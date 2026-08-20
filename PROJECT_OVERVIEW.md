# Dental Clinic Appointment Booking & Reminder System

## Project Overview & Business Requirements Document (BRD)

**Document version:** 1.0
**Status:** Living document — reflects the system as currently implemented
**Related docs:** `README.md` (setup/run/deploy instructions), `services/gateway/src/openapi.yaml` (full API spec, served interactively at `/api-docs`)

---

## 1. Executive Summary

The Dental Clinic Appointment Booking & Reminder System is a full-stack, multi-service
web application that replaces manual (phone-call / paper / spreadsheet) appointment
management for a dental clinic. It covers the complete patient-appointment lifecycle —
booking, rescheduling, cancellation, follow-ups — plus automated multi-channel
reminders (email and SMS), patient record-keeping, and an admin reporting dashboard.

It is built as a **microservices architecture** (7 backend services behind a single API
gateway) with a **Next.js + shadcn/ui** frontend, **Neon Postgres** for persistence,
and an optional **Redis** read-through caching layer for low-latency reads.

---

## 2. Feature List

### 2.1 Appointment Scheduling & Booking
- Slot-based calendar per dentist, derived from each dentist's configurable working
  hours (default 09:00–17:00) and slot length (default 30 minutes).
- Real-time availability: taken slots are computed live against booked appointments
  and shown as unavailable/struck-through in the UI.
- **Double-booking prevention** — every booking or reschedule is checked server-side
  for an overlapping appointment on that dentist and rejected with `409 Conflict`.
- Booking rejects times in the past (`400`).
- Custom duration support — a booking can override the dentist's default slot length
  via `duration_minutes` or an explicit `end` time.

### 2.2 Appointment Lifecycle Management
- **Reschedule** — move a booked appointment to a new open slot; reminders are
  cancelled and re-issued for the new time automatically.
- **Cancel** — one-click cancellation with an optional reason; triggers a
  cancellation email/SMS and voids any pending reminders for that appointment.
- **Status tracking** — `booked → completed | no_show`, plus `cancelled`, updatable
  by staff from the appointments list.
- **Follow-ups** — book a new appointment linked to a prior one (`follow_up_of`),
  carrying its own reminders and confirmation notice.

### 2.3 Patient Management
- Full patient records: name, email, phone, date of birth, free-text notes.
- Searchable patient list with live query.
- Duplicate-email prevention at creation time.
- Phone validation requiring an explicit country code (E.164-style, e.g.
  `+15551234567`) via a dedicated country-code picker component, so the same local
  number from two countries is never silently conflated.
- Per-patient appointment history, composed live from appointment- and
  dentist-service (no data duplication).

### 2.4 Dentist Management
- Dentist directory with name, specialty, and email.
- Configurable per-dentist working hours and slot length, which directly drive the
  slot picker shown to reception/patients.

### 2.5 Automated Patient Communication (Email + SMS)
- **Email** (real SMTP delivery via `nodemailer`) sent for: booking confirmation,
  cancellation, follow-up booking, and every scheduled reminder. Branded HTML +
  plain-text templates. Falls back to a disposable Ethereal test inbox (with a
  logged preview URL) if no SMTP credentials are configured, so the system runs
  out-of-the-box with zero setup.
- **SMS** (real delivery via Twilio) sent in parallel with the same four triggers,
  whenever a patient has a phone number on file. Fails soft (logs and continues,
  never blocks the underlying booking/cancellation/reminder) if Twilio isn't fully
  configured.
- **Reminders** — scheduled automatically on every booking at configurable offsets
  before the appointment (default: 48h and 2h before). A cron job scans for due
  reminders every minute and dispatches them. Each offset produces an independent
  email reminder and, when a phone number exists, an independent SMS reminder — so
  one channel failing never blocks the other. Reminder status is tracked per row
  (`pending → sending → sent | failed | skipped`) with a manual "Send now" action
  for demos/retries.

### 2.6 Admin Dashboard & Reporting
- **Live stat tiles**: Total Patients, Total Appointments, Total Completed, Total
  Cancelled, Total No-Shows, Monthly Appointments, Daily Appointments, Upcoming
  Appointments, No-show Rate, Cancellation Rate, Reminders Sent.
