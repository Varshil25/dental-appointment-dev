import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  services: {
    patient: process.env.PATIENT_SERVICE_URL || 'http://localhost:4001',
    dentist: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
    appointment: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:4003',
    reminder: process.env.REMINDER_SERVICE_URL || 'http://localhost:4004',
    report: process.env.REPORT_SERVICE_URL || 'http://localhost:4006',
  },
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
  },
};
