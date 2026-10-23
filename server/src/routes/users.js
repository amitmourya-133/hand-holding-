import { Router } from 'express';
import { User, Connection, Question, Answer } from '../models.js';
import { requireAuth, requireRole } from '../auth.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/mentors', async (req, res) => {
const { q = '', type = '', skills = '' } = req.query;
  const filter = { role: 'mentor' };
  const searchFilters = [];
  if (q) {
    searchFilters.push(
      { name: { $regex: q, $options: 'i' } },
      { department: { $regex: q, $options: 'i' } },
      { company: { $regex: q, $options: 'i' } },
      { skills: { $regex: q, $options: 'i' } }
    );
  }
  if (skills && !q) {
    searchFilters.push({ skills: { $regex: skills, $options: 'i' } });
  }
  if (searchFilters.length) filter.$or = searchFilters;
  if (type) filter.mentorType = type;

  const mentors = await User.find(filter).sort({ ratingAvg: -1, name: 1 }).limit(60);

  const connections = await Connection.find({
    $or: [{ mentee: req.userId }, { mentor: req.userId }],
  });

  const statusFor = (id) => {
    const c = connections.find(
      (x) => String(x.mentor) === String(id) && String(x.mentee) === String(req.userId)
    );
    return c ? c.status : 'none';
  };

  res.json({
    mentors: mentors.map((m) => ({
      ...m.toPublic(),
      connectionStatus: String(m._id) === String(req.userId) ? 'self' : statusFor(m._id),
    })),
  });
});

router.get('/mentees', async (req, res) => {
  let menteeIds = [];
  if (req.userRole === 'mentor') {
    const links = await Connection.find({ mentor: req.userId, status: 'accepted' });
    menteeIds = links.map((l) => l.mentee);
  } else if (req.userRole === 'admin') {
    const all = await User.find({ role: 'mentee' }).select('_id');
    menteeIds = all.map((u) => u._id);
  } else {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const mentees = await User.find({ _id: { $in: menteeIds } }).sort({ name: 1 });
  res.json({ mentees: mentees.map((m) => m.toPublic()) });
});

router.get('/connections', async (req, res) => {
  const { status } = req.query;
  const filter = {
    $or: [{ mentee: req.userId }, { mentor: req.userId }],
  };
  if (status) filter.status = status;

  const connections = await Connection.find(filter)
    .populate('mentee', 'name email role color department batch company designation skills bio mentorType')
    .populate('mentor', 'name email role color department batch company designation skills bio mentorType ratingAvg ratingCount')
    .sort({ updatedAt: -1 });

  res.json({ connections });
});

router.post('/connections', async (req, res) => {
  try {
    if (req.userRole !== 'mentee') return res.status(403).json({ error: 'Only mentees can request a mentor' });
    const { mentorId, note = '' } = req.body;
    if (!mentorId) return res.status(400).json({ error: 'Mentor is required' });

    const mentor = await User.findOne({ _id: mentorId, role: 'mentor' });
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });

    const existing = await Connection.findOne({ mentee: req.userId, mentor: mentorId });
    if (existing && existing.status === 'accepted') {
      return res.status(409).json({ error: 'You are already connected with this mentor' });
    }
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ error: 'A request is already pending with this mentor' });
    }

    const connection = existing
      ? Object.assign(existing, { status: 'pending', note })
      : new Connection({ mentee: req.userId, mentor: mentorId, note });
    await connection.save();

    const mentee = await User.findById(req.userId);
    await notify(mentorId, {
      type: 'connection',
      title: 'New mentorship request',
      body: `${mentee.name} has requested you as a mentor.`,
      link: '/connections',
    });

    res.status(201).json({ connection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send request' });
  }
});

router.post('/connections/:id/respond', async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    const connection = await Connection.findById(req.params.id);
    if (!connection) return res.status(404).json({ error: 'Request not found' });
    if (String(connection.mentor) !== String(req.userId)) {
      return res.status(403).json({ error: 'Only the mentor can respond to this request' });
    }
    if (connection.status !== 'pending') return res.status(409).json({ error: 'This request was already handled' });

    connection.status = action === 'accept' ? 'accepted' : 'declined';
    await connection.save();

    const mentor = await User.findById(connection.mentor);
    await notify(connection.mentee, {
      type: 'connection',
      title: action === 'accept' ? 'Mentorship request accepted' : 'Mentorship request declined',
      body:
        action === 'accept'
          ? `${mentor.name} is now your mentor. You can start a conversation.`
          : `${mentor.name} declined your mentorship request.`,
      link: '/connections',
    });

    res.json({ connection });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not respond to request' });
  }
});

