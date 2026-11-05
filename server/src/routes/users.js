import bcrypt from 'bcryptjs';
import { User, Connection, Question, Answer, Conversation } from '../models.js';
import { requireAuth, requireRole } from '../auth.js';
import { notify } from '../helpers.js';
import { createRouter } from '../asyncRouter.js';
import {
  escapeRegex,
  isValidObjectId,
  validateEmail,
  validatePassword,
} from '../middleware.js';

const router = createRouter();
router.use(requireAuth);

const MENTOR_TYPES = ['faculty', 'alumni', 'industry'];
const AVAILABILITY = ['available', 'limited', 'unavailable'];

const cleanText = (value, max) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

router.get('/mentors', async (req, res) => {
  const q = cleanText(req.query.q, 100);
  const skills = cleanText(req.query.skills, 100);
  const type = MENTOR_TYPES.includes(req.query.type) ? req.query.type : '';

  const filter = { role: 'mentor' };
  const searchFilters = [];
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    searchFilters.push(
      { name: rx },
      { department: rx },
      { company: rx },
      { skills: rx }
    );
  } else if (skills) {
    searchFilters.push({ skills: new RegExp(escapeRegex(skills), 'i') });
  }
  if (searchFilters.length) filter.$or = searchFilters;
  if (type) filter.mentorType = type;

  const [mentors, connections] = await Promise.all([
    User.find(filter).sort({ ratingAvg: -1, name: 1 }).limit(60),
    Connection.find({
      $or: [{ mentee: req.userId }, { mentor: req.userId }],
    }),
  ]);

  const statusFor = (id) => {
    const c = connections.find(
      (x) => String(x.mentor) === String(id) && String(x.mentee) === String(req.userId)
    );
    return c ? c.status : 'none';
  };

  res.json({
    mentors: mentors.map((m) => {
      const publicUser = m.toPublic();
      // Do not expose email addresses in the public mentor directory.
      delete publicUser.email;
      return {
        ...publicUser,
        connectionStatus: String(m._id) === String(req.userId) ? 'self' : statusFor(m._id),
      };
    }),
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
  if (['pending', 'accepted', 'declined'].includes(status)) filter.status = status;

  const connections = await Connection.find(filter)
    .populate('mentee', 'name email role color department batch company designation skills bio mentorType')
    .populate('mentor', 'name email role color department batch company designation skills bio mentorType ratingAvg ratingCount')
    .sort({ updatedAt: -1 });

  res.json({ connections });
});

router.post('/connections', async (req, res) => {
  try {
    if (req.userRole !== 'mentee') {
      return res.status(403).json({ error: 'Only mentees can request a mentor' });
    }
    const { mentorId, note = '' } = req.body;
    if (!mentorId) return res.status(400).json({ error: 'Mentor is required' });
    if (!isValidObjectId(mentorId)) return res.status(400).json({ error: 'Invalid mentor id' });
    if (String(mentorId) === String(req.userId)) {
      return res.status(400).json({ error: 'You cannot request yourself as a mentor' });
    }

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
      ? Object.assign(existing, { status: 'pending', note: cleanText(note, 500) })
      : new Connection({ mentee: req.userId, mentor: mentorId, note: cleanText(note, 500) });
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
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A request already exists with this mentor' });
    }
    throw err;
  }
});

