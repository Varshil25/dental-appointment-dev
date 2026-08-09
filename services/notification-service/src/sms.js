import twilio from 'twilio';
import { config } from './config.js';

let client = null;
let warned = false;

function getClient() {
  if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.fromNumber) {
    if (!warned) {
      console.log('[sms] TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER not fully configured — SMS sending is disabled.');
      warned = true;
    }
    return null;
  }
  if (!client) client = twilio(config.twilio.accountSid, config.twilio.authToken);
  return client;
}

// Send an SMS. Returns { ok, detail } where detail is the Twilio message sid
// (real mode) or an error string — same shape as mailer.js's sendMail, so
// callers can treat email/SMS results identically.
export async function sendSms(to, body) {
  const c = getClient();
  if (!c) return { ok: false, detail: 'SMS not configured' };
  try {
    const msg = await c.messages.create({ to, from: config.twilio.fromNumber, body });
    return { ok: true, detail: msg.sid };
  } catch (err) {
    console.error('[sms] send failed:', err.message);
    return { ok: false, detail: err.message };
  }
}
