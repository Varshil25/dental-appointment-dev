import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { mountProxies } from './proxyRoutes.js';
import { aggregatedHealth } from './health.js';
import { mountDocs } from './docs.js';
import { generalLimiter, writeLimiter, lookupLimiter, chatLimiter, forMethods } from './rateLimit.js';
import chatRouter from './routes/chat.js';
import {
  requireAuth,
  requireRole,
  scopeAppointmentsList,
  requireOwnAppointmentOrAdmin,
  requireOwnDentistOrAdmin,
} from './auth.js';

const app = express();
app.use(cors());

// Registered before the proxies below so it's answered by the gateway
// itself rather than forwarded anywhere.
app.get('/api/health', aggregatedHealth);
mountDocs(app);

// Rate limiting — registered before mountProxies() so it runs first on
// every matching prefix; see rateLimit.js for why each endpoint gets the
// limiter it does. `/api/appointments/lookup` matches both prefixes below
// (Express's app.use matches by path prefix), so the appointments write
// limiter explicitly skips it — a lookup counts only against the tighter
// lookupLimiter budget, not both.
app.use('/api', generalLimiter);
app.use('/api/appointments/lookup', lookupLimiter);
app.use(
  '/api/appointments',
  forMethods(['POST', 'PATCH'], (req, res, next) => (req.path === '/lookup' ? next() : writeLimiter(req, res, next)))
);
app.use('/api/inquiries', forMethods(['POST'], writeLimiter));
// Only the public application-submission POST '/' needs this — the
// approve/reject actions on the same prefix are admin-only writes already
// gated by auth below, same distinction appointments draws for '/lookup'.
app.use('/api/dentist-applications', forMethods(['POST'], (req, res, next) => (req.path === '/' ? writeLimiter(req, res, next) : next())));
app.use('/api/patients', forMethods(['POST'], writeLimiter));
app.use('/api/chat', forMethods(['POST'], chatLimiter));

// Handled locally (not proxied) — it calls the Anthropic API server-side
// rather than forwarding to a backend microservice, so it's mounted here
// alongside /api/health rather than added to proxyRoutes.js's prefix table.
// express.json() is scoped to this one path so the proxy routes below keep
// streaming raw request bodies through http-proxy-middleware unparsed.
app.use('/api/chat', express.json(), chatRouter);

// Access control — registered as exact method+path routes ahead of
// mountProxies() below, so each runs only for the request it targets and
// then falls through (via next()) to the matching proxy prefix. Everything
// NOT listed here stays exactly as it was before auth-service existed:
// public and unauthenticated. That's deliberate, not an oversight — several
// of these routes are called directly, with no login, by the public
// patient-frontend (booking, the patient-side reschedule/cancel-by-
// reference flow, patient search/creation during booking, clinic-profile
// reads) and must keep working unauthenticated. Only the routes below,
// which are staff-only actions or expose clinic-wide data, gain a check.
//
// Appointments — GET '/' (the full list) and the two id-scoped staff-only
// actions (status change, follow-up) require login; POST '/' (booking),
// '/lookup', and PATCH '/:id/reschedule' | '/:id/cancel' are the patient
// self-service surface and stay public, matching FR-4/FR-5 in the BRD.
app.get('/api/appointments', requireAuth, scopeAppointmentsList);
app.patch('/api/appointments/:id/status', requireAuth, requireOwnAppointmentOrAdmin);
app.post('/api/appointments/:id/follow-up', requireAuth, requireOwnAppointmentOrAdmin);

// Patients — GET '/' (list/search) and POST '/' (create) power the
// patient-frontend booking wizard's returning-patient lookup and stay
// public; a single patient's full record (DOB, notes) is staff-only.
app.get('/api/patients/:id', requireAuth);
app.put('/api/patients/:id', requireAuth);

// Dentists — the public directory (GET '/'), a single dentist (GET '/:id'),
// and slot availability (GET '/:id/slots') stay public (patient-frontend
// booking + the chat widget read them). Creating a dentist is admin-only;
// editing a profile or weekly availability is admin-or-that-dentist's-own-
// doctor-account. (Known limitation: a doctor editing their own profile via
// PUT '/:id' can also flip their own `status` field — the gateway doesn't
// parse proxied bodies to strip that out; see src/auth.js.)
app.post('/api/dentists', requireAuth, requireRole('admin'));
app.put('/api/dentists/:id', requireAuth, requireOwnDentistOrAdmin);
app.get('/api/dentists/:id/availability', requireAuth, requireOwnDentistOrAdmin);
app.put('/api/dentists/:id/availability', requireAuth, requireOwnDentistOrAdmin);

// Clinic profile — GET stays public (patient-frontend + the chat widget
// read it); PUT is the exact "restrict to admin role" the TODOs left in
// dentist-service/src/routes/clinicProfile.js and the frontend were
// waiting on.
app.put('/api/clinic-profile', requireAuth, requireRole('admin'));

// Inquiries — POST (the public contact form) stays public; reading/
// triaging submitted inquiries is staff-only.
app.get('/api/inquiries', requireAuth, requireRole('admin'));
app.patch('/api/inquiries/:id/status', requireAuth, requireRole('admin'));

// Reminders and reports are staff-only in full; unlike appointments,
// reminder rows don't carry a dentist_id to scope by (see reminder-
// service's db.js — only a denormalized dentist *name*), so rather than an
// incomplete/approximate scoping this keeps both admin-only for now.
app.use('/api/reminders', requireAuth, requireRole('admin'));
app.use('/api/reports', requireAuth, requireRole('admin'));

// Admin-only account creation — auth-service also independently re-checks
// the token itself (see its middleware/auth.js), so this is defense in
// depth, not the only gate.
app.post('/api/auth/users', requireAuth, requireRole('admin'));

// Dentist applications — POST '/' (the public application form, submitted
// from patient-frontend's /join-as-dentist) stays public; listing, reading,
// approving, and rejecting are staff review actions, admin-only. auth-
// service's routes/dentistApplications.js independently re-checks these
// too, same defense-in-depth posture as POST /api/auth/users above.
app.get('/api/dentist-applications', requireAuth, requireRole('admin'));
app.get('/api/dentist-applications/:id', requireAuth, requireRole('admin'));
app.post('/api/dentist-applications/:id/approve', requireAuth, requireRole('admin'));
app.post('/api/dentist-applications/:id/reject', requireAuth, requireRole('admin'));

mountProxies(app);

app.use((req, res) => res.status(404).json({ error: 'not found' }));

app.listen(config.port, () => {
  console.log(`\n🦷  Gateway listening on http://localhost:${config.port}`);
  console.log(`    API docs at http://localhost:${config.port}/api-docs`);
});
