import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Meeting, Goal, Feedback, Connection, Conversation, Notification } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
const oid = (id) => new mongoose.Types.ObjectId(String(id));

function exportCSV(rows, headers) {
  if (rows.length === 0) return '';
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h] ?? '';
        const escaped = String(val).replace(/"/g, '""').replace(/[\r\n]/g, ' ');
        return `"${escaped}"`;
      })
      .join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

function formatDateServer(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const count = (arr, key) => arr.find((x) => x._id === key)?.count || 0;

router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.userRole === 'admin') {
      const [usersByRole, connectionsTotal, meetingsTotal, goalsTotal, feedbackAgg] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        Connection.countDocuments(),
        Meeting.countDocuments(),
        Goal.countDocuments(),
        Feedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
      ]);

      return res.json({
        admin: {
          users: {
            total: usersByRole.reduce((s, u) => s + u.count, 0),
            byRole: {
              admin: count(usersByRole, 'admin'),
              mentor: count(usersByRole, 'mentor'),
              mentee: count(usersByRole, 'mentee'),
            },
          },
          connections: { total: connectionsTotal },
          meetings: { total: meetingsTotal },
          goals: { total: goalsTotal },
          feedback: { count: feedbackAgg[0]?.count || 0, avg: Math.round((feedbackAgg[0]?.avg || 0) * 10) / 10 },
        },
      });
    }

    if (req.userRole === 'mentor') {
      const [menteeGoals, menteeMeetings, menteeConnections] = await Promise.all([
        Goal.find({ mentor: req.userId }).populate('mentee', 'name').sort({ createdAt: -1 }).limit(50),
        Meeting.find({ mentor: req.userId, date: { $gte: new Date() }, status: { $in: ['pending', 'accepted'] } })
          .populate('mentee', 'name')
          .sort({ date: 1 })
          .limit(50),
        Connection.countDocuments({ mentor: req.userId, status: 'pending' }),
      ]);

      return res.json({ mentor: { menteeGoals, menteeMeetings, menteeConnections } });
    }

    if (req.userRole === 'mentee') {
      const [menteeGoals, menteeMeetings, menteeFeedback, menteeConnections] = await Promise.all([
        Goal.find({ mentee: req.userId }).sort({ createdAt: -1 }).limit(50),
        Meeting.find({ mentee: req.userId, date: { $gte: new Date() }, status: { $in: ['pending', 'accepted'] } })
          .populate('mentor', 'name')
          .sort({ date: 1 })
          .limit(50),
        Feedback.find({ mentee: req.userId }).sort({ createdAt: -1 }).limit(20),
        Connection.find({ mentee: req.userId }),
      ]);

      return res.json({ mentee: { menteeGoals, menteeMeetings, menteeFeedback, menteeConnections } });
    }

    return res.status(403).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('Progress report error:', err);
    return res.status(500).json({ error: 'Could not load progress data' });
  }
});

