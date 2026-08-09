import { config } from '../config.js';

export async function getDentist(id) {
  return fetchWithRetry(`${config.dentistServiceUrl}/internal/dentists/${id}`);
}

export async function listDentists() {
  const res = await fetch(`${config.dentistServiceUrl}/`);
  if (!res.ok) throw new Error(`dentist-service responded ${res.status}`);
  return res.json();
}

async function fetchWithRetry(url, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
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
