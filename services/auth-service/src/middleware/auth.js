import { verifyToken } from '../jwt.js';

// Verifies the Authorization header itself rather than trusting any header
// the gateway might have attached — this service must stay safe to call
// directly (e.g. in local dev, or if the gateway is ever bypassed), so
// "is this request authenticated" can never depend on which front door it
// came through.
export function requireAuth(req, res, next) {
  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing bearer token' });
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin access required' });
  next();
}
