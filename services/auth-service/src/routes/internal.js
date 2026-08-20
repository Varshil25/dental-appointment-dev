import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { config } from '../config.js';
import { getDentist } from '../clients/dentistServiceClient.js';

const router = Router();
const BCRYPT_ROUNDS = 10;

// Bootstraps the very first admin account (and lets scripts/seed-all.js
// create the demo doctor account too) without the chicken-and-egg problem
// of POST /users itself requiring an existing admin's token. Guarded by a
// shared token exactly like appointment-service's
// POST /internal/appointments/seed — dev/seed-only, never called by either
// frontend.
router.post('/seed-user', async (req, res) => {
  if (req.get('X-Seed-Token') !== config.seedToken)
    return res.status(403).json({ error: 'invalid seed token' });

  const { email, password, role, name, dentist_id } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password and role are required' });
  if (!['admin', 'doctor'].includes(role)) return res.status(400).json({ error: "role must be 'admin' or 'doctor'" });

  let dentistId = null;
  if (role === 'doctor') {
    if (!dentist_id) return res.status(400).json({ error: 'dentist_id is required for role=doctor' });
    const dentist = await getDentist(dentist_id);
    if (!dentist) return res.status(400).json({ error: 'unknown dentist_id' });
    dentistId = dentist.id;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, name, dentist_id) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, role = $3, name = $4, dentist_id = $5
       RETURNING id, email, role, name, dentist_id`,
      [String(email).toLowerCase(), passwordHash, role, name || null, dentistId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[auth-service] seed-user failed:', err.message);
    res.status(500).json({ error: 'failed to seed user' });
  }
});

export default router;
