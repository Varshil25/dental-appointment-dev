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

// Composes a patient's appointment history from appointment-service +
// dentist-service. Unlike report-service, this fails *soft*: the patient
// record itself is independently useful even if history can't be composed.
export async function getAppointmentHistory(patientId) {
  try {
    const [appointments, dentists] = await Promise.all([
      getJSON(`${config.appointmentServiceUrl}/internal/appointments?patientId=${patientId}`),
      getJSON(`${config.dentistServiceUrl}/internal/dentists`),
    ]);
    const dentistName = new Map(dentists.map((d) => [d.id, d.name]));
    return appointments
      .map((a) => ({ ...a, dentist_name: dentistName.get(a.dentist_id) || null }))
      .sort((a, b) => (a.start_time < b.start_time ? 1 : -1));
  } catch (err) {
    console.error('[patient-service] could not compose appointment history:', err.message);
    return [];
  }
}
