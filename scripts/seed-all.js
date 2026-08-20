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
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4007',
};
const seedToken = process.env.SEED_TOKEN || 'dev-seed-token';
// auth-service has its own independent SEED_TOKEN env var — defaults to the
// same 'dev-seed-token' value as appointment-service's for local dev, so
// this reuses `seedToken` unless you've set the two differently.
const authSeedToken = process.env.AUTH_SEED_TOKEN || seedToken;

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

async function putJSON(url, body) {
  const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PUT ${url} -> ${res.status}: ${data.error || JSON.stringify(data)}`);
  return data;
}

console.log('Seeding sample data across services…');

// 1. Dentists — varied weekly schedules so the availability editor and the
// calendar/slot-picker have something interesting to show immediately:
// Amara is a standard Mon-Fri dentist, Ben works weekdays but cuts Friday
// short, Priya works every day including weekends.
const dentistDefs = [
  {
    name: 'Dr. Amara Osei', specialty: 'General Dentistry', email: 'amara@brightsmile.example',
    phone: '+15550101', work_start: 9, work_end: 17, slot_minutes: 30, status: 'active',
    dayOverrides: { 0: { is_available: false }, 6: { is_available: false } }, // off weekends
  },
  {
    name: 'Dr. Ben Cohen', specialty: 'Orthodontics', email: 'ben@brightsmile.example',
    phone: '+15550102', work_start: 10, work_end: 18, slot_minutes: 45, status: 'active',
    dayOverrides: {
      0: { is_available: false }, // off Sunday
      5: { work_start: 10, work_end: 14 }, // shorter Friday
      6: { is_available: false }, // off Saturday
    },
  },
  {
    name: 'Dr. Priya Nair', specialty: 'Endodontics', email: 'priya@brightsmile.example',
    phone: '+15550103', work_start: 8, work_end: 14, slot_minutes: 30, status: 'active',
    dayOverrides: {}, // works every day, including weekends
  },
];
const dentistIds = [];
for (const { dayOverrides, ...body } of dentistDefs) {
  const d = await postJSON(`${urls.dentist}/`, body);
  dentistIds.push(d.id);

  const days = [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
    day_of_week,
    is_available: true,
    work_start: body.work_start,
    work_end: body.work_end,
    ...dayOverrides[day_of_week],
  }));
  await putJSON(`${urls.dentist}/${d.id}/availability`, { days });
}

// 2. Patients.
const patientDefs = [
  // First patient uses your own email so real reminder emails land in your inbox.
  ['Varshil (you)', 'varshilce@gmail.com', '+15550100', '1998-04-12', 'Prefers morning slots.'],
  ['Maria Gomez', 'maria.gomez@example.com', '+15550111', '1985-09-30', 'Sensitive to anesthetic.'],
  ['James Okafor', 'james.okafor@example.com', '+15550122', '1972-01-05', 'Wears a crown, upper left.'],
  ['Lily Chen', 'lily.chen@example.com', '+15550133', '2005-06-21', 'Braces — ortho follow-ups.'],
  ['Tom Bianchi', 'tom.bianchi@example.com', '+15550144', '1990-11-11', ''],
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

// 5. Staff accounts (admin + doctor) for auth-service — created via the
// token-gated bootstrap endpoint (POST /users itself is admin-only, which
// would otherwise be a chicken-and-egg problem for the very first admin).
// Uses your own email, with Gmail plus-addressing to keep the two accounts
// distinct, so the real OTP/reset emails land in your own inbox — same
// reasoning as the first patient above.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'nbnabhay@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin1234';
const DOCTOR_EMAIL = process.env.SEED_DOCTOR_EMAIL || 'abhaymgajjar@gmail.com';
const DOCTOR_PASSWORD = process.env.SEED_DOCTOR_PASSWORD || 'Doctor1234';
const doctorDentistName = dentistDefs[0].name; // linked to dentistIds[0] below

await postJSON(
  `${urls.auth}/internal/seed-user`,
  { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin', name: 'Clinic Admin' },
  { 'X-Seed-Token': authSeedToken }
);
await postJSON(
  `${urls.auth}/internal/seed-user`,
  { email: DOCTOR_EMAIL, password: DOCTOR_PASSWORD, role: 'doctor', name: doctorDentistName, dentist_id: dentistIds[0] },
  { 'X-Seed-Token': authSeedToken }
);

console.log(
  `Done: ${dentistIds.length} dentists, ${patientIds.length} patients, ` +
    `${appointmentCount} appointments, ${reminders.length} reminders.`
);

console.log(`
──────────────────────────────────────────────────────────
  Staff login — http://localhost:3000/login
──────────────────────────────────────────────────────────
  Admin:   ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}
  Doctor:  ${DOCTOR_EMAIL} / ${DOCTOR_PASSWORD}  (linked to ${doctorDentistName})

  Login is two-step: password first, then a 6-digit code
  emailed to the address above (both route to your real
  inbox via Gmail's +addressing).
──────────────────────────────────────────────────────────
`);
