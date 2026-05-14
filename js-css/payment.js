// ============================================================
//  payment.js — Payment Controller (Router)
//  HedgeCapitalPro — Phase 9
//
//  Single entry point for all deposit payment flows.
//  Routes between:
//    - Manual crypto (admin-set wallet addresses)
//    - NOWPayments (automated crypto invoices)
//
//  To add a future gateway (e.g. Stripe, CoinGate):
//    1. Create gateway.js with its API logic
//    2. Add a case to PAYMENT_PROVIDERS below
//    3. Add initiate() + verify() handlers
//    4. Done — no other files need to change
// ============================================================

import { getSetting }                              from './api.js';
import {
  createPayment,
  getPaymentStatus,
  getEstimatedPrice,
  getMinAmount,
  getNPStatusLabel,
}                                                   from './nowpayments.js';
import {
  submitDeposit,
  submitNowPaymentsDeposit,
  syncNowPaymentsStatus,
  getCurrentUser,
}                                                   from './api.js';

// ── PAYMENT PROVIDERS REGISTRY ───────────────────────────────
// Add new gateways here — nothing else needs to change
export const PAYMENT_PROVIDERS = {
  manual:       'manual',
  nowpayments:  'nowpayments',
  // future:    'coingate', 'stripe', etc.
};

// ── GATEWAY AVAILABILITY CHECK ───────────────────────────────

/**
 * Returns which payment providers are currently enabled.
 * Reads from Supabase settings table — admin-controlled.
 * Manual is always available as fallback.
 */
export async function getEnabledProviders() {
  const [npEnabled] = await Promise.all([
    getSetting('nowpayments_enabled'),
  ]);

  return {
    manual:      true,                         // always on
    nowpayments: npEnabled === 'true',
  };
}

// ── MANUAL DEPOSIT FLOW ───────────────────────────────────────

/**
 * Initiate a manual deposit.
 * User sends crypto themselves, uploads screenshot as proof.
 *
 * @param {object} params
 * @param {string} params.method        - e.g. 'Bitcoin (BTC)'
 * @param {number} params.amount        - USD equivalent
 * @param {File|null} params.proofFile  - Screenshot/proof upload (optional)
 * @param {function} params.onUpload    - Called with upload progress (optional)
 */
export async function initiateManualDeposit({ method, amount, proofFile, onUpload }) {
  if (!method) return { error: 'Payment method is required' };
  if (!amount || amount < 1) return { error: 'Invalid amount' };

  let screenshotUrl = null;

  // Upload proof screenshot if provided
  if (proofFile) {
    const { uploadDepositProof } = await import('./api.js');
    const upload = await uploadDepositProof(proofFile);
    if (upload.error) return { error: 'Screenshot upload failed: ' + upload.error };
    screenshotUrl = upload.url;
    if (onUpload) onUpload(screenshotUrl);
  }

  const { data, error } = await submitDeposit({ method, amount, screenshotUrl });
  if (error) return { error: error.message || error };

  return {
    success:  true,
    provider: 'manual',
    txId:     data.id,
    status:   'pending',
    message:  'Deposit submitted. Our team will confirm within 1–3 hours.',
  };
}

// ── NOWPAYMENTS DEPOSIT FLOW ──────────────────────────────────

/**
 * Initiate a NOWPayments automated deposit.
 * Creates an invoice, saves the record, returns wallet address to show user.
 *
 * @param {object} params
 * @param {number} params.amount          - USD amount to deposit
 * @param {string} params.cryptoCurrency  - e.g. 'btc', 'eth', 'usdttrc20'
 */
export async function initiateNowPaymentsDeposit({ amount, cryptoCurrency }) {
  if (!amount || amount < 1)    return { error: 'Invalid amount' };
  if (!cryptoCurrency)          return { error: 'Cryptocurrency is required' };

  // Check provider is enabled
  const { nowpayments } = await getEnabledProviders();
  if (!nowpayments) return { error: 'NOWPayments is not enabled. Please use manual deposit.' };

  // Get current user for order ID
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };

  const orderId = `${user.id.slice(0, 8)}_${Date.now()}`;

  // Create payment invoice with NOWPayments
  const { payment, error: npError } = await createPayment({
    amountUsd:      amount,
    cryptoCurrency,
    orderId,
    orderDesc:      'HedgeCapitalPro Deposit',
  });

  if (npError) return { error: 'Payment creation failed: ' + npError };

  // Record in our transactions table
  const methodLabel = `${cryptoCurrency.toUpperCase()} via NOWPayments`;
  const { data: tx, error: txError } = await submitNowPaymentsDeposit({
    method:             methodLabel,
    amount,
    nowpaymentsId:      payment.paymentId,
    nowpaymentsStatus:  payment.status,
  });

  if (txError) return { error: 'Failed to record transaction: ' + (txError.message || txError) };

  return {
    success:        true,
    provider:       'nowpayments',
    txId:           tx.id,
    paymentId:      payment.paymentId,
    payAddress:     payment.payAddress,
    payAmount:      payment.payAmount,
    payCurrency:    payment.payCurrency,
    network:        payment.network,
    expirationDate: payment.expirationDate,
    status:         payment.status,
    message:        `Send exactly ${payment.payAmount} ${payment.payCurrency.toUpperCase()} to the address below.`,
  };
}

// ── POLL NOWPAYMENTS STATUS ───────────────────────────────────

/**
 * Poll status of a NOWPayments deposit and sync to our DB.
 * Call this from the dashboard UI every 30s while payment is pending.
 *
 * @param {string} paymentId     - NOWPayments payment ID
 * @param {string} internalTxId  - Our transactions.id (for UI update)
 */
export async function pollNowPaymentsDeposit(paymentId) {
  const result = await getPaymentStatus(paymentId);
  if (result.error) return { error: result.error };

  // Sync status back into our transactions table
  await syncNowPaymentsStatus(paymentId, result.status);

  return {
    paymentId:    result.paymentId,
    status:       result.status,
    statusLabel:  getNPStatusLabel(result.status),
    actuallyPaid: result.actuallyPaid,
    payCurrency:  result.payCurrency,
    isComplete:   result.status === 'finished',
    isFailed:     ['failed', 'refunded', 'expired'].includes(result.status),
  };
}

// ── UNIFIED DEPOSIT INITIATOR ─────────────────────────────────

/**
 * Single entry point for all deposit types.
 * Call this from dashboard UI — it handles routing internally.
 *
 * @param {string} provider   - 'manual' | 'nowpayments'
 * @param {object} params     - Provider-specific params (see above)
 */
export async function initiateDeposit(provider, params) {
  switch (provider) {
    case PAYMENT_PROVIDERS.manual:
      return initiateManualDeposit(params);

    case PAYMENT_PROVIDERS.nowpayments:
      return initiateNowPaymentsDeposit(params);

    default:
      return { error: `Unknown payment provider: ${provider}` };
  }
}

// ── CRYPTO PRICE ESTIMATE (UI helper) ────────────────────────

/**
 * Get estimated crypto amount for USD value.
 * Use to show user how much crypto to send before they confirm.
 */
export async function estimateDepositAmount(amountUsd, cryptoCurrency) {
  return getEstimatedPrice(amountUsd, cryptoCurrency);
}

/**
 * Get minimum deposit amount for a currency.
 */
export async function getDepositMinimum(cryptoCurrency) {
  return getMinAmount(cryptoCurrency, 'usd');
}
