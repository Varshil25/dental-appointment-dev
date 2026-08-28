import { config } from '../config.js';

// Validates a doctor account's dentist_id actually exists in dentist-service
// before the account is created — same cross-service integrity check
// appointment-service performs on patient_id/dentist_id. Throws on network
// failure so the caller fails closed rather than creating an account linked
// to an unverified dentist.
export async function getDentist(id) {
  const controller = new AbortController();
  // 3s is too short for a cold Render free-tier instance (can take
  // 20-50s to answer its first request after spinning down from idle).
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${config.dentistServiceUrl}/internal/dentists/${id}`, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`dentist-service responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Creates the dentist-service row for an approved application, calling its
// public POST / directly (service-to-service, bypassing the gateway) — same
// posture as getDentist above: there's no service-to-service auth in this
// system, so any inter-service call already trusts its caller. Used only by
// the dentist-application approval flow.
export async function createDentist({ name, specialty, email, phone }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${config.dentistServiceUrl}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ name, specialty, email, phone }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `dentist-service responded ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}
