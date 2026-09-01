import { config } from '../config.js';

// 3s was tuned for a warm backend; on Render's free tier a downstream
// service that's spun down from idle can take 20-50s to answer its very
// first request after waking (confirmed directly: appointment-service and
// auth-service each took ~21-22s cold). At 3s, buildSummary's Promise.all
// (see compose.js) would reject on essentially every first dashboard load
// of the day, well before any of these services finished booting - not a
// real error, just too short a fuse. 40s covers that cold-start window
// (with headroom under gateway's own 55s proxy timeout for this whole
// request) while a genuine non-2xx response (the `!res.ok` check) still
// fails immediately, same as before.
async function getJSON(url, timeoutMs = 40_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export const appointmentSummary = (from, to) => {
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  return getJSON(`${config.appointmentServiceUrl}/internal/appointments/summary${qs ? `?${qs}` : ''}`);
};

export const perDentistSummary = (from, to) => {
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  return getJSON(`${config.appointmentServiceUrl}/internal/appointments/per-dentist-summary${qs ? `?${qs}` : ''}`);
};

export const appointmentTimeseries = (days = 14) =>
  getJSON(`${config.appointmentServiceUrl}/internal/appointments/timeseries?days=${days}`);

export const listDentists = () => getJSON(`${config.dentistServiceUrl}/internal/dentists`);

export const revenueSummary = (from, to) => {
  const qs = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
  return getJSON(`${config.appointmentServiceUrl}/internal/invoices/revenue-summary${qs ? `?${qs}` : ''}`);
};

export const remindersSummary = () => getJSON(`${config.reminderServiceUrl}/internal/reminders-summary`);

export const patientsCount = () => getJSON(`${config.patientServiceUrl}/internal/patients-count`);