- **Appointments-by-status breakdown** with proportional bars.
- **Per-dentist load** table (kept / no-shows / cancelled).
- **Appointments — last 14 days** bar chart (accessible, colorblind-safe palette,
  interactive tooltip).
- **Downloadable PDF report** — one-click export of the full summary (via `pdfkit`),
  branded with clinic name/phone/address.
- All dashboard data is composed live from the other services with no data
  duplication; report-service itself holds no database.

### 2.7 Performance: Redis Read-Through Caching
- Optional Redis cache in front of the most expensive read paths across all 5
  data-owning services (patient, dentist, appointment, reminder, report).
- **Read-through**: cache hit returns in single-digit milliseconds; cache miss
  falls through to Postgres/composition and populates the cache.
- **Write-invalidation**: every booking/reschedule/cancel/status-change/create/update
  invalidates the relevant cache keys immediately — no stale reads after a write.
- **Fails open**: if `REDIS_URL` is unset or Redis is unreachable, every service
  transparently falls back to hitting the database directly — caching is a pure
  performance layer, never a hard dependency.
- Measured impact: `GET /api/appointments` ~4.1s → ~10ms warm; `GET
  /api/reports/summary` (a 5-way parallel composition) ~2.4s → ~10ms warm.

### 2.8 API & Documentation
- Single **API Gateway** (`:4000`) reverse-proxies `/api/*` to the owning service —
  the frontend and any external integrator only ever talk to one origin.
- Full interactive **Swagger / OpenAPI** documentation served at `/api-docs`
  (spec source at `services/gateway/src/openapi.yaml`).

### 2.9 Frontend Experience
- **Next.js (App Router)** + **shadcn/ui** component library on Tailwind CSS v4,
  built as a static export for low-cost hosting.
- Classic black/white shadcn theme with a light/dark mode toggle.
- Responsive collapsible sidebar navigation, toast notifications, skeleton loading
  states, spinners, drawers/dialogs, and a full data-table view — consistent UI
  primitives throughout Book, Appointments, Patients, Reminders, and the Dashboard.

### 2.10 Deployment & Infrastructure
- `render.yaml` Render Blueprint defines all 7 backend services plus the static
  frontend site and the env-var wiring between them, for one-click deployment.
- **Neon Postgres** (serverless Postgres) — 4 independent databases, one per
  stateful service, all within a single free-tier Neon project.
- Each service manages its own schema (`CREATE TABLE IF NOT EXISTS` /
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on boot) — no separate migration step.

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router, JavaScript), shadcn/ui (Base UI), Tailwind CSS v4, Recharts |
| Backend | Node.js, Express |
| Database | Neon Postgres (serverless), one database per stateful service |
| Caching | Redis (`ioredis`), optional, fail-open |
| Email | Nodemailer (SMTP — Gmail / Mailtrap / Ethereal fallback) |
| SMS | Twilio |
| PDF generation | pdfkit |
| API Gateway | `http-proxy-middleware` |
| API Docs | OpenAPI 3 / Swagger UI |
| Hosting | Render (Blueprint deploy) |

---

## 4. System Architecture (Summary)

```
frontend (Next.js + shadcn/ui)  ──/api──►  gateway (reverse proxy, :4000)
                                              │
        ┌───────────────┬───────────────┬────┼────────────────┬─────────────────┐
        ▼               ▼               ▼    ▼                ▼                 ▼
  patient-service  dentist-service  appointment-service  reminder-service  report-service
     :4001             :4002             :4003               :4004            :4006
  (Neon Postgres)   (Neon Postgres)    (Neon Postgres)     (Neon Postgres)   (no DB — composes
                          │                 │                   │            the others' data)
                          └──── slots ◄─────┘                   │
                                                                 ▼
                                                          notification-service
                                                                :4005
                                                        (email via SMTP, SMS via Twilio)
```

Each stateful service owns exactly one domain's data — no shared database, no
cross-service SQL joins. Services needing another domain's data call its HTTP API
directly (e.g. appointment-service validates `patient_id`/`dentist_id` against
patient-/dentist-service before booking, and fails closed with `503` if it can't
reach them). See `README.md` for the full architecture notes and run/deploy steps.

---

## 5. Business Requirements Document (BRD)

### 5.1 Purpose

Dental clinics lose time and revenue when patients miss appointments, cancel late,
or when bookings are managed manually by phone, paper, or spreadsheets. This system
exists to digitize and automate the full appointment lifecycle, reduce no-shows
through automated reminders, and give clinic staff visibility into scheduling
performance — without requiring a large IT investment.

