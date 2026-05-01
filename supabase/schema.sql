-- ============================================================
--  HedgeCapitalPro — Production Database Schema
--  Supabase / PostgreSQL
--  Phase 1 — Foundation
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ───────────────────────────────────────────────────

CREATE TYPE user_role        AS ENUM ('user', 'admin');
CREATE TYPE kyc_status       AS ENUM ('not_submitted', 'pending', 'approved', 'rejected');
CREATE TYPE tx_type          AS ENUM ('deposit', 'withdrawal', 'profit', 'referral_bonus', 'admin_credit', 'admin_debit');
CREATE TYPE tx_status        AS ENUM ('pending', 'confirmed', 'processing', 'completed', 'rejected', 'credited');
CREATE TYPE invest_status    AS ENUM ('active', 'paused', 'cancelled');
CREATE TYPE ticket_status    AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE referral_status  AS ENUM ('pending', 'paid');
CREATE TYPE content_section  AS ENUM ('hero', 'services', 'values', 'about', 'contact', 'footer', 'articles', 'dashboard', 'team');

-- ============================================================
--  TABLE: profiles
--  One-to-one with auth.users. Created on registration.
-- ============================================================
CREATE TABLE public.profiles (
  id                UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name        TEXT          NOT NULL,
  last_name         TEXT          NOT NULL,
  email             TEXT          NOT NULL UNIQUE,
  username          TEXT          NOT NULL UNIQUE,
  phone             TEXT,
  country           TEXT,
  avatar_url        TEXT,

  -- Financial state
  balance           NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_invested    NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_invested >= 0),
  total_profit      NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_profit >= 0),
  total_withdrawn   NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_withdrawn >= 0),

  -- Referral
  referral_code     TEXT          UNIQUE,
  referred_by       TEXT,                              -- stores referral_code of referrer

  -- Access control
  role              user_role     NOT NULL DEFAULT 'user',
  is_suspended      BOOLEAN       NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,

  -- KYC
  kyc_status        kyc_status    NOT NULL DEFAULT 'not_submitted',
  kyc_notes         TEXT,

  -- Meta
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Auto-set updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-generate referral code on insert
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code = UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_referral
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- ============================================================
--  TABLE: investment_plans
--  Admin-controlled. Fetched dynamically — never hardcoded.
-- ============================================================
CREATE TABLE public.investment_plans (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT          NOT NULL,
  min_amount      NUMERIC(18,2) NOT NULL CHECK (min_amount > 0),
  max_amount      NUMERIC(18,2) NOT NULL CHECK (max_amount > min_amount),
  roi_percentage  NUMERIC(5,2)  NOT NULL CHECK (roi_percentage > 0),  -- daily %
  description     TEXT,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  sort_order      INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_plans_updated
  BEFORE UPDATE ON public.investment_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default plans (admin can edit/delete these)
INSERT INTO public.investment_plans (name, min_amount, max_amount, roi_percentage, description, sort_order)
VALUES
  ('Starter',  100,    999,    5.00,  'Entry-level plan for new investors. Steady daily returns.',     1),
  ('Bronze',   1000,   4999,   7.00,  'Intermediate plan with enhanced daily ROI.',                   2),
  ('Silver',   5000,   19999,  10.00, 'Most popular plan. Strong daily returns with priority support.',3),
  ('Gold',     20000,  49999,  15.00, 'High-performance plan for serious investors.',                  4),
  ('Platinum', 50000,  9999999,20.00, 'Elite plan with maximum daily ROI and private advisor.',        5);

-- ============================================================
--  TABLE: investments
--  Continuous model — no duration, no expiry.
-- ============================================================
CREATE TABLE public.investments (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id          UUID          NOT NULL REFERENCES public.investment_plans(id),
  amount           NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  total_earned     NUMERIC(18,2) NOT NULL DEFAULT 0,
  last_payout_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  status           invest_status NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investments_user   ON public.investments(user_id);
CREATE INDEX idx_investments_status ON public.investments(status);

CREATE TRIGGER trg_investments_updated
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: transactions
--  All money movement: deposits, withdrawals, profits, credits.
-- ============================================================
CREATE TABLE public.transactions (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type             tx_type       NOT NULL,
  method           TEXT          NOT NULL,              -- e.g. "Bitcoin (BTC)", "Silver Plan", "Admin"
  amount           NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  status           tx_status     NOT NULL DEFAULT 'pending',
  investment_id    UUID          REFERENCES public.investments(id) ON DELETE SET NULL,
  payment_provider      TEXT        NOT NULL DEFAULT 'manual', -- 'manual' | 'nowpayments'
  nowpayments_id        TEXT,                                -- NOWPayments payment ID
  nowpayments_status    TEXT,                                -- raw status from NOWPayments
  screenshot_url        TEXT,                                -- deposit proof (manual only)
  wallet_address        TEXT,                                -- withdrawal destination
  admin_notes           TEXT,                                -- admin review notes
  processed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user     ON public.transactions(user_id);
CREATE INDEX idx_transactions_type     ON public.transactions(type);
CREATE INDEX idx_transactions_status   ON public.transactions(status);
CREATE INDEX idx_transactions_provider ON public.transactions(payment_provider);
CREATE INDEX idx_transactions_np_id    ON public.transactions(nowpayments_id) WHERE nowpayments_id IS NOT NULL;

CREATE TRIGGER trg_transactions_updated
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: crypto_wallets
--  Admin-managed deposit wallet addresses.
-- ============================================================
CREATE TABLE public.crypto_wallets (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  coin_name   TEXT        NOT NULL,        -- "Bitcoin"
  symbol      TEXT        NOT NULL,        -- "BTC"
  network     TEXT        NOT NULL,        -- "Bitcoin Network"
  address     TEXT        NOT NULL,
  icon        TEXT,                        -- emoji or image URL
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_wallets_updated
  BEFORE UPDATE ON public.crypto_wallets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default wallets (admin can edit)
INSERT INTO public.crypto_wallets (coin_name, symbol, network, address, icon, sort_order)
VALUES
  ('Bitcoin',  'BTC',       'Bitcoin Network', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', '₿', 1),
  ('Ethereum', 'ETH',       'ERC20',           '0x742d35Cc6634C0532925a3b8D4C9C5Eda8a2Ba2f', 'Ξ', 2),
  ('Tether',   'USDT-TRC20','TRC20',           'TYsbWxNnyJLrGya2bLFzEX5TNGS3T9qsL2',         '₮', 3),
  ('Tether',   'USDT-ERC20','ERC20',           '0x742d35Cc6634C0532925a3b8D4C9C5Eda8a2Ba2f', '₮', 4);

-- ============================================================
--  TABLE: kyc_submissions
--  ID document uploads for withdrawal gating.
-- ============================================================
CREATE TABLE public.kyc_submissions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id_front_url   TEXT        NOT NULL,
  id_back_url    TEXT        NOT NULL,
  status         kyc_status  NOT NULL DEFAULT 'pending',
  admin_notes    TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID        REFERENCES public.profiles(id)
);

CREATE INDEX idx_kyc_user   ON public.kyc_submissions(user_id);
CREATE INDEX idx_kyc_status ON public.kyc_submissions(status);

-- ============================================================
--  TABLE: user_sessions
--  Login history for admin audit + security.
-- ============================================================
CREATE TABLE public.user_sessions (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_address   TEXT,
  country      TEXT,
  city         TEXT,
  device_info  TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON public.user_sessions(user_id);

-- ============================================================
--  TABLE: support_tickets
--  User support system.
-- ============================================================
CREATE TABLE public.support_tickets (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject        TEXT          NOT NULL,
  message        TEXT          NOT NULL,
  status         ticket_status NOT NULL DEFAULT 'open',
  admin_response TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_user   ON public.support_tickets(user_id);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);

CREATE TRIGGER trg_tickets_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: referrals
--  Tracks referral relationships and commissions.
-- ============================================================
CREATE TABLE public.referrals (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id       UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id       UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_amount NUMERIC(18,2)   NOT NULL DEFAULT 0,
  status            referral_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);

-- ============================================================
--  TABLE: team_members
--  Displayed on landing page. Admin-managed.
-- ============================================================
CREATE TABLE public.team_members (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  bio         TEXT,
  image_url   TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_team_updated
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
--  TABLE: site_content
--  Key-value CMS. Admin edits via structured forms only.
-- ============================================================
CREATE TABLE public.site_content (
  id          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT            NOT NULL UNIQUE,
  value       TEXT            NOT NULL,
  section     content_section NOT NULL,
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_by  UUID            REFERENCES public.profiles(id)
);

CREATE TRIGGER trg_content_updated
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default site content
INSERT INTO public.site_content (key, value, section) VALUES
  ('hero_eyebrow',     'Financial Consulting & Asset Management',                           'hero'),
  ('hero_title_line',  'Unlock your financial potential with',                              'hero'),
  ('hero_words',       'expert guidance,strategic insights,personalized advice,proven strategies,comprehensive planning', 'hero'),
  ('hero_subtitle',    'Premier financial consulting and asset management services tailored to your goals, risk profile, and long-term vision.', 'hero'),
  ('about_headline',   'Trusted experts with years of experience and industry accreditations', 'about'),
  ('about_text',       'At HedgeCapitalPro, we are dedicated to guiding you on your financial journey with expertise, integrity, and a personalized approach.', 'about'),
  ('contact_phone',    '1-800-HEDGEPRO',                                                   'contact'),
  ('contact_email',    'contact@hedgecapitalpro.com',                                      'contact'),
  ('contact_address',  'New York, NY 10004',                                               'contact'),
  ('contact_subtitle', 'Drop your details and one of our senior consultants will reach out within one business day.', 'contact'),
  ('footer_tagline',   'Building wealth, securing futures. Trusted financial consulting firm providing expert guidance and personalized solutions.', 'footer'),
  ('footer_copyright', '© 2025 HedgeCapitalPro. All rights reserved.',                    'footer'),
  ('company_name',     'HedgeCapitalPro',                                                  'hero'),
  ('company_tagline',  'Building wealth, securing futures.',                               'hero');

-- ============================================================
--  TABLE: settings
--  System toggles and configuration. Admin-only.
-- ============================================================
CREATE TABLE public.settings (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT        NOT NULL UNIQUE,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_settings_updated
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('animations_enabled',    'true',  'Enable scroll + entrance animations on landing page'),
  ('live_chat_enabled',     'false', 'Show Tawk.to chat widget'),
  ('captcha_enabled',       'false', 'Require hCaptcha on registration and contact forms'),
  ('maintenance_mode',      'false', 'Put site into maintenance mode (redirects to 503)'),
  ('referral_commission',   '5',     'Referral commission percentage (%)'),
  ('min_withdrawal',        '50',    'Minimum withdrawal amount in USD'),
  ('withdrawal_fee',        '2',     'Withdrawal processing fee (%)'),
  ('nowpayments_enabled',   'false', 'Enable NOWPayments crypto gateway'),
  ('nowpayments_api_key',   '',      'NOWPayments API key (keep secret)'),
  ('nowpayments_ipn_secret','',      'NOWPayments IPN secret for webhook verification'),
  ('nowpayments_sandbox',   'true',  'Use NOWPayments sandbox (set false in production)'),
  ('profit_payout_hour',    '0',     'Hour (UTC) to run daily profit payouts (0-23)');

-- ============================================================
--  FUNCTION: handle_new_user
--  Fires on auth.users INSERT → creates profile row automatically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    username,
    phone,
    country,
    referred_by
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username',   ''),
    COALESCE(NEW.raw_user_meta_data->>'phone',      ''),
    COALESCE(NEW.raw_user_meta_data->>'country',    ''),
    COALESCE(NEW.raw_user_meta_data->>'referred_by','')
  );
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
--  FUNCTION: process_daily_profits
--  Called by Supabase Edge Function (cron) once per day.
--  Applies ROI to all active investments.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_daily_profits()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  inv           RECORD;
  plan          RECORD;
  profit_amount NUMERIC(18,2);
  payout_count  INTEGER := 0;
BEGIN
  FOR inv IN
    SELECT i.*, p.roi_percentage
    FROM public.investments i
    JOIN public.investment_plans p ON p.id = i.plan_id
    WHERE i.status = 'active'
      AND i.last_payout_at < (NOW() - INTERVAL '23 hours')
  LOOP
    profit_amount := ROUND(inv.amount * (inv.roi_percentage / 100), 2);

    -- Credit user balance
    UPDATE public.profiles
    SET
      balance      = balance + profit_amount,
      total_profit = total_profit + profit_amount
    WHERE id = inv.user_id;

    -- Update investment earnings
    UPDATE public.investments
    SET
      total_earned  = total_earned + profit_amount,
      last_payout_at = NOW()
    WHERE id = inv.id;

    -- Log transaction
    INSERT INTO public.transactions (
      user_id, type, method, amount, status, investment_id, processed_at
    ) VALUES (
      inv.user_id, 'profit',
      (SELECT name FROM public.investment_plans WHERE id = inv.plan_id) || ' Plan',
      profit_amount, 'credited', inv.id, NOW()
    );

    payout_count := payout_count + 1;
  END LOOP;

  RETURN json_build_object('payouts_processed', payout_count, 'run_at', NOW());
END;
$$;

-- ============================================================
--  FUNCTION: approve_deposit
--  Admin calls this to confirm a deposit → credits user balance.
-- ============================================================
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

  -- Credit balance
  UPDATE public.profiles
  SET balance = balance + tx.amount
  WHERE id = tx.user_id;

  -- Mark confirmed
  UPDATE public.transactions
  SET
    status      = 'confirmed',
    admin_notes = p_notes,
    processed_at = NOW()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
--  FUNCTION: approve_withdrawal
--  Admin confirms a withdrawal request → marks completed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_transaction_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tx RECORD;
BEGIN
  SELECT * INTO tx FROM public.transactions
  WHERE id = p_transaction_id AND type = 'withdrawal' AND status = 'processing';

  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.transactions
  SET
    status       = 'completed',
    admin_notes  = p_notes,
    processed_at = NOW()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
--  FUNCTION: reject_transaction
--  Admin rejects deposit or withdrawal → refunds if withdrawal.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_transaction(
  p_transaction_id UUID,
  p_admin_id       UUID,
  p_notes          TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tx RECORD;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Refund balance if withdrawal was rejected
  IF tx.type = 'withdrawal' AND tx.status = 'processing' THEN
    UPDATE public.profiles
    SET
      balance          = balance + tx.amount,
      total_withdrawn  = total_withdrawn - tx.amount
    WHERE id = tx.user_id;
  END IF;

  UPDATE public.transactions
  SET
    status       = 'rejected',
    admin_notes  = p_notes,
    processed_at = NOW()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
--  FUNCTION: admin_adjust_balance
--  Admin can manually credit or debit a user's balance.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id  UUID,
  p_amount   NUMERIC,
  p_type     TEXT,   -- 'credit' or 'debit'
  p_reason   TEXT,
  p_admin_id UUID
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tx_type_val tx_type;
  final_amount NUMERIC(18,2) := ABS(p_amount);
BEGIN
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

-- ============================================================
--  STORAGE BUCKETS (run via Supabase dashboard or migration)
-- ============================================================
-- NOTE: Execute these in the Supabase SQL editor after enabling Storage.
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-proofs', 'deposit-proofs', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('team-avatars', 'team-avatars', true);
--
-- ============================================================
