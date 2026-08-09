import 'dotenv/config';

const parseOffsets = (raw) =>
  (raw || '48,2')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => b - a);

export const config = {
  port: Number(process.env.PORT) || 4004,
  databaseUrl: process.env.DATABASE_URL,
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005',
  redisUrl: process.env.REDIS_URL || '',
  reminderOffsetsHours: parseOffsets(process.env.REMINDER_OFFSETS_HOURS),
  reminderCron: process.env.REMINDER_CRON || '* * * * *',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '(555) 012-3456',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
  },
};
