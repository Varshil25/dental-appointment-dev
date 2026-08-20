import { Router } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';
import { listAppointmentsLocal, composeNames } from '../queries.js';
import { hasConflict } from '../slots.js';
import { scheduleReminders } from '../clients/reminderServiceClient.js';
import { cached, invalidateAll } from '../cache.js';

const router = Router();

// Raw local rows, no cross-service composition — used by dentist-service
// (slot availability) and patient-service (appointment history). Shorter
// TTL than the other internal endpoints since slot availability needs to
// stay fairly fresh — actual booking conflict checks are never cached, so
// this only risks a slot briefly *looking* available in the UI, not an
// actual double-booking.
router.get('/appointments', async (req, res) => {
  const filters = {
    status: req.query.status,
    from: req.query.from,
    to: req.query.to,
    dentistId: req.query.dentistId,
    patientId: req.query.patientId,
  };
  const rows = await cached(`internal:list:${JSON.stringify(filters)}`, 10, () => listAppointmentsLocal(filters));
  res.json(rows);
});

// Future booked appointments for one dentist, with the patient's name
// composed in — used by dentist-service to warn an admin before
// deactivating a dentist who still has upcoming bookings. Not cached:
// this gates a destructive-ish admin decision, so it must read the
// current state rather than a stale one.
router.get('/appointments/future-booked', async (req, res) => {
  const dentistId = req.query.dentistId;
  if (!dentistId) return res.status(400).json({ error: 'dentistId is required' });
  const rows = await listAppointmentsLocal({
    status: 'booked',
    dentistId,
    from: new Date().toISOString(),
  });
  const composed = await composeNames(rows);
  res.json(
    composed.map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
      patient_name: a.patient_name,
      reason: a.reason,
    }))
  );
});

// Status breakdown + upcoming count for report-service.
router.get('/appointments/summary', async (req, res) => {
  const { from, to } = req.query;
  const result = await cached(`internal:summary:${from || ''}:${to || ''}`, 15, async () => {
    const cond = [];
    const params = [];
    let i = 1;
    if (from) { cond.push(`start_time >= $${i++}`); params.push(from); }
    if (to) { cond.push(`start_time <= $${i++}`); params.push(to); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const { rows: byStatus } = await pool.query(
      `SELECT status, COUNT(*) AS n FROM appointments ${where} GROUP BY status`,
      params
    );
    const counts = { booked: 0, completed: 0, cancelled: 0, no_show: 0 };
    for (const r of byStatus) counts[r.status] = Number(r.n);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    const nowISO = new Date().toISOString();
    const { rows: upcomingRows } = await pool.query(
      `SELECT COUNT(*) AS n FROM appointments WHERE status = 'booked' AND start_time > $1`,
      [nowISO]
    );
    const upcoming = Number(upcomingRows[0].n);

    return { counts, total, upcoming };
  });
  res.json(result);
});

// Per-dentist load for report-service (dentistId only — report-service
// joins in the dentist name itself, including zero-appointment dentists).
router.get('/appointments/per-dentist-summary', async (req, res) => {
  const { from, to } = req.query;
  const result = await cached(`internal:per-dentist:${from || ''}:${to || ''}`, 15, async () => {
    const cond = [];
    const params = [];
    let i = 1;
    if (from) { cond.push(`start_time >= $${i++}`); params.push(from); }
    if (to) { cond.push(`start_time <= $${i++}`); params.push(to); }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT dentist_id AS "dentistId",
              SUM(CASE WHEN status IN ('booked','completed','no_show') THEN 1 ELSE 0 END) AS kept,
              SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS "noShows",
              SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
         FROM appointments
              ${where}
        GROUP BY dentist_id`,
      params
    );
    return rows.map((r) => ({
      dentistId: r.dentistId,
      kept: Number(r.kept),
      noShows: Number(r.noShows),
      cancelled: Number(r.cancelled),
    }));
  });
  res.json(result);
});

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Today / this-month counts + a zero-filled daily series for the last
// `days` days, all bucketed by the server's local calendar day (same
// convention slots.js uses) — computed in JS rather than a SQL date_trunc
// so the bucketing can't drift from Postgres's own session timezone.
router.get('/appointments/timeseries', async (req, res) => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 14));
  const result = await cached(`internal:timeseries:${days}`, 15, async () => {
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const seriesStart = new Date(todayStart.getTime() - (days - 1) * 24 * 3600 * 1000);

    const [todayResult, monthResult, seriesRows] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS n FROM appointments WHERE start_time >= $1 AND start_time < $2`, [
        todayStart.toISOString(), todayEnd.toISOString(),
      ]),
      pool.query(`SELECT COUNT(*) AS n FROM appointments WHERE start_time >= $1 AND start_time < $2`, [
        monthStart.toISOString(), monthEnd.toISOString(),
      ]),
      pool.query(`SELECT start_time FROM appointments WHERE start_time >= $1 AND start_time < $2`, [
        seriesStart.toISOString(), todayEnd.toISOString(),
      ]),
    ]);

    const buckets = new Map();
    for (let i = 0; i < days; i++) {
      buckets.set(dateKey(new Date(seriesStart.getTime() + i * 24 * 3600 * 1000)), 0);
    }
    for (const r of seriesRows.rows) {
      const d = new Date(r.start_time);
      const key = dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
    }

    return {
      today: Number(todayResult.rows[0].n),
      thisMonth: Number(monthResult.rows[0].n),
      series: [...buckets.entries()].map(([date, count]) => ({ date, count })),
    };
  });
  res.json(result);
});

// Seed-only: insert an appointment with an explicit status/time (e.g. a
// past 'completed' visit for reporting demo data), bypassing the
// past-time guard the public booking route enforces. Guarded by a shared
// token so it can't be hit outside of local/dev seeding.
router.post('/appointments/seed', async (req, res) => {
  if (req.get('X-Seed-Token') !== config.seedToken)
    return res.status(403).json({ error: 'invalid seed token' });

  const { patient_id, dentist_id, start, end, status, reason, follow_up_of } = req.body;
  if (!patient_id || !dentist_id || !start || !end)
    return res.status(400).json({ error: 'patient_id, dentist_id, start and end are required' });

  if (await hasConflict(dentist_id, start, end))
    return res.status(409).json({ error: 'that slot is already booked' });

  const { rows } = await pool.query(
    `INSERT INTO appointments (patient_id, dentist_id, start_time, end_time, status, reason, follow_up_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [patient_id, dentist_id, start, end, status || 'booked', reason || null, follow_up_of || null]
  );
  await invalidateAll();

  const appt = rows[0];
  if (appt.status === 'booked' && new Date(appt.start_time).getTime() > Date.now()) {
    try {
      await scheduleReminders({
        appointmentId: appt.id,
        startTimeISO: appt.start_time,
        patientEmail: req.body.patient_email,
        patientName: req.body.patient_name,
        dentistName: req.body.dentist_name,
        reason: appt.reason,
      });
    } catch (err) {
      console.error('[appointment-service] seed: failed to schedule reminders:', err.message);
    }
  }
  res.status(201).json(appt);
});

export default router;
