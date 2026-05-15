-- ============================================================
--  HedgeCapitalPro — Migration 001
--  Run in Supabase SQL Editor (Dashboard → SQL Editor)
--  Safe to run multiple times (uses CREATE OR REPLACE + ON CONFLICT)
-- ============================================================

-- ── 1. Add tawkto_id setting key ─────────────────────────────
INSERT INTO public.settings (key, value, description)
VALUES ('tawkto_id', '', 'Tawk.to property ID for live chat (e.g. abc123def456/1234567890abcdef)')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Patch raise_if_balance_changed to allow SECURITY DEFINER bypass ──
-- Adds a transaction-scoped session variable check so server-side RPC
-- functions can update balance without hitting the direct-update guard.
CREATE OR REPLACE FUNCTION public.raise_if_balance_changed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance
     AND current_setting('role', true)              NOT IN ('service_role', 'supabase_admin')
     AND current_setting('hcp.bypass_balance_check', true) IS DISTINCT FROM 'true'
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin()
  THEN
    RAISE EXCEPTION 'Direct balance update not permitted. Use server functions.';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. create_investment RPC — atomic, user-callable, secure ─
CREATE OR REPLACE FUNCTION public.create_investment(
  p_user_id UUID,
  p_plan_id UUID,
  p_amount  NUMERIC
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile  RECORD;
  v_plan     RECORD;
  v_inv_id   UUID;
BEGIN
  -- Identity guard
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Cannot create investment for another user'; END IF;

  -- Lock the profile row to prevent concurrent race conditions
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND        THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_profile.is_suspended THEN RAISE EXCEPTION 'Account is suspended'; END IF;

  -- Fetch and validate plan
  SELECT * INTO v_plan
  FROM public.investment_plans
  WHERE id = p_plan_id AND is_active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Investment plan not found or inactive'; END IF;

  IF p_amount < v_plan.min_amount THEN
    RAISE EXCEPTION 'Amount $% is below the minimum $% for this plan', p_amount, v_plan.min_amount;
  END IF;
  IF p_amount > v_plan.max_amount THEN
    RAISE EXCEPTION 'Amount $% exceeds the maximum $% for this plan', p_amount, v_plan.max_amount;
  END IF;
  IF v_profile.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $%, Required: $%', v_profile.balance, p_amount;
  END IF;

  -- Allow balance update for this transaction only
  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  UPDATE public.profiles
  SET
    balance        = balance        - p_amount,
    total_invested = total_invested + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.investments (user_id, plan_id, amount, status)
  VALUES (p_user_id, p_plan_id, p_amount, 'active')
  RETURNING id INTO v_inv_id;

  RETURN json_build_object(
    'investment_id', v_inv_id,
    'amount',        p_amount,
    'plan_name',     v_plan.name,
    'roi_pct',       v_plan.roi_percentage,
    'new_balance',   v_profile.balance - p_amount,
    'new_invested',  v_profile.total_invested + p_amount
  );
END;
$$;

-- ── 4. submit_withdrawal RPC — atomic, user-callable, KYC-gated ──
CREATE OR REPLACE FUNCTION public.submit_withdrawal(
  p_user_id        UUID,
  p_method         TEXT,
  p_amount         NUMERIC,
  p_wallet_address TEXT
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile    RECORD;
  v_min_amount NUMERIC;
  v_tx_id      UUID;
BEGIN
  IF auth.uid() IS NULL   THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF auth.uid() != p_user_id THEN RAISE EXCEPTION 'Cannot withdraw for another user'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND            THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_profile.is_suspended   THEN RAISE EXCEPTION 'Account is suspended'; END IF;
  IF v_profile.kyc_status != 'approved' THEN
    RAISE EXCEPTION 'KYC verification required to withdraw';
  END IF;

  SELECT COALESCE(value::NUMERIC, 50) INTO v_min_amount
  FROM public.settings WHERE key = 'min_withdrawal';

  IF p_amount < v_min_amount THEN
    RAISE EXCEPTION 'Minimum withdrawal is $%', v_min_amount;
  END IF;
  IF v_profile.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $%', v_profile.balance;
  END IF;
  IF p_wallet_address IS NULL OR TRIM(p_wallet_address) = '' THEN
    RAISE EXCEPTION 'Wallet address is required';
  END IF;

  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  UPDATE public.profiles
  SET
    balance         = balance         - p_amount,
    total_withdrawn = total_withdrawn + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, method, amount, status, wallet_address)
  VALUES (p_user_id, 'withdrawal', p_method, p_amount, 'processing', TRIM(p_wallet_address))
  RETURNING id INTO v_tx_id;

  RETURN json_build_object(
    'transaction_id', v_tx_id,
    'amount',         p_amount,
    'method',         p_method,
    'new_balance',    v_profile.balance - p_amount,
    'new_withdrawn',  v_profile.total_withdrawn + p_amount
  );
END;
$$;

-- ── 5. Patch approve_deposit: add bypass flag + referral commission ──
CREATE OR REPLACE FUNCTION public.approve_deposit(
  p_transaction_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tx RECORD;
BEGIN
  SELECT * INTO tx FROM public.transactions
  WHERE id = p_transaction_id AND type = 'deposit' AND status = 'pending';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  UPDATE public.profiles SET balance = balance + tx.amount WHERE id = tx.user_id;

  UPDATE public.transactions
  SET status = 'confirmed', admin_notes = p_notes, processed_at = NOW()
  WHERE id = p_transaction_id;

  BEGIN
    PERFORM public.handle_referral_commission(tx.user_id, tx.amount, p_transaction_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN TRUE;
END;
$$;

-- ── 6. Patch approve_withdrawal: add bypass flag ──────────────
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_transaction_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE tx RECORD; BEGIN
  SELECT * INTO tx FROM public.transactions
  WHERE id = p_transaction_id AND type = 'withdrawal' AND status = 'processing';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.transactions
  SET status = 'completed', admin_notes = p_notes, processed_at = NOW()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

-- ── 7. Patch reject_transaction: refund uses bypass flag ──────
CREATE OR REPLACE FUNCTION public.reject_transaction(
  p_transaction_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE tx RECORD; BEGIN
  SELECT * INTO tx FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  IF tx.type = 'withdrawal' AND tx.status = 'processing' THEN
    UPDATE public.profiles
    SET
      balance         = balance         + tx.amount,
      total_withdrawn = GREATEST(0, total_withdrawn - tx.amount)
    WHERE id = tx.user_id;
  END IF;

  UPDATE public.transactions
  SET status = 'rejected', admin_notes = p_notes, processed_at = NOW()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

-- ── 8. Patch admin_adjust_balance: add bypass flag ────────────
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id  UUID,
  p_amount   NUMERIC,
  p_type     TEXT,
  p_reason   TEXT,
  p_admin_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tx_type_val  tx_type;
  final_amount NUMERIC(18,2) := ABS(p_amount);
BEGIN
  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  IF p_type = 'credit' THEN
    tx_type_val := 'admin_credit';
    UPDATE public.profiles SET balance = balance + final_amount WHERE id = p_user_id;
  ELSE
    tx_type_val := 'admin_debit';
    UPDATE public.profiles SET balance = GREATEST(0, balance - final_amount) WHERE id = p_user_id;
  END IF;

  INSERT INTO public.transactions (user_id, type, method, amount, status, admin_notes, processed_at)
  VALUES (p_user_id, tx_type_val, 'Admin Adjustment', final_amount, 'completed', p_reason, NOW());

  RETURN TRUE;
END;
$$;

-- ── 9. Patch process_daily_profits: add bypass flag ──────────
CREATE OR REPLACE FUNCTION public.process_daily_profits()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv           RECORD;
  profit_amount NUMERIC(18,2);
  payout_count  INTEGER := 0;
BEGIN
  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  FOR inv IN
    SELECT i.*, p.roi_percentage
    FROM public.investments i
    JOIN public.investment_plans p ON p.id = i.plan_id
    WHERE i.status = 'active'
      AND i.last_payout_at < (NOW() - INTERVAL '23 hours')
  LOOP
    profit_amount := ROUND(inv.amount * (inv.roi_percentage / 100), 2);

    UPDATE public.profiles
    SET balance = balance + profit_amount, total_profit = total_profit + profit_amount
    WHERE id = inv.user_id;

    UPDATE public.investments
    SET total_earned = total_earned + profit_amount, last_payout_at = NOW()
    WHERE id = inv.id;

    INSERT INTO public.transactions (user_id, type, method, amount, status, investment_id, processed_at)
    VALUES (
      inv.user_id, 'profit',
      (SELECT name FROM public.investment_plans WHERE id = inv.plan_id) || ' Plan',
      profit_amount, 'credited', inv.id, NOW()
    );

    payout_count := payout_count + 1;
  END LOOP;

  RETURN json_build_object('payouts_processed', payout_count, 'run_at', NOW());
END;
$$;

-- ── 10. Storage policies ──────────────────────────────────────
-- Run only after creating the buckets in Supabase Dashboard → Storage.
-- Skip any that already exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='kyc docs: user can upload own') THEN
    EXECUTE $p$CREATE POLICY "kyc docs: user can upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='kyc docs: user can view own') THEN
    EXECUTE $p$CREATE POLICY "kyc docs: user can view own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='kyc docs: admin can view all') THEN
    EXECUTE $p$CREATE POLICY "kyc docs: admin can view all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc-documents' AND public.is_admin())$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='deposit proofs: user can upload own') THEN
    EXECUTE $p$CREATE POLICY "deposit proofs: user can upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'deposit-proofs' AND (storage.foldername(name))[1] = auth.uid()::text)$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='deposit proofs: admin can view all') THEN
    EXECUTE $p$CREATE POLICY "deposit proofs: admin can view all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'deposit-proofs' AND public.is_admin())$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='team avatars: public read') THEN
    EXECUTE $p$CREATE POLICY "team avatars: public read" ON storage.objects FOR SELECT USING (bucket_id = 'team-avatars')$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='objects' AND policyname='team avatars: admin upload') THEN
    EXECUTE $p$CREATE POLICY "team avatars: admin upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'team-avatars' AND public.is_admin())$p$;
  END IF;
END;
$$;
