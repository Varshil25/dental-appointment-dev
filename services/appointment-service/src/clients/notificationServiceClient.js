import { config } from '../config.js';

// Best-effort — a failed confirmation/cancellation email shouldn't fail
// the booking/cancellation itself, same posture as the original monolith.
// No timeout previously meant a cold/slow notification-service could leave
// the booking request hanging well past what "best-effort" should cost;
// 30s matches the other inter-service clients in this repo.
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
    console.error('[appointment-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

// Same best-effort posture and timeout reasoning as sendMail above.
export async function sendSms(to, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body }),
      signal: controller.signal,
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (err) {
    console.error('[appointment-service] notification-service unreachable:', err.message);
    return { ok: false, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}
