// ============================================================
//  supabase/functions/nowpayments-webhook/index.ts
//  HedgeCapitalPro — NOWPayments IPN Webhook Handler
//
//  NOWPayments calls this URL when payment status changes.
//  Set Webhook URL in NOWPayments dashboard to:
//    https://<project-ref>.supabase.co/functions/v1/nowpayments-webhook
//
//  Deploy:
//    supabase functions deploy nowpayments-webhook
// ============================================================

import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac }   from 'https://deno.land/std@0.177.0/node/crypto.ts';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IPN_SECRET           = Deno.env.get('NOWPAYMENTS_IPN_SECRET') || '';

// NOWPayments status → our internal tx_status
const STATUS_MAP: Record<string, string> = {
  waiting:        'pending',
  confirming:     'pending',
  confirmed:      'pending',
  sending:        'pending',
  partially_paid: 'pending',
  finished:       'confirmed',
  failed:         'rejected',
  refunded:       'rejected',
  expired:        'rejected',
};

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // ── READ BODY ─────────────────────────────────────────────
  const rawBody = await req.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // ── VERIFY HMAC SIGNATURE ─────────────────────────────────
  if (IPN_SECRET) {
    const signature = req.headers.get('x-nowpayments-sig') || '';

    // Sort keys alphabetically, stringify, HMAC-SHA512
    const sorted = Object.keys(body)
      .sort()
      .reduce((acc: Record<string, unknown>, k) => { acc[k] = body[k]; return acc; }, {});

    const expected = createHmac('sha512', IPN_SECRET)
      .update(JSON.stringify(sorted))
      .digest('hex');

    if (signature !== expected) {
      console.warn('[nowpayments-webhook] Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }
  }

  // ── EXTRACT PAYMENT DATA ──────────────────────────────────
  const paymentId      = String(body.payment_id   || '');
  const paymentStatus  = String(body.payment_status || '');
  const actuallyPaid   = Number(body.actually_paid  || 0);
  const payCurrency    = String(body.pay_currency   || '');

  if (!paymentId || !paymentStatus) {
    return new Response('Missing required fields', { status: 400 });
  }

  const internalStatus = STATUS_MAP[paymentStatus] || 'pending';
  const isFinished     = paymentStatus === 'finished';

  // ── UPDATE SUPABASE ───────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Find matching transaction
  const { data: tx, error: txErr } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status')
    .eq('nowpayments_id', paymentId)
    .single();

  if (txErr || !tx) {
    console.warn('[nowpayments-webhook] Transaction not found:', paymentId);
    // Return 200 to stop NOWPayments from retrying for unknown payments
    return new Response(JSON.stringify({ received: true, warning: 'transaction_not_found' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Update transaction status
  await supabase
    .from('transactions')
    .update({
      nowpayments_status: paymentStatus,
      status:             internalStatus,
      processed_at:       isFinished ? new Date().toISOString() : null,
    })
    .eq('id', tx.id);

  // Auto-credit balance on finished (if not already credited)
  if (isFinished && tx.status === 'pending') {
    await supabase.rpc('approve_deposit', {
      p_transaction_id: tx.id,
      p_admin_id:       tx.user_id,   // self-approved via webhook
      p_notes:          `NOWPayments auto-confirmed. Payment ID: ${paymentId}. Paid: ${actuallyPaid} ${payCurrency}`,
    });

    console.log(`[nowpayments-webhook] Auto-credited $${tx.amount} to user ${tx.user_id}`);
  }

  return new Response(JSON.stringify({ received: true, status: internalStatus }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
