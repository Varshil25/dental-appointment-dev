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

// Future booked appointments for a dentist (date, time, patient name) —
// used to warn an admin before they deactivate a dentist. Throws on
// failure, same fail-closed reasoning as getTakenIntervals: we must not
// let a status change through on a check we couldn't actually perform.
export async function getFutureBookedAppointments(dentistId) {
  const url = `${config.appointmentServiceUrl}/internal/appointments/future-booked?dentistId=${dentistId}`;
  const controller = new AbortController();
  // Longer budget than getTakenIntervals: this endpoint composes patient
  // and dentist names in, which is 2 more network+DB hops (one of them
  // back into this very service) rather than one local query.
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`appointment-service responded ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Booked/completed/no_show appointments for one dentist on one calendar
// day, with patient names composed in — used by the authenticated day-
// schedule summary (GET /:id/schedule) on the dentist detail page. Kept
// separate from getTakenIntervals (which the public slots endpoint uses)
// so that endpoint never has to fetch, and can never leak, patient names.
export async function getDaySchedule(dentistId, dayStartISO, dayEndISO) {
  const url =
    `${config.appointmentServiceUrl}/internal/appointments/day` +
    `?dentistId=${dentistId}&from=${encodeURIComponent(dayStartISO)}&to=${encodeURIComponent(dayEndISO)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`appointment-service responded ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Cancels one appointment via appointment-service's own cancel route, so
// the existing cancellation-email/SMS + reminder-voiding logic there runs
// unchanged — this is a same-effect internal call, not a reimplementation.
export async function cancelAppointment(id, reason) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${config.appointmentServiceUrl}/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(`appointment-service responded ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}
