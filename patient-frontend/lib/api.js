// Thin fetch wrapper around the backend API — same split as the staff
// frontend's lib/api.js: direct localhost:4000 in dev (no server-side
// rewrite is possible with `output:'export'`), relative /api/* in
// production once render.yaml's route rewrite is in front of this static
// site. Kept as an independent copy (not imported across projects) since
// patient-frontend is meant to build/deploy on its own.
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // Clinic profile — name/logo/contact/weekly hours, powers the header,
  // footer, and Clinic Info section. Public GET, no auth needed.
  getClinicProfile: () => request('/clinic-profile'),

  // Dentists & slots
  listDentists: () => request('/dentists'),
  getDentist: (id) => request(`/dentists/${id}`),
  slots: (dentistId, date) => request(`/dentists/${dentistId}/slots?date=${date}`),

  // Patients — no dedicated "find by contact" endpoint exists, so the
  // booking wizard's returning-patient lookup reuses the search endpoint
  // (?q= does an ILIKE across name/email/phone) and the caller filters for
  // an exact match itself; see lib/patient-lookup.js.
  searchPatients: (q) => request(`/patients?q=${encodeURIComponent(q)}`),
  createPatient: (body) => request('/patients', { method: 'POST', body: JSON.stringify(body) }),

  // Appointments
  book: (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  getAppointment: (id) => request(`/appointments/${id}`),
  // Public, unauthenticated "manage my appointment" lookup — requires the
  // reference (appointment id) AND a matching email/phone on file, so a
  // guessable sequential id alone can't pull up someone else's booking.
  lookupAppointment: (id, contact) =>
    request('/appointments/lookup', { method: 'POST', body: JSON.stringify({ id, contact }) }),
  reschedule: (id, body) =>
    request(`/appointments/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancel: (id, reason) =>
    request(`/appointments/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),

  // Inquiries — general contact form, separate from booking.
  submitInquiry: (body) => request('/inquiries', { method: 'POST', body: JSON.stringify(body) }),

  // Dentist applications — public self-application form at /join-as-dentist.
  // Reviewed by an admin in the staff dashboard; not readable from here.
  submitDentistApplication: (body) => request('/dentist-applications', { method: 'POST', body: JSON.stringify(body) }),

  // Chat widget — proxies to Claude server-side (gateway holds the API
  // key); the browser never talks to Anthropic directly. `messages` is
  // [{role: 'user'|'assistant', content: string}, ...].
  chat: (messages) => request('/chat', { method: 'POST', body: JSON.stringify({ messages }) }),
};

// Shared formatting helpers.
export const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const fmtDateShort = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const fmtDateTime = (iso) =>
  `${fmtDateShort(iso)} at ${fmtTime(iso)}`;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const fmtHour12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};
