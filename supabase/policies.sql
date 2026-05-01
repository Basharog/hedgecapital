-- ============================================================
--  HedgeCapitalPro — Row Level Security Policies
--  Supabase / PostgreSQL
--  Phase 1 — Security Foundation
-- ============================================================
--  RUN THIS AFTER schema.sql
--  Order matters: enable RLS first, then create policies.
-- ============================================================


-- ── HELPER: is_admin() ──────────────────────────────────────
-- Reusable function to check if the calling user is an admin.
-- Used inside policy definitions to keep them readable.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


-- ============================================================
--  TABLE: profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile only
CREATE POLICY "profiles: user reads own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own non-sensitive fields
CREATE POLICY "profiles: user updates own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-promoting to admin via update
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- Admins can read all profiles
CREATE POLICY "profiles: admin reads all"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Admins can update all profiles (balance, role, suspension, kyc_status)
CREATE POLICY "profiles: admin updates all"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Profile is created automatically by handle_new_user trigger (SECURITY DEFINER)
-- No INSERT policy needed for anon/authenticated — trigger handles it


-- ============================================================
--  TABLE: investment_plans
-- ============================================================
ALTER TABLE public.investment_plans ENABLE ROW LEVEL SECURITY;

-- Everyone (including unauthenticated visitors) can read active plans
-- Needed so landing page can show plans without login
CREATE POLICY "plans: public reads active"
  ON public.investment_plans FOR SELECT
  USING (is_active = TRUE);

-- Admins can read all plans (including inactive)
CREATE POLICY "plans: admin reads all"
  ON public.investment_plans FOR SELECT
  USING (public.is_admin());

-- Admins can insert / update / delete plans
CREATE POLICY "plans: admin insert"
  ON public.investment_plans FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "plans: admin update"
  ON public.investment_plans FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "plans: admin delete"
  ON public.investment_plans FOR DELETE
  USING (public.is_admin());


-- ============================================================
--  TABLE: investments
-- ============================================================
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Users read their own investments
CREATE POLICY "investments: user reads own"
  ON public.investments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create investments (balance check is in app logic + function)
CREATE POLICY "investments: user inserts own"
  ON public.investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own investments (e.g. cancel)
CREATE POLICY "investments: user updates own"
  ON public.investments FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins read all investments
CREATE POLICY "investments: admin reads all"
  ON public.investments FOR SELECT
  USING (public.is_admin());

-- Admins can update all (pause/cancel, adjust total_earned)
CREATE POLICY "investments: admin updates all"
  ON public.investments FOR UPDATE
  USING (public.is_admin());


-- ============================================================
--  TABLE: transactions
-- ============================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users read their own transactions
CREATE POLICY "transactions: user reads own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own transactions (deposit, withdrawal requests)
CREATE POLICY "transactions: user inserts own"
  ON public.transactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    -- Users may only submit deposit or withdrawal — not credit themselves
    AND type IN ('deposit', 'withdrawal')
  );

-- Users cannot update transactions (admin only)
-- Admins read all transactions
CREATE POLICY "transactions: admin reads all"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

-- Admins can update status, notes, processed_at
CREATE POLICY "transactions: admin updates all"
  ON public.transactions FOR UPDATE
  USING (public.is_admin());

-- Admins can insert (profit credits, admin adjustments done via SECURITY DEFINER functions)
CREATE POLICY "transactions: admin inserts"
  ON public.transactions FOR INSERT
  WITH CHECK (public.is_admin());


-- ============================================================
--  TABLE: crypto_wallets
-- ============================================================
ALTER TABLE public.crypto_wallets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active wallets (needed for deposit page)
CREATE POLICY "wallets: auth reads active"
  ON public.crypto_wallets FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- Admins read all wallets
CREATE POLICY "wallets: admin reads all"
  ON public.crypto_wallets FOR SELECT
  USING (public.is_admin());

-- Admins full control
CREATE POLICY "wallets: admin insert"
  ON public.crypto_wallets FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "wallets: admin update"
  ON public.crypto_wallets FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "wallets: admin delete"
  ON public.crypto_wallets FOR DELETE
  USING (public.is_admin());


-- ============================================================
--  TABLE: kyc_submissions
-- ============================================================
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- Users read their own KYC submissions
CREATE POLICY "kyc: user reads own"
  ON public.kyc_submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can submit KYC (one active submission per user enforced in app)
CREATE POLICY "kyc: user inserts own"
  ON public.kyc_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins read all KYC submissions
CREATE POLICY "kyc: admin reads all"
  ON public.kyc_submissions FOR SELECT
  USING (public.is_admin());

