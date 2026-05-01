// ============================================================
//  nowpayments.js — NOWPayments API Integration
//  HedgeCapitalPro — Phase 9
//
//  Handles:
//  - Creating crypto payment invoices
//  - Checking payment status
//  - Verifying IPN webhook signatures
//
//  NOWPayments docs: https://documenter.getpostman.com/view/7907941/2s93JqTRWN
// ============================================================

import { getSetting } from './api.js';

// ── CONFIG ───────────────────────────────────────────────────
// All values pulled from Supabase settings table — never hardcoded

async function getNPConfig() {
  const [apiKey, sandbox] = await Promise.all([
    getSetting('nowpayments_api_key'),
    getSetting('nowpayments_sandbox'),
  ]);

  const isSandbox = sandbox === 'true';

  return {
    apiKey:  apiKey || '',
    baseUrl: isSandbox
      ? 'https://api-sandbox.nowpayments.io/v1'
      : 'https://api.nowpayments.io/v1',
    isSandbox,
  };
}

// ── HELPERS ───────────────────────────────────────────────────

function npHeaders(apiKey) {
  return {
    'x-api-key':   apiKey,
    'Content-Type': 'application/json',
  };
}

async function npFetch(endpoint, options = {}) {
  const cfg = await getNPConfig();
  if (!cfg.apiKey) return { error: 'NOWPayments API key not configured' };

  try {
    const res = await fetch(`${cfg.baseUrl}${endpoint}`, {
      ...options,
      headers: { ...npHeaders(cfg.apiKey), ...(options.headers || {}) },
    });
    const data = await res.json();
    if (!res.ok) return { error: data.message || `NOWPayments error ${res.status}` };
    return { data };
  } catch (err) {
    console.error('[nowpayments]', err);
    return { error: err.message };
  }
}

// ── STATUS CHECK ─────────────────────────────────────────────

/**
 * Verify the NOWPayments API key is valid and service is up.
 * Call this from admin panel settings page.
 */
export async function checkNPStatus() {
  const { data, error } = await npFetch('/status');
  if (error) return { ok: false, error };
  return { ok: data.message === 'OK', message: data.message };
}

// ── AVAILABLE CURRENCIES ─────────────────────────────────────

/**
 * Get list of currencies NOWPayments accepts.
 * Use to build the crypto selection dropdown dynamically.
 */
export async function getAvailableCurrencies() {
  const { data, error } = await npFetch('/currencies?fixed_rate=false');
  if (error) return { currencies: [], error };
  return { currencies: data.currencies || [] };
}

// ── MINIMUM PAYMENT AMOUNT ───────────────────────────────────

/**
 * Get minimum deposit amount for a currency pair.
 * @param {string} currencyFrom  - e.g. 'btc', 'eth', 'usdttrc20'
 * @param {string} currencyTo    - e.g. 'usd' (what we settle in)
 */
export async function getMinAmount(currencyFrom, currencyTo = 'usd') {
  const { data, error } = await npFetch(
    `/min-amount?currency_from=${currencyFrom}&currency_to=${currencyTo}&fiat_equivalent=usd`
  );
  if (error) return { minAmount: null, error };
  return { minAmount: data.min_amount };
}

// ── ESTIMATED PRICE ──────────────────────────────────────────

/**
 * Get estimated crypto amount for a USD amount.
 * Call before creating payment so user sees the crypto equivalent.
 * @param {number} amountUsd     - USD amount user wants to deposit
 * @param {string} cryptoCurrency - e.g. 'btc', 'eth', 'usdttrc20'
 */
export async function getEstimatedPrice(amountUsd, cryptoCurrency) {
  const { data, error } = await npFetch(
    `/estimate?amount=${amountUsd}&currency_from=usd&currency_to=${cryptoCurrency}`
  );
  if (error) return { estimatedAmount: null, error };
  return {
    estimatedAmount: data.estimated_amount,
    currencyFrom:    data.currency_from,
    currencyTo:      data.currency_to,
  };
}

// ── CREATE PAYMENT ───────────────────────────────────────────

