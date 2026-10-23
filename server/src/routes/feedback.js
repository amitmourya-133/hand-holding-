import { Router } from 'express';
import { Feedback, Meeting, User } from '../models.js';
import { requireAuth } from '../auth.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  try {
    const { meetingId, rating, comment = '' } = req.body;
    const ratingNum = Number(rating);
    if (!meetingId || !ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'A rating between 1 and 5 is required' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (String(meeting.mentee) !== String(req.userId)) {
      return res.status(403).json({ error: 'Only the mentee can rate a session' });
    }
    if (meeting.status !== 'completed') return res.status(400).json({ error: 'Only completed sessions can be rated' });

    const existing = await Feedback.findOne({ meeting: meetingId, mentee: req.userId });
    if (existing) return res.status(409).json({ error: 'You have already rated this session' });

    const feedback = await Feedback.create({
      meeting: meetingId,
      mentee: req.userId,
      mentor: meeting.mentor,
      rating: ratingNum,
      comment,
    });

    const stats = await Feedback.aggregate([
      { $match: { mentor: meeting.mentor } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (stats[0]) {
      await User.updateOne(
        { _id: meeting.mentor },
        { $set: { ratingAvg: Math.round(stats[0].avg * 10) / 10, ratingCount: stats[0].count } }
      );
    }

    await notify(meeting.mentor, {
      type: 'feedback',
      title: `New feedback: ${ratingNum}★`,
      body: comment || `A mentee rated your session "${meeting.title}".`,
      link: '/feedback',
    });

    res.status(201).json({ feedback });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'You have already rated this session' });
    console.error(err);
    res.status(500).json({ error: 'Could not submit feedback' });
  }
});

router.get('/', async (req, res) => {
  const { mentorId, meetingId, mine } = req.query;
  const filter = {};

  if (mine === '1' || req.userRole === 'mentee') {
    filter.mentee = req.userId;
  } else if (req.userRole === 'mentor') {
    filter.mentor = mentorId || req.userId;
  } else if (mentorId) {
    filter.mentor = mentorId;
  }

  if (meetingId) filter.meeting = meetingId;

  const feedbacks = await Feedback.find(filter)
    .populate('mentee', 'name color department batch')
    .populate('mentor', 'name color mentorType')
    .populate('meeting', 'title date')
    .sort({ createdAt: -1 })
    .limit(100);

  const pending = [];
  if (req.userRole === 'mentee') {
    const doneMeetings = feedbacks.map((f) => String(f.meeting?._id || f.meeting));
    const completed = await Meeting.find({ mentee: req.userId, status: 'completed' })
      .populate('mentor', 'name color')
      .sort({ date: -1 });
    for (const m of completed) {
      if (!doneMeetings.includes(String(m._id))) pending.push(m);
    }
  }

  res.json({ feedbacks, pendingSessions: pending });
});

export default router;
