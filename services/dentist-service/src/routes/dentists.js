import { Router } from 'express';
import { pool } from '../db.js';
import { generateSlots } from '../slots.js';
import { getTakenIntervals, getFutureBookedAppointments, cancelAppointment } from '../clients/appointmentServiceClient.js';
import { cached, invalidate } from '../cache.js';

const router = Router();

const STATUSES = ['active', 'inactive'];
const DAYS = [0, 1, 2, 3, 4, 5, 6]; // Sun..Sat, matches Date#getDay()

function validateHours(work_start, work_end) {
  if (!Number.isFinite(work_start) || !Number.isFinite(work_end) || work_start >= work_end)
    return 'work_start must be before work_end';
  if (work_start < 0 || work_end > 24) return 'work_start/work_end must be within 0-24';
  return null;
}

async function seedAvailability(client, dentistId, work_start, work_end) {
  for (const day of DAYS) {
    await client.query(
      `INSERT INTO dentist_availability (dentist_id, day_of_week, is_available, work_start, work_end)
       VALUES ($1,$2,true,$3,$4)
       ON CONFLICT (dentist_id, day_of_week) DO NOTHING`,
      [dentistId, day, work_start, work_end]
    );
  }
}

router.get('/', async (_req, res) => {
  const rows = await cached('list', 60, async () => {
    const { rows } = await pool.query('SELECT * FROM dentists ORDER BY name');
    return rows;
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, specialty, email, phone, status, work_start, work_end, slot_minutes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const slotMinutes = slot_minutes ?? 30;
  const workStart = work_start ?? 9;
  const workEnd = work_end ?? 17;
  const dentistStatus = status ?? 'active';
  // Bug fix: previously `slot_minutes ?? 30` let an explicit 0/negative
  // value through, which hung generateSlots() in an infinite loop later.
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0)
    return res.status(400).json({ error: 'slot_minutes must be a positive number' });
  const hoursError = validateHours(workStart, workEnd);
  if (hoursError) return res.status(400).json({ error: hoursError });
  if (!STATUSES.includes(dentistStatus))
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });

  const { rows } = await pool.query(
    `INSERT INTO dentists (name, specialty, email, phone, status, work_start, work_end, slot_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, specialty || null, email || null, phone || null, dentistStatus, workStart, workEnd, slotMinutes]
  );
  const dentist = rows[0];
  await seedAvailability(pool, dentist.id, workStart, workEnd);
  await invalidate('*');
  res.status(201).json(dentist);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'dentist not found' });
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'dentist not found' });

  const name = req.body.name ?? existing.name;
  const specialty = req.body.specialty ?? existing.specialty;
  const email = req.body.email ?? existing.email;
  const phone = req.body.phone ?? existing.phone;
  const status = req.body.status ?? existing.status;
  const workStart = req.body.work_start ?? existing.work_start;
  const workEnd = req.body.work_end ?? existing.work_end;
  const slotMinutes = req.body.slot_minutes ?? existing.slot_minutes;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0)
    return res.status(400).json({ error: 'slot_minutes must be a positive number' });
  const hoursError = validateHours(workStart, workEnd);
  if (hoursError) return res.status(400).json({ error: hoursError });
  if (!STATUSES.includes(status))
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });

  // Deactivating a dentist who still has future booked appointments needs
  // an explicit admin decision (cancel them vs. leave them attached) — we
  // never silently cancel or silently orphan them. Only gate the
  // active -> inactive transition; re-saving an already-inactive dentist
  // (or any other field on them) shouldn't re-trigger this check.
  let cancelledCount = 0;
  if (status === 'inactive' && existing.status !== 'inactive') {
    let futureBooked;
    try {
      futureBooked = await getFutureBookedAppointments(existing.id);
    } catch (err) {
      console.error('[dentist-service] could not check future appointments:', err.message);
      return res.status(503).json({ error: 'could not verify future appointments, try again' });
    }

    if (futureBooked.length > 0) {
      const onConflict = req.body.on_conflict; // 'cancel' | 'keep' | undefined
      if (onConflict !== 'cancel' && onConflict !== 'keep') {
        return res.status(409).json({
          error: `this dentist has ${futureBooked.length} future booked appointment(s)`,
          conflict: 'future_appointments',
          count: futureBooked.length,
          appointments: futureBooked,
        });
      }
      if (onConflict === 'cancel') {
        for (const appt of futureBooked) {
          try {
            await cancelAppointment(appt.id, 'Dentist no longer available');
            cancelledCount += 1;
          } catch (err) {
            console.error(`[dentist-service] failed to cancel appointment ${appt.id}:`, err.message);
          }
        }
      }
      // onConflict === 'keep' falls through — appointments untouched, they
      // just show as attached to an inactive dentist from here on.
    }
  }

  const { rows } = await pool.query(
    `UPDATE dentists SET name=$1, specialty=$2, email=$3, phone=$4, status=$5,
       work_start=$6, work_end=$7, slot_minutes=$8
     WHERE id=$9 RETURNING *`,
    [name, specialty || null, email || null, phone || null, status, workStart, workEnd, slotMinutes, existing.id]
  );
  await invalidate('*');
  res.json({ ...rows[0], cancelled_count: cancelledCount });
});

// Weekly availability — one row per day-of-week (0=Sun..6=Sat).
router.get('/:id/availability', async (req, res) => {
  const { rows: dentistRows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
  const dentist = dentistRows[0];
  if (!dentist) return res.status(404).json({ error: 'dentist not found' });

  // Defensive backfill for a dentist somehow missing rows (e.g. inserted
  // directly, bypassing POST /) — normal path is already fully seeded.
  await seedAvailability(pool, dentist.id, dentist.work_start, dentist.work_end);

  const { rows } = await pool.query(
    'SELECT day_of_week, is_available, work_start, work_end FROM dentist_availability WHERE dentist_id = $1 ORDER BY day_of_week',
    [dentist.id]
  );
  res.json({ dentist_id: dentist.id, days: rows });
});

router.put('/:id/availability', async (req, res) => {
  const { rows: dentistRows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
  const dentist = dentistRows[0];
  if (!dentist) return res.status(404).json({ error: 'dentist not found' });

  const days = req.body.days;
  if (!Array.isArray(days) || days.length === 0)
    return res.status(400).json({ error: 'days must be a non-empty array' });

  for (const d of days) {
    if (!DAYS.includes(d.day_of_week))
      return res.status(400).json({ error: 'day_of_week must be an integer 0-6 (Sun-Sat)' });
    if (d.is_available) {
      const hoursError = validateHours(d.work_start, d.work_end);
      if (hoursError) return res.status(400).json({ error: `day ${d.day_of_week}: ${hoursError}` });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const d of days) {
      await client.query(
        `INSERT INTO dentist_availability (dentist_id, day_of_week, is_available, work_start, work_end)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (dentist_id, day_of_week)
         DO UPDATE SET is_available=$3, work_start=$4, work_end=$5`,
        [dentist.id, d.day_of_week, !!d.is_available, d.work_start ?? 9, d.work_end ?? 17]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await invalidate('*');

  const { rows } = await pool.query(
    'SELECT day_of_week, is_available, work_start, work_end FROM dentist_availability WHERE dentist_id = $1 ORDER BY day_of_week',
    [dentist.id]
  );
  res.json({ dentist_id: dentist.id, days: rows });
});

// Available slots for a dentist on a given date (?date=YYYY-MM-DD) —
// respects that day's entry in dentist_availability (hours, or a day off).
router.get('/:id/slots', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
  const dentist = rows[0];
  if (!dentist) return res.status(404).json({ error: 'dentist not found' });
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: 'date=YYYY-MM-DD is required' });

  // An inactive dentist isn't bookable at all — no point even checking
  // taken intervals.
  if (dentist.status === 'inactive') {
    return res.json({ dentist, date, slots: [] });
  }

  const [y, m, d] = date.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0);
  const dayOfWeek = dayStart.getDay();

  const { rows: availRows } = await pool.query(
    'SELECT is_available, work_start, work_end FROM dentist_availability WHERE dentist_id = $1 AND day_of_week = $2',
    [dentist.id, dayOfWeek]
  );
  const avail = availRows[0] || { is_available: true, work_start: dentist.work_start, work_end: dentist.work_end };

  if (!avail.is_available) {
    return res.json({ dentist, date, slots: [] });
  }

  let taken;
  try {
    taken = await getTakenIntervals(dentist.id, dayStart.toISOString(), dayEnd.toISOString());
  } catch (err) {
    console.error('[dentist-service] could not reach appointment-service:', err.message);
    return res.status(503).json({ error: 'could not check dentist availability, try again' });
  }

  const daySchedule = { slot_minutes: dentist.slot_minutes, work_start: avail.work_start, work_end: avail.work_end };
  res.json({ dentist, date, slots: generateSlots(daySchedule, date, taken) });
});

export default router;
