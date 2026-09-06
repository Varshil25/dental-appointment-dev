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
  // bounded time. Render's own free-tier cold start can take up to ~50s
  // (see render.yaml's comments) — 30s was cutting it close enough to
  // actually 502 a login attempt that raced a cold notification-service;
  // 45s leaves margin under gateway's own 55s proxyTimeout for this route.
  const timeout = setTimeout(() => controller.abort(), 45_000);
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
