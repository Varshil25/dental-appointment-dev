import { pool } from './db.js';
import { listPatients } from './clients/patientServiceClient.js';
import { listDentists } from './clients/dentistServiceClient.js';

export async function getInvoiceLocal(id) {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getInvoiceByAppointment(appointmentId) {
  const { rows } = await pool.query('SELECT * FROM invoices WHERE appointment_id = $1', [appointmentId]);
  return rows[0] || null;
}

export async function listInvoicesLocal({ status, patientId, dentistId, from, to } = {}) {
  const clauses = [];
  const params = [];
  let i = 1;
  if (status) {
    const statuses = String(status).split(',').map((s) => s.trim());
    clauses.push(`status = ANY($${i++})`);
    params.push(statuses);
  }
  if (patientId) { clauses.push(`patient_id = $${i++}`); params.push(patientId); }
  if (dentistId) { clauses.push(`dentist_id = $${i++}`); params.push(dentistId); }
  if (from) { clauses.push(`created_at >= $${i++}`); params.push(from); }
  if (to) { clauses.push(`created_at <= $${i++}`); params.push(to); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM invoices ${where} ORDER BY created_at DESC`, params);
  return rows;
}

// Joins invoice rows with patient/dentist display fields by composing with
// patient-service + dentist-service, same fail-soft bulk-fetch pattern as
// queries.js's composeNames (a lookup-service outage degrades to blank
// names rather than breaking the billing list).
export async function composeInvoiceNames(rows) {
  let patients = [];
  let dentists = [];
  try {
    [patients, dentists] = await Promise.all([listPatients(), listDentists()]);
  } catch (err) {
    console.error('[appointment-service] could not compose patient/dentist names for invoices:', err.message);
  }
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const dentistMap = new Map(dentists.map((d) => [d.id, d]));
  return rows.map((inv) => {
    const p = patientMap.get(inv.patient_id);
    const d = dentistMap.get(inv.dentist_id);
    return {
      ...inv,
      patient_name: p?.name ?? null,
      patient_email: p?.email ?? null,
      patient_phone: p?.phone ?? null,
      dentist_name: d?.name ?? null,
    };
  });
}

export async function listInvoices(filters) {
  return composeInvoiceNames(await listInvoicesLocal(filters));
}

export async function getInvoice(id) {
  const row = await getInvoiceLocal(id);
  if (!row) return null;
  const [composed] = await composeInvoiceNames([row]);
  return composed;
}
