// ============================================================
//  api.js — HedgeCapitalPro Supabase Client & Data Layer
//  All database interactions go through this file.
//  Import this before auth.js, ui.js, main.js
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ── CLIENT ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://egedzwcezqksjeozzttd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YOGPxMoD0RWCTW43n-hurw_es3iSN8K';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken:    true,
    persistSession:      true,
    detectSessionInUrl:  true,
    storageKey:          'hcp_auth',
  }
});

// ── CURRENT USER (cached) ───────────────────────────────────
let _profile = null;

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(forceRefresh = false) {
  if (_profile && !forceRefresh) return _profile;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) { console.error('[api] getProfile:', error); return null; }
  _profile = data;
  return data;
}

export function clearProfileCache() { _profile = null; }


// ── AUTH ─────────────────────────────────────────────────────

export async function signUp({ email, password, firstName, lastName, username, phone, country, referredBy }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, username, phone, country, referred_by: referredBy || '' }
    }
  });
  return { data, error };
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  clearProfileCache();
  return supabase.auth.signOut();
}

export async function sendPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });
}

export async function updatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

export async function requireAuth(redirectTo = 'login.html') {
  const user = await getCurrentUser();
  if (!user) { window.location.href = redirectTo; return null; }
  const profile = await getProfile();
  if (!profile) { window.location.href = redirectTo; return null; }
  if (profile.is_suspended) {
    await signOut();
    window.location.href = `login.html?suspended=1`;
    return null;
  }
  return profile;
}

export async function requireAdmin(redirectTo = 'index.html') {
  const profile = await requireAuth();
  if (!profile) return null;
  if (profile.role !== 'admin') { window.location.href = redirectTo; return null; }
  return profile;
}


// ── SESSION LOGGING ─────────────────────────────────────────

export async function logSession() {
  const user = await getCurrentUser();
  if (!user) return;
  try {
    // Grab IP + location from ipapi (free, no key needed)
    const geo = await fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({}));
    await supabase.from('user_sessions').insert({
      user_id:     user.id,
      ip_address:  geo.ip        || 'unknown',
      country:     geo.country_name || 'unknown',
      city:        geo.city      || 'unknown',
      user_agent:  navigator.userAgent,
      device_info: getDeviceInfo()
    });
  } catch (e) { /* non-critical — don't break login */ }
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /Tablet|iPad/i.test(ua);
  if (isTablet) return 'Tablet';
  if (isMobile) return 'Mobile';
  return 'Desktop';
}


// ── PROFILE ──────────────────────────────────────────────────

export async function updateProfile(fields) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', user.id)
    .select()
    .single();
  if (!error) _profile = data;
  return { data, error };
}


// ── INVESTMENT PLANS ─────────────────────────────────────────

export async function getPlans() {
  const { data, error } = await supabase
    .from('investment_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return { data, error };
}

export async function getAllPlans() {
  const { data, error } = await supabase
    .from('investment_plans')
    .select('*')
    .order('sort_order');
  return { data, error };
}

export async function createPlan(plan) {
  return supabase.from('investment_plans').insert(plan).select().single();
}

export async function updatePlan(id, fields) {
  return supabase.from('investment_plans').update(fields).eq('id', id).select().single();
}

export async function deletePlan(id) {
  return supabase.from('investment_plans').delete().eq('id', id);
}


// ── INVESTMENTS ──────────────────────────────────────────────

export async function getMyInvestments() {
  const user = await getCurrentUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('investments')
    .select('*, investment_plans(name, roi_percentage)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
}

export async function createInvestment({ planId, amount }) {
  const profile = await getProfile();
  if (!profile) return { error: 'Not authenticated' };
  if (profile.balance < amount) return { error: 'Insufficient balance' };

  // Deduct balance + create investment in a transaction-like pattern
  const { error: balErr } = await supabase
    .from('profiles')
    .update({
      balance:       profile.balance - amount,
      total_invested: (profile.total_invested || 0) + amount
    })
    .eq('id', profile.id);

  if (balErr) return { error: balErr.message };

  const { data, error } = await supabase
    .from('investments')
    .insert({ user_id: profile.id, plan_id: planId, amount })
    .select()
    .single();

  clearProfileCache();
  return { data, error };
}


// ── TRANSACTIONS ─────────────────────────────────────────────

export async function getMyTransactions() {
  const user = await getCurrentUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
}

export async function submitDeposit({ method, amount, screenshotUrl }) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  return supabase
    .from('transactions')
    .insert({
      user_id:          user.id,
      type:             'deposit',
      method,
      amount,
      status:           'pending',
      payment_provider: 'manual',
      screenshot_url:   screenshotUrl || null
    })
    .select()
    .single();
}

// NOWPayments deposit — called after payment is created via nowpayments.js
// Stores the payment record so admin + user can track it
export async function submitNowPaymentsDeposit({ method, amount, nowpaymentsId, nowpaymentsStatus }) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  return supabase
    .from('transactions')
    .insert({
      user_id:            user.id,
      type:               'deposit',
      method,
      amount,
      status:             'pending',
      payment_provider:   'nowpayments',
      nowpayments_id:     nowpaymentsId,
      nowpayments_status: nowpaymentsStatus || 'waiting'
    })
    .select()
    .single();
}

