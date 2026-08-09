import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required — set it to this service\'s Neon Postgres connection string');
}

// Neon requires TLS; its certificate chains to a public CA but the
// `rejectUnauthorized: false` here matches Neon's own connection examples
// for serverless/edge clients that don't ship a custom CA bundle.
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
});

// Top-level await: server.js's `import './db.js'` waits for this to settle
// before the rest of the module graph runs, so routes never see a missing table.
await pool.query(`
  CREATE TABLE IF NOT EXISTS patients (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT,
    dob         TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Case-insensitive: "Jane@x.com" and "jane@x.com" count as the same
  -- patient. Backstops the app-level duplicate check in routes/patients.js
  -- against a race between two concurrent signups for the same address.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_email_unique ON patients (LOWER(email));
`);
