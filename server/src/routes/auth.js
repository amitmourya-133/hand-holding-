import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { User } from '../models.js';
import { signToken, requireAuth } from '../auth.js';
import { createRouter } from '../asyncRouter.js';
import { csrfProtection, validatePassword } from '../middleware.js';

const router = createRouter();

const COLORS = ['#4f6df5', '#e8595c', '#18a999', '#f0932b', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];

// Cookie configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days - matches JWT expiration
  path: '/',
};

// CSRF token configuration - separate non-HttpOnly cookie for double-submit pattern
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false, // MUST be false so JavaScript can read it
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days - matches JWT expiration
  path: '/',
};

// Rate limiters applied as middleware on specific routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please wait a few minutes and try again.' },
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Please wait a few minutes and try again.' },
});

// Generate a random CSRF token
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Set the HttpOnly session cookie and the readable CSRF double-submit cookie.
// Returns the CSRF token so clients can also keep it in memory.
function setSessionCookies(res, token) {
  res.cookie('hh_token', token, COOKIE_OPTIONS);
  const csrfToken = generateCSRFToken();
  res.cookie('XSRF-TOKEN', csrfToken, CSRF_COOKIE_OPTIONS);
  return csrfToken;
}

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password, role = 'mentee', mentorType = '', department = '', batch = '', company = '', designation = '', skills = [], bio = '' } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    if (!['mentee', 'mentor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (role === 'mentor' && !['faculty', 'alumni', 'industry'].includes(mentorType)) {
      return res.status(400).json({ error: 'Mentors must choose a type: faculty, alumni or industry' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role,
      mentorType: role === 'mentor' ? mentorType : '',
      department,
      batch,
      company,
      designation,
      skills: Array.isArray(skills) ? skills : [],
      bio,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });

    const token = signToken(user);
    const csrfToken = setSessionCookies(res, token);
    res.status(201).json({ token, user: user.toPublic(), csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    user.lastActiveAt = new Date();
    await user.save();

    const token = signToken(user);
    // Set the HttpOnly JWT cookie and the readable CSRF double-submit cookie,
    // and return the token in JSON for the Authorization-header fallback.
    const csrfToken = setSessionCookies(res, token);
    res.json({ token, user: user.toPublic(), csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// requireAuth reads the session from the HttpOnly cookie or Bearer header.
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toPublic() });
});

// Clear both session cookies so logout invalidates the browser session.
router.post('/logout', (req, res) => {
  const base = {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };
  res.clearCookie('hh_token', { ...base, httpOnly: true });
  res.clearCookie('XSRF-TOKEN', { ...base, httpOnly: false });
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, csrfProtection, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ error: 'New password must contain at least one letter and one number' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not change password' });
  }
});

router.post('/forgot', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = token;
      user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
      await user.save();
    }
    // always respond success to avoid confirming existence
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process forgot request' });
  }
});

router.post('/reset', passwordResetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    if (!validatePassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and contain at least one letter and one number',
      });
    }
    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

export default router;
