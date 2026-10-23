import { Router } from 'express';
import { Meeting, Connection, Goal } from '../models.js';
import { requireAuth } from '../auth.js';
import { notify } from '../helpers.js';

const ALLOWED_URL_SCHEMES = ['https:', 'http:'];

function isValidMeetingUrl(url) {
  if (!url || url.trim() === '') return true; // empty = in-person meeting
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { mentorId, menteeId, title, agenda = '', date, durationMin = 30, mode = 'online', placeOrLink = '' } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Title and date are required' });
    const hex = /^[0-9a-fA-F]{24}$/;
    if (mentorId && !hex.test(String(mentorId))) return res.status(400).json({ error: 'Invalid mentor id' });
    if (menteeId && !hex.test(String(menteeId))) return res.status(400).json({ error: 'Invalid mentee id' });

    // Validate placeOrLink URL scheme
    if (!isValidMeetingUrl(placeOrLink)) {
      return res.status(400).json({ error: 'Invalid meeting URL scheme. Only HTTPS and HTTP are allowed.' });
    }

    let mentor = mentorId;
    let mentee = menteeId;

    if (req.userRole === 'mentee') {
      mentee = req.userId;
      mentor = mentorId;
    } else if (req.userRole === 'admin') {
      mentor = mentorId;
      mentee = menteeId;
    } else {
      mentor = req.userId;
      mentee = menteeId;
    }

    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid date' });
    if (when.getTime() < Date.now() - 60 * 60 * 1000) {
      return res.status(400).json({ error: 'Meeting date must be in the future' });
    }

    const linked = await Connection.findOne({
      status: 'accepted',
      mentee,
      mentor,
    });
    if (!linked && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can schedule meetings only with a connected mentor or mentee' });
    }

    const meeting = await Meeting.create({
      mentor,
      mentee,
      title,
      agenda,
      date: when,
      durationMin: Number(durationMin) || 30,
      mode,
      placeOrLink,
      proposedBy: req.userId,
    });

    const other = String(req.userId) === String(mentor) ? mentee : mentor;
    await notify(other, {
      type: 'meeting',
      title: 'New meeting proposal',
      body: `"${title}" proposed for ${when.toLocaleString()}`,
      link: '/meetings',
    });

    res.status(201).json({ meeting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not schedule meeting' });
  }
});

router.get('/', async (req, res) => {
  const { scope = 'all' } = req.query;
  const now = new Date();
  const filter = {};
  if (req.userRole !== 'admin') {
    filter.$or = [{ mentor: req.userId }, { mentee: req.userId }];
  }

  const timeFilter = {};
  if (scope === 'upcoming') {
    timeFilter.date = { $gte: now };
    timeFilter.status = { $in: ['pending', 'accepted'] };
  } else if (scope === 'past') {
    timeFilter.$or = [{ date: { $lt: now } }, { status: { $in: ['completed', 'declined', 'cancelled'] } }];
  }
  if (Object.keys(timeFilter).length > 0) {
    filter.$and = [timeFilter];
  }

  const meetings = await Meeting.find(filter)
    .populate('mentor', 'name color role mentorType department company designation')
    .populate('mentee', 'name color role department batch')
    .sort({ date: scope === 'past' ? -1 : 1 });

  res.json({ meetings });
});

async function loadMeeting(req, res) {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return null;
  }
  const isMentor = String(meeting.mentor) === String(req.userId);
  const isMentee = String(meeting.mentee) === String(req.userId);
  if (!isMentor && !isMentee && req.userRole !== 'admin') {
    res.status(403).json({ error: 'Not allowed' });
    return null;
  }
  return { meeting, isMentor, isMentee };
}

router.post('/:id/respond', async (req, res) => {
  const loaded = await loadMeeting(req, res);
  if (!loaded) return;
  const { meeting } = loaded;
  const { action } = req.body;
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  if (meeting.status !== 'pending') return res.status(409).json({ error: 'This meeting is no longer pending' });
  if (String(meeting.proposedBy) === String(req.userId)) {
    return res.status(403).json({ error: 'The other party must respond to this proposal' });
  }

  meeting.status = action === 'accept' ? 'accepted' : 'declined';
  await meeting.save();

  const other = String(meeting.proposedBy);
  await notify(other, {
    type: 'meeting',
    title: action === 'accept' ? 'Meeting confirmed' : 'Meeting declined',
    body: `"${meeting.title}" was ${action === 'accept' ? 'accepted' : 'declined'}.`,
    link: '/meetings',
  });

  res.json({ meeting });
});

router.post('/:id/complete', async (req, res) => {
  const loaded = await loadMeeting(req, res);
  if (!loaded) return;
  const { meeting } = loaded;
  if (meeting.status !== 'accepted') return res.status(409).json({ error: 'Only accepted meetings can be completed' });

  meeting.status = 'completed';
  await meeting.save();

  await notify(meeting.mentee, {
    type: 'feedback',
    title: 'Session completed',
    body: `How was "${meeting.title}"? Share your feedback.`,
    link: '/feedback',
  });

  res.json({ meeting });
});

router.post('/:id/cancel', async (req, res) => {
  const loaded = await loadMeeting(req, res);
  if (!loaded) return;
  const { meeting } = loaded;
  if (!['pending', 'accepted'].includes(meeting.status)) {
    return res.status(409).json({ error: 'This meeting can no longer be cancelled' });
  }

  meeting.status = 'cancelled';
  await meeting.save();

  const other = String(meeting.mentor) === String(req.userId) ? meeting.mentee : meeting.mentor;
  await notify(other, {
    type: 'meeting',
    title: 'Meeting cancelled',
    body: `"${meeting.title}" has been cancelled.`,
    link: '/meetings',
  });

  res.json({ meeting });
});

router.get('/summary', async (req, res) => {
  const upcoming = await Meeting.find({
    $or: [{ mentor: req.userId }, { mentee: req.userId }],
    date: { $gte: new Date() },
    status: { $in: ['pending', 'accepted'] },
  })
    .populate('mentor', 'name color')
    .populate('mentee', 'name color')
    .sort({ date: 1 })
    .limit(5);

  const goals = await Goal.find({ mentee: req.userId });
  const total = goals.length;
  const done = goals.filter((g) => g.status === 'completed').length;

  res.json({ upcomingMeetings: upcoming, goalProgress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 } });
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const hex = /^[0-9a-fA-F]{24}$/;
    if (!hex.test(String(id))) return res.status(400).json({ error: 'Invalid meeting id' });
    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    // authorization: only proposer or admin
    const isProposer = String(meeting.proposedBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    if (!isProposer && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    // cannot edit completed or cancelled meetings
    if (!['pending', 'accepted'].includes(meeting.status)) {
      return res.status(409).json({ error: 'This meeting can no longer be edited' });
    }
    const { date, agenda, mode, placeOrLink } = req.body;
    if (placeOrLink !== undefined && !isValidMeetingUrl(placeOrLink)) {
      return res.status(400).json({ error: 'Invalid meeting URL scheme. Only HTTPS and HTTP are allowed.' });
    }
    if (date) {
      const when = new Date(date);
      if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Invalid date' });
      if (when.getTime() < Date.now() - 60 * 60 * 1000) {
        return res.status(400).json({ error: 'Meeting date must be in the future' });
      }
      meeting.date = when;
    }
    if (agenda !== undefined) meeting.agenda = agenda;
    if (mode) meeting.mode = mode;
    if (placeOrLink !== undefined) meeting.placeOrLink = placeOrLink;
    await meeting.save();
    res.json({ meeting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reschedule meeting' });
  }
});

export default router;
