import { pool } from './db.js';
import { getAppointment } from './queries.js';
import { getPatient } from './clients/patientServiceClient.js';
import { getDentist } from './clients/dentistServiceClient.js';
import { cancelReminders } from './clients/reminderServiceClient.js';
import { sendMail, sendSms } from './clients/notificationServiceClient.js';
import { reviewRequestTemplate, reviewRequestSms } from './templates.js';
import { invalidateAll } from './cache.js';
import { composeRow } from './compose.js';

// Downstream effects of a status change, factored out so both the manual
// PATCH /:id/status route AND the auto-complete cron job (autoComplete.js)
// trigger the exact same review-request email/SMS and reminder-cancellation
// logic — an automatic completion must not be a parallel path that silently
// drifts from what a manual one does. `status` is passed explicitly (rather
// than read off `appt.status`) since callers may pass either a pre- or
// post-update row; the fields this function actually reads
// (patient_id/dentist_id/review_requested_at) don't change with the status
// column either way.
export async function applyStatusSideEffects(appt, status) {
  if (status !== 'booked') {
    cancelReminders(appt.id).catch((err) =>
      console.error('[appointment-service] failed to cancel reminders:', err.message)
    );
  }

  // Review-request email/SMS, sent once per appointment regardless of how
  // many times it's (re-)marked completed, or whether that happened
  // manually or automatically — review_requested_at (not the reviews table)
  // is the guard, since a patient can ignore the request and never actually
  // leave a review, and correcting a mis-set no_show/booked back to
  // completed shouldn't trigger a second send.
  if (status === 'completed' && !appt.review_requested_at) {
    try {
      const [patient, dentist] = await Promise.all([
        getPatient(appt.patient_id),
        getDentist(appt.dentist_id),
      ]);
      if (patient && dentist) {
        const composed = composeRow(appt, patient, dentist);
        sendMail(patient.email, reviewRequestTemplate(composed)).catch(() => {});
        if (patient.phone) sendSms(patient.phone, reviewRequestSms(composed)).catch(() => {});
        await pool.query('UPDATE appointments SET review_requested_at = now() WHERE id = $1', [appt.id]);
      }
    } catch (err) {
      console.error('[appointment-service] failed to send review request:', err.message);
    }
  }
}

// Single source of truth for changing an appointment's status by id — used
// by the manual admin-driven route. The auto-complete cron job instead does
// its own atomic `UPDATE ... WHERE status = 'booked' ... RETURNING *` (so a
// concurrent manual action can't race with it — see autoComplete.js) and
// then calls applyStatusSideEffects directly with the already-updated row,
// rather than this function (which would re-run a redundant UPDATE).
export async function updateAppointmentStatus(existing, status) {
  await pool.query('UPDATE appointments SET status = $1 WHERE id = $2', [status, existing.id]);
  await invalidateAll();
  await applyStatusSideEffects(existing, status);
  return getAppointment(existing.id);
}
