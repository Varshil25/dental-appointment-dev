import { pool } from './db.js';
import { listPatients } from './clients/patientServiceClient.js';
import { listDentists } from './clients/dentistServiceClient.js';
import { cached } from './cache.js';

// invoice_id/invoice_status are left-joined in from invoices (same DB, see
// db.js) so the frontend can show "Add Invoice" vs "View Invoice" on a
// completed appointment without a second round-trip. Aliased rather than
// selected via `i.*` since both tables have a `status` column.
const APPT_SELECT = `
  SELECT a.*, i.id AS invoice_id, i.status AS invoice_status
    FROM appointments a
    LEFT JOIN invoices i ON i.appointment_id = a.id`;

export async function getAppointmentLocal(id) {
  const { rows } = await pool.query(`${APPT_SELECT} WHERE a.id = $1`, [id]);
  return rows[0] || null;
}

export async function listAppointmentsLocal({ status, from, to, dentistId, patientId } = {}) {
  const clauses = [];
  const params = [];
  let i = 1;
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim());
    clauses.push(`a.status = ANY($${i++})`);
    params.push(statuses);
  }
  if (from) { clauses.push(`a.start_time >= $${i++}`); params.push(from); }
  if (to) { clauses.push(`a.start_time <= $${i++}`); params.push(to); }
  if (dentistId) { clauses.push(`a.dentist_id = $${i++}`); params.push(dentistId); }
  if (patientId) { clauses.push(`a.patient_id = $${i++}`); params.push(patientId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`${APPT_SELECT} ${where} ORDER BY a.start_time ASC`, params);
  return rows;
}

// Joins appointment rows with patient/dentist display fields by composing
// with patient-service + dentist-service, replicating the SQL JOIN the
// monolith used to do in one query. Fails soft (null names) so the
// schedule/history views stay usable even if a lookup service is down —
// unlike booking validation, which fails closed.
export async function composeNames(rows) {
  let patients = [];
  let dentists = [];
  try {
    [patients, dentists] = await Promise.all([listPatients(), listDentists()]);
  } catch (err) {
    console.error('[appointment-service] could not compose patient/dentist names:', err.message);
  }
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const dentistMap = new Map(dentists.map((d) => [d.id, d]));
  return rows.map((a) => {
    const p = patientMap.get(a.patient_id);
    const d = dentistMap.get(a.dentist_id);
    return {
      ...a,
      patient_name: p?.name ?? null,
      patient_email: p?.email ?? null,
      patient_phone: p?.phone ?? null,
      dentist_name: d?.name ?? null,
      // Lets the UI flag a still-booked appointment whose dentist has since
      // been deactivated, without a separate lookup.
      dentist_status: d?.status ?? null,
    };
  });
}

export async function getAppointment(id) {
  return cached(`byId:${id}`, 15, async () => {
    const row = await getAppointmentLocal(id);
    if (!row) return null;
    const [composed] = await composeNames([row]);
    return composed;
  });
}

export async function listAppointments(filters) {
  const key = `list:${JSON.stringify(filters || {})}`;
  return cached(key, 15, async () => composeNames(await listAppointmentsLocal(filters)));
}
