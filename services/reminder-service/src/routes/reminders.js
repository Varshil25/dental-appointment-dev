import { Router } from 'express';
import { pool } from '../db.js';
import { fireReminderNow } from '../reminders.js';
import { cached, invalidate } from '../cache.js';

const router = Router();

// Reminder log (optionally filtered by ?appointmentId=).
router.get('/', async (req, res) => {
  const appointmentId = req.query.appointmentId || '';
  const rows = await cached(`list:${appointmentId}`, 15, async () => {
    const { rows } = appointmentId
      ? await pool.query('SELECT * FROM reminders WHERE appointment_id = $1 ORDER BY scheduled_for', [appointmentId])
      : await pool.query('SELECT * FROM reminders ORDER BY scheduled_for DESC LIMIT 200');
    return rows;
  });
  res.json(rows);
});

// Manually fire a reminder now — handy for demos so you don't have to
// wait for the scheduled time to roll around.
router.post('/:id/send', async (req, res) => {
  const result = await fireReminderNow(req.params.id);
  await invalidate('*');
  res.status(result.ok ? 200 : 400).json(result);
});

export default router;
