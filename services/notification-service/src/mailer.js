import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporterPromise = null;

// Lazily create (and cache) an SMTP transporter.
// - If SMTP creds are configured in .env, use them (real delivery).
// - Otherwise fall back to an Ethereal test account so the service still
//   works out-of-the-box; emails are captured and a preview URL is logged.
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

// Send an email. Returns { ok, detail } where detail is a preview URL
// (test mode) or the SMTP message id (real mode), or an error string.
export async function sendMail(to, { subject, text, html }) {
  try {
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
