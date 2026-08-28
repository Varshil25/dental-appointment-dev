# Deploy Checklist — Render + Neon

Follow this in order. `render.yaml` at the repo root is the Blueprint; everything
below is what you fill in by hand on Render's/Neon's dashboards (secrets never
live in the yaml).

> **Architecture note:** this codebase has no message queue anywhere — every
> inter-service call is synchronous HTTP, and the "async reminders" feature
> is `reminder-service` polling its own DB on a `node-cron` schedule
> (`REMINDER_CRON`), not a queue consumer. There is no RabbitMQ/CloudAMQP
> step in this checklist — skip any instructions elsewhere that mention it,
> they don't apply to this repo.

> **Private-network note:** every `*_SERVICE_URL` in render.yaml is a
> hardcoded public `https://...onrender.com` URL, not Render's
> `fromService: {property: hostport}`. That's required, not a style choice:
> `hostport` resolves to the *private* network address, and free-tier web
> services can send private-network requests but can't receive them
> (confirmed via Render's docs) — so on an all-`free` deploy like this one,
> any service-to-service call over the private network just hangs forever.
> This bit gateway hardest: its own `healthCheckPath` fans out to every
> backend service, so with `hostport` URLs the deploy's health check never
> returns and the first deploy times out. See section (d) for what this
> means for the hardcoded URLs after a fresh deploy.

> **Email note:** Render's free plan blocks outbound SMTP (ports 25/465/587)
> entirely — confirmed by every `notification-service` SMTP send attempt
> timing out regardless of credentials. `notification-service` now sends
> email via Resend's HTTP API (HTTPS, not blocked) instead when
> `RESEND_API_KEY` is set — see section (c). Without it, no email sends on
> this deploy, including staff OTP login codes.

> **Plan note:** every service runs on Render's `free` plan (no card on
> file, by choice). Consequence: free instances spin down after 15 minutes
> idle. For `reminder-service` this means the `node-cron` reminder loop
> silently stops firing while it's asleep, and only resumes once something
> wakes the service back up. If reminders need to fire reliably on a
> schedule, add a card and move `reminder-service` (and its dependencies —
> patient/dentist/appointment-service) to `starter` later.

> **KNOWN ISSUE — admin dashboard client-side routing:** `/v1/admin/login`
> (and presumably every other admin route) loads and hydrates correctly —
> the server sends the right per-route HTML (verified directly via curl) —
> but Next's client-side router then silently swaps in the DASHBOARD
> route's ('/') content instead, while the URL bar stays on `/login`. Not a
> redirect; confirmed by inspecting the live React tree (right URL, wrong
> mounted component) after ruling out every render.yaml/rewrite-level cause
> (all three earlier routing bugs in this file are genuinely fixed — asset
> loading, page-vs-SPA-catchall routing, all verified via curl before this
> was found). This matches a documented Next.js App Router limitation:
> static-export client-side navigation fetches per-route RSC payloads, and
> when that fetch can't resolve correctly — here, likely `basePath`
> (`/v1/admin`) combined with being served through a cross-origin reverse
> proxy — the router falls back silently instead of erroring
> (https://github.com/vercel/next.js/issues/59986 is the same class of
> bug). Options to actually fix, not yet attempted:
> 1. Force full page reloads for admin-app navigation instead of Next's
>    client-side router (e.g. plain `<a>` tags / `window.location`
>    assignments instead of `next/link` and `router.push/replace`) —
>    sidesteps RSC payload fetching entirely, at the cost of full reloads
>    between admin pages.
> 2. Migrate `frontend` from the App Router to the Pages Router, which
>    historically handles `basePath` more reliably and doesn't do
>    RSC-payload-based client navigation the same way.
> 3. Give the admin app its own real subdomain instead of a `basePath`
>    path-prefix nested behind a reverse proxy, removing the
>    `basePath`+cross-origin-proxy combination that's the likely trigger.
> Reproduces both via patient-frontend's proxy AND hitting `frontend`'s own
> onrender.com URL directly, in a fresh browser tab — not proxy-specific,
> not a caching/tab-state artifact.

## a) Neon — create the databases

One Neon project, five databases (one per stateful service — `report-service`
and `gateway` and `notification-service` have no DB of their own). In the Neon
console, open the SQL Editor against your project's default `neondb` and run:

```sql
CREATE DATABASE patient_service;
CREATE DATABASE dentist_service;
CREATE DATABASE appointment_service;
CREATE DATABASE reminder_service;
CREATE DATABASE auth_service;
```

