import { Router } from 'express';
import { pool } from '../db.js';
import { config } from '../config.js';
import { sendMail } from '../clients/notificationServiceClient.js';

const router = Router();

const SUBJECTS = ['General Question', 'Insurance/Billing', 'Feedback', 'Other'];
const STATUSES = ['new', 'read'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function inquiryNoticeTemplate(inquiry) {
  const subject = `New website inquiry — ${inquiry.subject}`;
  const text =
    `A new inquiry came in through the ${config.clinic.name} website.\n\n` +
    `  From:    ${inquiry.name} <${inquiry.email}>${inquiry.phone ? ` · ${inquiry.phone}` : ''}\n` +
    `  Subject: ${inquiry.subject}\n\n` +
    `${inquiry.message}\n\n` +
    `View it in the staff dashboard's Inquiries page.`;
  const html = `
<div style="background:#eef1f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 34px rgba(15,23,42,.08);">
    <tr><td height="5" style="background:#0d9488;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="padding:28px 32px 8px;">
        <span style="display:inline-block;padding:5px 13px;border-radius:999px;background:#ecfdf5;color:#0d9488;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;">New inquiry</span>
        <h1 style="font-size:19px;margin:14px 0 4px;color:#0f172a;font-weight:800;">${escapeHtml(inquiry.subject)}</h1>
        <p style="font-size:13.5px;color:#667085;margin:0;">from ${escapeHtml(inquiry.name)} &lt;${escapeHtml(inquiry.email)}&gt;${inquiry.phone ? ` &middot; ${escapeHtml(inquiry.phone)}` : ''}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px 32px;">
        <div style="background:#f8f9fb;border:1px solid #eef0f3;border-radius:12px;padding:16px 18px;font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${escapeHtml(inquiry.message)}</div>
        <p style="font-size:12px;color:#98a2b3;margin:16px 0 0;">Submitted via the ${escapeHtml(config.clinic.name)} website contact form. Full list in the staff dashboard's Inquiries page.</p>
      </td>
    </tr>
  </table>
</div>`;
  return { subject, text, html };
}

router.get('/', async (req, res) => {
  const status = req.query.status;
  const { rows } = status
    ? await pool.query('SELECT * FROM inquiries WHERE status = $1 ORDER BY created_at DESC', [status])
    : await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inquiries WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'inquiry not found' });
  res.json(rows[0]);
});

// Public — submitted from the patient-facing contact form, no auth.
router.post('/', async (req, res) => {
  // Honeypot: hidden field a real visitor never fills in. Reject quietly
  // rather than store spam or spend an outbound email on it.
  if (req.body.website) return res.status(400).json({ error: 'invalid submission' });

  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !subject || !message)
    return res.status(400).json({ error: 'name, email, subject and message are required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email address' });
  if (!SUBJECTS.includes(subject))
    return res.status(400).json({ error: `subject must be one of ${SUBJECTS.join(', ')}` });

  const { rows } = await pool.query(
    `INSERT INTO inquiries (name, email, phone, subject, message) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, email, phone || null, subject, message]
  );
  const inquiry = rows[0];

  // Fire-and-forget — the inquiry is already durably saved above, so a
  // failed/unconfigured notification email never fails the submission
  // itself (same posture as booking confirmation emails elsewhere).
  sendMail(config.clinic.notifyEmail, inquiryNoticeTemplate(inquiry)).catch(() => {});

  res.status(201).json(inquiry);
});

// Admin-visible status toggle (new -> read). No auth layer exists yet —
// same TODO posture as clinic-profile's PUT route.
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of ${STATUSES.join(', ')}` });
  const { rows } = await pool.query('UPDATE inquiries SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'inquiry not found' });
  res.json(rows[0]);
});

export default router;
