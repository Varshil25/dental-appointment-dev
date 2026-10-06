import rateLimit from 'express-rate-limit';
import { verifyBearer } from './auth.js';

// No auth layer exists anywhere in this system yet, so every public,
// unauthenticated write/lookup endpoint the patient-facing site exposes
// (booking, the manage-my-appointment reference lookup, and the contact
// form) is reachable by anyone on the internet — these limiters are the
// only thing standing between that and a bot hammering them. Keyed on IP
// (express's default keyGenerator) since there's no patient identity to
// key on instead.

const jsonLimitHandler = (_req, res) => {
  res.status(429).json({ error: 'too many requests — please wait a bit and try again' });
};

// Booking creation, the appointment reference lookup, and inquiry
// submission are all "a stranger types some data and it gets stored /
// emailed" endpoints — the ones worth limiting tightest since each hit
// can also trigger an outbound email.
export const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  // Staff dashboard writes (status changes, reschedules) share these
  // prefixes but are already authenticated — see generalLimiter below.
  skip: (req) => verifyBearer(req) !== null,
  standardHeaders: true,
  legacyHeaders: false,
  message: undefined,
  handler: jsonLimitHandler,
});

// The manage-my-appointment lookup doubles as a guessing oracle for
// (id, contact) pairs — tighter than the general write limiter above.
export const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

// Broad safety net across all of /api/*, generous enough to never bother a
// real browsing session (dozens of GETs per page load between clinic
// profile, dentists, and slots). Skipped for requests carrying a valid
// staff JWT: the admin dashboard makes many calls per page plus a 20s
// poll on the appointments view, and its traffic can arrive through the
// frontend's /api/* rewrite sharing one upstream IP — so signed-in staff
// were burning through this anonymous-abuse budget and getting 429s.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: (req) => verifyBearer(req) !== null,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

// The chatbot calls the paid Gemini API on every message — this caps
// cost exposure, not just abuse, so it's tighter than writeLimiter despite
// chat messages not writing anything to a database.
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimitHandler,
});

// Wraps a limiter so it only runs for the given HTTP methods — lets a
// stricter limiter sit on the same prefix as the general one without
// double-penalizing plain GETs (e.g. GET /api/appointments/:id for the
// manage page vs. POST /api/appointments/lookup on the same prefix).
export function forMethods(methods, limiter) {
  const set = new Set(methods.map((m) => m.toUpperCase()));
  return (req, res, next) => (set.has(req.method) ? limiter(req, res, next) : next());
}
