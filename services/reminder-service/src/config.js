import 'dotenv/config';

const parseOffsets = (raw) =>
  (raw || '48,2')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a);

// Render's `fromService: {property: hostport}` env vars resolve to bare
// "host:port" (no scheme) — fetch() needs an absolute URL, so prepend
// http:// when it's missing. Local .env values are already full
// http://localhost:... URLs, so this is a no-op there.
const withScheme = (url) => (url && !/^https?:\/\//.test(url) ? `http://${url}` : url);

export const config = {
  port: Number(process.env.PORT) || 4004,
  databaseUrl: process.env.DATABASE_URL,
  notificationServiceUrl: withScheme(process.env.NOTIFICATION_SERVICE_URL) || 'http://localhost:4005',
  redisUrl: process.env.REDIS_URL || '',
  reminderOffsetsHours: parseOffsets(process.env.REMINDER_OFFSETS_HOURS),
  reminderCron: process.env.REMINDER_CRON || '* * * * *',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '(555) 012-3456',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
  },
};
