import { api } from './api';

const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[\s().-]/g, '');

// patient-service has no dedicated "find by email or phone" route, only a
// fuzzy ?q= search (ILIKE across name/email/phone). Booking step 4 needs an
// exact match to safely reuse a patient_id instead of creating a duplicate,
// so this searches by whichever contact field was given and filters the
// (usually tiny) result set down to a real match client-side.
export async function findExistingPatient({ email, phone }) {
  const query = email || phone;
  if (!query) return null;
  let results;
  try {
    results = await api.searchPatients(query);
  } catch {
    return null;
  }
  const wantEmail = email ? normalize(email) : null;
  const wantPhone = phone ? normalize(phone) : null;
  return (
    results.find(
      (p) =>
        (wantEmail && normalize(p.email) === wantEmail) ||
        (wantPhone && p.phone && normalize(p.phone) === wantPhone)
    ) || null
  );
}