// Called by webhook handler to sync NOWPayments status into our transactions table
export async function syncNowPaymentsStatus(nowpaymentsId, nowpaymentsStatus) {
  // Map NOWPayments statuses to our internal tx_status
  const statusMap = {
    waiting:    'pending',
    confirming: 'pending',
    confirmed:  'pending',   // admin still manually confirms balance credit
    sending:    'pending',
    partially_paid: 'pending',
    finished:   'confirmed', // auto-confirm on finished
    failed:     'rejected',
    refunded:   'rejected',
    expired:    'rejected',
  };
  const internalStatus = statusMap[nowpaymentsStatus] || 'pending';

  const { data: tx } = await supabase
    .from('transactions')
    .select('id, user_id, amount, status')
    .eq('nowpayments_id', nowpaymentsId)
    .single();

  if (!tx) return { error: 'Transaction not found' };

  // If NOWPayments says finished and we haven't credited yet — credit the user
  if (nowpaymentsStatus === 'finished' && tx.status === 'pending') {
    await supabase
      .from('profiles')
      .update({ balance: supabase.rpc('balance + ' + tx.amount) })
      .eq('id', tx.user_id);
    // Use the proper RPC pattern
    await supabase.rpc('admin_adjust_balance', {
      p_user_id:  tx.user_id,
      p_amount:   tx.amount,
      p_type:     'credit',
      p_reason:   'NOWPayments auto-confirmed: ' + nowpaymentsId,
      p_admin_id: tx.user_id  // self-credited via webhook
    });
  }

  return supabase
    .from('transactions')
    .update({
      nowpayments_status: nowpaymentsStatus,
      status:             internalStatus,
      processed_at:       nowpaymentsStatus === 'finished' ? new Date().toISOString() : null
    })
    .eq('nowpayments_id', nowpaymentsId);
}

export async function submitWithdrawal({ method, amount, walletAddress }) {
  const profile = await getProfile();
  if (!profile) return { error: 'Not authenticated' };

  // KYC gate — only for withdrawals
  if (profile.kyc_status !== 'approved') {
    return { error: 'kyc_required' };
  }
  if (profile.balance < amount) {
    return { error: 'Insufficient balance' };
  }

  const minWithdrawal = await getSetting('min_withdrawal').then(v => parseFloat(v) || 50);
  if (amount < minWithdrawal) {
    return { error: `Minimum withdrawal is $${minWithdrawal}` };
  }

  // Deduct balance immediately (held pending admin approval)
  await supabase.from('profiles').update({
    balance:         profile.balance - amount,
    total_withdrawn: (profile.total_withdrawn || 0) + amount
  }).eq('id', profile.id);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id:       profile.id,
      type:          'withdrawal',
      method,
      amount,
      status:        'processing',
      wallet_address: walletAddress
    })
    .select()
    .single();

  clearProfileCache();
  return { data, error };
}


// ── CRYPTO WALLETS ───────────────────────────────────────────

