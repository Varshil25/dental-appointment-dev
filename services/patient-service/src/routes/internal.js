import { Router } from 'express';
import { pool } from '../db.js';
import { cached } from '../cache.js';

const router = Router();

// Used by appointment-service to validate patient_id and read the
// patient's name/email for booking confirmation + reminder snapshots.
router.get('/patients/:id', async (req, res) => {
  const patient = await cached(`internal:byId:${req.params.id}`, 30, async () => {
    const { rows } = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
    return rows[0] || null;
  });
  if (!patient) return res.status(404).json({ error: 'patient not found' });
  res.json(patient);
});

// Used by report-service for the total-patients metric.
router.get('/patients-count', async (_req, res) => {
  const result = await cached('internal:count', 30, async () => {
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM patients');
    // pg returns COUNT(*) as a string (it's a bigint) — cast back to a number.
    return { n: Number(rows[0].n) };
  });
  res.json(result);
});

export default router;
