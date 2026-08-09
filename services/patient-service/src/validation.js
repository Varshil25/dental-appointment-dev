// Format-only phone validation (E.164-ish): requires an explicit leading
// '+' and country code so the same local number from two different
// countries isn't silently accepted as identical/valid. This is NOT
// carrier verification, just a shape check. Spaces/parens/dashes are
// allowed for readability and stripped before validating/storing.
const PHONE_RE = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(raw) {
  return String(raw).trim().replace(/[\s().-]/g, '');
}

export function isValidPhone(raw) {
  return PHONE_RE.test(normalizePhone(raw));
}
