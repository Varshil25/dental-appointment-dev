import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { config } from '../config.js';
import { createDentist } from '../clients/dentistServiceClient.js';
import { sendMail } from '../clients/notificationServiceClient.js';
import { applicationReceivedTemplate, applicationApprovedTemplate, applicationRejectedTemplate } from '../templates.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ['pending', 'approved', 'rejected'];

// Avoids visually-ambiguous characters (0/O, 1/I/l) since this ends up
// read/typed off an email by a human, unlike the OTP codes elsewhere in
// this service. Built by construction (one letter, one digit, then a
// shuffled fill) rather than "generate random, retry if it doesn't match
// PASSWORD_RE" — guarantees a pass on the first try.
function generateTempPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const pick = (set) => set[crypto.randomInt(0, set.length)];

  const chars = [pick(letters), pick(digits)];
  for (let i = 0; i < 10; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Public — a prospective dentist applying to join the clinic. No auth;
// rate-limited at the gateway (see services/gateway/src/rateLimit.js) the
// same way the contact-form inquiry endpoint is.
router.post('/', async (req, res) => {
  // Honeypot: same pattern as dentist-service's POST /inquiries — a hidden
  // field a real applicant never fills in. Reject quietly rather than store
  // spam or spend an outbound email on it.
  if (req.body?.website) return res.status(400).json({ error: 'invalid submission' });

  const { name, email, phone, specialization, notes } = req.body || {};
  if (!name || !email || !phone || !specialization) {
    return res.status(400).json({ error: 'name, email, phone and specialization are required' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email address' });

  const normalizedEmail = String(email).toLowerCase();

  const { rows: pendingRows } = await pool.query(
    `SELECT id FROM dentist_applications WHERE email = $1 AND status = 'pending'`,
    [normalizedEmail]
  );
  if (pendingRows[0]) {
    return res.status(409).json({ error: 'an application from this email is already pending review' });
  }

  const { rows: userRows } = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (userRows[0]) {
    return res.status(409).json({ error: 'an account already exists for this email' });
  }

  const { rows } = await pool.query(
    `INSERT INTO dentist_applications (name, email, phone, specialization, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, normalizedEmail, phone, specialization, notes || null]
  );
  const application = rows[0];

  const mailResult = await sendMail(application.email, applicationReceivedTemplate(application));
  if (!mailResult.ok) {
    console.error('[auth-service] failed to send application-received email:', mailResult.detail);
  }

  res.status(201).json(application);
});

// Everything below is admin-only staff review — the applicant themselves
// never sees or polls these.
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const status = req.query.status;
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  }
  const { rows } = status
    ? await pool.query('SELECT * FROM dentist_applications WHERE status = $1 ORDER BY submitted_at DESC', [status])
    : await pool.query('SELECT * FROM dentist_applications ORDER BY submitted_at DESC');
  res.json(rows);
});

router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dentist_applications WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'application not found' });
  res.json(rows[0]);
});

// Approve: creates the dentist-service row, creates a linked doctor login
// with a system-generated temporary password, marks the application
// reviewed, and emails the applicant their credentials — all using the
// exact email address they applied with (never a value the admin types).
//
// Known limitation (time-boxed, same posture as this project's other
// documented tradeoffs): if the dentist-service call below succeeds but the
// local users-insert transaction then fails, the new dentist row is left
// orphaned (no linked login) rather than rolled back — undoing a write
// already committed in another service's database would need a distributed
// transaction/saga this project doesn't have anywhere else either.
router.post('/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dentist_applications WHERE id = $1', [req.params.id]);
  const application = rows[0];
  if (!application) return res.status(404).json({ error: 'application not found' });
  if (application.status !== 'pending') {
    return res.status(409).json({ error: `application is already ${application.status}` });
  }

  const { rows: existingUserRows } = await pool.query('SELECT id FROM users WHERE email = $1', [application.email]);
  if (existingUserRows[0]) {
    return res.status(409).json({ error: 'an account already exists for this email' });
  }

  let dentist;
  try {
    dentist = await createDentist({
      name: application.name,
      specialty: application.specialization,
      email: application.email,
      phone: application.phone,
    });
  } catch (err) {
    console.error('[auth-service] failed to create dentist record on approval:', err.message);
    return res.status(502).json({ error: 'could not create the dentist record right now, please retry' });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const client = await pool.connect();
  let user;
  let updatedApplication;
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, role, name, dentist_id) VALUES ($1,$2,'doctor',$3,$4) RETURNING *`,
      [application.email, passwordHash, application.name, dentist.id]
    );
    user = userRows[0];
    const { rows: appRows } = await client.query(
      `UPDATE dentist_applications SET status='approved', reviewed_by=$1, reviewed_at=now() WHERE id=$2 RETURNING *`,
      [req.user.sub, application.id]
    );
    updatedApplication = appRows[0];
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'an account already exists for this email' });
    throw err;
  } finally {
    client.release();
  }

  const loginUrl = `${config.frontendUrl}/login`;
  const mailResult = await sendMail(application.email, applicationApprovedTemplate(application.email, tempPassword, loginUrl));
  if (!mailResult.ok) {
    console.error('[auth-service] failed to send approval email:', mailResult.detail);
  }

  res.json({ application: updatedApplication, dentist_id: dentist.id, email_sent: mailResult.ok });
});

router.post('/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { rejection_reason } = req.body || {};
  const { rows } = await pool.query('SELECT * FROM dentist_applications WHERE id = $1', [req.params.id]);
  const application = rows[0];
  if (!application) return res.status(404).json({ error: 'application not found' });
  if (application.status !== 'pending') {
    return res.status(409).json({ error: `application is already ${application.status}` });
  }

  const { rows: updatedRows } = await pool.query(
    `UPDATE dentist_applications SET status='rejected', reviewed_by=$1, reviewed_at=now(), rejection_reason=$2 WHERE id=$3 RETURNING *`,
    [req.user.sub, rejection_reason || null, application.id]
  );

  const mailResult = await sendMail(application.email, applicationRejectedTemplate(rejection_reason));
  if (!mailResult.ok) {
    console.error('[auth-service] failed to send rejection email:', mailResult.detail);
  }

  res.json(updatedRows[0]);
});

export default router;
