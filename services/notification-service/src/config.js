import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4005,
  // Resend's HTTP API — preferred over SMTP when set. Render (and many
  // other PaaS free tiers) block outbound traffic to SMTP ports 25/465/587
  // entirely (https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports),
  // so SMTP_* below silently times out there even with correct credentials
  // — this goes over plain HTTPS instead, which isn't blocked. Get a free
  // key at resend.com (3,000 emails/month, no card required).
  resendApiKey: process.env.RESEND_API_KEY || '',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  mailFrom: process.env.MAIL_FROM || 'Dental Clinic <no-reply@example.com>',
  // Auth via the main Auth Token — see sms.js's getClient() for why (API
  // Keys require a paid Twilio account; this project runs on a Trial one).
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
  },
};
