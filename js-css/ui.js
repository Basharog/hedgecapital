// ============================================================
//  ui.js — HedgeCapitalPro Shared UI Module
//  Phase 3 — Modular Architecture
//
//  Import this on every page that needs:
//  - Toast notifications
//  - Modal open/close
//  - Loading state helpers
//  - Copy to clipboard
//  - Format utilities (currency, date, percent)
//  - Scroll reveal (Intersection Observer)
//  - Confirm dialog
//  - Preloader
//  - DOM shortcuts
// ============================================================


// ── TOAST NOTIFICATIONS ───────────────────────────────────────
// Usage: toast('Saved!') | toast('Error', 'error') | toast('Warning', 'warn')
// Types: 'success' | 'error' | 'warn' | 'info'

let _toastContainer = null;

function getToastContainer() {
  if (_toastContainer) return _toastContainer;
  _toastContainer = document.getElementById('toast-container');
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

export function toast(message, type = 'success', duration = 3200) {
  const container = getToastContainer();
  const el = document.createElement('div');

  const icons = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };
  el.className = `toast toast-${type === 'error' ? 'error' : type === 'warn' ? 'warn' : type === 'info' ? 'info' : 'success'}`;
  el.innerHTML = `<span>${icons[type] || '✓'}</span><span>${message}</span>`;

  container.appendChild(el);

  // Auto-remove
  const timeout = setTimeout(() => removeToast(el), duration);
  el.addEventListener('click', () => { clearTimeout(timeout); removeToast(el); });
}

