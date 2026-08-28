import { config } from '../config.js';

// The SQL foreign key that used to guarantee patient_id validity is gone
// now that appointments and patients live in separate databases — this
// HTTP check is the only integrity guard left, so callers must treat a
// network failure as "cannot proceed", not "assume valid".
export async function getPatient(id) {
  return fetchWithRetry(`${config.patientServiceUrl}/internal/patients/${id}`);
}

export async function listPatients() {
  const res = await fetch(`${config.patientServiceUrl}/`);
  if (!res.ok) throw new Error(`patient-service responded ${res.status}`);
  return res.json();
}

async function fetchWithRetry(url, attempt = 0) {
  const controller = new AbortController();
  // 3s was too short for a cold Render free-tier instance (20-50s to
  // answer its first request after spinning down from idle) — 25s
  // (matching dentistServiceClient.js, called in parallel with this) so
  // the combined worst case with this function's own one retry stays
  // under gateway's 55s proxy timeout for the outer request.
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`responded ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt < 1) {
      await new Promise((r) => setTimeout(r, 500));
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
