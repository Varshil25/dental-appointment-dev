import { Router } from 'express';
import { pool } from '../db.js';
import { getAppointment } from '../queries.js';
import { getReviewLocal, getReviewByAppointment, listReviews, getReview } from '../reviewQueries.js';
import { contactMatches } from '../contactMatch.js';
import { invalidateAll } from '../cache.js';

const router = Router();

const STATUSES = ['visible', 'hidden'];

// Public, unauthenticated — submitted from patient-frontend's
// /review?appointment=<id> page, reached via the review-request email/SMS
// (see routes/appointments.js's PATCH /:id/status). Verified the same way
// as the manage-my-appointment lookup: the caller must supply the same
// email/phone on file for that appointment, since the appointment id alone
// is a guessable sequential integer.
router.post('/', async (req, res) => {
  // Same honeypot convention as appointment-service's POST /appointments
  // and dentist-service's POST /inquiries — a hidden field real patients
  // never see or fill.
  if (req.body.website) return res.status(400).json({ error: 'invalid submission' });

  const { appointment_id, contact, rating, comment } = req.body;
  if (!appointment_id || !contact) return res.status(400).json({ error: 'appointment_id and contact (email or phone) are required' });

  const NOT_FOUND = { error: 'no matching appointment found — check your link and contact details' };
  const appt = await getAppointment(appointment_id);
  if (!appt || !appt.patient_email) return res.status(404).json(NOT_FOUND);
  if (!contactMatches(appt, contact)) return res.status(404).json(NOT_FOUND);

  if (appt.status !== 'completed')
    return res.status(400).json({ error: 'this appointment is not eligible for a review yet' });

  const existing = await getReviewByAppointment(appt.id);
  if (existing) return res.status(409).json({ error: 'this appointment has already been reviewed' });

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5)
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });

  const { rows } = await pool.query(
    `INSERT INTO reviews (appointment_id, patient_id, dentist_id, rating, comment)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [appt.id, appt.patient_id, appt.dentist_id, ratingNum, String(comment || '').trim() || null]
  );
  await invalidateAll();
  res.status(201).json(await getReview(rows[0].id));
});

// Admin-only (enforced at the gateway — see gateway/src/server.js).
router.get('/', async (req, res) => {
  res.json(
    await listReviews({
      status: req.query.status,
      dentistId: req.query.dentistId,
      rating: req.query.rating,
    })
  );
});

// Admin-only moderation toggle — hide/unhide, never a hard delete, so
// there's always a record of what was submitted.
router.patch('/:id/status', async (req, res) => {
  const existing = await getReviewLocal(req.params.id);
  if (!existing) return res.status(404).json({ error: 'review not found' });
  if (!STATUSES.includes(req.body.status))
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });

  await pool.query('UPDATE reviews SET status = $1 WHERE id = $2', [req.body.status, existing.id]);
  await invalidateAll();
  res.json(await getReview(existing.id));
});

export default router;