router.post('/connections/:id/respond', async (req, res) => {
  const { action } = req.body;
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const connection = await Connection.findById(req.params.id);
  if (!connection) return res.status(404).json({ error: 'Request not found' });
  if (String(connection.mentor) !== String(req.userId)) {
    return res.status(403).json({ error: 'Only the mentor can respond to this request' });
  }
  if (connection.status !== 'pending') {
    return res.status(409).json({ error: 'This request was already handled' });
  }

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

router.post('/questions', async (req, res) => {
  if (req.userRole !== 'mentee') {
    return res.status(403).json({ error: 'Only students can post questions' });
  }
  const title = cleanText(req.body.title, 200);
  const description = cleanText(req.body.description, 5000);
  const subject = cleanText(req.body.subject, 100);
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const question = await Question.create({
    student: req.userId,
    title,
    description,
    subject,
    status: 'open',
  });
  res.json({ ok: true, question });
});

// All open questions (mentor queue). Kept for backward compatibility.
router.get('/questions', async (req, res) => {
  const questions = await Question.find({ status: 'open' })
    .populate('student', 'name email role')
    .sort({ createdAt: -1 });
  res.json({ questions });
});

router.get('/questions/mentor', async (req, res) => {
  if (!['mentor', 'admin'].includes(req.userRole)) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  const questions = await Question.find({ status: 'open' })
    .populate('student', 'name email role')
    .sort({ createdAt: -1 });
  res.json({ questions });
});

// The current student's questions, including answered and solved ones.
router.get('/questions/mine', async (req, res) => {
  const questions = await Question.find({ student: req.userId })
    .populate('acceptedAnswer')
    .sort({ createdAt: -1 });
  res.json({ questions });
});

router.get('/questions/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid question id' });
  }
  const question = await Question.findById(req.params.id)
    .populate('student', 'name email role')
    .populate('acceptedAnswer');
  if (!question) return res.status(404).json({ error: 'Question not found' });
  res.json({ question });
});

router.get('/questions/:id/answers', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid question id' });
  }
  const answers = await Answer.find({ question: req.params.id })
    .populate('mentor', 'name color role mentorType')
    .sort({ createdAt: 1 });
  res.json({ answers });
});

router.post('/answers', async (req, res) => {
  if (!['mentor', 'admin'].includes(req.userRole)) {
    return res.status(403).json({ error: 'Only mentors can answer questions' });
  }
  const questionId = req.body.questionId;
  const text = cleanText(req.body.text, 5000);
  if (!questionId || !text) {
    return res.status(400).json({ error: 'questionId and text are required' });
  }
  if (!isValidObjectId(questionId)) {
    return res.status(400).json({ error: 'Invalid question id' });
  }

  const question = await Question.findById(questionId);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  if (question.status === 'solved') {
    return res.status(409).json({ error: 'This question has already been solved' });
  }

  const answer = await Answer.create({
    question: questionId,
    mentor: req.userId,
    text,
  });

  if (question.status === 'open') {
    question.status = 'answered';
    await question.save();
  }

  await notify(question.student, {
    type: 'info',
    title: 'New answer to your question',
    body: text.length > 90 ? `${text.slice(0, 90)}...` : text,
    link: `/question/${question._id}`,
  });

  res.status(201).json({ ok: true, answer });
});

router.post('/answers/:id/accept', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid answer id' });
  }

  // The route parameter is an ANSWER id; the question is resolved from it.
  const answer = await Answer.findById(req.params.id);
  if (!answer) return res.status(404).json({ error: 'Answer not found' });

  const question = await Question.findById(answer.question);
  if (!question) return res.status(404).json({ error: 'Question not found' });
  if (String(question.student) !== String(req.userId)) {
    return res.status(403).json({ error: 'Only the question owner can accept an answer' });
  }

  question.status = 'solved';
  question.acceptedAnswer = answer._id;
  await question.save();

  await notify(answer.mentor, {
    type: 'info',
    title: 'Your answer was accepted',
    body: `Your answer to "${question.title}" was accepted.`,
    link: `/question/${question._id}`,
  });

  res.json({ ok: true, question });
});

