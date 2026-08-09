import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4006,
  patientServiceUrl: process.env.PATIENT_SERVICE_URL || 'http://localhost:4001',
  dentistServiceUrl: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
  appointmentServiceUrl: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:4003',
  reminderServiceUrl: process.env.REMINDER_SERVICE_URL || 'http://localhost:4004',
  redisUrl: process.env.REDIS_URL || '',
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
    phone: process.env.CLINIC_PHONE || '(555) 012-3456',
    address: process.env.CLINIC_ADDRESS || '12 Riverside Ave, Springfield',
  },
};
