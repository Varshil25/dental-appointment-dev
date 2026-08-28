import nodemailer from 'nodemailer';
import { config } from './config.js';

// config.mailFrom is a combined "Name <email>" string (what Resend/
// nodemailer both accept directly) — SendGrid's API wants those as
// separate fields, so this splits it. Falls back to treating the whole
// string as the email if it isn't in "Name <email>" form.
function parseMailFrom(mailFrom) {
  const m = /^(.*)<(.+)>\s*$/.exec(mailFrom.trim());
  if (!m) return { email: mailFrom.trim() };
  return { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() };
}

// Preferred provider (see config.js's sendgridApiKey comment for why):
// SendGrid's free tier lets one verified sender email — verified once via
// Settings > Sender Authentication > Single Sender Verification, no domain
// needed — send to any recipient, unlike Resend's sandbox mode below.
async function sendViaSendGrid(to, { subject, text, html }) {
  const from = parseMailFrom(config.mailFrom);
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content: [
        ...(text ? [{ type: 'text/plain', value: text }] : []),
        ...(html ? [{ type: 'text/html', value: html }] : []),
      ],
    }),
  });
  // SendGrid returns 202 with an empty body on success — no message id in
  // the JSON to read, only the X-Message-Id response header.
  if (res.status === 202) return { ok: true, detail: res.headers.get('x-message-id') || 'sent' };
  const data = await res.json().catch(() => ({}));
  const message = data.errors?.map((e) => e.message).join('; ') || `SendGrid responded ${res.status}`;
  throw new Error(message);
}

// Resend's sandbox mode (no verified sending domain) hard-rejects any
// recipient except the account owner's own address — every OTHER staff
// login (any account whose email isn't that one address) would otherwise
// be unable to receive a login code at all until a real domain is
// verified at resend.com/domains. That's a one-time manual step outside
// this codebase (DNS records at a domain we don't have here), so until
// it's done, sendMail() below falls back to logging the full message
// (OTP/reset link included) to this service's own console — retrievable
// from Render's Logs tab — instead of hard-failing the request. Matched
// narrowly on Resend's actual wording so a real delivery failure (bad API
// key, Resend outage, etc.) still surfaces as a failure rather than being
// silently swallowed by this fallback.
const SANDBOX_RESTRICTION_RE = /own email address/i;

async function sendViaResend(to, { subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: config.mailFrom, to, subject, text, html }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (SANDBOX_RESTRICTION_RE.test(data.message || '')) {
      console.log(
        `\n[mailer] Resend sandbox blocked delivery to ${to} (no verified domain yet) — logging content instead:\n` +
          `[mailer] Subject: ${subject}\n[mailer] ${text}\n`
      );
      return { ok: true, detail: 'logged-fallback: recipient blocked by Resend sandbox, see server logs' };
    }
    throw new Error(data.message || `Resend responded ${res.status}`);
  }
  return { ok: true, detail: data.id };
}

let transporterPromise = null;

// Lazily create (and cache) an SMTP transporter.
// - If SMTP creds are configured in .env, use them (real delivery).
// - Otherwise fall back to an Ethereal test account so the service still
//   works out-of-the-box; emails are captured and a preview URL is logged.
// NOTE: both paths use SMTP, which Render's free tier blocks outbound
// entirely (see config.js) — these only work locally or off Render's free
// plan. RESEND_API_KEY (checked first in sendMail below) is the one that
// actually works on Render's free tier.
async function getTransporter() {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (config.smtp.host && config.smtp.user) {
      return {
        transport: nodemailer.createTransport({
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          auth: { user: config.smtp.user, pass: config.smtp.pass },
        }),
        isTest: false,
      };
    }
    // No real SMTP configured — spin up an Ethereal sandbox account.
    const testAccount = await nodemailer.createTestAccount();
    console.log(
      `\n[mailer] No SMTP configured — using Ethereal test inbox (${testAccount.user}).\n` +
        `[mailer] Emails will NOT reach real recipients; a preview URL is logged for each.\n`
    );
    return {
      transport: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      }),
      isTest: true,
    };
  })();

  return transporterPromise;
}

// Send an email. Returns { ok, detail } where detail is a SendGrid/Resend
// message id, an Ethereal preview URL (test mode), an SMTP message id
// (real mode), or an error string.
export async function sendMail(to, { subject, text, html }) {
  // Tried first, on its own from the rest of the chain below: a failure
  // here (SendGrid down, sender not verified yet, quota hit) shouldn't be
  // fatal when Resend or SMTP might still get the message through — see
  // config.js for why SendGrid is preferred when available.
  if (config.sendgridApiKey) {
    try {
      return await sendViaSendGrid(to, { subject, text, html });
    } catch (err) {
      console.error('[mailer] SendGrid send failed, falling back:', err.message);
    }
  }

  try {
    if (config.resendApiKey) return await sendViaResend(to, { subject, text, html });

    const { transport, isTest } = await getTransporter();
    const info = await transport.sendMail({
      from: config.mailFrom,
      to,
      subject,
      text,
      html,
    });
    const preview = isTest ? nodemailer.getTestMessageUrl(info) : null;
    if (preview) console.log(`[mailer] Preview: ${preview}`);
    return { ok: true, detail: preview || info.messageId };
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return { ok: false, detail: err.message };
  }
}
