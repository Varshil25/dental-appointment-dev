import twilio from 'twilio';
import { config } from './config.js';

let client = null;
let warned = false;

function getClient() {
  const { accountSid, authToken, fromNumber } = config.twilio;
  if (!accountSid || !authToken || !fromNumber) {
    if (!warned) {
      console.log('[sms] TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER not fully configured — SMS sending is disabled.');
      warned = true;
    }
    return null;
  }
  // Auth via the main Auth Token rather than an API Key SID/Secret pair —
  // Twilio API Keys require a paid account (Trial accounts get
  // "This feature is not available on a Trial account" / error 20003 for
  // *any* API key, even a correctly-copied one), confirmed against this
  // project's own Trial account. Revisit if/when the account is upgraded.
  if (!client) client = twilio(accountSid, authToken);
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
