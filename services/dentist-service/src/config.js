import 'dotenv/config';

// Render's `fromService: {property: hostport}` env vars resolve to bare
// "host:port" (no scheme) — fetch() needs an absolute URL, so prepend
// http:// when it's missing. Local .env values are already full
// http://localhost:... URLs, so this is a no-op there.
const withScheme = (url) => (url && !/^https?:\/\//.test(url) ? `http://${url}` : url);

export const config = {
  port: Number(process.env.PORT) || 4002,
  databaseUrl: process.env.DATABASE_URL,
  appointmentServiceUrl: withScheme(process.env.APPOINTMENT_SERVICE_URL) || 'http://localhost:4003',
  notificationServiceUrl: withScheme(process.env.NOTIFICATION_SERVICE_URL) || 'http://localhost:4005',
  redisUrl: process.env.REDIS_URL || '',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '(555) 012-3456',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
    // Inbox that receives the "new website inquiry" staff notification —
    // separate from MAIL_FROM (the outgoing send-as address on
    // notification-service), since a clinic often wants patient-facing
    // mail sent from a no-reply address but staff notices to land in a
    // real front-desk inbox.
    notifyEmail: process.env.CLINIC_NOTIFY_EMAIL || 'front-desk@example.com',
  },
};
