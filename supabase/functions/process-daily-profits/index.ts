// ============================================================
//  process-daily-profits/index.ts
//  Supabase Edge Function — Daily ROI Payout
//
//  Called by pg_cron once per day (see README for setup).
//  Verifies CRON_SECRET header before executing.
//  Calls the process_daily_profits() SECURITY DEFINER RPC.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  try {
    // ── AUTH: verify cron secret ──────────────────────────────
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      return new Response('Server misconfiguration: CRON_SECRET not set', { status: 500 });
    }
    const authHeader = req.headers.get('Authorization') || '';
    const providedSecret = authHeader.replace('Bearer ', '').trim();
    if (providedSecret !== cronSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    // ── SUPABASE: use service role to bypass RLS ──────────────
    const supabaseUrl    = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Server misconfiguration: Supabase env vars not set', { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── RUN PAYOUT ────────────────────────────────────────────
    const { data, error } = await supabase.rpc('process_daily_profits');
    if (error) {
      console.error('[process-daily-profits] RPC error:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[process-daily-profits] Complete:', data);
    return new Response(JSON.stringify({ success: true, result: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[process-daily-profits] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