router.put('/profile', async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if ('name' in req.body) {
    const name = cleanText(req.body.name, 100);
    if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
    user.name = name;
  }

  for (const key of ['department', 'batch', 'company', 'designation', 'bio']) {
    if (key in req.body) {
      const max = key === 'bio' ? 2000 : 200;
      user[key] = cleanText(req.body[key], max);
    }
  }

  if ('skills' in req.body) {
    const incoming = Array.isArray(req.body.skills)
      ? req.body.skills
      : String(req.body.skills || '').split(',');
    const skills = incoming
      .map((s) => String(s).trim().slice(0, 50))
      .filter(Boolean)
      .slice(0, 50);
    user.skills = skills;
  }

  if ('availability' in req.body) {
    if (!AVAILABILITY.includes(req.body.availability)) {
      return res.status(400).json({ error: 'Invalid availability value' });
    }
    user.availability = req.body.availability;
  }

  if (user.role === 'mentor' && 'mentorType' in req.body) {
    if (!MENTOR_TYPES.includes(req.body.mentorType)) {
      return res.status(400).json({ error: 'Invalid mentor type' });
    }
    user.mentorType = req.body.mentorType;
  }

  await user.save();
  res.json({ user: user.toPublic() });
});

router.get('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const publicUser = user.toPublic();
  const isSelf = String(user._id) === String(req.userId);
  if (!isSelf && req.userRole !== 'admin') {
    delete publicUser.email;
  }
  res.json({ user: publicUser });
});

router.post('/admin/create', requireRole('admin'), async (req, res) => {
  const {
    fullName,
    email,
    password,
    role,
    bio = '',
    skills = [],
    availability = 'available',
    mentorType = '',
    department = '',
    batch = '',
    company = '',
    designation = '',
  } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: 'Full name, email, password and role are required' });
  }
  if (!validateEmail(String(email))) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and contain at least one letter and one number',
    });
  }
  if (!['mentor', 'mentee'].includes(role)) {
    return res.status(400).json({ error: 'Role must be mentor or mentee' });
  }
  if (role === 'mentor' && mentorType && !MENTOR_TYPES.includes(mentorType)) {
    return res.status(400).json({ error: 'Invalid mentor type' });
  }
  if (!AVAILABILITY.includes(availability)) {
    return res.status(400).json({ error: 'Invalid availability value' });
  }

  const emailLower = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: emailLower });
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const skillList = (Array.isArray(skills) ? skills : String(skills || '').split(','))
    .map((s) => String(s).trim().slice(0, 50))
    .filter(Boolean)
    .slice(0, 50);

  const user = await User.create({
    name: cleanText(fullName, 100),
    email: emailLower,
    passwordHash,
    role,
    mentorType: role === 'mentor' ? mentorType : '',
    department: cleanText(department, 200),
    batch: cleanText(batch, 200),
    company: cleanText(company, 200),
    designation: cleanText(designation, 200),
    skills: role === 'mentor' ? skillList : [],
    bio: cleanText(bio, 2000),
    color: '#4f6df5',
    availability: role === 'mentor' ? availability : 'available',
  });

  res.json({ ok: true, user: user.toPublic() });
});

router.put('/settings', requireRole('admin'), async (req, res) => {
  const { currentPassword, newEmail, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });

  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

  if (newEmail) {
    if (!validateEmail(String(newEmail))) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const emailLower = String(newEmail).toLowerCase().trim();
    const existing = await User.findOne({ email: emailLower });
    if (existing && existing._id.toString() !== user._id.toString()) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    user.email = emailLower;
  }

  if (newPassword) {
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters and contain at least one letter and one number',
      });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  await user.save();
  res.json({ ok: true, user: user.toPublic() });
});

// AI Mentor Service
// GET /ai/health — check if AI service is configured
router.get('/ai/health', async (req, res) => {
  const aiKey = process.env.AI_PROVIDER_KEY;
  if (!aiKey) {
    return res.json({ configured: false, service: 'external-ai', message: 'AI provider not configured. Set AI_PROVIDER_KEY environment variable to enable.' });
  }
  return res.json({ configured: true, service: 'external-ai' });
});

