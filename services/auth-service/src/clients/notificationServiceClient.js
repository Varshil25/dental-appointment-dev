import { config } from '../config.js';

// Reuses notification-service's existing Nodemailer/SMTP setup rather than
// building a separate mailer — same client shape as dentist-service's and
// appointment-service's notificationServiceClient.js.
export async function sendMail(to, { subject, text, html }) {
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html }),
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (err) {
    console.error('[auth-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  }
}
