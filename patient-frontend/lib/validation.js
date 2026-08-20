export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Same "explicit country code" convention as patient-service (E.164-ish) —
// keeps a booking's phone acceptable to the backend's own validation
// instead of failing only after submit.
export const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export const normalizePhone = (raw) => String(raw || '').trim().replace(/[\s().-]/g, '');

export const isValidEmail = (v) => EMAIL_RE.test(String(v || '').trim());
export const isValidPhone = (v) => !v || PHONE_RE.test(normalizePhone(v));
export const isRequiredPhone = (v) => PHONE_RE.test(normalizePhone(v));
