# HedgeCapitalPro — Setup & Deployment Guide

## Stack
- **Frontend**: HTML5, CSS3, Vanilla JS (ES modules)
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, Storage)
- **Payments**: Manual crypto + NOWPayments
- **Edge Functions**: Deno (Supabase)
- **Hosting**: Any static host (Render, Netlify, Vercel, GitHub Pages)

---

## 1. Supabase Setup

### 1a. Create project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Save your **Project URL** and **anon key** (already set in all files)

### 1b. Run database migrations
In the Supabase **SQL Editor**, run in order:

```sql
-- Step 1: Schema + tables + functions
-- Paste contents of: schema.sql

-- Step 2: Row Level Security policies
-- Paste contents of: policies.sql
```

### 1c. Create Storage buckets
In **Storage** → New Bucket (run each):

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents',  'kyc-documents',  false);
INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-proofs', 'deposit-proofs', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('team-avatars',   'team-avatars',   true);
```

Then apply the storage policies from the comments at the bottom of `policies.sql`.

---

## 2. Admin Account Setup

1. Register via the app UI using email: `admin@hedgecapitalpro.com`
2. Confirm the email (check inbox)
3. In Supabase SQL Editor, promote to admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@hedgecapitalpro.com';
```

4. Login to `admin.html` with:
   - **Username**: `admin`
   - **Password**: `admin123` (change immediately via Security panel)

---

## 3. Deploy Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref egedzwcezqksjeozzttd
```

Deploy both functions:
```bash
supabase functions deploy process-daily-profits
supabase functions deploy nowpayments-webhook
```

Set required secrets:
```bash
supabase secrets set CRON_SECRET=your-random-secret-here
supabase secrets set NOWPAYMENTS_IPN_SECRET=your-nowpayments-ipn-secret
```

---

## 4. Schedule Daily Profit Payouts

In Supabase SQL Editor, enable `pg_cron` and schedule the payout:

```sql
-- Enable extension (once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at midnight UTC
SELECT cron.schedule(
  'daily-profit-payout',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url    := 'https://egedzwcezqksjeozzttd.supabase.co/functions/v1/process-daily-profits',
    headers := '{"Authorization": "Bearer your-cron-secret-here"}'::jsonb
  );
  $$
);
```

To run manually (admin panel → Dashboard → "Run Profit Payout" button also works).

---

## 5. NOWPayments Setup (optional)

1. Create account at [nowpayments.io](https://nowpayments.io)
2. Get your **API Key** and **IPN Secret**
3. In Admin Panel → System Settings → enter API keys
4. Set webhook URL in NOWPayments dashboard:
   ```
   https://egedzwcezqksjeozzttd.supabase.co/functions/v1/nowpayments-webhook
   ```
5. Enable NOWPayments toggle in Admin → System Settings

---

## 6. Deploy Frontend

### Render (recommended)
1. Push all files to a GitHub repo
2. Render → New → Static Site
3. Build command: *(leave blank)*
4. Publish directory: `.` (root)
5. Add redirect rule for 404:
   ```
   /*    /404.html    404
   ```

### Netlify
```toml
# netlify.toml
[[redirects]]
  from   = "/*"
  to     = "/404.html"
  status = 404
```

### Vercel
```json
// vercel.json
{
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/404.html", "status": 404 }
  ]
}
```

---

## 7. API Keys Reference

| Key | Location | Used For |
|-----|----------|----------|
| Supabase URL | All HTML files (hardcoded) | Database + Auth |
| Supabase Anon Key | All HTML files (hardcoded) | Public API access |
| Supabase Service Role Key | Edge Functions only (env var) | Admin DB operations |
| NOWPayments API Key | Admin Panel → System Settings | Payment invoice creation |
| NOWPayments IPN Secret | Supabase secret + Admin Panel | Webhook verification |
| Cron Secret | Supabase secret | Edge function auth |

> ⚠️ **Never expose the Service Role Key in frontend code.** It bypasses all RLS policies.

---

## 8. File Structure

```
/
├── index.html              # Landing page
├── login.html              # Client login
├── register.html           # Registration
├── forgot-password.html    # Password reset request
├── reset-password.html     # Password reset form
├── dashboard.html          # Client portal
├── admin.html              # Admin super panel
├── about.html              # About page
├── contact.html            # Contact + consultation form
├── article.html            # Article reader
├── 404.html                # Not found page
├── styles.css              # Global design system
├── auth.js                 # Auth layer (Supabase Auth wrapper)
├── api.js                  # Supabase data layer
├── ui.js                   # Shared UI utilities (toast, modal, etc.)
├── main.js                 # App initialization
├── i18n.js                 # Translation engine (EN/FR/ES/DE/ZH/AR)
├── payment.js              # Payment controller (manual + NOWPayments)
├── nowpayments.js          # NOWPayments API wrapper
├── schema.sql              # Database schema + seed data
├── policies.sql            # Row Level Security policies
└── supabase/
    └── functions/
        ├── process-daily-profits/
        │   └── index.ts    # Daily ROI payout cron
        └── nowpayments-webhook/
            └── index.ts    # NOWPayments IPN handler
```

---

## 9. Environment Checklist

- [ ] `schema.sql` executed in Supabase SQL Editor
- [ ] `policies.sql` executed in Supabase SQL Editor
- [ ] Storage buckets created (kyc-documents, deposit-proofs, team-avatars)
- [ ] Admin account registered + promoted to `role = 'admin'`
- [ ] Admin password changed from default
- [ ] Edge functions deployed
- [ ] `CRON_SECRET` set as Supabase secret
- [ ] Daily profit cron scheduled via `pg_cron`
- [ ] NOWPayments keys entered in Admin → System Settings (if using)
- [ ] Webhook URL set in NOWPayments dashboard (if using)
- [ ] Custom domain configured on hosting platform
- [ ] 404 redirect rule added on hosting platform

---

## 10. Default Credentials (change immediately)

| Access | Default |
|--------|---------|
| Admin panel username | `admin` |
| Admin panel password | `admin123` |
| Demo user email | `demo@hedgecapitalpro.com` |

---

## 11. Languages Supported

English, Français, Español, Deutsch, 中文, العربية (RTL)

Language auto-detected from browser. User preference persisted in `localStorage`.

---

## 12. Support

For technical issues, open a ticket via the admin panel or contact the development team.
