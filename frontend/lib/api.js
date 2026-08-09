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

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request('/health'),

  // Patients
  listPatients: (q = '') => request(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (body) => request('/patients', { method: 'POST', body: JSON.stringify(body) }),
  updatePatient: (id, body) =>
    request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Dentists & slots
  listDentists: () => request('/dentists'),
  slots: (dentistId, date) => request(`/dentists/${dentistId}/slots?date=${date}`),

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
