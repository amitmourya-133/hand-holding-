import crypto from 'crypto';

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Input is stored as-is and trimmed. Output is escaped by React/Mongoose, so
// replacing characters here only corrupted legitimate values (for example an
// apostrophe in a name) and could silently change passwords.
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim();
};

export const validatePassword = (password) => {
  // Minimum 8 characters, at least 1 letter and 1 number. Special characters
  // are allowed so existing password styles keep working.
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
};

export const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isValidObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ''));

// Double-submit CSRF protection for cookie-authenticated requests.
// Bearer-authenticated requests are not CSRF-susceptible because a cross-site
// form cannot add an Authorization header. Requests with no session cookie are
// left for requireAuth to reject with 401.
export function csrfProtection(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const authorization = req.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) return next();

  if (!req.cookies?.hh_token) return next();

  const headerToken = req.headers['x-xsrf-token'];
  const cookieToken = req.cookies?.['XSRF-TOKEN'];

  if (!headerToken || !cookieToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  const a = Buffer.from(String(headerToken));
  const b = Buffer.from(String(cookieToken));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
}
