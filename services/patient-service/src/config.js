import 'dotenv/config';

// Render's `fromService: {property: hostport}` env vars resolve to bare
// "host:port" (no scheme) — fetch() needs an absolute URL, so prepend
// http:// when it's missing. Local .env values are already full
// http://localhost:... URLs, so this is a no-op there.
const withScheme = (url) => (url && !/^https?:\/\//.test(url) ? `http://${url}` : url);

export const config = {
  port: Number(process.env.PORT) || 4001,
  databaseUrl: process.env.DATABASE_URL,
  appointmentServiceUrl: withScheme(process.env.APPOINTMENT_SERVICE_URL) || 'http://localhost:4003',
  dentistServiceUrl: withScheme(process.env.DENTIST_SERVICE_URL) || 'http://localhost:4002',
  redisUrl: process.env.REDIS_URL || '',
};
