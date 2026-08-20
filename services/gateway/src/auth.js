import jwt from 'jsonwebtoken';
import { config } from './config.js';

// Verifies the JWT's signature/expiry directly with the shared secret
// instead of calling auth-service on every proxied request. Chosen over
// "ask auth-service" because the gateway is otherwise a pure, stateless
// reverse proxy (see proxyRoutes.js) with no per-request backend
// round-trips of its own — adding one to authenticate every single API
// call would undercut that and add real latency to hot paths (slots,
// appointment list, etc.). The one thing this trades away is instant
// server-side revocation: a password reset bumps users.token_version in
// auth-service's database (see that service's db.js), but this gateway
// check never looks at it, so a token issued before a reset stays
// "valid" here until it naturally expires. GET /api/auth/me re-checks
// token_version against the database on every call, so the frontend
// catches a revoked session the next time it loads a page — see that
// route for the actual enforcement point.
function verifyBearer(req) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const user = verifyBearer(req);
  if (!user) return res.status(401).json({ error: 'authentication required' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'insufficient permissions' });
    next();
  };
}

// Doctor scoping for the appointments LIST route: forces dentistId to the
// doctor's own, overriding anything the client sent — GET /api/appointments
// otherwise returns every dentist's bookings (patient PII included), so a
// doctor must never be able to widen this by passing a different
// ?dentistId= themselves. Admins pass through with whatever filter (or
// none) they sent.
export function scopeAppointmentsList(req, _res, next) {
  if (req.user.role === 'doctor') {
    const url = new URL(req.url, 'http://internal');
    url.searchParams.set('dentistId', req.user.dentist_id);
    req.url = `${url.pathname}${url.search}`;
  }
  next();
}

// Doctor scoping for single-appointment write actions (status change,
// follow-up booking): admins may act on any appointment; a doctor may only
// act on one that's actually theirs. There's no dentist_id on the JWT-only
// side of this request (the appointment lives in appointment-service), so
// this fetches it directly — same "ask the owning service" cross-service
// pattern the rest of this app uses (e.g. appointment-service validating
// patient_id/dentist_id against patient-/dentist-service).
export function requireOwnAppointmentOrAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'insufficient permissions' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  fetch(`${config.services.appointment}/${req.params.id}`, { signal: controller.signal })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`appointment-service responded ${r.status}`))))
    .then((appt) => {
      if (String(appt.dentist_id) !== String(req.user.dentist_id)) {
        return res.status(403).json({ error: "you can only manage your own appointments" });
      }
      next();
    })
    .catch((err) => {
      console.error('[gateway] ownership check failed:', err.message);
      res.status(503).json({ error: 'unable to verify appointment ownership right now, please retry' });
    })
    .finally(() => clearTimeout(timeout));
}

// Doctor scoping for a dentist's own profile/availability: the dentist_id
// is already on the JWT, so unlike appointments this needs no extra
// network call — just compare path param to token claim.
export function requireOwnDentistOrAdmin(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'doctor' && String(req.user.dentist_id) === String(req.params.id)) return next();
  return res.status(403).json({ error: "you can only manage your own dentist profile" });
}