// POST /ai/chat — send message to AI mentor
// Mentee-only endpoint. Saves conversation with aiType marker.
// Message body: { conversationId, role, content }
// conversationId: existing conversation ID to continue, or new ID to start fresh
router.post('/ai/chat', requireAuth, async (req, res) => {
  try {
    const { conversationId, role, content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }
    if (role !== 'mentee' && role !== 'student') {
      return res.status(403).json({ error: 'Only mentees can use the AI mentor' });
    }

    const aiKey = process.env.AI_PROVIDER_KEY;
    if (!aiKey) {
      return res.status(503).json({ error: 'AI service not configured. Please contact admin.' });
    }

    // Reuse existing conversation if provided
    let conversation = null;
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      // Verify user owns this conversation
      const isParticipant = conversation.participants.some((p) => String(p) === String(req.userId));
      if (!isParticipant) return res.status(403).json({ error: 'Access denied. You do not own this conversation.' });
    }

    // Create new conversation if not provided
    if (!conversation) {
      conversation = new Conversation({
        pairKey: [String(req.userId), 'ai-mentor'].sort().join('_'),
        participants: [req.userId, { ai: true }],
        aiType: 'ai-mentor',
      });
      await conversation.save();
    }

    // Add user message
    conversation.lastMessage = {
      text: content,
      sender: req.userId,
      at: new Date(),
      ai: false,
    };
    // Initialize unread if needed
    if (!conversation.unread) conversation.unread = {};
    conversation.unread[req.userId] = (conversation.unread[req.userId] || 0) + 1;
    await conversation.save();

    // Call external AI provider
    const aiResponse = await fetchExternalAI(content, conversation);

    // Add AI response to conversation
    conversation.lastMessage = {
      text: aiResponse.reply,
      sender: 'ai-mentor',
      at: new Date(),
      ai: true,
    };
    // Mark user's unread count back (AI response is "read")
    if (conversation.unread && conversation.unread[req.userId]) {
      conversation.unread[req.userId] = Math.max(0, conversation.unread[req.userId] - 1);
    }
    await conversation.save();

    res.json({ ok: true, conversation, aiReply: aiResponse.reply });
  } catch (err) {
    console.error('AI mentor error:', err);
    res.status(500).json({ error: 'AI mentor service error' });
  }
});

