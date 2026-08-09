import { Router } from 'express';
import { sendMail } from '../mailer.js';
import { sendSms } from '../sms.js';

const router = Router();

// Internal-only: render/queueing is the caller's job, this just delivers.
router.post('/send', async (req, res) => {
  const { to, subject, text, html } = req.body;
  if (!to || !subject || (!text && !html))
    return res.status(400).json({ error: 'to, subject and text/html are required' });
  const result = await sendMail(to, { subject, text, html });
  res.status(result.ok ? 200 : 502).json(result);
});

// Internal-only: SMS delivery via Twilio. Fails soft with { ok: false } if
// Twilio isn't configured — callers already treat this the same as a failed
// email send (best-effort, never blocks the booking/reminder itself).
router.post('/send-sms', async (req, res) => {
  const { to, body } = req.body;
  if (!to || !body) return res.status(400).json({ error: 'to and body are required' });
  const result = await sendSms(to, body);
  res.status(result.ok ? 200 : 502).json(result);
});

export default router;
