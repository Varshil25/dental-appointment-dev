import { config } from '../config.js';

export async function getDentist(id) {
  return fetchWithRetry(`${config.dentistServiceUrl}/internal/dentists/${id}`);
}

export async function listDentists() {
  const res = await fetch(`${config.dentistServiceUrl}/`);
  if (!res.ok) throw new Error(`dentist-service responded ${res.status}`);
  return res.json();
}

// Clinic name/phone/address/logo for the invoice PDF header — same public,
// unauthenticated endpoint the patient-frontend booking pages read (see
// dentist-service's routes/clinicProfile.js).
export async function getClinicProfile() {
  const res = await fetch(`${config.dentistServiceUrl}/clinic-profile`);
  if (!res.ok) throw new Error(`dentist-service responded ${res.status}`);
  return res.json();
}

async function fetchWithRetry(url, attempt = 0) {
  const controller = new AbortController();
  // 3s was too short for a cold Render free-tier instance (20-50s to
  // answer its first request after spinning down from idle) — 25s here
  // rather than the 30s used elsewhere because this function retries once
  // on failure, and the combined worst case (25s + 25s + the 500ms retry
  // delay) needs to stay under gateway's own 55s proxy timeout for the
  // outer request this is usually called from (POST /api/appointments).
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
