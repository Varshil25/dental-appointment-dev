import { config } from '../config.js';

// Best-effort — a failed staff-notification email shouldn't fail the
// inquiry submission itself; the inquiry is already saved and visible in
// the admin dashboard either way. Same posture as appointment-service's
// client of the same name.
export async function sendMail(to, { subject, text, html }) {
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html }),
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (err) {
    console.error('[dentist-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  }
}
