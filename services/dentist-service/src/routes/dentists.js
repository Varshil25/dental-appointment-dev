import { Router } from 'express';
import { pool } from '../db.js';
import { generateSlots } from '../slots.js';
import { getTakenIntervals } from '../clients/appointmentServiceClient.js';
import { cached, invalidate } from '../cache.js';

const router = Router();

router.get('/', async (_req, res) => {
  const rows = await cached('list', 60, async () => {
    const { rows } = await pool.query('SELECT * FROM dentists ORDER BY name');
    return rows;
  });
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, specialty, email, work_start, work_end, slot_minutes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const slotMinutes = slot_minutes ?? 30;
  const workStart = work_start ?? 9;
  const workEnd = work_end ?? 17;
  // Bug fix: previously `slot_minutes ?? 30` let an explicit 0/negative
  // value through, which hung generateSlots() in an infinite loop later.
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0)
    return res.status(400).json({ error: 'slot_minutes must be a positive number' });
  if (!Number.isFinite(workStart) || !Number.isFinite(workEnd) || workStart >= workEnd)
    return res.status(400).json({ error: 'work_start must be before work_end' });

  const { rows } = await pool.query(
    `INSERT INTO dentists (name, specialty, email, work_start, work_end, slot_minutes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, specialty || null, email || null, workStart, workEnd, slotMinutes]
  );
  await invalidate('*');
  res.status(201).json(rows[0]);
});

// Available slots for a dentist on a given date (?date=YYYY-MM-DD).
router.get('/:id/slots', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
  const dentist = rows[0];
  if (!dentist) return res.status(404).json({ error: 'dentist not found' });
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: 'date=YYYY-MM-DD is required' });

  const [y, m, d] = date.split('-').map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0);

  let taken;
  try {
    taken = await getTakenIntervals(dentist.id, dayStart.toISOString(), dayEnd.toISOString());
  } catch (err) {
    console.error('[dentist-service] could not reach appointment-service:', err.message);
    return res.status(503).json({ error: 'could not check dentist availability, try again' });
  }

  res.json({ dentist, date, slots: generateSlots(dentist, date, taken) });
});

export default router;
