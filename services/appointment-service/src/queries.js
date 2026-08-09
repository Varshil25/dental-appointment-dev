import { pool } from './db.js';
import { listPatients } from './clients/patientServiceClient.js';
import { listDentists } from './clients/dentistServiceClient.js';
import { cached } from './cache.js';

export async function getAppointmentLocal(id) {
  const { rows } = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listAppointmentsLocal({ status, from, to, dentistId, patientId } = {}) {
  const clauses = [];
  const params = [];
  let i = 1;
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim());
    clauses.push(`status = ANY($${i++})`);
    params.push(statuses);
  }
  if (from) { clauses.push(`start_time >= $${i++}`); params.push(from); }
  if (to) { clauses.push(`start_time <= $${i++}`); params.push(to); }
  if (dentistId) { clauses.push(`dentist_id = $${i++}`); params.push(dentistId); }
  if (patientId) { clauses.push(`patient_id = $${i++}`); params.push(patientId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM appointments ${where} ORDER BY start_time ASC`, params);
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
  const dentistMap = new Map(dentists.map((d) => [d.id, d.name]));
  return rows.map((a) => {
    const p = patientMap.get(a.patient_id);
    return {
      ...a,
      patient_name: p?.name ?? null,
      patient_email: p?.email ?? null,
      patient_phone: p?.phone ?? null,
      dentist_name: dentistMap.get(a.dentist_id) ?? null,
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