router.get('/csv', requireAuth, async (req, res) => {
  try {
    if (req.userRole === 'admin') {
      const [usersByRole, meetingsByStatus, feedbackAgg, connectionsByStatus, goalsByStatus, notificationsByRead] =
        await Promise.all([
          User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
          Meeting.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
          Feedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
          Connection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
          Goal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
          Notification.aggregate([{ $group: { _id: '$read', count: { $sum: 1 } } }]),
        ]);

      const usersCSV = exportCSV(
        [
          { role: 'admin', count: count(usersByRole, 'admin') },
          { role: 'mentor', count: count(usersByRole, 'mentor') },
          { role: 'mentee', count: count(usersByRole, 'mentee') },
        ],
        ['role', 'count']
      );
      const meetingsCSV = exportCSV(
        [
          { status: 'pending', count: count(meetingsByStatus, 'pending') },
          { status: 'accepted', count: count(meetingsByStatus, 'accepted') },
          { status: 'completed', count: count(meetingsByStatus, 'completed') },
          { status: 'cancelled', count: count(meetingsByStatus, 'cancelled') },
        ],
        ['status', 'count']
      );
      const feedbackCSV = exportCSV(
        [
          { metric: 'total_feedback', value: feedbackAgg[0]?.count || 0 },
          { metric: 'average_rating', value: Math.round((feedbackAgg[0]?.avg || 0) * 10) / 10 },
        ],
        ['metric', 'value']
      );
      const connectionsCSV = exportCSV(
        [
          { status: 'pending', count: count(connectionsByStatus, 'pending') },
          { status: 'accepted', count: count(connectionsByStatus, 'accepted') },
          { status: 'declined', count: count(connectionsByStatus, 'declined') },
        ],
        ['status', 'count']
      );
      const goalsCSV = exportCSV(
        [
          { status: 'not_started', count: count(goalsByStatus, 'not_started') },
          { status: 'in_progress', count: count(goalsByStatus, 'in_progress') },
          { status: 'completed', count: count(goalsByStatus, 'completed') },
        ],
        ['status', 'count']
      );
      const notificationsCSV = exportCSV(
        [
          { status: 'read', count: count(notificationsByRead, true) },
          { status: 'unread', count: count(notificationsByRead, false) },
        ],
        ['status', 'count']
      );

      res.attachment('handholding-admin-progress.csv');
      res.type('text/csv');
      return res.send(
        [usersCSV, meetingsCSV, feedbackCSV, connectionsCSV, goalsCSV, notificationsCSV].join('\n')
      );
    }

    if (req.userRole === 'mentor') {
      const [goalsByStatus, upcomingMeetings, pendingConnections, conversations] = await Promise.all([
        Goal.aggregate([{ $match: { mentor: oid(req.userId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Meeting.find({ mentor: req.userId, status: { $in: ['pending', 'accepted'] }, date: { $gte: new Date() } })
          .populate('mentee', 'name')
          .sort({ date: 1 })
          .limit(50),
        Connection.countDocuments({ mentor: req.userId, status: 'pending' }),
        Conversation.find({ participants: req.userId }).sort({ updatedAt: -1 }).limit(50),
      ]);

      const goalsCSV = exportCSV(
        [
          { status: 'not_started', count: count(goalsByStatus, 'not_started') },
          { status: 'in_progress', count: count(goalsByStatus, 'in_progress') },
          { status: 'completed', count: count(goalsByStatus, 'completed') },
        ],
        ['status', 'count']
      );
      const meetingRows = upcomingMeetings.map((m) => ({
        mentee_name: m.mentee ? m.mentee.name : 'Unknown',
        date: formatDateServer(m.date),
        title: m.title,
        status: m.status,
      }));
      const meetingsCSV = exportCSV(meetingRows, ['mentee_name', 'date', 'title', 'status']);
      const convRows = conversations.map((c) => ({
        last_message: (c.lastMessage?.text || '').substring(0, 50),
        date: formatDateServer(c.lastMessage?.at || c.updatedAt),
        unread: Object.values(c.unread || {}).reduce((s, v) => s + (Number(v) || 0), 0),
      }));
      const conversationsCSV = exportCSV(convRows, ['last_message', 'date', 'unread']);
      const connectionsCSV = exportCSV(
        [{ metric: 'pending_connections', value: pendingConnections }],
        ['metric', 'value']
      );

      res.attachment('handholding-mentor-progress.csv');
      res.type('text/csv');
      return res.send([goalsCSV, meetingsCSV, conversationsCSV, connectionsCSV].join('\n'));
    }

    if (req.userRole === 'mentee') {
      const [goals, meetingsUpcoming, meetingsPast, feedbackGiven, connections, notifications] = await Promise.all([
        Goal.find({ mentee: req.userId }).sort({ createdAt: -1 }),
        Meeting.find({ mentee: req.userId, date: { $gte: new Date() }, status: { $in: ['pending', 'accepted'] } })
          .populate('mentor', 'name')
          .sort({ date: 1 }),
        Meeting.find({ mentee: req.userId, date: { $lt: new Date() }, status: 'completed' })
          .populate('mentor', 'name')
          .sort({ date: -1 })
          .limit(10),
        Feedback.find({ mentee: req.userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('mentor', 'name')
          .populate('meeting', 'title'),
        Connection.find({ mentee: req.userId }),
        Notification.find({ user: req.userId, read: false }).limit(20),
      ]);

      const goalsData = goals.map((g) => ({
        title: g.title,
        status: g.status.replace('_', ' '),
        due_date: g.dueDate ? formatDateServer(g.dueDate) : '',
      }));
      const goalsCSV = exportCSV(goalsData, ['title', 'status', 'due_date']);

      const toMeetingRow = (m) => ({
        mentor_name: m.mentor ? m.mentor.name : 'Unknown',
        date: formatDateServer(m.date),
        title: m.title,
        mode: m.mode,
        status: m.status,
      });
      const meetingsCSV = exportCSV([...meetingsUpcoming.map(toMeetingRow), ...meetingsPast.map(toMeetingRow)], [
        'mentor_name',
        'date',
        'title',
        'mode',
        'status',
      ]);

      const feedbackRows = feedbackGiven.map((f) => ({
        meeting: f.meeting ? f.meeting.title || 'Unknown session' : '',
        rating: f.rating,
        comment: (f.comment || '').substring(0, 80),
        date: formatDateServer(f.createdAt),
      }));
      const feedbackCSV = exportCSV(feedbackRows, ['meeting', 'rating', 'comment', 'date']);

      const connRows = connections.map((c) => ({
        status: c.status,
        note: (c.note || '').substring(0, 50),
        created: formatDateServer(c.createdAt),
      }));
      const connectionsCSV = exportCSV(connRows, ['status', 'note', 'created']);

      const notifRows = notifications.map((n) => ({
        type: n.type,
        title: n.title,
        body: (n.body || '').substring(0, 80),
        date: formatDateServer(n.createdAt),
        read: n.read,
      }));
      const notificationsCSV = exportCSV(notifRows, ['type', 'title', 'body', 'date', 'read']);

      res.attachment('handholding-mentee-progress.csv');
      res.type('text/csv');
      return res.send([goalsCSV, meetingsCSV, feedbackCSV, connectionsCSV, notificationsCSV].join('\n'));
    }

    return res.status(403).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('Progress CSV export error:', err);
    return res.status(500).json({ error: 'Could not generate progress report' });
  }
});

export default router;
