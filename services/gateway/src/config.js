import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 4000,
  services: {
    patient: process.env.PATIENT_SERVICE_URL || 'http://localhost:4001',
    dentist: process.env.DENTIST_SERVICE_URL || 'http://localhost:4002',
    appointment: process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:4003',
    reminder: process.env.REMINDER_SERVICE_URL || 'http://localhost:4004',
    report: process.env.REPORT_SERVICE_URL || 'http://localhost:4006',
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4007',
  },
  clinic: {
    name: process.env.CLINIC_NAME || 'Bright Smile Dental',
  },
  // Verifies JWTs issued by auth-service directly (see src/auth.js for why
  // this is stateless rather than a per-request call to auth-service).
  // MUST be the exact same value as auth-service's JWT_SECRET.
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  // Server-side only — never sent to the frontend. POST /api/chat is the
  // only thing that reads this; the browser never talks to the Gemini API
  // directly. Left undefined (not defaulted) so chat.js can 503 cleanly
  // when it's unset instead of the SDK throwing on a bad key.
  geminiApiKey: process.env.GEMINI_API_KEY,
};
