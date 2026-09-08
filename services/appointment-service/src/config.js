import 'dotenv/config';

// Render's `fromService: {property: hostport}` env vars resolve to bare
// "host:port" (no scheme) — fetch() needs an absolute URL, so prepend
// http:// when it's missing. Local .env values are already full
// http://localhost:... URLs, so this is a no-op there.
const withScheme = (url) => (url && !/^https?:\/\//.test(url) ? `http://${url}` : url);

export const config = {
  port: Number(process.env.PORT) || 4003,
  databaseUrl: process.env.DATABASE_URL,
  patientServiceUrl: withScheme(process.env.PATIENT_SERVICE_URL) || 'http://localhost:4001',
  dentistServiceUrl: withScheme(process.env.DENTIST_SERVICE_URL) || 'http://localhost:4002',
  reminderServiceUrl: withScheme(process.env.REMINDER_SERVICE_URL) || 'http://localhost:4004',
  notificationServiceUrl: withScheme(process.env.NOTIFICATION_SERVICE_URL) || 'http://localhost:4005',
  // Public patient-facing site — the review-request email/SMS links to
  // <PATIENT_FRONTEND_URL>/review?appointment=<id>. Matches auth-service's
  // FRONTEND_URL (same idea, different audience: that one links to the
  // staff dashboard for password resets, this one to the public site).
  patientFrontendUrl: process.env.PATIENT_FRONTEND_URL || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL || '',
  // Auto-complete cron (see autoComplete.js): how often it checks for
  // still-'booked' appointments past their end_time, and how many minutes
  // of grace it gives an admin to mark one 'no_show' themselves first.
  autoCompleteCron: process.env.AUTO_COMPLETE_CRON || '*/2 * * * *',
  autoCompleteGraceMinutes: Number(process.env.AUTO_COMPLETE_GRACE_MINUTES) || 5,
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '+61 470375410',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
  },
  seedToken: process.env.SEED_TOKEN || 'dev-seed-token',
};
