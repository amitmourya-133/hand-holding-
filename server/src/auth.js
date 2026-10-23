import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const DEV_SECRET = 'hand-holding-dev-secret';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a value of at least 32 characters in production');
}

export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;

export function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req, res, next) {
  // Check JWT from HttpOnly cookie first
  let token = req.cookies?.hh_token;
  // Fall back to Bearer header for backward compatibility
  if (!token) {
    const header = req.headers.authorization || '';
    token = header.startsWith('Bearer ') ? header.slice(7) : null;
  }
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
}
