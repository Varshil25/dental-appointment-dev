// Seed the microservices with a realistic sample clinic scenario, calling
// each service's real HTTP API in dependency order (unlike the old
// monolith's seed.js, IDs now come from independent per-service SQLite
// sequences, so we can't hardcode them — every ID is captured from the
// service's own response).
//
// Run with:  node scripts/seed-all.js
// (all services must already be running — see README)

const urls = {
  patient: process.env.PATIENT_SERVICE_URL || 'http://localhost:4001',
  dentist: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
  appointment: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:4003',
  reminder: process.env.REMINDER_SERVICE_URL || 'http://localhost:4004',
};
const seedToken = process.env.SEED_TOKEN || 'dev-seed-token';

async function postJSON(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`POST ${url} -> ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

console.log('Seeding sample data across services…');

// 1. Dentists.
const dentistDefs = [
  ['Dr. Amara Osei', 'General Dentistry', 'amara@brightsmile.example', 9, 17, 30],
  ['Dr. Ben Cohen', 'Orthodontics', 'ben@brightsmile.example', 10, 18, 45],
  ['Dr. Priya Nair', 'Endodontics', 'priya@brightsmile.example', 8, 14, 30],
];
const dentistIds = [];
for (const [name, specialty, email, work_start, work_end, slot_minutes] of dentistDefs) {
  const d = await postJSON(`${urls.dentist}/`, { name, specialty, email, work_start, work_end, slot_minutes });
  dentistIds.push(d.id);
}

// 2. Patients.
const patientDefs = [
  // First patient uses your own email so real reminder emails land in your inbox.
  ['Varshil (you)', 'varshilce@gmail.com', '555-0100', '1998-04-12', 'Prefers morning slots.'],
  ['Maria Gomez', 'maria.gomez@example.com', '555-0111', '1985-09-30', 'Sensitive to anesthetic.'],
  ['James Okafor', 'james.okafor@example.com', '555-0122', '1972-01-05', 'Wears a crown, upper left.'],
  ['Lily Chen', 'lily.chen@example.com', '555-0133', '2005-06-21', 'Braces — ortho follow-ups.'],
  ['Tom Bianchi', 'tom.bianchi@example.com', '555-0144', '1990-11-11', ''],
];
const patientIds = [];
const patientById = new Map();
for (const [name, email, phone, dob, notes] of patientDefs) {
  const p = await postJSON(`${urls.patient}/`, { name, email, phone, dob, notes });
  patientIds.push(p.id);
  patientById.set(p.id, p);
}

// Helper: build a Date N days from now at a given local hour:minute.
const at = (days, hour, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d;
};

let appointmentCount = 0;

// 3. Past appointments (for reporting metrics) — the public booking route
// rejects past times, so these go through the internal seed endpoint.
async function seedPast(pi, di, start, mins, status, reason) {
  const end = new Date(start.getTime() + mins * 60000);
  const patient = patientById.get(patientIds[pi]);
  await postJSON(
    `${urls.appointment}/internal/appointments/seed`,
    {
      patient_id: patientIds[pi],
      dentist_id: dentistIds[di],
      start: start.toISOString(),
      end: end.toISOString(),
      status,
      reason,
      patient_email: patient.email,
      patient_name: patient.name,
    },
    { 'X-Seed-Token': seedToken }
  );
  appointmentCount++;
}
await seedPast(1, 0, at(-7, 10), 30, 'completed', 'Routine cleaning');
await seedPast(2, 0, at(-5, 11), 30, 'no_show', 'Filling');
await seedPast(3, 1, at(-4, 14), 45, 'cancelled', 'Ortho adjustment');
await seedPast(4, 2, at(-2, 9), 30, 'completed', 'Root canal review');

// 4. Upcoming appointments — go through the real public booking route, as
// an end-to-end smoke test of validation + conflict-check + reminder push.
async function bookUpcoming(pi, di, start, mins, reason) {
  const end = new Date(start.getTime() + mins * 60000);
  await postJSON(`${urls.appointment}/`, {
    patient_id: patientIds[pi],
    dentist_id: dentistIds[di],
    start: start.toISOString(),
    end: end.toISOString(),
    reason,
  });
  appointmentCount++;
}
await bookUpcoming(0, 0, at(1, 9), 30, 'Check-up & cleaning');
await bookUpcoming(1, 2, at(1, 13), 30, 'Toothache assessment');
await bookUpcoming(2, 1, at(2, 10, 45), 45, 'Braces tightening');
await bookUpcoming(3, 0, at(3, 15), 30, 'Whitening consultation');

const reminders = await getJSON(`${urls.reminder}/`);

console.log(
  `Done: ${dentistIds.length} dentists, ${patientIds.length} patients, ` +
    `${appointmentCount} appointments, ${reminders.length} reminders.`
);
