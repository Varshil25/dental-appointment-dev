import { config } from '../config.js';

// Best-effort — a failed staff-notification email shouldn't fail the
// inquiry submission itself; the inquiry is already saved and visible in
// the admin dashboard either way. Same posture as appointment-service's
// client of the same name. No timeout previously meant a cold/slow
// notification-service could leave the request hanging indefinitely; 30s
// matches the other inter-service clients in this repo.
export async function sendMail(to, { subject, text, html }) {
  const controller = new AbortController();
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
    console.error('[dentist-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}
