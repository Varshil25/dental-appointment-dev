'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/api';

// This app is served under the `/v1/admin` basePath (see next.config.mjs)
// whether hit directly at this service's own URL or reverse-proxied in
// from patient-frontend's origin. On this static export, next/navigation's
// usePathname() does not reliably reflect the real runtime URL — in
// production it stayed stuck on a build-time value that never matched any
// bare-path comparison (BARE_PATHS, PUBLIC_PATHS, ADMIN_ONLY_PATHS), so
// the app got stuck rendering app-shell.jsx's loading skeleton forever.
// Went unnoticed locally since `next dev` doesn't hit this static-export
// code path at all, and only surfaced by actually opening the deployed
// site. useNormalizedPathname() below reads window.location.pathname
// directly instead — the one source of truth that's unambiguous — and
// still depends on usePathname() so it re-runs on client-side navigation.
const BASE_PATH = '/v1/admin';
function stripBasePath(pathname) {
  return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || '/' : pathname;
}

function currentPathname() {
  return typeof window !== 'undefined' ? stripBasePath(window.location.pathname) : '';
}

export function useNormalizedPathname() {
  const [pathname, setPathname] = useState(currentPathname);
  const nextPathname = usePathname();
  useEffect(() => {
    setPathname(currentPathname());
  }, [nextPathname]);
  return pathname;
}

// Token storage: localStorage, not an httpOnly cookie. This frontend is a
// static export (`output: 'export'` in next.config.mjs) — there is no
// Next.js server of its own to ever set a cookie from, in dev or in prod.
// The only real server in this picture is the gateway/auth-service, and in
// local dev the frontend calls it cross-origin (localhost:3000 ->
// localhost:4000), where a cookie would need `SameSite=None; Secure` — and
// `Secure` cookies are dropped over plain http, which local dev always is.
// A plain Bearer token in localStorage, sent via the Authorization header
// (see lib/api.js), works identically in dev and prod (where render.yaml's
// rewrite makes the gateway same-origin) without fighting cookie flags.
// The tradeoff is XSS exposure (a script that gets to run on this origin
// can read the token) rather than a cookie's CSRF exposure — reasonable for
// a staff-only dashboard with no untrusted user-generated content rendered
// on it.
const TOKEN_KEY = 'auth_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Pure fetch, no setState — kept separate from `refresh` below so every
// state update stays textually inside a .then() callback rather than in
// the body of a function called directly from an effect. This repo's
// react-hooks lint config (react-hooks/set-state-in-effect) statically
// flags a setState call reachable in a function invoked by-reference from
// a useEffect body, even one only reached after an await — it isn't
// tracing real control flow, so the fix is structural, not just deferring
// with an await.
async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    return await api.me();
  } catch {
    // Covers an expired/invalid token AND a token whose session was
    // invalidated server-side by a password reset (GET /me is the one
    // place that re-checks token_version — see auth-service's routes).
    clearToken();
    return null;
  }
}

const AuthContext = createContext(null);

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
// Exact-path admin-only areas — a doctor hitting any of these is bounced to
// '/'. '/dentists' (the full directory) is admin-only too; a doctor's own
// profile lives at '/dentists/detail?id=<their own dentist_id>', which is
// checked separately below since it needs the query param, not just the
// path.
const ADMIN_ONLY_PATHS = ['/clinic-settings', '/inquiries', '/patients', '/reminders', '/dentists', '/dentist-applications'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = useNormalizedPathname();

  const refresh = useCallback(() => {
    return fetchCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
      return u;
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Route protection — runs on every navigation, not just at mount, so a
  // doctor can't get to an admin-only page by clicking a link either.
  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.includes(pathname);

    if (!user && !isPublic) {
      router.replace('/login');
      return;
    }
    if (user && isPublic) {
      router.replace('/');
      return;
    }
    if (user?.role === 'doctor') {
      if (ADMIN_ONLY_PATHS.includes(pathname)) {
        router.replace('/');
        return;
      }
      if (pathname === '/dentists/detail') {
        // Read the query string directly rather than via useSearchParams()
        // — that hook requires a <Suspense> boundary during Next's static
        // export build, and AuthProvider wraps every page in the app, so
        // pulling it in here would force every single page into that
        // boundary. This runs client-side only (inside an effect, after
        // mount), where window.location is always available.
        const id = new URLSearchParams(window.location.search).get('id');
        if (id && String(id) !== String(user.dentist_id)) {
          router.replace(`/dentists/detail?id=${user.dentist_id}`);
        }
      }
    }
  }, [user, loading, pathname, router]);

  async function logout() {
    api.logout().catch(() => {});
    clearToken();
    setUser(null);
    router.replace('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
