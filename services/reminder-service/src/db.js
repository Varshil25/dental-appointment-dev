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

// Reminders no longer FK into an appointments table we don't own — instead
// each row carries a denormalized snapshot of what it needs to send an
// email, pushed by appointment-service at schedule time. This keeps the
// cron dispatch loop fully independent of appointment-service's uptime.
await pool.query(`
  CREATE TABLE IF NOT EXISTS reminders (
    id             SERIAL PRIMARY KEY,
    appointment_id INTEGER NOT NULL,
    channel        TEXT NOT NULL DEFAULT 'email',  -- email|sms
    offset_hours   REAL NOT NULL,
    scheduled_for  TIMESTAMPTZ NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending', -- pending|sending|sent|failed|skipped
    sent_at        TIMESTAMPTZ,
    detail         TEXT,            -- preview url or error message
    patient_email     TEXT NOT NULL,
    patient_name      TEXT NOT NULL,
    dentist_name      TEXT,
    appt_start_time   TIMESTAMPTZ NOT NULL,
    appt_reason       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_reminder_due ON reminders(status, scheduled_for);
  CREATE INDEX IF NOT EXISTS idx_reminder_appointment ON reminders(appointment_id);

  -- Added for SMS reminders: nullable since older rows and email-only
  -- snapshots never had a phone number.
  ALTER TABLE reminders ADD COLUMN IF NOT EXISTS patient_phone TEXT;
`);
