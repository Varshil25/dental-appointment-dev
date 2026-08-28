import { config } from '../config.js';

// Reuses notification-service's existing Nodemailer/SMTP setup rather than
// building a separate mailer — same client shape as dentist-service's and
// appointment-service's notificationServiceClient.js.
export async function sendMail(to, { subject, text, html }) {
  const controller = new AbortController();
  // No timeout here previously meant a cold/slow notification-service (or a
  // one-off network blip between it and this service, both free-tier and
  // both prone to spinning down from idle) could leave a login request
  // hanging indefinitely instead of failing — or succeeding — within a
  // bounded time. 30s matches the other inter-service clients in this repo.
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html }),
      signal: controller.signal,
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (err) {
    console.error('[auth-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}
