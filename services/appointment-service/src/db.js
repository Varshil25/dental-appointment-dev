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

// No FKs to patients/dentists — those live in other services' databases now.
// Referential integrity is enforced at booking time via HTTP validation
// (see clients/patientServiceClient.js, clients/dentistServiceClient.js).
// follow_up_of stays a real FK since it's self-referencing within this table.
await pool.query(`
  CREATE TABLE IF NOT EXISTS appointments (
    id            SERIAL PRIMARY KEY,
    patient_id    INTEGER NOT NULL,
    dentist_id    INTEGER NOT NULL,
    start_time    TIMESTAMPTZ NOT NULL,
    end_time      TIMESTAMPTZ NOT NULL,
    status        TEXT NOT NULL DEFAULT 'booked', -- booked|completed|cancelled|no_show
    reason        TEXT,
    notes         TEXT,
    follow_up_of  INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
    cancel_reason TEXT,
    cancelled_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_appt_dentist_time ON appointments(dentist_id, start_time);
  CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments(patient_id);
`);
