// Shared by routes/appointments.js and statusUpdate.js — pulled out of
// appointments.js so statusUpdate.js (used by both the manual PATCH
// /:id/status route and the auto-complete cron job) can compose a
// patient/dentist-named row without importing from the routes file.
export function composeRow(row, patient, dentist) {
  return {
    ...row,
    patient_name: patient.name,
    patient_email: patient.email,
    patient_phone: patient.phone,
    dentist_name: dentist.name,
  };
}
