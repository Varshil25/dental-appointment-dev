import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4003,
  databaseUrl: process.env.DATABASE_URL,
  patientServiceUrl: process.env.PATIENT_SERVICE_URL || 'http://localhost:4001',
  dentistServiceUrl: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
  reminderServiceUrl: process.env.REMINDER_SERVICE_URL || 'http://localhost:4004',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005',
  redisUrl: process.env.REDIS_URL || '',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '+61 470375410',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
  },
  seedToken: process.env.SEED_TOKEN || 'dev-seed-token',
};