### 5.2 Business Objectives

| # | Objective | How the system addresses it |
|---|---|---|
| BO-1 | Reduce no-show rate | Automated, multi-channel (email + SMS) reminders at configurable offsets before each appointment |
| BO-2 | Eliminate double-booking | Server-enforced slot-conflict checks on every booking/reschedule |
| BO-3 | Reduce manual admin workload | Self-service booking/reschedule/cancel flow; automatic reminder dispatch; no manual calling |
| BO-4 | Improve patient communication | Consistent, branded, timely email + SMS at every lifecycle event |
| BO-5 | Give management visibility | Admin dashboard with real-time KPIs, trend chart, and exportable PDF report |
| BO-6 | Keep the system fast as data grows | Redis read-through caching on all hot read paths |
| BO-7 | Keep hosting/running costs low | Serverless Postgres (Neon free tier), static frontend hosting, free-tier Render services |

### 5.3 Scope

**In scope (delivered):**
- Appointment booking, rescheduling, cancellation, follow-ups, status tracking
- Patient and dentist record management
- Automated email and SMS reminders and lifecycle notifications
- Admin dashboard with KPIs, charts, and PDF export
- Performance caching layer
- API documentation
- Cloud deployment blueprint

**Out of scope (explicitly not built — prototype boundaries):**
- Staff authentication / role-based access control
- Multi-clinic / multi-location support
- Multi-timezone support (system is single-timezone, server-local)
- Payment processing / billing
- Clinical/medical records or imaging
- Patient self-service login portal
- Encryption in transit for inter-service HTTP calls (fine within a private
  network; would need TLS or a service mesh for a public/multi-tenant deployment)
- Audit logging, data-retention/consent tooling, and jurisdiction-specific
  health-data compliance (e.g. HIPAA, GDPR)

### 5.4 Stakeholders

| Role | Interest |
|---|---|
| Clinic reception staff | Fast, error-proof booking and rescheduling; clear daily/weekly view |
| Clinic management / owner | No-show and cancellation visibility; operational KPIs |
| Dentists | Accurate schedule; no double-booked slots |
| Patients | Easy booking; timely reminders and confirmations via email/SMS |
| Development/IT | Maintainable, independently deployable services; clear API contract |

### 5.5 Functional Requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-1 | Staff/patients can view a dentist's available slots for a given date | Must | Delivered |
| FR-2 | System prevents booking two appointments in the same dentist slot | Must | Delivered |
| FR-3 | System prevents booking a time in the past | Must | Delivered |
| FR-4 | Patients/staff can reschedule a booked appointment to a new open slot | Must | Delivered |
| FR-5 | Patients/staff can cancel an appointment with an optional reason | Must | Delivered |
| FR-6 | Staff can mark an appointment completed / no-show | Must | Delivered |
| FR-7 | Staff can book a follow-up linked to a prior appointment | Should | Delivered |
| FR-8 | System sends an automated email confirmation on booking | Must | Delivered |
| FR-9 | System sends an automated email on cancellation | Must | Delivered |
| FR-10 | System sends automated reminder emails at configurable offsets before an appointment | Must | Delivered |
| FR-11 | System sends the same lifecycle notifications via SMS when a phone number is on file | Should | Delivered |
| FR-12 | Staff can manually trigger ("send now") a pending or failed reminder | Should | Delivered |
| FR-13 | System prevents duplicate patient records by email | Must | Delivered |
| FR-14 | System validates patient phone numbers include a country code | Should | Delivered |
| FR-15 | Staff can search/filter the patient list | Should | Delivered |
| FR-16 | Staff can view a patient's full appointment history | Should | Delivered |
| FR-17 | Staff can create/configure dentists (working hours, slot length, specialty) | Must | Delivered |
| FR-18 | Dashboard shows total patients, total appointments, and status breakdown (completed/cancelled/no-show) | Must | Delivered |
| FR-19 | Dashboard shows daily and monthly appointment counts | Should | Delivered |
| FR-20 | Dashboard shows a trend chart of appointment volume over recent days | Should | Delivered |
| FR-21 | Dashboard shows no-show rate, cancellation rate, and reminders-sent count | Must | Delivered |
| FR-22 | Staff can export the dashboard summary as a PDF | Should | Delivered |
| FR-23 | All lifecycle-triggered messages continue to work (fail soft) if the SMS/email provider is unreachable or unconfigured | Must | Delivered |
| FR-24 | System exposes a documented, versioned API for all operations | Should | Delivered |