router.delete('/connections/:id', async (req, res) => {
  const connection = await Connection.findById(req.params.id);
  if (!connection) return res.status(404).json({ error: 'Request not found' });
  const isMentee = String(connection.mentee) === String(req.userId);
  const isMentor = String(connection.mentor) === String(req.userId);
  if (!isMentee && !isMentor) return res.status(403).json({ error: 'Not allowed' });
  if (isMentor && connection.status !== 'accepted') {
    return res.status(403).json({ error: 'Mentors can only remove accepted connections' });
  }
  await connection.deleteOne();
  res.json({ ok: true });
});

router.post('/questions', requireAuth, async (req, res) => {
  try {
    const { title, description, subject } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const question = await Question.create({
      student: req.userId,
      title,
      description: description || '',
      subject: subject || '',
      status: 'open',
    });
    res.json({ ok: true, question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create question' });
  }
});

router.get('/questions', requireAuth, async (req, res) => {
  try {
    const questions = await Question.find({ status: 'open' })
      .populate('student', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch questions' });
  }
});

router.get('/questions/mentor', requireAuth, async (req, res) => {
  try {
    const questions = await Question.find({ status: 'open' })
      .populate('student', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch questions' });
  }
});

router.get('/questions/:id', requireAuth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('student', 'name email role')
      .populate('acceptedAnswer');
    if (!question) return res.status(404).json({ error: 'Question not found' });
    res.json({ question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch question' });
  }
});

router.post('/answers', requireAuth, async (req, res) => {
  try {
    const { questionId, text } = req.body;
    if (!questionId || !text) return res.status(400).json({ error: 'questionId and text are required' });
    
    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    
    const answer = await Answer.create({
      question: questionId,
      mentor: req.userId,
      text,
    });
    
    question.status = 'answered';
    await question.save();
    
    res.status(201).json({ ok: true, answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit answer' });
  }
});

router.post('/answers/:id/accept', requireAuth, async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ error: 'Question not found' });
    if (String(question.student) !== String(req.userId)) {
      return res.status(403).json({ error: 'Only the question owner can accept an answer' });
    }
    
    question.status = 'solved';
    question.acceptedAnswer = req.params.id;
    await question.save();
    
    res.json({ ok: true, question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not accept answer' });
  }
});

router.put('/profile', async (req, res) => {
  const allowed = ['name', 'department', 'batch', 'company', 'designation', 'bio', 'skills', 'availability'];
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  for (const key of allowed) {
    if (key in req.body) user[key] = req.body[key];
  }
  if (user.role === 'mentor' && 'mentorType' in req.body && ['faculty', 'alumni', 'industry'].includes(req.body.mentorType)) {
    user.mentorType = req.body.mentorType;
  }
  await user.save();
  res.json({ user: user.toPublic() });
});

router.get('/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toPublic() });
});

router.post('/admin/create', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { fullName, email, password, role, bio, skills, availability } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Full name, email, password and role are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    }
    if (!['mentor', 'mentee'].includes(role)) {
      return res.status(400).json({ error: 'Role must be mentor or mentee' });
    }
    const emailLower = email.toLowerCase();
    const existing = await User.findOne({ email: emailLower });
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const user = await User.create({
      name: fullName,
      email: emailLower,
      passwordHash,
      role,
      mentorType: role === 'mentor' ? '' : '',
      department: '',
      batch: '',
      designation: '',
      skills: role === 'mentor' ? (skills || []) : [],
      bio: bio || '',
      color: '#4f6df5',
      availability: role === 'mentor' ? (availability || 'available') : 'available',
    });
    await user.save();
    res.json({ ok: true, user: user.toPublic() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create user' });
  }
});

router.put('/settings', requireAuth, requireRole('admin'), async (req, res) => {
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