// Helper: fetch from external AI provider
async function fetchExternalAI(message, conversation) {
  const aiKey = process.env.AI_PROVIDER_KEY;
  const apiUrl = process.env.AI_PROVIDER_URL || 'https://api.openai.com/v1/chat/completions';

  const systemPrompt = 'You are HH AI Mentor, a helpful mentorship assistant for the Hand Holding Mini platform. Provide guidance on career planning, skill development, interview preparation, and academic questions. Keep responses concise and educational. Do not invent private user data or access internal APIs. If the student asks about something you cannot help with, suggest contacting a human mentor.';

  const payload = {
    model: process.env.AI_PROVIDER_MODEL || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    temperature: 0.7,
  };

  const headers = {
    'Authorization': `Bearer ${aiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const fetch = require('node-fetch');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI provider responded with ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'I am unable to respond at this time. Please try again later.';

    return { reply };
  } catch (err) {
    console.error('External AI fetch error:', err);
    return { reply: 'I am experiencing technical difficulties. Please try again later, or contact a human mentor for assistance.' };
  }
}

// Smart Mentor Matching
// GET /api/users/matching — get mentor recommendations for the authenticated mentee
router.get('/matching', requireAuth, async (req, res) => {
  try {
    if (req.userRole !== 'mentee') {
      return res.status(403).json({ error: 'Only mentees can get mentor recommendations' });
    }

    const mentee = await User.findById(req.userId);
    if (!mentee) return res.status(404).json({ error: 'User not found' });

    const matching = await computeMentorMatching(mentee);
    res.json({ matching });
  } catch (err) {
    console.error('Mentor matching error:', err);
    res.status(500).json({ error: 'Failed to compute mentor matching' });
  }
});

// Helper: compute mentor matches based on student profile
async function computeMentorMatching(mentee) {
  const menteeSkills = new Set((mentee.skills || []).map((s) => String(s).toLowerCase()));
  const menteeDept = mentee.department || '';
  const menteeInterests = mentee.bio ? mentee.bio.toLowerCase().split(/\\s+/) : [];
  const menteeCareerGoals = mentee.bio ? extractCareerGoals(mentee.bio) : [];

  // Fetch all available mentors
  const mentors = await User.find({ role: 'mentor', availability: { $ne: 'unavailable' } })
    .select('name department skills availability mentorType bio ratingAvg ratingCount');

  const matches = mentors.map((mentor) => {
    const mentorSkills = new Set(mentor.skills?.map((s) => String(s).toLowerCase()) || []);

    // Skills compatibility (35% weight)
    const skillIntersection = menteeSkills.filter((s) => mentorSkills.has(s));
    const skillRatio = menteeSkills.size > 0 ? skillIntersection.length / menteeSkills.size : 0;
    const skillScore = skillRatio * 35;

    // Department compatibility (10% weight)
    const deptMatch = menteeDept && menteeDept === (mentor.department || '') ? 10 : 0;

    // Interest compatibility (15% weight)
    const interestIntersection = menteeInterests.filter((i) =>
      (mentor.bio || '').toLowerCase().includes(i)
    );
    const interestRatio = menteeInterests.length > 0 ? interestIntersection.length / menteeInterests.size : 0;
    const interestScore = interestRatio * 15;

    // Availability (10% weight)
    const availabilityScore = mentor.availability === 'available' ? 10 : 0;

    // Experience relevance (5% weight) - based on rating
    const experienceScore = (mentor.ratingAvg || 0) / 5 * 5;

    // Career goal compatibility (25% weight)
    const careerScore = computeCareerGoalCompatibility(menteeCareerGoals, mentor.bio);

    const totalScore = skillScore + deptMatch + interestScore + availabilityScore + experienceScore + careerScore;

    return {
      mentor: {
        id: mentor._id,
        name: mentor.name,
        department: mentor.department,
        mentorType: mentor.mentorType,
        availability: mentor.availability,
        ratingAvg: mentor.ratingAvg,
        ratingCount: mentor.ratingCount,
        bio: mentor.bio,
        skills: mentor.skills,
      },
      score: Math.round(totalScore),
      breakdown: {
        skills: Math.round(skillScore),
        department: deptMatch,
        interests: Math.round(interestScore),
        availability: availabilityScore,
        experience: Math.round(experienceScore),
        career: Math.round(careerScore),
      },
    };
  });

  // Sort by score descending, then by rating average descending
  matches.sort((a, b) => b.score - a.score || b.mentor.ratingAvg - a.mentor.ratingAvg);

  // Return top 5 matches
  return matches.slice(0, 5);
}

// Helper: extract career goals from bio text
function extractCareerGoals(bio) {
  const goals = [];
  const lowerBio = (bio || '').toLowerCase();
  if (lowerBio.includes('software') || lowerBio.includes('developer') || lowerBio.includes('program')) goals.push('software-development');
  if (lowerBio.includes('data') || lowerBio.includes('analytic')) goals.push('data-analysis');
  if (lowerBio.includes('web') || lowerBio.includes('frontend') || lowerBio.includes('backend')) goals.push('web-development');
  if (lowerBio.includes('cyber') || lowerBio.includes('security')) goals.push('cybersecurity');
  if (lowerBio.includes('management') || lowerBio.includes('lead')) goals.push('management');
  if (lowerBio.includes('higher') || lowerBio.includes('degree') || lowerBio.includes('masters')) goals.push('higher-education');
  return goals;
}

// Helper: compute career goal compatibility
function computeCareerGoalCompatibility(studentGoals, mentorBio) {
  if (!studentGoals.length || !mentorBio) return 0;
  const lowerBio = (mentorBio || '').toLowerCase();
  let matches = 0;
  studentGoals.forEach((goal) => {
    if (lowerBio.includes(goal)) matches++;
  });
  return studentGoals.length > 0 ? (matches / studentGoals.length) * 25 : 0;
}

export default router;
