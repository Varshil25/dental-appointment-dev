import { pool } from './db.js';
import { listPatients } from './clients/patientServiceClient.js';
import { listDentists } from './clients/dentistServiceClient.js';

export async function getReviewLocal(id) {
  const { rows } = await pool.query('SELECT * FROM reviews WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getReviewByAppointment(appointmentId) {
  const { rows } = await pool.query('SELECT * FROM reviews WHERE appointment_id = $1', [appointmentId]);
  return rows[0] || null;
}

export async function listReviewsLocal({ status, dentistId, rating } = {}) {
  const clauses = [];
  const params = [];
  let i = 1;
  if (status) { clauses.push(`status = $${i++}`); params.push(status); }
  if (dentistId) { clauses.push(`dentist_id = $${i++}`); params.push(dentistId); }
  if (rating) { clauses.push(`rating = $${i++}`); params.push(Number(rating)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM reviews ${where} ORDER BY created_at DESC`, params);
  return rows;
}

// Same fail-soft bulk-fetch pattern as invoiceQueries.js's composeInvoiceNames
// — a lookup-service outage degrades to blank names rather than breaking the
// admin moderation list or the per-dentist public summary.
export async function composeReviewNames(rows) {
  let patients = [];
  let dentists = [];
  try {
    [patients, dentists] = await Promise.all([listPatients(), listDentists()]);
  } catch (err) {
    console.error('[appointment-service] could not compose patient/dentist names for reviews:', err.message);
  }
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const dentistMap = new Map(dentists.map((d) => [d.id, d]));
  return rows.map((r) => {
    const p = patientMap.get(r.patient_id);
    const d = dentistMap.get(r.dentist_id);
    return {
      ...r,
      patient_name: p?.name ?? null,
      dentist_name: d?.name ?? null,
    };
  });
}

export async function listReviews(filters) {
  return composeReviewNames(await listReviewsLocal(filters));
}

export async function getReview(id) {
  const row = await getReviewLocal(id);
  if (!row) return null;
  const [composed] = await composeReviewNames([row]);
  return composed;
}

// Average rating + count for one dentist's *visible* reviews, plus a page
// of the reviews themselves — backs dentist-service's public
// GET /:id/reviews (via GET /internal/reviews?dentistId=...), so this only
// ever considers status = 'visible' (moderation-hidden reviews must not
// affect the public average or appear in the list).
export async function getDentistReviewSummary(dentistId, { page = 1, limit = 10 } = {}) {
  const { rows: statsRows } = await pool.query(
    `SELECT COUNT(*) AS n, COALESCE(AVG(rating), 0) AS avg
       FROM reviews WHERE dentist_id = $1 AND status = 'visible'`,
    [dentistId]
  );
  const totalCount = Number(statsRows[0].n);
  const averageRating = totalCount > 0 ? Math.round(Number(statsRows[0].avg) * 10) / 10 : null;

  const offset = (Math.max(1, page) - 1) * limit;
  const { rows } = await pool.query(
    `SELECT * FROM reviews WHERE dentist_id = $1 AND status = 'visible'
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [dentistId, limit, offset]
  );
  const composed = await composeReviewNames(rows);

  return {
    averageRating,
    totalCount,
    page,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    reviews: composed.map((r) => ({
      // Truncated to first name only — this response is served straight
      // through to the public via dentist-service's GET /:id/reviews, and
      // must never carry a patient's full name, email, or phone.
      patient_first_name: (r.patient_name || '').trim().split(' ')[0] || null,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
    })),
  };
}
