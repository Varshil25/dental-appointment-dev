import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { config } from '../config.js';
import { signToken } from '../jwt.js';
import { getDentist } from '../clients/dentistServiceClient.js';
import { sendMail } from '../clients/notificationServiceClient.js';
import { otpEmailTemplate, passwordResetTemplate } from '../templates.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

const BCRYPT_ROUNDS = 10;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/; // 8+ chars, at least one letter and one digit

function publicUser(u) {
  return { id: u.id, email: u.email, role: u.role, name: u.name, dentist_id: u.dentist_id };
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

// Step 1: email + password. On success, does NOT issue a session — it
// stores an OTP server-side and emails it, returning only a reference the
// client uses to complete step 2.
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]);
  const user = rows[0];
  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't give a guesser a way to enumerate valid staff emails.
  const GENERIC_ERROR = { error: 'invalid email or password' };
  if (!user) return res.status(401).json(GENERIC_ERROR);
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json(GENERIC_ERROR);

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const reference = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60000);

  // One in-progress login per user — a fresh attempt supersedes any earlier
  // unused OTP rather than leaving multiple valid codes floating around.
  await pool.query('DELETE FROM login_otps WHERE user_id = $1 AND used = false', [user.id]);
  await pool.query(
    `INSERT INTO login_otps (user_id, reference, otp_hash, expires_at) VALUES ($1,$2,$3,$4)`,
    [user.id, reference, otpHash, expiresAt]
  );

  const mailResult = await sendMail(user.email, otpEmailTemplate(otp));
  if (!mailResult.ok) {
    console.error('[auth-service] failed to send OTP email:', mailResult.detail);
    return res.status(502).json({ error: 'could not send the login code email, please try again' });
  }

  res.json({
    message: 'a 6-digit code was sent to your email',
    reference,
    expiresInSeconds: config.otp.ttlMinutes * 60,
  });
});

// Step 2: reference + the 6-digit code. Issues the real JWT only here.
router.post('/verify-otp', async (req, res) => {
  const { reference, otp } = req.body || {};
  if (!reference || !otp) return res.status(400).json({ error: 'reference and otp are required' });

  const { rows } = await pool.query('SELECT * FROM login_otps WHERE reference = $1', [reference]);
  const row = rows[0];
  const INVALID = { error: 'invalid or expired code — request a new one' };
  if (!row || row.used) return res.status(400).json(INVALID);
  if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json(INVALID);
  if (row.attempts >= config.otp.maxAttempts) {
    return res.status(429).json({ error: 'too many incorrect attempts — request a new code' });
  }

  const match = await bcrypt.compare(String(otp), row.otp_hash);
  if (!match) {
    await pool.query('UPDATE login_otps SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return res.status(400).json(INVALID);
  }

  await pool.query('UPDATE login_otps SET used = true WHERE id = $1', [row.id]);
  const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [row.user_id]);
  const user = userRows[0];
  if (!user) return res.status(400).json(INVALID); // account deleted mid-flow

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Regenerates and resends a fresh code for a login attempt still in
// progress, rate-limited to one resend per cooldown window.
router.post('/resend-otp', async (req, res) => {
  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ error: 'reference is required' });

  const { rows } = await pool.query('SELECT * FROM login_otps WHERE reference = $1', [reference]);
  const row = rows[0];
  if (!row || row.used) return res.status(400).json({ error: 'this login attempt is no longer valid — log in again' });

  const secondsSinceLastSend = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
  if (secondsSinceLastSend < config.otp.resendCooldownSeconds) {
    const waitSeconds = Math.ceil(config.otp.resendCooldownSeconds - secondsSinceLastSend);
    return res.status(429).json({ error: `please wait ${waitSeconds}s before requesting another code`, retryAfterSeconds: waitSeconds });
  }

  const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [row.user_id]);
  const user = userRows[0];
  if (!user) return res.status(400).json({ error: 'this login attempt is no longer valid — log in again' });

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60000);
  await pool.query(
    `UPDATE login_otps SET otp_hash = $1, expires_at = $2, attempts = 0, last_sent_at = now() WHERE id = $3`,
    [otpHash, expiresAt, row.id]
  );

  const mailResult = await sendMail(user.email, otpEmailTemplate(otp));
  if (!mailResult.ok) {
    console.error('[auth-service] failed to resend OTP email:', mailResult.detail);
    return res.status(502).json({ error: 'could not send the login code email, please try again' });
  }

  res.json({ message: 'a new code was sent to your email', expiresInSeconds: config.otp.ttlMinutes * 60 });
});

