import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models.js';
import { signToken, requireAuth, requireRole } from '../auth.js';

const router = Router();

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

// CSRF validation middleware for state-changing requests
// Validates that the X-XSRF-TOKEN header matches the XSRF-TOKEN cookie value
function csrfTokenValidator(req, res, next) {
  const headerToken = req.headers['x-xsrf-token'];
  const cookieToken = req.cookies?.['XSRF-TOKEN'];

  if (!headerToken || !cookieToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  next();
}

// Generate a random CSRF token
export function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/register', async (req, res) => {
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

    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
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
    // Set JWT as HttpOnly cookie
    res.cookie('hh_token', token, COOKIE_OPTIONS);
    // Set CSRF token cookie (non-HttpOnly so JavaScript can read it for double-submit pattern)
    const csrfToken = generateCSRFToken();
    res.cookie('XSRF-TOKEN', csrfToken, CSRF_COOKIE_OPTIONS);
    // Also return token in JSON for backward compatibility
    res.json({ token, user: user.toPublic(), csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Keep existing /me endpoint - requireAuth will read from cookie or header
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toPublic() });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toPublic() });
});

router.post('/change-password', requireAuth, csrfTokenValidator, async (req, res) => {
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

router.post('/forgot', async (req, res) => {
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

router.post('/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

router.put('/settings', requireAuth, csrfTokenValidator, requireRole('admin'), async (req, res) => {
  try {
    const { currentPassword, newEmail, newPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify current password
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    // Change email if provided
    if (newEmail) {
      const emailLower = newEmail.toLowerCase();
      const existing = await User.findOne({ email: emailLower });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      user.email = emailLower;
    }

    // Change password if provided
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      user.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({ ok: true, user: user.toPublic() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update account settings' });
  }
});

export default router;