export async function getWallets() {
  const { data, error } = await supabase
    .from('crypto_wallets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return { data, error };
}

export async function getAllWallets() {
  return supabase.from('crypto_wallets').select('*').order('sort_order');
}

export async function createWallet(wallet) {
  return supabase.from('crypto_wallets').insert(wallet).select().single();
}

export async function updateWallet(id, fields) {
  return supabase.from('crypto_wallets').update(fields).eq('id', id).select().single();
}

export async function deleteWallet(id) {
  return supabase.from('crypto_wallets').delete().eq('id', id);
}


// ── KYC ──────────────────────────────────────────────────────

export async function getMyKYC() {
  const user = await getCurrentUser();
  if (!user) return { data: null, error: null };
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

export async function submitKYC({ idFrontUrl, idBackUrl }) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  return supabase
    .from('kyc_submissions')
    .insert({ user_id: user.id, id_front_url: idFrontUrl, id_back_url: idBackUrl })
    .select()
    .single();
}

export async function uploadKYCDoc(file, side) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  const ext  = file.name.split('.').pop();
  const path = `${user.id}/${side}_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('kyc-documents').upload(path, file, { upsert: true });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from('kyc-documents').getPublicUrl(path);
  return { url: path }; // return path, admin fetches signed URL
}

export async function uploadDepositProof(file) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  const ext  = file.name.split('.').pop();
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('deposit-proofs').upload(path, file);
  if (error) return { error: error.message };
  return { url: path };
}


// ── SUPPORT TICKETS ──────────────────────────────────────────

export async function getMyTickets() {
  const user = await getCurrentUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
}

export async function createTicket({ subject, message }) {
  const user = await getCurrentUser();
  if (!user) return { error: 'Not authenticated' };
  return supabase
    .from('support_tickets')
    .insert({ user_id: user.id, subject, message })
    .select()
    .single();
}


// ── REFERRALS ────────────────────────────────────────────────

export async function getMyReferrals() {
  const user = await getCurrentUser();
  if (!user) return { data: [], error: null };
  return supabase
    .from('referrals')
    .select('*, referred:referred_id(first_name, last_name, created_at)')
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });
}


// ── SITE CONTENT ─────────────────────────────────────────────

export async function getSiteContent() {
  const { data, error } = await supabase
    .from('site_content')
    .select('key, value, section');
  if (error) return {};
  // Convert array to key-value object
  return data.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
}

export async function updateSiteContent(key, value) {
  return supabase
    .from('site_content')
    .update({ value })
    .eq('key', key);
}


// ── SETTINGS ─────────────────────────────────────────────────

let _settings = null;

export async function getSettings() {
  if (_settings) return _settings;
  const { data } = await supabase.from('settings').select('key, value');
  if (data) _settings = data.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
  return _settings || {};
}

export async function getSetting(key) {
  const settings = await getSettings();
  return settings[key];
}

export async function updateSetting(key, value) {
  _settings = null; // clear cache
  return supabase.from('settings').update({ value }).eq('key', key);
}


// ── TEAM MEMBERS ─────────────────────────────────────────────

export async function getTeamMembers() {
  return supabase
    .from('team_members')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
}


// ── ADMIN: USER MANAGEMENT ───────────────────────────────────

export async function adminGetAllUsers() {
  return supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
}

export async function adminGetAllTransactions() {
  return supabase
    .from('transactions')
    .select('*, profiles(first_name, last_name, email)')
    .order('created_at', { ascending: false });
}

export async function adminGetPendingDeposits() {
  return supabase
    .from('transactions')
    .select('*, profiles(first_name, last_name, email)')
    .eq('type', 'deposit')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
}

export async function adminGetPendingWithdrawals() {
  return supabase
    .from('transactions')
    .select('*, profiles(first_name, last_name, email)')
    .eq('type', 'withdrawal')
    .eq('status', 'processing')
    .order('created_at', { ascending: false });
}

export async function adminGetPendingKYC() {
  return supabase
    .from('kyc_submissions')
    .select('*, profiles(first_name, last_name, email, kyc_status)')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false });
}

export async function adminApproveDeposit(txId, notes = '') {
  const profile = await getProfile();
  if (!profile) return { error: 'Not authenticated' };
  const { data, error } = await supabase.rpc('approve_deposit', {
    p_transaction_id: txId,
    p_admin_id:       profile.id,
    p_notes:          notes
  });
  return { data, error };
}

export async function adminApproveWithdrawal(txId, notes = '') {
  const profile = await getProfile();
  if (!profile) return { error: 'Not authenticated' };
  const { data, error } = await supabase.rpc('approve_withdrawal', {
    p_transaction_id: txId,
    p_admin_id:       profile.id,
    p_notes:          notes
  });
  return { data, error };
}

export async function adminRejectTransaction(txId, notes = '') {
  const profile = await getProfile();
  if (!profile) return { error: 'Not authenticated' };
  const { data, error } = await supabase.rpc('reject_transaction', {
    p_transaction_id: txId,
    p_admin_id:       profile.id,
    p_notes:          notes
  });
  return { data, error };
}

export async function adminAdjustBalance(userId, amount, type, reason) {
  const profile = await getProfile();
  if (!profile) return { error: 'Not authenticated' };
  return supabase.rpc('admin_adjust_balance', {
    p_user_id:  userId,
    p_amount:   amount,
    p_type:     type,
    p_reason:   reason,
    p_admin_id: profile.id
  });
}

export async function adminSuspendUser(userId, reason) {
  return supabase
    .from('profiles')
    .update({ is_suspended: true, suspension_reason: reason })
    .eq('id', userId);
}

export async function adminUnsuspendUser(userId) {
  return supabase
    .from('profiles')
    .update({ is_suspended: false, suspension_reason: null })
    .eq('id', userId);
}

export async function adminApproveKYC(submissionId, userId, notes = '') {
  await supabase.from('kyc_submissions').update({
    status: 'approved', admin_notes: notes, reviewed_at: new Date().toISOString()
  }).eq('id', submissionId);

  return supabase.from('profiles').update({ kyc_status: 'approved' }).eq('id', userId);
}

export async function adminRejectKYC(submissionId, userId, notes = '') {
  await supabase.from('kyc_submissions').update({
    status: 'rejected', admin_notes: notes, reviewed_at: new Date().toISOString()
  }).eq('id', submissionId);

  return supabase.from('profiles').update({ kyc_status: 'rejected' }).eq('id', userId);
}

export async function adminGetAllSessions() {
  return supabase
    .from('user_sessions')
    .select('*, profiles(first_name, last_name, email)')
    .order('created_at', { ascending: false })
    .limit(500);
}

export async function adminGetAllTickets() {
  return supabase
    .from('support_tickets')
    .select('*, profiles(first_name, last_name, email)')
    .order('created_at', { ascending: false });
}

export async function adminRespondTicket(ticketId, response, status = 'in_progress') {
  return supabase.from('support_tickets').update({
    admin_response: response, status
  }).eq('id', ticketId);
}

export async function adminGetAllInvestments() {
  return supabase
    .from('investments')
    .select('*, profiles(first_name, last_name, email), investment_plans(name, roi_percentage)')
    .order('created_at', { ascending: false });
}

export async function adminTriggerProfitPayout() {
  return supabase.rpc('process_daily_profits');
}


// ── REALTIME ─────────────────────────────────────────────────

export function subscribeToProfile(userId, callback) {
  return supabase
    .channel(`profile-${userId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'profiles',
      filter: `id=eq.${userId}`
    }, payload => {
      _profile = payload.new;
      callback(payload.new);
    })
    .subscribe();
}

export function subscribeToTransactions(userId, callback) {
  return supabase
    .channel(`tx-${userId}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'transactions',
      filter: `user_id=eq.${userId}`
    }, payload => callback(payload.new))
    .subscribe();
}


// ── ANALYTICS (admin dashboard) ──────────────────────────────

export async function adminGetStats() {
  const [users, deposits, withdrawals, investments] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('transactions').select('amount').eq('type', 'deposit').eq('status', 'confirmed'),
    supabase.from('transactions').select('amount').eq('type', 'withdrawal').eq('status', 'completed'),
    supabase.from('investments').select('amount').eq('status', 'active'),
  ]);

  const sum = arr => (arr || []).reduce((t, r) => t + parseFloat(r.amount || 0), 0);

  return {
    totalUsers:       users.count || 0,
    totalDeposits:    sum(deposits.data),
    totalWithdrawals: sum(withdrawals.data),
    totalInvested:    sum(investments.data),
  };
}
