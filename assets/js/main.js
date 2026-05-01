// ============================================================
//  main.js — HedgeCapitalPro App Initialization
//  Phase 3 — Modular Architecture
//
//  Import this on EVERY page (after api.js and ui.js).
//  Handles:
//  - Supabase settings loader (animations, chat, maintenance)
//  - Auth state → nav button updates
//  - Tawk.to live chat injection (when enabled)
//  - Scroll reveal initialization
//  - Back to top button
//  - Nav scroll shadow
//  - Mobile menu toggle
//  - Preloader dismissal
//
//  Usage in any page:
//    <script type="module">
//      import { initApp } from './main.js';
//      await initApp();
//    </script>
// ============================================================

import { supabase, getProfile, getSettings, getSiteContent } from './api.js';
import { initScrollReveal, initBackToTop, initPreloader, toast } from './ui.js';


// ── MAIN INIT ─────────────────────────────────────────────────
// Call once per page on load.

export async function initApp({ skipAuth = false } = {}) {
  // 1. Preloader
  initPreloader();

  // 2. Load settings from Supabase (non-blocking)
  const settings = await loadSettings();

  // 3. Apply settings
  applySettings(settings);

  // 4. Nav: scroll shadow + mobile menu
  initNav();

  // 5. Scroll reveal animations (only if enabled)
  if (settings.animations_enabled !== 'false') {
    initScrollReveal('.reveal');
  }

  // 6. Back to top button
  initBackToTop();

  // 7. Auth state → update nav CTA
  if (!skipAuth) {
    initAuthNav();
  }

  // 8. Live chat (if enabled)
  if (settings.live_chat_enabled === 'true') {
    injectTawkTo(settings.tawkto_id || '');
  }

  // 9. Maintenance mode check
  if (settings.maintenance_mode === 'true') {
    const path = window.location.pathname;
    const isMaintPage = path.includes('maintenance') || path.includes('admin');
    if (!isMaintPage) {
      window.location.href = '/maintenance.html';
    }
  }

  return settings;
}


// ── SETTINGS LOADER ───────────────────────────────────────────
// Fetches from Supabase. Falls back to defaults if offline.

const DEFAULT_SETTINGS = {
  animations_enabled:  'true',
  live_chat_enabled:   'false',
  captcha_enabled:     'false',
  maintenance_mode:    'false',
  referral_commission: '5',
  min_withdrawal:      '50',
  withdrawal_fee:      '2',
};

