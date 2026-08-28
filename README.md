# 🦷 Dental Clinic Appointment Booking & Reminder System

A working prototype that replaces phone-call / paper / spreadsheet appointment
management with a single system covering **booking, cancellation, rescheduling,
follow-ups, automated email reminders, patient records, and admin reporting**.

Built for the brief: *"Dental clinics lose time and revenue when patients miss
appointments, cancel late, or when bookings are manually managed."*

---

## What it does

| Capability | How the prototype delivers it |
|---|---|
| **Appointment scheduling** | Slot-based calendar per dentist (working hours + slot length). Open slots are shown; taken slots are disabled. |
| **No double-booking** | Every booking/reschedule checks for an overlapping appointment for that dentist and rejects conflicts (HTTP 409). |
| **Automated reminders** | On booking, reminders are scheduled at configurable offsets (default **48h and 2h** before). A cron job scans every minute and sends **real emails**. |
| **Cancellation handling** | One-click cancel with optional reason; patient gets a cancellation email; pending reminders are voided. |
| **Rescheduling** | Move an appointment to a new open slot; reminders are re-issued for the new time. |
| **Follow-ups** | From a completed visit, book a linked follow-up appointment (with its own reminders + email). |
| **Patient records** | Searchable patient list with contact details, notes, and full appointment history. |
| **Admin reporting** | Dashboard with upcoming count, no-show rate, cancellation rate, reminders sent, status breakdown, and per-dentist load. |

---

## Architecture

A microservices split of the original monolith — each domain owns its data
in its own **Neon Postgres database**, talks to the others over plain HTTP,
and sits behind a single API Gateway so the frontend still calls one
relative `/api/*` origin with zero code changes.

```
frontend (Next.js + shadcn/ui, static export)  ──/api──►  gateway (reverse proxy, :4000)
                                              │
        ┌───────────────┬───────────────┬────┼────────────────┬─────────────────┐
        ▼               ▼               ▼    ▼                ▼                 ▼
  patient-service  dentist-service  appointment-service  reminder-service  report-service
     :4001             :4002             :4003               :4004            :4006
 (Neon db:        (Neon db:         (Neon db:           (Neon db:          (no DB —
  patient_service)  dentist_service)  appointment_service) reminder_service) composes the
                          │                 │                   │           others' data)
                          └──── slots ◄─────┘                   │
                          (taken/available)                     ▼
                                                          notification-service
                                                                :4005
                                                          (nodemailer, no DB)
```

