import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { api } from '@/lib/api';

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
  // Pages Router's router.pathname is the file-route path with basePath,
  // locale, and trailing slash already excluded (unlike App Router's
  // usePathname(), which doesn't strip basePath at all — the reason this
  // app was on the App Router originally got stuck rendering the wrong
  // page forever under the /v1/admin basePath). No stripping needed here.
  const pathname = router.pathname;

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
        const id = router.query.id;
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
