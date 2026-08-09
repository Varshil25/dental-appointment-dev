import { config } from '../config.js';

// Fetch [[startMs, endMs], ...] of active (booked/completed/no_show)
// appointments for one dentist on one calendar day. Throws on failure —
// the caller must not silently treat "couldn't check" as "everything free".
export async function getTakenIntervals(dentistId, dayStartISO, dayEndISO) {
  const url =
    `${config.appointmentServiceUrl}/internal/appointments` +
    `?dentistId=${dentistId}&from=${encodeURIComponent(dayStartISO)}&to=${encodeURIComponent(dayEndISO)}` +
    `&status=booked,completed,no_show`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`appointment-service responded ${res.status}`);
    const rows = await res.json();
    return rows.map((r) => [new Date(r.start_time).getTime(), new Date(r.end_time).getTime()]);
  } finally {
    clearTimeout(timeout);
  }
}