-- Admins can update (approve, reject, add notes)
CREATE POLICY "kyc: admin updates all"
  ON public.kyc_submissions FOR UPDATE
  USING (public.is_admin());


-- ============================================================
--  TABLE: user_sessions
-- ============================================================
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can see their own login history
CREATE POLICY "sessions: user reads own"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Sessions are inserted by the app (authenticated users only)
CREATE POLICY "sessions: user inserts own"
  ON public.user_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins read all sessions (audit trail)
CREATE POLICY "sessions: admin reads all"
  ON public.user_sessions FOR SELECT
  USING (public.is_admin());

-- Admins can delete suspicious session records
CREATE POLICY "sessions: admin deletes"
  ON public.user_sessions FOR DELETE
  USING (public.is_admin());


-- ============================================================
--  TABLE: support_tickets
-- ============================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users read/create their own tickets
CREATE POLICY "tickets: user reads own"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tickets: user inserts own"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins read all tickets and can update (respond, change status)
CREATE POLICY "tickets: admin reads all"
  ON public.support_tickets FOR SELECT
  USING (public.is_admin());

CREATE POLICY "tickets: admin updates all"
  ON public.support_tickets FOR UPDATE
  USING (public.is_admin());


-- ============================================================
--  TABLE: referrals
-- ============================================================
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users see referrals where they are the referrer
CREATE POLICY "referrals: user reads own"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- Referral rows created by app logic (SECURITY DEFINER function)
-- No user INSERT policy — prevents self-referral manipulation

-- Admins read all
CREATE POLICY "referrals: admin reads all"
  ON public.referrals FOR SELECT
  USING (public.is_admin());

CREATE POLICY "referrals: admin updates all"
  ON public.referrals FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "referrals: admin inserts"
  ON public.referrals FOR INSERT
  WITH CHECK (public.is_admin());


-- ============================================================
--  TABLE: team_members
-- ============================================================
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Public can read active team members (landing page, no auth needed)
CREATE POLICY "team: public reads active"
  ON public.team_members FOR SELECT
  USING (is_active = TRUE);

-- Admins full control
CREATE POLICY "team: admin reads all"
  ON public.team_members FOR SELECT
  USING (public.is_admin());

CREATE POLICY "team: admin insert"
  ON public.team_members FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "team: admin update"
  ON public.team_members FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "team: admin delete"
  ON public.team_members FOR DELETE
  USING (public.is_admin());


-- ============================================================
--  TABLE: site_content
-- ============================================================
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Public can read all site content (needed to render landing page)
CREATE POLICY "content: public reads all"
  ON public.site_content FOR SELECT
  USING (TRUE);

-- Only admins can modify content
CREATE POLICY "content: admin updates"
  ON public.site_content FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "content: admin inserts"
  ON public.site_content FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "content: admin deletes"
  ON public.site_content FOR DELETE
  USING (public.is_admin());


-- ============================================================
--  TABLE: settings
-- ============================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read non-sensitive settings
-- (needed for checking if animations/chat are enabled)
CREATE POLICY "settings: auth reads"
  ON public.settings FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND key NOT IN ('nowpayments_api_key', 'nowpayments_ipn_secret') -- hide sensitive keys
  );

-- Admins read all settings including sensitive ones
CREATE POLICY "settings: admin reads all"
  ON public.settings FOR SELECT
  USING (public.is_admin());

-- Only admins can modify settings
CREATE POLICY "settings: admin updates"
  ON public.settings FOR UPDATE
  USING (public.is_admin());


-- ============================================================
--  STORAGE POLICIES
--  Run after creating storage buckets in Supabase dashboard.
-- ============================================================

-- kyc-documents bucket (private)
-- Users can upload their own KYC docs
-- CREATE POLICY "kyc storage: user upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own KYC docs
-- CREATE POLICY "kyc storage: user read own"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can read all KYC docs
-- CREATE POLICY "kyc storage: admin read all"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'kyc-documents' AND public.is_admin());

-- deposit-proofs bucket (private)
-- CREATE POLICY "deposits storage: user upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "deposits storage: admin read"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'deposit-proofs' AND public.is_admin());

-- team-avatars bucket (public read)
-- CREATE POLICY "team storage: public read"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'team-avatars');

-- CREATE POLICY "team storage: admin upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'team-avatars' AND public.is_admin());


-- ============================================================
--  SEED: Admin Account
--  After running schema + policies:
--  1. Register via the app UI with email: admin@hedgecapitalpro.com
--  2. Then run this to promote that user to admin:
--
--  UPDATE public.profiles
--  SET role = 'admin'
--  WHERE email = 'admin@hedgecapitalpro.com';
--
-- ============================================================