- Each stateful service owns exactly one table and one **Neon Postgres
  database** — no shared database, no cross-service SQL joins. All 4 live in
  the same Neon *project* (Neon's free tier is one project) but as 4
  separate *databases* within it, so they stay as isolated as separate
  SQLite files were.
- Services that need another service's data call its HTTP API: dentist-service
  asks appointment-service for taken slots; appointment-service validates
  `patient_id`/`dentist_id` against patient-/dentist-service before booking
  (and fails closed with `503` if it can't reach them — that HTTP check is
  now the only integrity guard, since the SQL foreign keys are gone);
  report-service has no database of its own and composes the whole
  `/reports/summary` response from the other services' APIs.
- Reminders are decoupled from appointment-service's uptime: when
  appointment-service schedules/reschedules/cancels a reminder, it pushes a
  denormalized snapshot (patient email/name, dentist name, start time,
  reason) into reminder-service, so its cron loop never has to call back.
- The **gateway** does pure prefix reverse-proxying (`/api/patients/*` →
  patient-service, etc.) — no path rewriting, no business logic.
- **Frontend** — Next.js (App Router) with shadcn/ui components, built as a
  static export (`output: 'export'` in `next.config.mjs`) — fully
  client-rendered, no server-side rendering or Server Actions, so it stays a
  free static site rather than a paid always-on Node service. Next.js
  doesn't support `rewrites()` together with static export, so `lib/api.js`
  calls the gateway directly (`http://localhost:4000`) in local dev and a
  relative `/api/*` path in production, where `render.yaml`'s static-site
  route rewrite proxies it to the deployed gateway.

### Data model
Same as before, just split across services: `patients` (patient-service) ·
`dentists` (dentist-service) · `appointments` (appointment-service; status:
booked / completed / cancelled / no_show; optional `follow_up_of` link) ·
`reminders` (reminder-service; per-appointment, per-offset, status: pending /
sending / sent / failed / skipped, plus a denormalized patient/dentist/appt
snapshot so it never needs to call appointment-service back).

---

## Running it

**Requirements:** Node 22.5+ · a free [Neon](https://neon.tech) account.

### 0. Create the Neon databases (one time)

1. Create a Neon project (any region).
2. Inside it, create **4 databases** — the Neon console's SQL editor or the
   `neonctl` CLI both work; via SQL editor, connect to the default database
   and run:
   ```sql
   CREATE DATABASE patient_service;
   CREATE DATABASE dentist_service;
   CREATE DATABASE appointment_service;
   CREATE DATABASE reminder_service;
   ```
3. Grab a connection string per database from the Neon console (**Connect**
   → pick the database from the dropdown) — they're identical except for
   the database name at the end, e.g.:
   ```
   postgresql://user:password@ep-xxxx.neon.tech/patient_service?sslmode=require
   ```

`notification-service` and `report-service` don't touch a database at all —
notification-service just sends email, report-service composes its response
live from the other services' APIs.

### 1. Backend services

Each service is independent — install and configure each the same way:

```bash
cd services/<service-name>   # e.g. services/patient-service
npm install
cp .env.example .env         # then paste in DATABASE_URL for the 4 with one
npm start
```

Start them in this order so cross-service calls succeed once you seed data
(each service listens on the fixed local port below):

| Service | Port | Needs `DATABASE_URL` |
|---|---|---|
| notification-service | 4005 | no |
| dentist-service | 4002 | yes → `dentist_service` |
| patient-service | 4001 | yes → `patient_service` |
| reminder-service | 4004 | yes → `reminder_service` |
| appointment-service | 4003 | yes → `appointment_service` |
| report-service | 4006 | no |
| gateway | 4000 | no |

Each of the 4 stateful services creates its own table(s) automatically on
first boot (`CREATE TABLE IF NOT EXISTS`) — no separate migration step.

Only `notification-service`'s `.env` needs the SMTP settings described
below; `appointment-service` and `reminder-service` share the clinic-display
and reminder-offset settings.

### 2. Seed sample data (once every service above is running)
```bash
node scripts/seed-all.js
```
Calls each service's real HTTP API in dependency order (dentists → patients →
past appointments → upcoming appointments), loading the same realistic
sample clinic the old monolith's `seed.js` did.

### 3. Frontend (separate terminal)
```bash
cd frontend
npm install
npm run dev               # http://localhost:3000
```

Open **http://localhost:3000**. In dev it calls the gateway directly at
`:4000` (see the Architecture note above on why); in production it goes
through `render.yaml`'s `/api/*` rewrite instead.

Built with [Next.js](https://nextjs.org) (App Router, JavaScript) and
[shadcn/ui](https://ui.shadcn.com) components on Tailwind CSS v4.

---

## Deploying (Render + Neon)

`render.yaml` at the repo root is a Render Blueprint defining all 7 backend
services and the static frontend site, plus the env-var wiring between them.
The frontend's `npm run build` runs `next build`, which — with
`output: 'export'` set in `frontend/next.config.mjs` — emits a static site
to `frontend/out/`, matching `render.yaml`'s `staticPublishPath: out`.
Push this repo to a Git host, create a new Blueprint in the Render dashboard
pointing at it, and fill in the `sync: false` values it prompts for: the 4
`DATABASE_URL`s (your Neon connection strings — same ones from step 0 above)
and the notification-service SMTP values. Render's Blueprint schema changes
over time — double-check the `fromService`/`property` fields in
`render.yaml` against Render's current docs before deploying.

---

## Email setup (real reminders)

The prototype sends **real** emails. Configure SMTP in
`services/notification-service/.env`:

- **Easiest / safest — Mailtrap** (`https://mailtrap.io`): a fake inbox that
  captures everything, so nothing reaches real patients. Paste its SMTP creds.
- **Gmail:** create an *App Password* (Google Account → Security → 2-Step
  Verification → App passwords) and use it as `SMTP_PASS`.

**If SMTP is left blank**, the app still works: it uses a throwaway *Ethereal*
test inbox and logs a **preview URL** for every email (also shown as a "preview"
link in the Reminders page). Great for demos with zero setup.

> The seeded first patient uses `varshilce@gmail.com`, so with real SMTP
> configured you'll receive an actual reminder in your own inbox.

## SMS setup (real reminders, optional)

The prototype also sends **real** SMS reminders via Twilio, alongside email —
a reminder with a patient phone on file gets both an `email` and an `sms` row
(see the `channel` column in the Reminders page). Configure Twilio in
`services/notification-service/.env`; see that file's comments for exactly
where to find each value in the Twilio console. **If any of the four
`TWILIO_*` vars are left blank, SMS sending is silently disabled** — the app
still runs and email reminders keep working. To send one test SMS and
confirm delivery before relying on the full reminder flow:

```bash
node scripts/test-sms.js +15551234567
```

### Reminder config (`services/reminder-service/.env`)
```
REMINDER_OFFSETS_HOURS=48,2     # when to remind, hours before
REMINDER_CRON=* * * * *         # how often to scan (every minute)
```

**Demo tip:** to see the automatic scheduler fire (not just "Send now"), set
`REMINDER_OFFSETS_HOURS=0.02` and book a slot a couple of minutes out — the cron
job will email it within a minute.

---

## API reference

Full interactive Swagger UI (requests, response schemas, error codes) is
served by the gateway at **http://localhost:4000/api-docs** once it's
running — spec source at `services/gateway/src/openapi.yaml`, raw JSON at
`/api-docs.json`.

Quick summary:

```
GET    /api/health
GET    /api/dentists
GET    /api/dentists/:id/slots?date=YYYY-MM-DD
GET    /api/patients        POST /api/patients        GET /api/patients/:id
GET    /api/appointments?status=&from=&to=&dentistId=&patientId=
POST   /api/appointments                         # book
PATCH  /api/appointments/:id/reschedule
PATCH  /api/appointments/:id/cancel
PATCH  /api/appointments/:id/status              # completed | no_show | booked
POST   /api/appointments/:id/follow-up
GET    /api/reminders?appointmentId=
POST   /api/reminders/:id/send                   # send now
GET    /api/reports/summary?from=&to=
```

---

## Evaluation notes (from the brief)

**Usability.** Reception-oriented flow: book in three steps on one screen; taken
slots are visibly struck through; status is colour-coded; every action gives a
toast confirmation. Follow-ups and reschedules reuse the same slot picker.

**Clinic efficiency.** Double-booking is structurally impossible via the slot
check. Reminders are automatic, cutting the manual call/confirm workload that
drives no-shows. The dashboard surfaces no-show and cancellation rates so the
clinic can act on them.

**Patient communication.** Automated, templated emails at booking, before the
visit, on cancellation, and for follow-ups — consistent and timely, replacing
ad-hoc phone calls.

**Privacy.** This is a prototype, so it deliberately keeps PII minimal (name,
email, phone, DOB, notes), stored in 4 separate Neon Postgres databases (one
per owning service) reached over TLS (`sslmode=require`). For production the
following would be required and are **out of scope here**: authentication &
role-based access for staff, encryption in transit for inter-service HTTP
calls (currently plain HTTP — fine within a private network, not over the
open internet), audit logging, data-retention/consent controls, and
jurisdiction-specific health-data compliance (e.g. HIPAA / GDPR). No card or
clinical-imaging data is collected. Each service's `.env` (Neon connection
string, SMTP secrets, seed token) is git-ignored (see root `.gitignore`).

**Limitations / next steps.** No auth yet; single clinic/timezone (server-local);
SMS reminders are wired up via Twilio (see "SMS setup" above) alongside email, using the same `channel` field; reminders
are best-effort (a failed send is logged and can be retried via "Send now").