Each service creates its own tables on first boot (see each service's `db.js`)
— nothing else to run by hand. Grab each database's connection string from
**Neon console → your project → Connect** (pick the database from the
dropdown) — that's the `DATABASE_URL` for the matching service below.

## b) ~~CloudAMQP~~ — not needed

Skip this. See the architecture note above — nothing in this codebase reads
`RABBITMQ_URL`.

## c) Environment variables — Render Blueprint setup

When you click "Apply" on the Blueprint, Render will prompt you for every
`sync: false` var below (the secrets). Plain `value:` fields in render.yaml
(clinic name/phone/address, `SMTP_HOST`/`SMTP_USER` placeholders, etc.) don't
need dashboard input — but note: those are blueprint-synced, so editing them
later in the dashboard instead of in `render.yaml` will get overwritten on the
next Blueprint sync/redeploy. Edit `render.yaml` directly for anything you
want to keep across redeploys.

**patient-service**
- `DATABASE_URL` — Neon console, `patient_service` database's connection string
- `REDIS_URL` — optional; a Redis connection string (Render Redis add-on, Upstash, etc.) or leave blank to run without the read-through cache

**dentist-service**
- `DATABASE_URL` — Neon console, `dentist_service` database
- `REDIS_URL` — optional, same as above

**appointment-service**
- `DATABASE_URL` — Neon console, `appointment_service` database
- `REDIS_URL` — optional, same as above
- `SEED_TOKEN` — auto-generated by the Blueprint (`generateValue: true`), nothing to enter; find the generated value later in this service's Environment tab if you need it for `scripts/seed-all.js`

**reminder-service**
- `DATABASE_URL` — Neon console, `reminder_service` database
- `REDIS_URL` — optional, same as above

**notification-service**
- `RESEND_API_KEY` — **required for email to work at all on this deploy.** Free key at resend.com (3,000/month, no card). Render's free plan blocks outbound SMTP entirely (confirmed: every SMTP send attempt times out), so `SMTP_PASS`/`SMTP_HOST` below never work here regardless of how correctly they're filled in — don't bother configuring them unless you've moved this service off the free plan. Until you verify a sending domain in Resend, sandbox mode restricts `MAIL_FROM` to `onboarding@resend.dev` and only delivers to the address your Resend account is registered under — real patient delivery needs a verified domain there
- `SMTP_PASS` — only relevant off Render's free plan; Gmail App Password or your SMTP provider's password (e.g. Mailtrap)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` — optional; Twilio console (console.twilio.com) → Account dashboard for the SID/Auth Token, Phone Numbers → Manage → Active Numbers for the from-number. Leave all three blank to disable SMS (email keeps working). Twilio's API is HTTPS, not SMTP, so it isn't affected by the port-blocking above

**auth-service**
- `DATABASE_URL` — Neon console, `auth_service` database
- `JWT_SECRET` — generate a random secure string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` — **must be pasted identically into gateway's `JWT_SECRET` too** (gateway verifies tokens auth-service issues without calling back)
- `SEED_TOKEN` — auto-generated by the Blueprint, same as appointment-service's

**report-service**
- `REDIS_URL` — optional, same as above

**gateway**
- `JWT_SECRET` — same exact value as auth-service's, see above
- `GEMINI_API_KEY` — optional; Google AI Studio (aistudio.google.com/apikey). Leave blank to disable the patient-frontend chat widget (its endpoint 503s cleanly instead of crashing the gateway)

**frontend** (admin static site) and **patient-frontend** (public static site)
— no secrets; both build with `npm install && npm run build`.

## d) Post-deploy: fix the hardcoded service URLs if needed

`render.yaml` hardcodes every inter-service URL and static-site route
destination as a literal `https://<service name>-<suffix>.onrender.com`
(see the private-network note above for why these can't be `fromService`).
The exact suffixes currently in the file match **this specific deployment**
— they will NOT match a fresh one, because Render appends a random suffix
to a service's default subdomain whenever the plain name is already taken
(true for every service here except `dentist-service`, which had no
suffix).

**If you tear down and recreate these services from scratch:**

1. After the first deploy, open each service in the Render dashboard and
   note its actual URL (shown at the top of the service page).
2. Update every place that references it in `render.yaml`:
   - Every other service's `*_SERVICE_URL` env var that points at it (e.g.
     appointment-service's URL is the value of `APPOINTMENT_SERVICE_URL` on
     patient-service, dentist-service, report-service, and gateway)
   - `frontend`'s and `patient-frontend`'s `/api/*` route → gateway's URL
   - `patient-frontend`'s `/v1/admin/*` route → `frontend`'s URL
   - `auth-service`'s `FRONTEND_URL` → `patient-frontend`'s URL + `/v1/admin`
3. Commit and push (each service auto-deploys on push to `main`) — or edit
   directly in each service's dashboard Environment tab (faster for a
   same-day fix, but gets silently overwritten if you ever push a
   render.yaml change touching that same var — keep the repo as the source
   of truth).
4. Gateway specifically: its `healthCheckPath` calls out to 6 other
   services, so if you update its `*_SERVICE_URL`s, trigger a redeploy of
   gateway *last*, after confirming every service it depends on is already
   deployed and responding — otherwise its own deploy's health check can
   time out the same way described above.

## e) Smoke tests

1. **Gateway health** — `GET https://<gateway-url>/api/health` → `{"ok":true, "services": {..all true..}}`
2. **Patient-frontend landing page** — root domain loads, dentist list and clinic info render
3. **Admin dashboard** — root domain `/v1/admin/login` currently shows the dashboard's own loading skeleton instead of the login form (URL stays correct, wrong component mounts) — see the KNOWN ISSUE note above. Not yet fixed as of this checklist
4. **Test booking end-to-end** — as a visitor: pick a dentist → pick a slot → book with a real-ish name/email/phone → confirm the appointment comes back with a booking id and a confirmation email is received
5. **Staff OTP login** — at `/v1/admin/login`: enter the admin/doctor password → a 6-digit code arrives by email within ~1 minute → enter it → dashboard loads and shows the logged-in user. **Until a sending domain is verified in Resend**, this only works logging in as the staff account whose email matches the one your Resend account is registered under — every other account's OTP send fails with a 403 from Resend (`could not send the login code email`, visible in gateway's response). Verify a domain at resend.com/domains to lift this for all staff accounts
6. **Reminder dispatch fires** — after the test booking in (4), either wait for `reminder-service`'s cron to reach a `scheduled_for` time, or (faster) log in as admin and use the dashboard's Reminders page "send now" action (`POST /api/reminders/:id/send`) — confirm the reminder's status flips from `pending` to `sent` and the email/SMS actually arrives. This is the real async path in this codebase; there's no queue to check. On the free plan, hit `reminder-service`'s health endpoint first if it's been idle — a cold start takes a few seconds before the "send now" call will go through.
