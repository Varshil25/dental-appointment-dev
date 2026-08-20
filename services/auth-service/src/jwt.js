import jwt from 'jsonwebtoken';
import { config } from './config.js';

// Payload carries exactly what the gateway needs to authorize a request
// without a database round-trip: role and dentist_id (for doctor scoping).
// `tv` (token_version) is carried too but only re-checked by GET /me — see
// db.js's comment on users.token_version for why.
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, dentist_id: user.dentist_id, name: user.name, tv: user.token_version },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
