import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4001,
  databaseUrl: process.env.DATABASE_URL,
  appointmentServiceUrl: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:4003',
  dentistServiceUrl: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
  redisUrl: process.env.REDIS_URL || '',
};