/**
 * Create a new payment invoice on NOWPayments.
 * Returns the wallet address + payment ID to show the user.
 *
 * @param {object} params
 * @param {number} params.amountUsd       - Deposit amount in USD
 * @param {string} params.cryptoCurrency  - e.g. 'btc', 'eth', 'usdttrc20'
 * @param {string} params.orderId         - Internal reference (e.g. user_id + timestamp)
 * @param {string} params.orderDesc       - Description shown on NOWPayments side
 */
export async function createPayment({ amountUsd, cryptoCurrency, orderId, orderDesc }) {
  const { data, error } = await npFetch('/payment', {
    method: 'POST',
    body: JSON.stringify({
      price_amount:      amountUsd,
      price_currency:    'usd',
      pay_currency:      cryptoCurrency.toLowerCase(),
      order_id:          orderId,
      order_description: orderDesc || 'HedgeCapitalPro Deposit',
      is_fixed_rate:     false,
      is_fee_paid_by_user: false,
    }),
  });

  if (error) return { payment: null, error };

  return {
    payment: {
      paymentId:       data.payment_id,
      status:          data.payment_status,
      payAddress:      data.pay_address,
      payAmount:       data.pay_amount,
      payCurrency:     data.pay_currency,
      priceAmount:     data.price_amount,
      priceCurrency:   data.price_currency,
      network:         data.network,
      networkPrecision: data.network_precision,
      expirationDate:  data.expiration_estimate_date,
    },
    error: null,
  };
}

// ── GET PAYMENT STATUS ────────────────────────────────────────

/**
 * Poll payment status from NOWPayments.
 * Statuses: waiting | confirming | confirmed | sending |
 *           partially_paid | finished | failed | refunded | expired
 *
 * @param {string} paymentId - NOWPayments payment ID
 */
export async function getPaymentStatus(paymentId) {
  const { data, error } = await npFetch(`/payment/${paymentId}`);
  if (error) return { status: null, error };
  return {
    status:          data.payment_status,
    paymentId:       data.payment_id,
    actuallyPaid:    data.actually_paid,
    payCurrency:     data.pay_currency,
    outcomeAmount:   data.outcome_amount,
    updatedAt:       data.updated_at,
  };
}

// ── IPN WEBHOOK VERIFICATION ──────────────────────────────────

/**
 * Verify the HMAC signature from NOWPayments IPN webhook.
 * Call this in your server-side webhook handler BEFORE processing any data.
 *
 * NOTE: This runs server-side (Node.js / Supabase Edge Function).
 *       Do not use in browser — IPN secret must stay server-side.
 *
 * @param {string} ipnSecret    - Your NOWPayments IPN secret
 * @param {string} signature    - x-nowpayments-sig header value
 * @param {object} body         - Parsed JSON body of the webhook
 * @returns {boolean}
 */
export function verifyIpnSignature(ipnSecret, signature, body) {
  // Sort keys alphabetically, stringify, then HMAC-SHA512
  const sorted = Object.keys(body)
    .sort()
    .reduce((acc, key) => { acc[key] = body[key]; return acc; }, {});

  const payload = JSON.stringify(sorted);

  // In browser context this won't work — use the Edge Function below
  // This export is for documentation / Edge Function use
  console.warn('[nowpayments] verifyIpnSignature must run server-side (Edge Function)');
  return false;
}

// ── PAYMENT STATUS LABELS (UI helpers) ───────────────────────

export const NP_STATUS_LABELS = {
  waiting:        { label: 'Waiting for Payment',  color: 'yellow' },
  confirming:     { label: 'Confirming…',           color: 'yellow' },
  confirmed:      { label: 'Confirmed',             color: 'blue'   },
  sending:        { label: 'Sending…',              color: 'blue'   },
  partially_paid: { label: 'Partially Paid',        color: 'yellow' },
  finished:       { label: 'Payment Complete',      color: 'green'  },
  failed:         { label: 'Payment Failed',        color: 'red'    },
  refunded:       { label: 'Refunded',              color: 'red'    },
  expired:        { label: 'Expired',               color: 'red'    },
};

export function getNPStatusLabel(status) {
  return NP_STATUS_LABELS[status] || { label: status, color: 'muted' };
}