// Who-am-I, based on the bearer token — also the one place that re-checks
// token_version against the database (see db.js's comment on that column),
// so a password reset takes effect the next time the frontend loads a page.
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.sub]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'account no longer exists' });
  if (user.token_version !== req.user.tv) {
    return res.status(401).json({ error: 'session expired — please log in again' });
  }
  res.json(publicUser(user));
});

// Stateless JWT — nothing to invalidate server-side. The frontend clears
// its stored token; this endpoint exists so that contract is explicit and
// callable, and so a future move to server-side sessions wouldn't need a
// new endpoint, just a body here.
router.post('/logout', (_req, res) => res.json({ ok: true }));

// Admin-only: create a new admin or doctor account. Doctors don't
// self-register — an admin creates their login and links it to their
// existing dentist-service row.
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, role, name, dentist_id } = req.body || {};
  if (!email || !password || !role) return res.status(400).json({ error: 'email, password and role are required' });
  if (!['admin', 'doctor'].includes(role)) return res.status(400).json({ error: "role must be 'admin' or 'doctor'" });
  if (!PASSWORD_RE.test(password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters and include a letter and a number' });
  }

  let dentistId = null;
  if (role === 'doctor') {
    if (!dentist_id) return res.status(400).json({ error: 'dentist_id is required for role=doctor' });
    let dentist;
    try {
      dentist = await getDentist(dentist_id);
    } catch (err) {
      console.error('[auth-service] dentist-service validation lookup failed:', err.message);
      return res.status(503).json({ error: 'unable to validate dentist_id right now, please retry' });
    }
    if (!dentist) return res.status(400).json({ error: 'unknown dentist_id' });
    dentistId = dentist.id;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, role, name, dentist_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [String(email).toLowerCase(), passwordHash, role, name || null, dentistId]
    );
    res.status(201).json(publicUser(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'an account with this email already exists' });
    throw err;
  }
});

// Never reveals whether the email exists — same response either way.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const GENERIC = { message: 'if that email exists, we’ve sent a password reset link' };
  if (!email) return res.status(400).json({ error: 'email is required' });

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()]);
  const user = rows[0];
  if (!user) return res.json(GENERIC);

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + config.passwordReset.ttlMinutes * 60000);

  await pool.query('DELETE FROM password_resets WHERE user_id = $1 AND used = false', [user.id]);
  await pool.query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${config.frontendUrl}/reset-password?token=${rawToken}`;
  sendMail(user.email, passwordResetTemplate(resetUrl)).catch((err) =>
    console.error('[auth-service] failed to send reset email:', err.message)
  );

  res.json(GENERIC);
});

router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body || {};
  if (!token || !new_password) return res.status(400).json({ error: 'token and new_password are required' });
  if (!PASSWORD_RE.test(new_password)) {
    return res.status(400).json({ error: 'password must be at least 8 characters and include a letter and a number' });
  }

  const { rows } = await pool.query('SELECT * FROM password_resets WHERE token_hash = $1', [sha256(token)]);
  const row = rows[0];
  const INVALID = { error: 'this reset link is invalid or has expired' };
  if (!row || row.used) return res.status(400).json(INVALID);
  if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json(INVALID);

  const passwordHash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // token_version bump invalidates any token issued before this reset —
    // enforced the next time the frontend calls GET /me (see that route).
    await client.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
      [passwordHash, row.user_id]
    );
    await client.query('UPDATE password_resets SET used = true WHERE id = $1', [row.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ ok: true });
});

export default router;
