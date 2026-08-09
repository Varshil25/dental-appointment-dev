import { config } from './config.js';

async function fetchHealth(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    if (!res.ok) return { ok: false, body: null };
    return { ok: true, body: await res.json().catch(() => null) };
  } catch {
    return { ok: false, body: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function aggregatedHealth(_req, res) {
  const entries = Object.entries(config.services);
  const results = await Promise.all(entries.map(([, url]) => fetchHealth(url)));
  const services = Object.fromEntries(entries.map(([name], i) => [name, results[i].ok]));
  const ok = results.every((r) => r.ok);

  // Surfaces reminder-service's configured offsets so the frontend can show
  // "reminders go out 48h/2h before" without needing its own service URL.
  const reminderIdx = entries.findIndex(([name]) => name === 'reminder');
  const reminderOffsetsHours = results[reminderIdx]?.body?.reminderOffsetsHours ?? [];

  res.status(ok ? 200 : 503).json({ ok, clinic: config.clinic, services, reminderOffsetsHours });
}
