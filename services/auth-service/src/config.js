import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4007,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  dentistServiceUrl: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000/v1/admin',
  // Guards POST /internal/seed-user — same shared-token pattern as
  // appointment-service's POST /internal/appointments/seed.
  seedToken: process.env.SEED_TOKEN || 'dev-seed-token',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '+61 470375410',
    address: process.env.CLINIC_ADDRESS || '19 amethyst st, salisbury east sa 5109',
  },
  otp: {
    ttlMinutes: 10,
    maxAttempts: 5,
    resendCooldownSeconds: 45,
  },
  passwordReset: {
    ttlMinutes: 30,
  },
};
