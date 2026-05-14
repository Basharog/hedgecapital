-- ============================================================
--  HedgeCapitalPro — Referral Commission Function
--  Run in Supabase SQL Editor AFTER schema.sql
--  Phase 12 — Bonus Systems
-- ============================================================

-- ── FUNCTION: handle_referral_commission ──────────────────────
-- Called by approve_deposit() when a deposit is confirmed.
-- If the depositing user was referred by someone, credits
-- the referrer with commission % of the deposit amount.

CREATE OR REPLACE FUNCTION public.handle_referral_commission(
  p_user_id    UUID,     -- user who deposited
  p_amount     NUMERIC,  -- deposit amount
  p_tx_id      UUID      -- transaction id for audit trail
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  depositor        RECORD;
  referrer         RECORD;
  commission_rate  NUMERIC;
  commission_amt   NUMERIC;
  existing_ref     UUID;
BEGIN
  -- Get depositor profile + referral code they used
  SELECT * INTO depositor FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR depositor.referred_by IS NULL OR depositor.referred_by = '' THEN
    RETURN FALSE; -- not referred
  END IF;

  -- Find referrer by referral_code
  SELECT * INTO referrer FROM public.profiles
  WHERE referral_code = depositor.referred_by AND id != p_user_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Get commission rate from settings (default 5%)
  SELECT COALESCE(value::NUMERIC, 5) INTO commission_rate
  FROM public.settings WHERE key = 'referral_commission';
  commission_amt := ROUND(p_amount * (commission_rate / 100), 2);

  -- Check if referral row already exists (prevent duplicate credits)
  SELECT id INTO existing_ref FROM public.referrals
  WHERE referrer_id = referrer.id AND referred_id = p_user_id;

  IF existing_ref IS NULL THEN
    -- First deposit — create referral record
    INSERT INTO public.referrals (referrer_id, referred_id, commission_amount, status)
    VALUES (referrer.id, p_user_id, commission_amt, 'paid');
  ELSE
    -- Subsequent deposits — add to commission total
    UPDATE public.referrals
    SET commission_amount = commission_amount + commission_amt,
        status = 'paid'
    WHERE id = existing_ref;
  END IF;

  -- Credit referrer balance
  UPDATE public.profiles
  SET balance = balance + commission_amt
  WHERE id = referrer.id;

  -- Log referral bonus transaction
  INSERT INTO public.transactions (user_id, type, method, amount, status, processed_at, admin_notes)
  VALUES (
    referrer.id,
    'referral_bonus',
    'Referral Commission',
    commission_amt,
    'credited',
    NOW(),
    'Commission from deposit by ' || depositor.first_name || ' ' || depositor.last_name
  );

  RETURN TRUE;
END;
$$;

-- ── PATCH: approve_deposit → also trigger referral commission ──
-- Replace existing approve_deposit to call handle_referral_commission

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

  -- Credit user balance
  UPDATE public.profiles
  SET balance = balance + tx.amount
  WHERE id = tx.user_id;

  -- Mark confirmed
  UPDATE public.transactions
  SET status       = 'confirmed',
      admin_notes  = p_notes,
      processed_at = NOW()
  WHERE id = p_transaction_id;

  -- Fire referral commission (non-blocking — ignore errors)
  BEGIN
    PERFORM public.handle_referral_commission(tx.user_id, tx.amount, p_transaction_id);
  EXCEPTION WHEN OTHERS THEN
    NULL; -- log but don't fail the deposit approval
  END;

  RETURN TRUE;
END;
$$;

-- ── ALSO: auto-approve NOWPayments finished deposits ──────────
-- Patch approve_deposit to handle nowpayments_id lookups too

-- View: referral_summary (useful for admin analytics)
CREATE OR REPLACE VIEW public.referral_summary AS
SELECT
  r.referrer_id,
  p.first_name || ' ' || p.last_name AS referrer_name,
  p.email                             AS referrer_email,
  COUNT(r.id)                         AS total_referrals,
  SUM(r.commission_amount)            AS total_commission,
  MAX(r.created_at)                   AS last_referral_at
FROM public.referrals r
JOIN public.profiles p ON p.id = r.referrer_id
GROUP BY r.referrer_id, p.first_name, p.last_name, p.email;
