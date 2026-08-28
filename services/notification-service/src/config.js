import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4005,
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
