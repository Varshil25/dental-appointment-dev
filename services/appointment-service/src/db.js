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

// Invoices live in this same database (unlike patients/dentists) because
// they're 1:1 with an appointment row here — a real FK is possible and
// cheaper than another HTTP round-trip. UNIQUE(appointment_id) enforces
// that 1:1-ness at the DB level: at most one invoice per appointment.
// patient_id/dentist_id are denormalized copies (read off the appointment
// at creation time) so invoice queries/filters don't need a join back to
// appointments, matching how appointments itself denormalizes away from
// patient-service/dentist-service.
await pool.query(`
  CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    appointment_id  INTEGER NOT NULL UNIQUE REFERENCES appointments(id),
    patient_id      INTEGER NOT NULL,
    dentist_id      INTEGER NOT NULL,
    line_items      JSONB NOT NULL,
    subtotal        NUMERIC(10,2) NOT NULL,
    tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL,
    status          TEXT NOT NULL DEFAULT 'unpaid', -- unpaid|paid|cancelled
    payment_method  TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at         TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_dentist ON invoices(dentist_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at);
`);
