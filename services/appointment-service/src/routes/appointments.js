import { Router } from 'express';
import { pool } from '../db.js';
import { hasConflict } from '../slots.js';
import { getAppointmentLocal, listAppointments, getAppointment } from '../queries.js';
import { getPatient } from '../clients/patientServiceClient.js';
import { getDentist } from '../clients/dentistServiceClient.js';
import { scheduleReminders, cancelReminders } from '../clients/reminderServiceClient.js';
import { sendMail, sendSms } from '../clients/notificationServiceClient.js';
import { bookingTemplate, cancellationTemplate, followUpTemplate, bookingSms, cancellationSms, followUpSms } from '../templates.js';
import { invalidateAll } from '../cache.js';

const router = Router();

// Resolve start/end times from a booking body. Accepts either an explicit
// `end` or a `duration_minutes` (defaults to the dentist's slot length).
function resolveTimes(body, dentist) {
  const start = new Date(body.start);
  if (Number.isNaN(start.getTime())) return { error: 'invalid start time' };
  let end;
  if (body.end) {
    end = new Date(body.end);
    if (Number.isNaN(end.getTime())) return { error: 'invalid end time' };
  } else {
    const mins = Number(body.duration_minutes) || dentist.slot_minutes;
    end = new Date(start.getTime() + mins * 60000);
  }
  if (end <= start) return { error: 'end must be after start' };
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function composeRow(row, patient, dentist) {
  return {
    ...row,
    patient_name: patient.name,
    patient_email: patient.email,
    patient_phone: patient.phone,
    dentist_name: dentist.name,
  };
}

// Wraps the parallel patient+dentist lookup every write route needs.
// Returns { patient, dentist } or writes an error response and returns null.
async function loadPatientAndDentist(res, patientId, dentistId) {
  let patient, dentist;
  try {
    [patient, dentist] = await Promise.all([getPatient(patientId), getDentist(dentistId)]);
  } catch (err) {
    // The old SQL foreign keys are gone — this HTTP check is now the only
    // integrity guard, so an unreachable dependency must fail closed
    // rather than let a possibly-invalid appointment through.
    console.error('[appointment-service] validation lookup failed:', err.message);
    res.status(503).json({ error: 'unable to validate patient/dentist right now, please retry' });
    return null;
  }
  if (!patient) { res.status(400).json({ error: 'unknown patient_id' }); return null; }
  if (!dentist) { res.status(400).json({ error: 'unknown dentist_id' }); return null; }
  if (dentist.status === 'inactive') {
    res.status(400).json({ error: 'this dentist is not currently accepting appointments' });
    return null;
  }
  return { patient, dentist };
}

router.get('/', async (req, res) => {
  res.json(
    await listAppointments({
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      dentistId: req.query.dentistId,
      patientId: req.query.patientId,
    })
  );
});

router.get('/:id', async (req, res) => {
  const appt = await getAppointment(req.params.id);
  if (!appt) return res.status(404).json({ error: 'appointment not found' });
  res.json(appt);
});

// Public, unauthenticated lookup for the patient-facing "manage my
// appointment" page — reference (appointment id) alone is a guessable
// sequential integer, so this also requires the patient's own email or
// phone on file to match before returning anything. Same generic error for
// "no such id" and "id exists but contact doesn't match" so a caller can't
// use the response to enumerate which bookings exist.
const normalizeForCompare = (s) => String(s).trim().toLowerCase().replace(/[\s().-]/g, '');

router.post('/lookup', async (req, res) => {
  const { id, contact } = req.body;
  if (!id || !contact) return res.status(400).json({ error: 'id and contact (email or phone) are required' });

  const NOT_FOUND = { error: 'no matching appointment found — check your reference and contact details' };
  const appt = await getAppointment(id);
  if (!appt || !appt.patient_email) return res.status(404).json(NOT_FOUND);

  const given = normalizeForCompare(contact);
  const matchesEmail = appt.patient_email && normalizeForCompare(appt.patient_email) === given;
  const matchesPhone = appt.patient_phone && normalizeForCompare(appt.patient_phone) === given;
  if (!matchesEmail && !matchesPhone) return res.status(404).json(NOT_FOUND);

  res.json(appt);
});

// Book a new appointment.
router.post('/', async (req, res) => {
  // Honeypot: a hidden field real patients never see or fill. Any value
  // here means a bot filled every field it could find — reject quietly
  // rather than let it reach patient/dentist validation.
  if (req.body.website) return res.status(400).json({ error: 'invalid submission' });

  const { patient_id, dentist_id, reason, notes } = req.body;
  const loaded = await loadPatientAndDentist(res, patient_id, dentist_id);
  if (!loaded) return;
  const { patient, dentist } = loaded;

  const t = resolveTimes(req.body, dentist);
  if (t.error) return res.status(400).json({ error: t.error });

  if (new Date(t.startISO).getTime() <= Date.now())
    return res.status(400).json({ error: 'cannot book a time in the past' });
  if (await hasConflict(dentist_id, t.startISO, t.endISO))
    return res.status(409).json({ error: 'that slot is already booked (double-booking prevented)' });

  const { rows } = await pool.query(
    `INSERT INTO appointments (patient_id, dentist_id, start_time, end_time, reason, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [patient_id, dentist_id, t.startISO, t.endISO, reason || null, notes || null]
  );
  await invalidateAll();
  const appt = composeRow(rows[0], patient, dentist);

  try {
    await scheduleReminders({
      appointmentId: appt.id,
      startTimeISO: appt.start_time,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      patientName: patient.name,
      dentistName: dentist.name,
      reason: appt.reason,
    });
  } catch (err) {
    console.error('[appointment-service] failed to schedule reminders:', err.message);
  }
  // Confirmation email + SMS (fire-and-forget so booking isn't blocked).
  sendMail(patient.email, bookingTemplate(appt)).catch(() => {});
  if (patient.phone) sendSms(patient.phone, bookingSms(appt)).catch(() => {});
  res.status(201).json(appt);
});

// Reschedule to a new time (keeps the same appointment record).
router.patch('/:id/reschedule', async (req, res) => {
  const existing = await getAppointmentLocal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'appointment not found' });
  if (existing.status !== 'booked')
    return res.status(400).json({ error: `cannot reschedule a ${existing.status} appointment` });

  const loaded = await loadPatientAndDentist(res, existing.patient_id, existing.dentist_id);
  if (!loaded) return;
  const { patient, dentist } = loaded;

  const t = resolveTimes(req.body, dentist);
  if (t.error) return res.status(400).json({ error: t.error });
  if (new Date(t.startISO).getTime() <= Date.now())
    return res.status(400).json({ error: 'cannot reschedule into the past' });
  if (await hasConflict(existing.dentist_id, t.startISO, t.endISO, existing.id))
    return res.status(409).json({ error: 'that slot is already booked' });

  const { rows } = await pool.query(
    'UPDATE appointments SET start_time = $1, end_time = $2 WHERE id = $3 RETURNING *',
    [t.startISO, t.endISO, existing.id]
  );
  await invalidateAll();

  // Re-issue reminders for the new time.
  try {
    await cancelReminders(existing.id);
    await scheduleReminders({
      appointmentId: existing.id,
      startTimeISO: t.startISO,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      patientName: patient.name,
      dentistName: dentist.name,
      reason: existing.reason,
    });
  } catch (err) {
    console.error('[appointment-service] failed to re-issue reminders:', err.message);
  }

  res.json(composeRow(rows[0], patient, dentist));
});

// Cancel an appointment.
router.patch('/:id/cancel', async (req, res) => {
  const existing = await getAppointmentLocal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'appointment not found' });
  if (existing.status === 'cancelled')
    return res.status(400).json({ error: 'already cancelled' });

  const { rows } = await pool.query(
    `UPDATE appointments
        SET status = 'cancelled', cancel_reason = $1, cancelled_at = $2
      WHERE id = $3 RETURNING *`,
    [req.body.reason || null, new Date().toISOString(), existing.id]
  );
  await invalidateAll();
  const updated = rows[0];

  cancelReminders(existing.id).catch((err) =>
    console.error('[appointment-service] failed to cancel reminders:', err.message)
  );

  try {
    const [patient, dentist] = await Promise.all([
      getPatient(existing.patient_id),
      getDentist(existing.dentist_id),
    ]);
    if (patient && dentist) {
      const composed = composeRow(updated, patient, dentist);
      sendMail(patient.email, cancellationTemplate(composed)).catch(() => {});
      if (patient.phone) sendSms(patient.phone, cancellationSms(composed)).catch(() => {});
      return res.json(composed);
    }
  } catch (err) {
    console.error('[appointment-service] could not compose cancellation notice:', err.message);
  }
  res.json(updated);
});

// Update status: completed | no_show | booked.
router.patch('/:id/status', async (req, res) => {
  const existing = await getAppointmentLocal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'appointment not found' });
  const allowed = ['booked', 'completed', 'no_show'];
  if (!allowed.includes(req.body.status))
    return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
  await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', [req.body.status, existing.id]);
  await invalidateAll();
  if (req.body.status !== 'booked') {
    cancelReminders(existing.id).catch((err) =>
      console.error('[appointment-service] failed to cancel reminders:', err.message)
    );
  }
  res.json(await getAppointment(existing.id));
});

// Book a follow-up appointment linked to an existing one.
router.post('/:id/follow-up', async (req, res) => {
  const parent = await getAppointmentLocal(req.params.id);
  if (!parent) return res.status(404).json({ error: 'appointment not found' });

  const dentistId = req.body.dentist_id || parent.dentist_id;
  const loaded = await loadPatientAndDentist(res, parent.patient_id, dentistId);
  if (!loaded) return;
  const { patient, dentist } = loaded;

  const t = resolveTimes(req.body, dentist);
  if (t.error) return res.status(400).json({ error: t.error });
  // Bug fix: the original follow-up route never checked for a past start
  // time, unlike the regular booking and reschedule routes.
  if (new Date(t.startISO).getTime() <= Date.now())
    return res.status(400).json({ error: 'cannot book a time in the past' });
  if (await hasConflict(dentist.id, t.startISO, t.endISO))
    return res.status(409).json({ error: 'that slot is already booked' });

  const { rows } = await pool.query(
    `INSERT INTO appointments
       (patient_id, dentist_id, start_time, end_time, reason, notes, follow_up_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      parent.patient_id,
      dentist.id,
      t.startISO,
      t.endISO,
      req.body.reason || `Follow-up: ${parent.reason || 'previous visit'}`,
      req.body.notes || null,
      parent.id,
    ]
  );
  await invalidateAll();

  const appt = composeRow(rows[0], patient, dentist);

  try {
    await scheduleReminders({
      appointmentId: appt.id,
      startTimeISO: appt.start_time,
      patientEmail: patient.email,
      patientPhone: patient.phone,
      patientName: patient.name,
      dentistName: dentist.name,
      reason: appt.reason,
    });
  } catch (err) {
    console.error('[appointment-service] failed to schedule reminders:', err.message);
  }
  sendMail(patient.email, followUpTemplate(appt)).catch(() => {});
  if (patient.phone) sendSms(patient.phone, followUpSms(appt)).catch(() => {});
  res.status(201).json(appt);
});

export default router;
