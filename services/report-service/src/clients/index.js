import { config } from '../config.js';

async function getJSON(url, timeoutMs = 3000) {
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

export const remindersSummary = () => getJSON(`${config.reminderServiceUrl}/internal/reminders-summary`);

export const patientsCount = () => getJSON(`${config.patientServiceUrl}/internal/patients-count`);