function removeToast(el) {
  el.classList.add('hide');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// Shorthand aliases
export const toastSuccess = msg => toast(msg, 'success');
export const toastError   = msg => toast(msg, 'error');
export const toastWarn    = msg => toast(msg, 'warn');
export const toastInfo    = msg => toast(msg, 'info');


// ── MODAL MANAGEMENT ─────────────────────────────────────────
// Usage:
//   openModal('my-modal-id')
//   closeModal('my-modal-id')
//   closeModal()  ← closes all

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  document.body.style.overflow = 'hidden';
  // Close on overlay click
  el.addEventListener('click', function handler(e) {
    if (e.target === el) { closeModal(id); el.removeEventListener('click', handler); }
  });
  // Close on Escape
  const esc = e => { if (e.key === 'Escape') { closeModal(id); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
}

export function closeModal(id) {
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  } else {
    document.querySelectorAll('.modal-overlay.show').forEach(el => el.classList.remove('show'));
  }
  // Only restore scroll if no modals remain open
  if (!document.querySelector('.modal-overlay.show')) {
    document.body.style.overflow = '';
  }
}

// Quick confirm dialog — returns Promise<boolean>
export function confirm(message, { title = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const id = 'hcp-confirm-' + Date.now();
    const html = `
      <div class="modal-overlay" id="${id}">
        <div class="modal-box" style="max-width:400px">
          <div class="modal-title">${title}</div>
          <div class="modal-sub" style="margin-bottom:20px">${message}</div>
          <div class="modal-footer">
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-full" id="${id}-ok">Confirm</button>
            <button class="btn btn-ghost btn-full" id="${id}-cancel">Cancel</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    openModal(id);
    const cleanup = val => {
      closeModal(id);
      setTimeout(() => document.getElementById(id)?.remove(), 300);
      resolve(val);
    };
    document.getElementById(`${id}-ok`).addEventListener('click',     () => cleanup(true));
    document.getElementById(`${id}-cancel`).addEventListener('click', () => cleanup(false));
  });
}


// ── LOADING STATES ────────────────────────────────────────────
// Usage:
//   setLoading('my-btn-id', true)   ← disables button, shows spinner
//   setLoading('my-btn-id', false)  ← restores button

export function setLoading(btnId, isLoading) {
  const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
  if (!btn) return;
  btn.disabled = isLoading;
  btn.classList.toggle('loading', isLoading);
}

// Page-level loading overlay
export function showPageLoader(message = 'Loading…') {
  let el = document.getElementById('page-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'page-loader';
    el.style.cssText = `
      position:fixed;inset:0;z-index:9000;
      background:rgba(6,10,18,0.88);
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:16px;
      backdrop-filter:blur(4px);animation:fadeIn .2s ease;
    `;
    el.innerHTML = `
      <div class="spinner spinner-lg"></div>
      <div style="font-size:13px;color:var(--muted)">${message}</div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}

export function hidePageLoader() {
  const el = document.getElementById('page-loader');
  if (el) {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }
}


// ── PRELOADER ─────────────────────────────────────────────────
// Call on DOMContentLoaded — hides spinner once page is ready.

export function initPreloader() {
  const el = document.getElementById('preloader');
  if (!el) return;
  window.addEventListener('load', () => {
    setTimeout(() => {
      el.classList.add('hide');
      setTimeout(() => el.remove(), 400);
    }, 300);
  });
}


// ── ALERTS (inline) ───────────────────────────────────────────
// Manage show/hide of .alert elements by ID.

export function showAlert(containerId, message, type = 'err') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type} show`;
}

export function clearAlert(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.classList.remove('show');
  el.textContent = '';
}

export function clearAlerts(...ids) {
  ids.forEach(clearAlert);
}


// ── COPY TO CLIPBOARD ─────────────────────────────────────────
// Usage: await copyText('abc123')

export async function copyText(text, successMsg = '✓ Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMsg, 'success', 2000);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast(successMsg, 'success', 2000);
    return true;
  }
}


// ── FORMAT UTILITIES ──────────────────────────────────────────

// Currency: 1234.5 → '$1,234.50'
export function fmtCurrency(amount, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(amount) || 0);
}

// Short currency: 12480.50 → '$12,480.50'
export const fmt$ = amount => fmtCurrency(amount);

// Number with commas: 1234567 → '1,234,567'
export function fmtNumber(n, decimals = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(parseFloat(n) || 0);
}

// Percent: 0.1234 → '12.34%' | fmtPercent(12.34, false) → '12.34%'
export function fmtPercent(value, isDecimal = false, decimals = 2) {
  const v = isDecimal ? value * 100 : value;
  return `${parseFloat(v).toFixed(decimals)}%`;
}

// Date: '2025-03-15' → 'Mar 15, 2025'
export function fmtDate(dateStr, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', opts);
}

// Relative time: '2025-03-15' → '2 months ago'
export function fmtRelative(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return fmtDate(dateStr);
}

// Truncate address: 'bc1qxyz...abcdef' → 'bc1qxy…bcdef'
export function fmtAddress(addr, start = 8, end = 6) {
  if (!addr || addr.length <= start + end) return addr || '—';
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

// File size: 1048576 → '1.0 MB'
export function fmtFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824)  return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}


// ── SCROLL REVEAL (Intersection Observer) ─────────────────────
// Add class="reveal" (or "reveal reveal-left" etc.) to elements.
// Call initScrollReveal() once per page.

let _revealObserver = null;

export function initScrollReveal(selector = '.reveal') {
  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    document.querySelectorAll(selector).forEach(el => el.classList.add('revealed'));
    return;
  }
  _revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        _revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll(selector).forEach(el => _revealObserver.observe(el));
}


// ── COUNTDOWN TIMER ───────────────────────────────────────────
// Usage:
//   const stop = startCountdown(60, secs => { el.textContent = secs; }, onDone);
//   stop() to cancel early.

export function startCountdown(seconds, onTick, onDone) {
  let remaining = seconds;
  onTick(remaining);
  const id = setInterval(() => {
    remaining--;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(id);
      if (onDone) onDone();
    }
  }, 1000);
  return () => clearInterval(id);
}


// ── LIVE CLOCK ────────────────────────────────────────────────
// Inject current time into an element every second.
// Usage: startClock('clock-element-id')

export function startClock(elementId, format24 = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: !format24,
    });
  };
  tick();
  return setInterval(tick, 1000);
}


// ── BACK TO TOP ───────────────────────────────────────────────
// Auto-shows #back-top button when scrolled past 400px.

export function initBackToTop() {
  const btn = document.getElementById('back-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}


// ── DOM HELPERS ───────────────────────────────────────────────

export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

export function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.textContent = val;
}

export function setHTML(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.innerHTML = val;
}

export function show(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
}

export function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

export function toggle(id, condition) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = condition ? '' : 'none';
}

export function addClasses(id, ...classes) {
  document.getElementById(id)?.classList.add(...classes);
}

export function removeClasses(id, ...classes) {
  document.getElementById(id)?.classList.remove(...classes);
}

// Create element shorthand
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on'))
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}


// ── DEBOUNCE / THROTTLE ───────────────────────────────────────

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function throttle(fn, ms = 200) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}


// ── NUMBER ANIMATION ──────────────────────────────────────────
// Animate a number from start to end over duration ms.
// Usage: animateNumber(el, 0, 12480.50, 1200, v => '$' + v.toFixed(2))

export function animateNumber(element, from, to, duration = 1000, format = v => Math.round(v)) {
  const start = performance.now();
  const diff  = to - from;
  const step  = timestamp => {
    const elapsed  = timestamp - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    element.textContent = format(from + diff * eased);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}


// ── SANITIZE HTML ─────────────────────────────────────────────
// Prevent XSS when rendering user-supplied text as HTML.

export function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
