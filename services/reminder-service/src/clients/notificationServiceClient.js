import { config } from '../config.js';

export async function sendMail(to, { subject, text, html }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text, html }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: data.detail || `notification-service responded ${res.status}` };
    return data;
  } catch (err) {
    return { ok: false, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendSms(to, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${config.notificationServiceUrl}/internal/send-sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, body }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: data.detail || `notification-service responded ${res.status}` };
    return data;
  } catch (err) {
    return { ok: false, detail: err.message };
  } finally {
    clearTimeout(timeout);
  }
}
