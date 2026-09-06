// Shared identity check for the public, unauthenticated endpoints that take
// a guessable sequential appointment id plus a contact string and must
// verify the caller actually owns that appointment — the manage-my-
// appointment lookup (routes/appointments.js) and review submission
// (routes/reviews.js) both need the exact same matching rule, so it lives
// here once rather than drifting between two copies.
const normalizeForCompare = (s) => String(s).trim().toLowerCase().replace(/[\s().-]/g, '');

export function contactMatches(appt, contact) {
  const given = normalizeForCompare(contact);
  const matchesEmail = appt.patient_email && normalizeForCompare(appt.patient_email) === given;
  const matchesPhone = appt.patient_phone && normalizeForCompare(appt.patient_phone) === given;
  return Boolean(matchesEmail || matchesPhone);
}
