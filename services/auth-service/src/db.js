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
  CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN ('admin', 'doctor')),
    name           TEXT,
    -- Only meaningful for role='doctor' — the id of this user's row in
    -- dentist-service's dentists table, validated via HTTP at account
    -- creation time (same cross-service integrity pattern
    -- appointment-service uses for patient_id/dentist_id). No SQL FK is
    -- possible since dentist-service owns a separate database.
    dentist_id     INTEGER,
    -- Bumped on password reset so an access token issued before the reset
    -- can be told apart from one issued after — see reset-password and
    -- GET /me for how this is actually enforced (the gateway verifies the
    -- JWT signature/expiry statelessly on every request; only /me re-checks
    -- this column against the database, so revocation takes effect the
    -- next time the frontend calls /me, not on the very next proxied call).
    token_version  INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

// One row per in-progress two-step login. `reference` is the opaque id the
// client holds between step 1 (login) and step 2 (verify-otp) — it never
// reveals the user id. otp_hash is bcrypt, exactly like password_hash:
// never store or log the plaintext code once it's been emailed.
await pool.query(`
  CREATE TABLE IF NOT EXISTS login_otps (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference      TEXT NOT NULL UNIQUE,
    otp_hash       TEXT NOT NULL,
    expires_at     TIMESTAMPTZ NOT NULL,
    used           BOOLEAN NOT NULL DEFAULT false,
    attempts       INTEGER NOT NULL DEFAULT 0,
    last_sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_login_otps_reference ON login_otps(reference);
`);

// Single-use password-reset tokens. token_hash is a SHA-256 hex digest (not
// bcrypt) — the token itself is a high-entropy random value the caller must
// present verbatim, so a fast, deterministic hash is enough to look it up
// safely, unlike a password/OTP where the whole point of bcrypt is
// resisting a low-entropy guess.
await pool.query(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash     TEXT NOT NULL UNIQUE,
    expires_at     TIMESTAMPTZ NOT NULL,
    used           BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

// Prospective-dentist self-applications. Lives here (not dentist-service)
// because approving one has to atomically write both this table's row and
// a new `users` row (role='doctor') — keeping both in the service that
// owns `users` makes that a single local transaction; only the linked
// dentist-service row itself needs a separate HTTP call (see
// routes/dentistApplications.js's approve handler and
// clients/dentistServiceClient.js's createDentist), the same
// "cross-service call, local transaction for the rest" shape this file's
// dentist_id validation already uses elsewhere.
await pool.query(`
  CREATE TABLE IF NOT EXISTS dentist_applications (
    id                 SERIAL PRIMARY KEY,
    name               TEXT NOT NULL,
    email              TEXT NOT NULL,
    phone              TEXT NOT NULL,
    specialization     TEXT NOT NULL,
    notes              TEXT,
    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by        INTEGER REFERENCES users(id),
    reviewed_at        TIMESTAMPTZ,
    rejection_reason   TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_dentist_applications_status ON dentist_applications(status);
`);
