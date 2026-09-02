import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required — set it to this service\'s Neon Postgres connection string');
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
});

// Neon closes idle connections; without this listener that shows up as an
// unhandled 'error' event on the pool and takes the whole process down.
pool.on('error', (err) => console.error('[db] idle client error:', err.message));

await pool.query(`
  CREATE TABLE IF NOT EXISTS dentists (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    specialty     TEXT,
    email         TEXT,
    work_start    INTEGER NOT NULL DEFAULT 9,   -- hour of day, 24h
    work_end      INTEGER NOT NULL DEFAULT 17,  -- hour of day, 24h
    slot_minutes  INTEGER NOT NULL DEFAULT 30
  );
`);

// Bolted on after the initial launch — ADD COLUMN IF NOT EXISTS keeps this
// idempotent across restarts, same as the rest of this file's migrations.
await pool.query(`ALTER TABLE dentists ADD COLUMN IF NOT EXISTS phone TEXT;`);
await pool.query(`ALTER TABLE dentists ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';`);

// Per-day-of-week schedule, replacing the single work_start/work_end pair
// as the source of truth for slot generation (dentists.work_start/work_end
// remain as the default template used when a new dentist is created and
// when composing a row for one that predates this table).
// day_of_week follows JS Date#getDay() — 0=Sunday .. 6=Saturday.
await pool.query(`
  CREATE TABLE IF NOT EXISTS dentist_availability (
    id            SERIAL PRIMARY KEY,
    dentist_id    INTEGER NOT NULL REFERENCES dentists(id) ON DELETE CASCADE,
    day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_available  BOOLEAN NOT NULL DEFAULT true,
    work_start    INTEGER NOT NULL DEFAULT 9,
    work_end      INTEGER NOT NULL DEFAULT 17,
    UNIQUE (dentist_id, day_of_week)
  );
`);

// Backfill: every existing dentist (seeded before this table existed) gets
// all 7 days, available, inheriting its own work_start/work_end. No-op
// once rows exist — new dentists get their rows written directly by the
// POST /dentists route instead of waiting for the next restart.
await pool.query(`
  INSERT INTO dentist_availability (dentist_id, day_of_week, is_available, work_start, work_end)
  SELECT d.id, dow, true, d.work_start, d.work_end
  FROM dentists d, generate_series(0, 6) AS dow
  WHERE NOT EXISTS (
    SELECT 1 FROM dentist_availability a WHERE a.dentist_id = d.id AND a.day_of_week = dow
  );
`);

// Clinic-wide profile (name/logo/contact info) — single row, replacing the
// hardcoded CLINIC_NAME/CLINIC_PHONE/CLINIC_ADDRESS env vars as the source
// of truth once the settings page is used. Those env vars now only supply
// the one-time default row below, so existing deployments aren't blank on
// first load.
await pool.query(`
  CREATE TABLE IF NOT EXISTS clinic_profile (
    id            SERIAL PRIMARY KEY,
    clinic_name   TEXT NOT NULL,
    logo_url      TEXT,
    phone         TEXT,
    address       TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

// Clinic-wide weekly hours, one row per day of week (0=Sun..6=Sat, same
// convention as dentist_availability above). Times are stored as "HH:MM"
// text — matches <input type="time"> exactly, no timezone/date baggage
// since these are wall-clock opening hours, not instants.
await pool.query(`
  CREATE TABLE IF NOT EXISTS clinic_hours (
    id            SERIAL PRIMARY KEY,
    day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    is_closed     BOOLEAN NOT NULL DEFAULT false,
    open_time     TEXT NOT NULL DEFAULT '09:00',
    close_time    TEXT NOT NULL DEFAULT '17:00',
    UNIQUE (day_of_week)
  );
`);

await pool.query(
  `INSERT INTO clinic_profile (clinic_name, phone, address)
   SELECT $1, $2, $3
   WHERE NOT EXISTS (SELECT 1 FROM clinic_profile);`,
  [config.clinic.name, config.clinic.phone, config.clinic.address]
);

// Default weekly hours: Mon-Fri 9-5, Sat 9-1, Sun closed.
const DEFAULT_CLINIC_HOURS = {
  0: { is_closed: true, open_time: '09:00', close_time: '13:00' },
  1: { is_closed: false, open_time: '09:00', close_time: '17:00' },
  2: { is_closed: false, open_time: '09:00', close_time: '17:00' },
  3: { is_closed: false, open_time: '09:00', close_time: '17:00' },
  4: { is_closed: false, open_time: '09:00', close_time: '17:00' },
  5: { is_closed: false, open_time: '09:00', close_time: '17:00' },
  6: { is_closed: false, open_time: '09:00', close_time: '13:00' },
};
for (const [day, h] of Object.entries(DEFAULT_CLINIC_HOURS)) {
  await pool.query(
    `INSERT INTO clinic_hours (day_of_week, is_closed, open_time, close_time)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (day_of_week) DO NOTHING`,
    [Number(day), h.is_closed, h.open_time, h.close_time]
  );
}

// General contact-form inquiries from the patient-facing site — deliberately
// not tied to a patient_id (no auth, no requirement that the sender is an
// existing patient). Lives here rather than a new service so a "who reads
// the website contact form" concern doesn't need its own Postgres database;
// dentist-service already owns clinic-wide, non-per-appointment data
// (clinic_profile above).
await pool.query(`
  CREATE TABLE IF NOT EXISTS inquiries (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    phone         TEXT,
    subject       TEXT NOT NULL,
    message       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'new', -- new|read|replied
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

// An inquiry can get more than one reply over time (a back-and-forth), so
// replies are their own append-only table rather than a single
// reply_text/replied_at pair on inquiries — that pair would only ever hold
// the latest reply and silently lose the rest of the thread. sent_by/
// sent_by_name are a denormalized copy of the admin who sent it (id from
// the gateway-forwarded X-User-Id header — see routes/inquiries.js — plus
// the display name from the JWT at send time) rather than a cross-service
// FK, same "plain INTEGER, no REFERENCES" convention appointment-service
// uses for patient_id/dentist_id, since auth-service's users table lives in
// a different database entirely.
await pool.query(`
  CREATE TABLE IF NOT EXISTS inquiry_replies (
    id            SERIAL PRIMARY KEY,
    inquiry_id    INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    message       TEXT NOT NULL,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_by       INTEGER,
    sent_by_name  TEXT
  );
`);
await pool.query(`CREATE INDEX IF NOT EXISTS idx_inquiry_replies_inquiry ON inquiry_replies(inquiry_id);`);