export async function loadSettings() {
  try {
    const settings = await getSettings();
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch {
    return DEFAULT_SETTINGS;
  }
}


// ── APPLY SETTINGS ────────────────────────────────────────────

function applySettings(settings) {
  // Disable animations globally if turned off in admin
  if (settings.animations_enabled === 'false') {
    const style = document.createElement('style');
    style.id = 'no-animations';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
      .reveal { opacity: 1 !important; transform: none !important; }
    `;
    document.head.appendChild(style);
  }
}


// ── SITE CONTENT LOADER ───────────────────────────────────────
// Load CMS content and apply to page. Call from landing page.
// Pass a mapping of { key: elementId } to auto-populate.

export async function loadSiteContent(mapping = {}) {
  try {
    const content = await getSiteContent();
    Object.entries(mapping).forEach(([key, elementId]) => {
      const el = document.getElementById(elementId);
      if (el && content[key] !== undefined) {
        el.textContent = content[key];
      }
    });
    return content;
  } catch {
    return {};
  }
}


// ── AUTH NAV ──────────────────────────────────────────────────
// Updates the nav CTA based on whether user is logged in.
// Looks for elements with data-auth="guest" / data-auth="user".

function initAuthNav() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const isLoggedIn = !!session?.user;
    let profile = null;

    if (isLoggedIn) {
      profile = await getProfile().catch(() => null);
    }

    // Elements with [data-auth="guest"] → shown when logged out
    document.querySelectorAll('[data-auth="guest"]').forEach(el => {
      el.style.display = isLoggedIn ? 'none' : '';
    });

    // Elements with [data-auth="user"] → shown when logged in
    document.querySelectorAll('[data-auth="user"]').forEach(el => {
      el.style.display = isLoggedIn ? '' : 'none';
    });

    // Elements with [data-auth="admin"] → shown for admins
    document.querySelectorAll('[data-auth="admin"]').forEach(el => {
      el.style.display = (isLoggedIn && profile?.role === 'admin') ? '' : 'none';
    });

    // Inject user name where [data-user="name"] exists
    if (profile) {
      document.querySelectorAll('[data-user="name"]').forEach(el => {
        el.textContent = profile.first_name || profile.username || 'User';
      });
      document.querySelectorAll('[data-user="email"]').forEach(el => {
        el.textContent = profile.email || '';
      });
      document.querySelectorAll('[data-user="initials"]').forEach(el => {
        const initials = ((profile.first_name?.[0] || '') + (profile.last_name?.[0] || '')).toUpperCase();
        el.textContent = initials || '?';
      });
    }
  });
}


// ── NAV BEHAVIORS ─────────────────────────────────────────────

function initNav() {
  // Scroll shadow on navbar
  const nav = document.querySelector('.nav, nav#navbar, nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  // Mobile hamburger toggle
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
    });

    // Close mobile menu on outside click
    document.addEventListener('click', e => {
      if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
      }
    });
  }

  // Active nav link highlight (based on current URL)
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
    const href = link.getAttribute('href')?.split('/').pop()?.split('#')[0];
    if (href && currentPath === href) {
      link.style.color = 'var(--accent)';
    }
  });
}


// ── LIVE CHAT (Tawk.to) ───────────────────────────────────────

function injectTawkTo(propertyId) {
  if (!propertyId || document.getElementById('tawkto-script')) return;
  const s = document.createElement('script');
  s.id = 'tawkto-script';
  s.async = true;
  s.src = `https://embed.tawk.to/${propertyId}/default`;
  s.charset = 'UTF-8';
  s.setAttribute('crossorigin', '*');
  document.head.appendChild(s);
}


// ── SIGN OUT HELPER ───────────────────────────────────────────
// Attach to any logout button: onclick="signOutUser()"

export async function signOutUser() {
  try {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  } catch {
    window.location.href = 'index.html';
  }
}


// ── TICKER DATA ───────────────────────────────────────────────
// Renders the market ticker bar on the landing page.
// Data is static + realistic — can be swapped for a live API.

const TICKER_DATA = [
  { name: 'S&P 500',   val: '5,872.16', chg: '+0.34%', up: true  },
  { name: 'NASDAQ',    val: '18,391.45',chg: '+0.52%', up: true  },
  { name: 'DOW',       val: '43,141.22',chg: '-0.11%', up: false },
  { name: '10Y YIELD', val: '4.37%',    chg: '+0.02',  up: true  },
  { name: 'GOLD',      val: '$2,631',   chg: '+0.28%', up: true  },
  { name: 'BTC',       val: '$84,210',  chg: '-1.23%', up: false },
  { name: 'EUR/USD',   val: '1.0832',   chg: '+0.09%', up: true  },
  { name: 'CRUDE OIL', val: '$70.42',   chg: '-0.74%', up: false },
  { name: 'ETH',       val: '$3,124',   chg: '+2.14%', up: true  },
  { name: 'SILVER',    val: '$29.84',   chg: '+0.44%', up: true  },
];

export function renderTicker(containerId = 'ticker-track') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const items = [...TICKER_DATA, ...TICKER_DATA] // duplicate for seamless loop
    .map(t => `
      <div class="ticker-item">
        <span class="t-name">${t.name}</span>
        <span>${t.val}</span>
        <span style="color:var(--${t.up ? 'accent' : 'red'})">${t.chg}</span>
      </div>`)
    .join('');
  el.innerHTML = items;
}


// ── GLOBAL ERROR HANDLER ──────────────────────────────────────
// Catches uncaught promise rejections and shows a toast.
// Non-intrusive — only fires in non-production or for real errors.

window.addEventListener('unhandledrejection', event => {
  const msg = event.reason?.message || '';
  // Suppress Supabase auth noise that's expected
  if (msg.includes('AuthRetryableFetchError') || msg.includes('Failed to fetch')) return;
  console.error('[HCP] Unhandled rejection:', event.reason);
});


// ── PAGE TITLE HELPER ─────────────────────────────────────────

export function setPageTitle(title) {
  document.title = title ? `${title} — HedgeCapitalPro` : 'HedgeCapitalPro';
}


// ── AUTO-INIT ─────────────────────────────────────────────────
// Pages can opt into auto-init by adding data-auto-init to <body>.
// <body data-auto-init> → calls initApp() automatically.

if (document.body?.dataset?.autoInit !== undefined) {
  document.addEventListener('DOMContentLoaded', () => initApp());
}