### 5.6 Non-Functional Requirements

| ID | Category | Requirement | Status |
|---|---|---|---|
| NFR-1 | Performance | Cached read endpoints respond in single-digit milliseconds on a warm cache | Delivered (Redis, measured ~4s→10ms) |
| NFR-2 | Reliability | A failed/unavailable notification provider (SMTP or Twilio) never blocks the underlying business operation | Delivered (fail-soft posture throughout) |
| NFR-3 | Reliability | A failed/unavailable cache never blocks a request | Delivered (Redis fail-open) |
| NFR-4 | Availability | If a dependency service is unreachable during a write that requires it (e.g. patient/dentist validation on booking), the system fails closed (rejects) rather than allowing invalid data | Delivered (`503` on unreachable dependency) |
| NFR-5 | Usability | Core booking flow completes in three steps on one screen | Delivered |
| NFR-6 | Usability | UI provides loading skeletons, spinners, and toast feedback for every async action | Delivered |
| NFR-7 | Maintainability | Each business domain is an independently deployable, independently owned service | Delivered (7-service microservice split) |
| NFR-8 | Security | Secrets (DB connection strings, SMTP/Twilio credentials) are never committed to source control | Delivered (`.env`, git-ignored) |
| NFR-9 | Security | Database connections use TLS | Delivered (`sslmode=require` on all Postgres connections) |
| NFR-10 | Portability | The whole system deploys via a single infrastructure-as-code blueprint | Delivered (`render.yaml`) |
| NFR-11 | Cost | The system runs entirely on free-tier cloud services for a prototype/demo scale | Delivered (Neon free tier, Render free tier, static frontend hosting) |

### 5.7 Assumptions & Constraints

- Single clinic, single timezone (server-local time) — multi-location/timezone is a
  future extension, not current scope.
- No staff authentication yet — the current deployment assumes a trusted internal
  network or is used for demo/prototype purposes; production use requires adding
  auth before exposing it publicly.
- Reminder/notification delivery depends on third-party providers (SMTP host,
  Twilio) being configured with valid, funded credentials; a Twilio **trial**
  account can only send SMS to verified numbers and requires an owned "From"
  number.
- Redis is optional infrastructure — its absence degrades performance but never
  breaks functionality.

### 5.8 Success Metrics / KPIs

- **No-show rate** and **cancellation rate**, tracked and surfaced directly on the
  Admin Dashboard (target: measurable reduction after reminder automation, vs. the
  clinic's prior manual-reminder baseline).
- **Reminder delivery rate** (`reminders sent` / `reminders scheduled`).
- **Booking-conflict rate**: target 0% — structurally enforced, not just monitored.
- **Dashboard/API response time**: target sub-50ms for cached reads (measured:
  ~10ms warm).

### 5.9 Risks

| Risk | Mitigation |
|---|---|
| Third-party outage (SMTP/Twilio/Neon/Redis) | Fail-soft/fail-open design throughout — core booking flow never depends on their availability |
| Trial-tier provider limits (Twilio trial restricts recipients; free-tier hosting cold starts) | Documented in setup docs; clear upgrade path when moving to production |
| No authentication in current scope | Documented explicitly as an out-of-scope item to close before any public-facing production deployment |
| Single-timezone assumption | Acceptable for a single-location prototype; flagged as a required change for multi-location expansion |

### 5.10 Glossary

| Term | Meaning |
|---|---|
| Slot | A fixed-length bookable time window for a specific dentist, derived from their working hours and slot length |
| Fail-soft | A failure in a non-critical dependency (e.g. SMS) is logged but does not stop the primary operation (e.g. booking) from succeeding |
| Fail-open (cache) | If the cache is unavailable, requests transparently fall back to the source of truth (the database) rather than erroring |
| Fail-closed (validation) | If a dependency required to validate a write is unreachable, the write is rejected rather than risking invalid data |
| Read-through cache | A cache that, on a miss, automatically fetches from the source of truth and populates itself before returning |
| Composed response | An API response built by a service (e.g. report-service) calling several other services and merging their data, without owning that data itself |
