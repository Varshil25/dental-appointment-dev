import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4002,
  databaseUrl: process.env.DATABASE_URL,
  appointmentServiceUrl: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:4003',
  redisUrl: process.env.REDIS_URL || '',
};
