import 'dotenv/config';

// Render's `fromService: {property: hostport}` env vars resolve to bare
// "host:port" (no scheme) — fetch() needs an absolute URL, so prepend
// http:// when it's missing. Local .env values are already full
// http://localhost:... URLs, so this is a no-op there.
const withScheme = (url) => (url && !/^https?:\/\//.test(url) ? `http://${url}` : url);

export const config = {
  port: Number(process.env.PORT) || 4006,
  patientServiceUrl: withScheme(process.env.PATIENT_SERVICE_URL) || 'http://localhost:4001',
  dentistServiceUrl: withScheme(process.env.DENTIST_SERVICE_URL) || 'http://localhost:4002',
  appointmentServiceUrl: withScheme(process.env.APPOINTMENT_SERVICE_URL) || 'http://localhost:4003',
  reminderServiceUrl: withScheme(process.env.REMINDER_SERVICE_URL) || 'http://localhost:4004',
  redisUrl: process.env.REDIS_URL || '',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '(555) 012-3456',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
  },
};
