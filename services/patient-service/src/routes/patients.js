import { Router } from 'express';
import { pool } from '../db.js';
import { getAppointmentHistory } from '../clients/historyClient.js';
import { isValidPhone, normalizePhone } from '../validation.js';
import { cached, invalidate } from '../cache.js';

const router = Router();

const DUPLICATE_EMAIL_ERROR = 'a patient with this email already exists';
const PHONE_FORMAT_ERROR = 'phone must include a country code, e.g. +1 5551234567';
const isUniqueViolation = (err) => err.code === '23505';

router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const rows = await cached(`list:${q}`, 30, async () => {
    const { rows } = q
      ? await pool.query(
          `SELECT * FROM patients
            WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1
            ORDER BY name`,
          [`%${q}%`]
        )
      : await pool.query('SELECT * FROM patients ORDER BY name');
    return rows;
  });
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const patient = await cached(`byId:${req.params.id}`, 30, async () => {
    const { rows } = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    if (!rows[0]) return null;
    const appointments = await getAppointmentHistory(req.params.id);
    return { ...rows[0], appointments };
  });
  if (!patient) return res.status(404).json({ error: 'patient not found' });
  res.json(patient);
});

router.post('/', async (req, res) => {
  const { name, email, phone, dob, notes } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: PHONE_FORMAT_ERROR });

  const { rows: dupe } = await pool.query('SELECT id FROM patients WHERE LOWER(email) = LOWER($1)', [email]);
  if (dupe.length) return res.status(409).json({ error: DUPLICATE_EMAIL_ERROR });

  try {
    const { rows } = await pool.query(
      'INSERT INTO patients (name, email, phone, dob, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, email, phone ? normalizePhone(phone) : null, dob || null, notes || null]
    );
    await invalidate('list:*');
    await invalidate('internal:*');
    res.status(201).json(rows[0]);
  } catch (err) {
    // Backstop for a race between two concurrent requests for the same
    // email that both passed the SELECT check above before either INSERT.
    if (isUniqueViolation(err)) return res.status(409).json({ error: DUPLICATE_EMAIL_ERROR });
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'patient not found' });
  const { name, email, phone, dob, notes } = { ...existing, ...req.body };
  // Bug fix carried over from the SQLite version: re-validate required
  // fields after merge instead of letting a blank overwrite them.
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  if (phone && !isValidPhone(phone)) return res.status(400).json({ error: PHONE_FORMAT_ERROR });

  const { rows: dupe } = await pool.query(
    'SELECT id FROM patients WHERE LOWER(email) = LOWER($1) AND id != $2',
    [email, req.params.id]
  );
  if (dupe.length) return res.status(409).json({ error: DUPLICATE_EMAIL_ERROR });

  try {
    const { rows } = await pool.query(
      'UPDATE patients SET name=$1, email=$2, phone=$3, dob=$4, notes=$5 WHERE id=$6 RETURNING *',
      [name, email, phone ? normalizePhone(phone) : phone, dob, notes, req.params.id]
    );
    await invalidate(`byId:${req.params.id}`);
    await invalidate('list:*');
    await invalidate(`internal:byId:${req.params.id}`);
    res.json(rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: DUPLICATE_EMAIL_ERROR });
    throw err;
  }
});

export default router;
