import { config } from '../config.js';

// Best-effort — a failed confirmation/cancellation email shouldn't fail
// the booking/cancellation itself, same posture as the original monolith.
export async function sendMail(to, { subject, text, html }) {
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html }),
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (err) {
    console.error('[appointment-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  }
}

// Same best-effort posture as sendMail — a failed/unconfigured SMS never
// blocks the booking/cancellation itself.
export async function sendSms(to, body) {
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body }),
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (err) {
    console.error('[appointment-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  }
}
