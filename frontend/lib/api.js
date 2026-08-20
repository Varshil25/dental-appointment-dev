// Thin fetch wrapper around the backend API.
//
// In production this is a static export served by Render, where /api/*
// is proxied to the gateway by render.yaml's route rewrite — so a plain
// relative path works exactly like it did on the old Vite build.
//
// In local dev there's no server-side rewrite available (Next.js doesn't
// support `rewrites()` together with `output:'export'` — see
// next.config.mjs), so we call the gateway directly; it already has CORS
// enabled for exactly this.
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '';

// See lib/auth.js for why the token lives in localStorage rather than an
// httpOnly cookie. Read lazily (not imported as a static value) so every
// request picks up the current token, including right after login/logout.
function authHeader() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Callers that need more than the message (e.g. the dentist-deactivation
    // conflict payload) can read err.status / err.data — everyone else just
    // keeps using err.message like before.
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyOtp: (reference, otp) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ reference, otp }) }),
  resendOtp: (reference) => request('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ reference }) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  createUser: (body) => request('/auth/users', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, new_password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

  // Patients
  listPatients: (q = '') => request(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (body) => request('/patients', { method: 'POST', body: JSON.stringify(body) }),
  updatePatient: (id, body) =>
    request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Dentists & slots
  listDentists: () => request('/dentists'),
  getDentist: (id) => request(`/dentists/${id}`),
  createDentist: (body) => request('/dentists', { method: 'POST', body: JSON.stringify(body) }),
  updateDentist: (id, body) => request(`/dentists/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getDentistAvailability: (id) => request(`/dentists/${id}/availability`),
  updateDentistAvailability: (id, days) =>
    request(`/dentists/${id}/availability`, { method: 'PUT', body: JSON.stringify({ days }) }),
  slots: (dentistId, date) => request(`/dentists/${dentistId}/slots?date=${date}`),

  // Clinic profile (name/logo/contact/weekly hours) — powers the admin
  // Clinic Settings page and the patient-facing booking pages. GET is
  // public; PUT is admin-only, enforced by the gateway.
  getClinicProfile: () => request('/clinic-profile'),
  updateClinicProfile: (body) => request('/clinic-profile', { method: 'PUT', body: JSON.stringify(body) }),

  // Appointments
  listAppointments: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return request(`/appointments${qs ? `?${qs}` : ''}`);
  },
  book: (body) => request('/appointments', { method: 'POST', body: JSON.stringify(body) }),
  reschedule: (id, body) =>
    request(`/appointments/${id}/reschedule`, { method: 'PATCH', body: JSON.stringify(body) }),
  cancel: (id, reason) =>
    request(`/appointments/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  setStatus: (id, status) =>
    request(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  followUp: (id, body) =>
    request(`/appointments/${id}/follow-up`, { method: 'POST', body: JSON.stringify(body) }),

  // Reminders
  listReminders: (appointmentId) =>
    request(`/reminders${appointmentId ? `?appointmentId=${appointmentId}` : ''}`),
  sendReminder: (id) => request(`/reminders/${id}/send`, { method: 'POST' }),

  // Inquiries — submitted from the patient-frontend site's Contact page,
  // read here so staff aren't relying solely on the notification email.
  listInquiries: (status) => request(`/inquiries${status ? `?status=${status}` : ''}`),
  setInquiryStatus: (id, status) =>
    request(`/inquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Dentist applications — admin review of self-submitted applications from
  // patient-frontend's /join-as-dentist form. Submission itself (POST '/')
  // is public and only ever called from patient-frontend, not here.
  listDentistApplications: (status) => request(`/dentist-applications${status ? `?status=${status}` : ''}`),
  getDentistApplication: (id) => request(`/dentist-applications/${id}`),
  approveDentistApplication: (id) => request(`/dentist-applications/${id}/approve`, { method: 'POST' }),
  rejectDentistApplication: (id, rejection_reason) =>
    request(`/dentist-applications/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejection_reason }) }),

  // Reports
  summary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/summary${qs ? `?${qs}` : ''}`);
  },
  // Binary response (application/pdf), not JSON — bypasses request()'s
  // res.json() parsing and returns the raw Blob for the caller to save.
  summaryPdf: async (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/api/reports/summary/pdf${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return res.blob();
  },
};

// Shared formatting helpers.
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
