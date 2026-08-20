import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sun..Sat, matches Date#getDay()
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM, 24h

function validateHours(open_time, close_time) {
  if (!TIME_RE.test(open_time) || !TIME_RE.test(close_time)) return 'open_time/close_time must be HH:MM';
  if (open_time >= close_time) return 'close_time must be after open_time';
  return null;
}

async function loadProfile() {
  const { rows: profileRows } = await pool.query('SELECT * FROM clinic_profile ORDER BY id LIMIT 1');
  const { rows: hours } = await pool.query(
    'SELECT day_of_week, is_closed, open_time, close_time FROM clinic_hours ORDER BY day_of_week'
  );
  return { ...profileRows[0], hours };
}

// Public — the patient-facing booking pages read this to show the clinic's
// name/logo/hours, so it isn't (and shouldn't be) auth-gated.
router.get('/', async (_req, res) => {
  res.json(await loadProfile());
});

// Admin-only — enforced by the gateway (see services/gateway/src/server.js,
// `app.put('/api/clinic-profile', requireAuth, requireRole('admin'))`), not
// here: this service has no notion of accounts or roles itself, same as
// every other backend service in this app.
router.put('/', async (req, res) => {
  const { clinic_name, logo_url, phone, address, hours } = req.body;

  if (!clinic_name) return res.status(400).json({ error: 'clinic_name is required' });
  if (!Array.isArray(hours) || hours.length !== 7)
    return res.status(400).json({ error: 'hours must be an array covering all 7 days (0=Sun..6=Sat)' });

  const seenDays = new Set();
  for (const h of hours) {
    if (!DAYS.includes(h.day_of_week)) return res.status(400).json({ error: 'day_of_week must be an integer 0-6 (Sun-Sat)' });
    if (seenDays.has(h.day_of_week)) return res.status(400).json({ error: `day_of_week ${h.day_of_week} appears more than once` });
    seenDays.add(h.day_of_week);
    if (!h.is_closed) {
      const hoursError = validateHours(h.open_time, h.close_time);
      if (hoursError) return res.status(400).json({ error: `day ${h.day_of_week}: ${hoursError}` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query('SELECT id FROM clinic_profile ORDER BY id LIMIT 1');
    if (existing[0]) {
      await client.query(
        `UPDATE clinic_profile SET clinic_name=$1, logo_url=$2, phone=$3, address=$4, updated_at=now() WHERE id=$5`,
        [clinic_name, logo_url || null, phone || null, address || null, existing[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO clinic_profile (clinic_name, logo_url, phone, address) VALUES ($1,$2,$3,$4)`,
        [clinic_name, logo_url || null, phone || null, address || null]
      );
    }

    for (const h of hours) {
      await client.query(
        `INSERT INTO clinic_hours (day_of_week, is_closed, open_time, close_time)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (day_of_week) DO UPDATE SET is_closed=$2, open_time=$3, close_time=$4`,
        [h.day_of_week, !!h.is_closed, h.open_time || '09:00', h.close_time || '17:00']
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json(await loadProfile());
});

export default router;
