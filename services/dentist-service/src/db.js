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
