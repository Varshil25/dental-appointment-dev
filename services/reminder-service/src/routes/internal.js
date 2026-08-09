import { Router } from 'express';
import { pool } from '../db.js';
import { scheduleReminders, cancelPendingReminders } from '../reminders.js';
import { cached, invalidate } from '../cache.js';

const router = Router();

// Called by appointment-service on booking/reschedule/follow-up.
router.post('/reminders/schedule', async (req, res) => {
  const { appointmentId, startTimeISO, patientEmail, patientPhone, patientName, dentistName, reason } = req.body;
  if (!appointmentId || !startTimeISO || !patientEmail || !patientName)
    return res.status(400).json({ error: 'appointmentId, startTimeISO, patientEmail and patientName are required' });
  await scheduleReminders({ appointmentId, startTimeISO, patientEmail, patientPhone, patientName, dentistName, reason });
  await invalidate('*');
  res.status(201).json({ ok: true });
});

// Called by appointment-service on reschedule/cancel/status change away from 'booked'.
router.post('/reminders/cancel', async (req, res) => {
  const { appointmentId } = req.body;
  if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required' });
  await cancelPendingReminders(appointmentId);
  await invalidate('*');
  res.json({ ok: true });
});

// Used by report-service for the reminders-sent metric.
router.get('/reminders-summary', async (_req, res) => {
  const result = await cached('internal:summary', 15, async () => {
    const { rows } = await pool.query(`SELECT COUNT(*) AS n FROM reminders WHERE status = 'sent'`);
    return { sent: Number(rows[0].n) };
  });
  res.json(result);
});

export default router;
