import { Router } from 'express';
import { pool } from '../db.js';
import { cached } from '../cache.js';

const router = Router();

// Used by report-service to reconstruct per-dentist load (needs every
// dentist's name, including ones with zero appointments).
router.get('/dentists', async (_req, res) => {
  const rows = await cached('internal:list', 60, async () => {
    const { rows } = await pool.query('SELECT * FROM dentists ORDER BY name');
    return rows;
  });
  res.json(rows);
});

// Used by appointment-service to validate dentist_id and read slot_minutes
// when resolving booking/reschedule/follow-up times.
router.get('/dentists/:id', async (req, res) => {
  const dentist = await cached(`internal:byId:${req.params.id}`, 60, async () => {
    const { rows } = await pool.query('SELECT * FROM dentists WHERE id = $1', [req.params.id]);
    return rows[0] || null;
  });
  if (!dentist) return res.status(404).json({ error: 'dentist not found' });
  res.json(dentist);
});

export default router;
