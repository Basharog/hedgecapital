-- ============================================================
--  HedgeCapitalPro — Referral Commission Function
--  Run in Supabase SQL Editor AFTER schema.sql AND migration_001.sql
--  Phase 12 — Bonus Systems
--
--  NOTE: approve_deposit is intentionally NOT redefined here.
--  It is defined and maintained in migration_001.sql which already
--  calls handle_referral_commission() internally. Redefining it
--  here would overwrite the bypass flag patch and break investments.
-- ============================================================

-- ── FUNCTION: handle_referral_commission ──────────────────────
-- Called by approve_deposit() when a deposit is confirmed.
-- If the depositing user was referred by someone, credits
-- the referrer with commission % of the deposit amount.
-- Safe to call multiple times — uses INSERT ... ON CONFLICT
-- to prevent duplicate referral rows; only adds commission on
-- subsequent deposits to the existing row.

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
  existing_ref_id  UUID;
BEGIN
  -- Get depositor profile + referral code they used at registration
  SELECT * INTO depositor FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR depositor.referred_by IS NULL OR TRIM(depositor.referred_by) = '' THEN
    RETURN FALSE; -- not referred, nothing to do
  END IF;

  -- Find referrer by their referral_code
  SELECT * INTO referrer
  FROM public.profiles
  WHERE referral_code = UPPER(TRIM(depositor.referred_by))
    AND id != p_user_id; -- cannot refer yourself
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Get commission rate from settings (default 5%)
  SELECT COALESCE(NULLIF(value, '')::NUMERIC, 5) INTO commission_rate
  FROM public.settings WHERE key = 'referral_commission';
  commission_rate := COALESCE(commission_rate, 5);
  commission_amt  := ROUND(p_amount * (commission_rate / 100.0), 2);

  IF commission_amt <= 0 THEN RETURN FALSE; END IF;

  -- Check if referral row already exists
  SELECT id INTO existing_ref_id
  FROM public.referrals
  WHERE referrer_id = referrer.id AND referred_id = p_user_id;

  IF existing_ref_id IS NULL THEN
    -- First deposit — create referral record
    INSERT INTO public.referrals (referrer_id, referred_id, commission_amount, status)
    VALUES (referrer.id, p_user_id, commission_amt, 'paid')
    ON CONFLICT (referrer_id, referred_id) DO UPDATE
      SET commission_amount = referrals.commission_amount + EXCLUDED.commission_amount,
          status = 'paid';
  ELSE
    -- Subsequent deposit — add to commission total
    UPDATE public.referrals
    SET commission_amount = commission_amount + commission_amt,
        status = 'paid'
    WHERE id = existing_ref_id;
  END IF;

  -- Credit referrer balance using bypass flag
  PERFORM set_config('hcp.bypass_balance_check', 'true', true);

  UPDATE public.profiles
  SET balance = balance + commission_amt
  WHERE id = referrer.id;

  -- Log referral bonus transaction for the referrer
  INSERT INTO public.transactions (
    user_id, type, method, amount, status, processed_at, admin_notes
  ) VALUES (
    referrer.id,
    'referral_bonus',
    'Referral Commission',
    commission_amt,
    'credited',
    NOW(),
    'Commission from deposit by ' || depositor.first_name || ' ' || depositor.last_name
      || ' (Deposit ID: ' || p_tx_id::TEXT || ')'
  );

  RETURN TRUE;
END;
$$;

-- ── VIEW: referral_summary (admin analytics) ─────────────────
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
