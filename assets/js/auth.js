// ============================================================
//  auth.js — HedgeCapitalPro Auth Layer
//  Phase 2 — Authentication System
//
//  Responsibilities:
//  - Session management (Supabase Auth)
//  - Route guards (requireAuth, requireAdmin)
//  - Auth state broadcasting (onAuthChange)
//  - Input validation helpers
//  - Session logging on login
// ============================================================

import { supabase, getProfile, clearProfileCache, logSession } from './api.js';

// ── AUTH STATE LISTENER ───────────────────────────────────────
// Call once on every page that needs to react to auth changes.
// Callback receives: { event, session, profile }

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    clearProfileCache();
    let profile = null;
    if (session?.user) {
      profile = await getProfile();
    }
    callback({ event, session, profile });
  });
}

// ── SIGN UP ───────────────────────────────────────────────────

export async function register({
  email, password, firstName, lastName,
  username, phone, country, referredBy
}) {
  // Validate
  const errs = [];
  if (!firstName?.trim())       errs.push('First name is required');
  if (!lastName?.trim())        errs.push('Last name is required');
  if (!validateEmail(email))    errs.push('Enter a valid email address');
  if (!validateUsername(username)) errs.push('Username: 3–20 chars, letters/numbers/underscores only');
  if (password?.length < 8)    errs.push('Password must be at least 8 characters');
  if (!country?.trim())         errs.push('Please select your country');
  if (errs.length) return { error: errs[0] };

  const { data, error } = await supabase.auth.signUp({
    email:    email.trim().toLowerCase(),
    password,
    options: {
      data: {
        first_name:  firstName.trim(),
        last_name:   lastName.trim(),
        username:    username.trim().toLowerCase(),
        phone:       phone?.trim() || '',
        country:     country.trim(),
        referred_by: referredBy?.trim().toUpperCase() || '',
      },
      // Email confirmation redirect
      emailRedirectTo: `${window.location.origin}/login.html?verified=1`,
    }
  });

  if (error) return { error: friendlyAuthError(error.message) };

  // Supabase requires email confirmation — user won't be able to sign in yet
  return {
    data,
    requiresConfirmation: !data.session,  // true when email confirmation is on
  };
}

// ── SIGN IN ───────────────────────────────────────────────────

export async function login({ identifier, password }) {
  if (!identifier?.trim()) return { error: 'Email or username is required' };
  if (!password)            return { error: 'Password is required' };

  // Supabase only accepts email — resolve username to email first
  let email = identifier.trim().toLowerCase();

  if (!email.includes('@')) {
    // Username login — look up email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', email)
      .single();

    if (!profile) return { error: 'No account found with that username' };
    email = profile.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message?.includes('Email not confirmed')) {
      return { error: 'email_not_confirmed' };
    }
    return { error: friendlyAuthError(error.message) };
  }

  // Check suspension
  const profile = await getProfile(true);
  if (profile?.is_suspended) {
    await supabase.auth.signOut();
    return { error: 'suspended', reason: profile.suspension_reason };
  }

  // Log session (fire-and-forget — non-blocking)
  logSession().catch(() => {});

  return { data, profile };
}

// ── SIGN OUT ──────────────────────────────────────────────────

export async function logout() {
  clearProfileCache();
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ── FORGOT PASSWORD ───────────────────────────────────────────

export async function sendResetEmail(email) {
  if (!validateEmail(email)) return { error: 'Enter a valid email address' };

  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/reset-password.html` }
  );

  if (error) return { error: friendlyAuthError(error.message) };
  return { success: true };
}

// ── RESET PASSWORD ────────────────────────────────────────────

export async function resetPassword(newPassword, confirmPassword) {
  if (newPassword.length < 8)      return { error: 'Password must be at least 8 characters' };
  if (newPassword !== confirmPassword) return { error: 'Passwords do not match' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: friendlyAuthError(error.message) };
  return { success: true };
}

// ── RESEND CONFIRMATION EMAIL ────────────────────────────────

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type:  'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${window.location.origin}/login.html?verified=1` }
  });
  if (error) return { error: friendlyAuthError(error.message) };
  return { success: true };
}

// ── ROUTE GUARDS ──────────────────────────────────────────────

// Use on dashboard.html — redirect to login if no session
export async function requireAuth(redirectTo = 'login.html') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = redirectTo; return null; }

  const profile = await getProfile();
  if (!profile) { window.location.href = redirectTo; return null; }

  if (profile.is_suspended) {
    await supabase.auth.signOut();
    window.location.href = `login.html?suspended=1`;
    return null;
  }

  return profile;
}

// Use on admin.html
export async function requireAdmin(redirectTo = 'index.html') {
  const profile = await requireAuth();
  if (!profile) return null;
  if (profile.role !== 'admin') {
    window.location.href = redirectTo;
    return null;
  }
  return profile;
}

// Use on login.html / register.html — redirect away if already logged in
export async function redirectIfLoggedIn(redirectTo = 'dashboard.html') {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const profile = await getProfile();
    if (profile && !profile.is_suspended) {
      window.location.href = profile.role === 'admin' ? 'admin.html' : redirectTo;
    }
  }
}

// ── VALIDATION HELPERS ────────────────────────────────────────

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email?.trim() || '');
}

export function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username?.trim() || '');
}

export function validatePhone(phone) {
  // E.164 format: +[country code][number], 7–15 digits
  return /^\+?[1-9]\d{6,14}$/.test(phone?.replace(/[\s\-()]/g, '') || '');
}

export function getPasswordStrength(password) {
  if (!password || password.length < 6) return { score: 0, label: 'Too short', color: '#ff4d6a' };
  let score = 0;
  if (password.length >= 8)                      score++;
  if (password.length >= 12)                     score++;
  if (/[A-Z]/.test(password))                   score++;
  if (/[0-9]/.test(password))                   score++;
  if (/[^A-Za-z0-9]/.test(password))            score++;

  const levels = [
    { score: 1, label: 'Weak',      color: '#ff4d6a' },
    { score: 2, label: 'Fair',      color: '#ffb830' },
    { score: 3, label: 'Good',      color: '#ffb830' },
    { score: 4, label: 'Strong',    color: '#00d9b5' },
    { score: 5, label: 'Very strong', color: '#00d9b5' },
  ];

  return levels[Math.min(score - 1, 4)];
}

// ── ERROR MESSAGES ────────────────────────────────────────────

function friendlyAuthError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login'))     return 'Incorrect email or password.';
  if (m.includes('user not found'))    return 'No account found with that email.';
  if (m.includes('already registered') || m.includes('already exists'))
                                       return 'An account with this email already exists.';
  if (m.includes('password'))          return 'Password is too weak or invalid.';
  if (m.includes('rate limit'))        return 'Too many attempts. Please wait a moment.';
  if (m.includes('network'))           return 'Network error. Check your connection.';
  return msg || 'Something went wrong. Please try again.';
}

// ── URL PARAM HELPERS ────────────────────────────────────────

export function getUrlParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
