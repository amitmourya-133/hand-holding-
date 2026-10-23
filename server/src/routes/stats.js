import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Meeting, Goal, Feedback, Connection, Conversation, Message, Notification } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const oid = (id) => new mongoose.Types.ObjectId(String(id));

router.get('/', async (req, res) => {
  try {
    if (req.userRole === 'admin') {
      const [byRole, meetings, feedbackAgg, connections, messages, mentees] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        Meeting.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Feedback.aggregate([
          { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
        ]),
        Connection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Message.countDocuments(),
        User.find({ role: 'mentee' }).select('_id').limit(500),
      ]);

      const menteeIds = mentees.map((m) => m._id);
      const goalsAgg = await Goal.aggregate([
        { $match: { mentee: { $in: menteeIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const count = (arr, key) => arr.find((x) => x._id === key)?.count || 0;

      return res.json({
        admin: {
          users: {
            total: byRole.reduce((s, r) => s + r.count, 0),
            mentees: count(byRole, 'mentee'),
            mentors: count(byRole, 'mentor'),
            admins: count(byRole, 'admin'),
          },
          connections: {
            total: connections.reduce((s, r) => s + r.count, 0),
            pending: count(connections, 'pending'),
            accepted: count(connections, 'accepted'),
          },
          meetings: {
            total: meetings.reduce((s, r) => s + r.count, 0),
            pending: count(meetings, 'pending'),
            accepted: count(meetings, 'accepted'),
            completed: count(meetings, 'completed'),
          },
          goals: {
            total: goalsAgg.reduce((s, r) => s + r.count, 0),
            completed: count(goalsAgg, 'completed'),
            inProgress: count(goalsAgg, 'in_progress'),
          },
          feedback: {
            count: feedbackAgg[0]?.count || 0,
            avg: feedbackAgg[0] ? Math.round(feedbackAgg[0].avg * 10) / 10 : 0,
          },
          messages,
        },
      });
    }

    if (req.userRole === 'mentor') {
      const links = await Connection.find({ mentor: req.userId, status: 'accepted' });
      const menteeIds = links.map((l) => l.mentee);

      const [pendingMeetings, upcoming, goals, feedbackAgg, pendingConnections, conversations] =
        await Promise.all([
          Meeting.countDocuments({ mentor: req.userId, status: 'pending' }),
          Meeting.find({
            mentor: req.userId,
            date: { $gte: new Date() },
            status: { $in: ['pending', 'accepted'] },
          })
            .populate('mentee', 'name color')
            .sort({ date: 1 })
            .limit(5),
          Goal.aggregate([
            { $match: { mentor: oid(req.userId) } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ]),
          Feedback.aggregate([
            { $match: { mentor: oid(req.userId) } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
          ]),
          Connection.countDocuments({ mentor: req.userId, status: 'pending' }),
          Conversation.find({ participants: req.userId }).sort({ updatedAt: -1 }).limit(30),
        ]);

      const count = (arr, key) => arr.find((x) => x._id === key)?.count || 0;
      const unread = conversations.reduce((s, c) => s + Number(c.unread?.[String(req.userId)] || 0), 0);

      return res.json({
        mentor: {
          mentees: menteeIds.length,
          pendingConnections,
          pendingMeetings,
          upcomingMeetings: upcoming,
          goals: {
            total: goals.reduce((s, g) => s + g.count, 0),
            completed: count(goals, 'completed'),
            inProgress: count(goals, 'in_progress'),
            notStarted: count(goals, 'not_started'),
          },
          rating: {
            avg: feedbackAgg[0] ? Math.round(feedbackAgg[0].avg * 10) / 10 : 0,
            count: feedbackAgg[0]?.count || 0,
          },
          unreadMessages: unread,
        },
      });
    }

    const [upcoming, goals, connections, conversations, feedbackGiven, unreadNotes] = await Promise.all([
      Meeting.find({
        mentee: req.userId,
        date: { $gte: new Date() },
        status: { $in: ['pending', 'accepted'] },
      })
        .populate('mentor', 'name color mentorType')
        .sort({ date: 1 })
        .limit(5),
      Goal.find({ mentee: req.userId }).sort({ createdAt: -1 }),
      Connection.find({ mentee: req.userId }),
      Conversation.find({ participants: req.userId }).sort({ updatedAt: -1 }).limit(30),
      Feedback.find({ mentee: req.userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('mentor', 'name color')
        .populate('meeting', 'title date'),
      Notification.countDocuments({ user: req.userId, read: false }),
    ]);

    const total = goals.length;
    const done = goals.filter((g) => g.status === 'completed').length;
    const unread = conversations.reduce((s, c) => s + Number(c.unread?.[String(req.userId)] || 0), 0);

    res.json({
      mentee: {
        upcomingMeetings: upcoming,
        goalProgress: { total, done, percent: total ? Math.round((done / total) * 100) : 0 },
        activeGoals: goals.filter((g) => g.status !== 'completed').slice(0, 5),
        connections: {
          total: connections.length,
          pending: connections.filter((c) => c.status === 'pending').length,
          accepted: connections.filter((c) => c.status === 'accepted').length,
        },
        unreadMessages: unread,
        unreadNotifications: unreadNotes,
        recentFeedback: feedbackGiven,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load dashboard' });
  }
});

export default router;
