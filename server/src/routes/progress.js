import { Router } from 'express';
import mongoose from 'mongoose';
import { User, Meeting, Goal, Feedback, Connection, Conversation, Message, Notification } from '../models.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Helper: export CSV content from an array of objects
 */
function exportCSV(rows, headers) {
  if (rows.length === 0) return '';
  const headerRow = headers.join(',');
  const dataRows = rows.map((row) =>
    headers.map((h) => {
      const val = row[h] ?? '';
      // Escape commas, quotes and newlines for CSV
      const escaped = String(val).replace(/"/g, '""').replace(/[\r\n]/g, ' ');
      return `"${escaped}"`;
    }).join(',')
  );
  return [headerRow, ...dataRows].join('\n');
}

router.get('/progress/csv', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;

    if (role === 'admin') {
      const [
        usersByRole, meetingsByStatus, feedbackAgg,
        connectionsByStatus, messagesCount, mentees,
        goalsByStatus, feedbacks, notifications, meetings,
      ] = await Promise.all([
        User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
        Meeting.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Feedback.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
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

      // CSV: Users by role
      const usersData = [
        { role: 'admin', count: count(usersByRole, 'admin') },
        { role: 'mentor', count: count(usersByRole, 'mentor') },
        { role: 'mentee', count: count(usersByRole, 'mentee') },
      ];
      const usersCSV = exportCSV(usersData, ['role', 'count']);

      // CSV: Meetings by status
      const meetingsData = [
        { status: 'pending', count: count(meetingsByStatus, 'pending') },
        { status: 'accepted', count: count(meetingsByStatus, 'accepted') },
        { status: 'completed', count: count(meetingsByStatus, 'completed') },
        { status: 'cancelled', count: count(meetingsByStatus, 'cancelled') },
      ];
      const meetingsCSV = exportCSV(meetingsData, ['status', 'count']);

      // CSV: Feedback stats
      const feedbackData = [
        { metric: 'total_feedback', count: feedbackAgg[0]?.count || 0 },
        { metric: 'average_rating', count: Math.round((feedbackAgg[0]?.avg || 0) * 10) / 10 },
      ];
      const feedbackCSV = exportCSV(feedbackData, ['metric', 'value']);

      // CSV: Connections by status
      const connectionsData = [
        { status: 'pending', count: count(connectionsByStatus, 'pending') },
        { status: 'accepted', count: count(connectionsByStatus, 'accepted') },
        { status: 'declined', count: count(connectionsByStatus, 'declined') },
      ];
      const connectionsCSV = exportCSV(connectionsData, ['status', 'count']);

      // CSV: Goals by status
      const goalsData = [
        { status: 'not_started', count: count(goalsByStatus, 'not_started') },
        { status: 'in_progress', count: count(goalsByStatus, 'in_progress') },
        { status: 'completed', count: count(goalsByStatus, 'completed') },
      ];
      const goalsCSV = exportCSV(goalsData, ['status', 'count']);

      // CSV: Notifications by read status
      const readCount = notifications.reduce((s, n) => s + (n.read ? 1 : 0), 0);
      const notificationsData = [
        { status: 'read', count: readCount },
        { status: 'unread', count: notifications.length - readCount },
      ];
      const notificationsCSV = exportCSV(notificationsData, ['status', 'count']);

      res.attachment('handholding-admin-progress.csv');
      res.set('Content-Type', 'text/csv');
      res.status(200).send(usersCSV + '\n' + meetingsCSV + '\n' + feedbackCSV + '\n' + connectionsCSV + '\n' + goalsCSV + '\n' + notificationsCSV);
    }

    if (role === 'mentor') {
      const menteeIds = (await Connection.find({ mentor: req.userId, status: 'accepted' })).map((l) => l.mentee);

      const [
        upcomingMeetings, goals, feedbackAgg, connections, conversations,
      ] = await Promise.all([
        Meeting.find({ mentor: req.userId, status: { $in: ['pending', 'accepted'] }, date: { $gte: new Date() } })
          .populate('mentee', 'name')
          .sort({ date: 1 })
          .limit(50),
        Goal.aggregate([{ $match: { mentor: oid(req.userId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Feedback.aggregate([{ $match: { mentor: oid(req.userId) } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
        Connection.countDocuments({ mentor: req.userId, status: 'pending' }),
        Conversation.find({ participants: req.userId }).sort({ updatedAt: -1 }).limit(50),
      ]);

      const count = (arr, key) => arr.find((x) => x._id === key)?.count || 0;

      // CSV: Goals by status
      const goalsData = [
        { status: 'not_started', count: count(goalsByStatus, 'not_started') },
        { status: 'in_progress', count: count(goalsByStatus, 'in_progress') },
        { status: 'completed', count: count(goalsByStatus, 'completed') },
      ];
      const goalsCSV = exportCSV(goalsData, ['status', 'count']);

      // CSV: Upcoming meetings
      const meetingRows = upcomingMeetings.map((m) => ({
        mentee_name: m.mentee ? m.mentee.name : 'Unknown',
        date: formatDateServer(m.date),
        title: m.title,
        status: m.status,
      }));
      const meetingsCSV = exportCSV(meetingRows, ['mentee_name', 'date', 'title', 'status']);

      // CSV: Conversations (recent)
      const convRows = conversations.map((c) => ({
        last_sender: c.lastMessage?.sender ? 'Mentor' : 'Mentee', // simplified
        last_message: c.lastMessage?.text?.substring(0, 50) || '',
        date: formatDateServer(c.lastMessage?.at || new Date()),
        unread: Object.values(c.unread || {}).reduce((s, v) => s + v, 0),
      }));
      const conversationsCSV = exportCSV(convRows, ['last_sender', 'last_message', 'date', 'unread']);

      // CSV: Pending connections
      const connectionsData = [
        { metric: 'pending_connections', count: connections },
      ];
      const connectionsCSV = exportCSV(connectionsData, ['metric', 'value']);

      res.attachment('handholding-mentor-progress.csv');
      res.set('Content-Type', 'text/csv');
      res.status(200).send(goalsCSV + '\n' + meetingsCSV + '\n' + conversationsCSV + '\n' + connectionsCSV);
    }

    if (role === 'mentee') {
      const menteeId = req.userId;

      const [
        goals, meetingsUpcoming, meetingsPast, feedbackGiven, connections, notifications,
      ] = await Promise.all([
        Goal.find({ mentee: menteeId }).sort({ createdAt: -1 }),
        Meeting.find({ mentee: menteeId, date: { $gte: new Date() }, status: { $in: ['pending', 'accepted'] } })
          .populate('mentor', 'name')
          .sort({ date: 1 }),
        Meeting.find({ mentee: menteeId, date: { $lt: new Date() }, status: 'completed' })
          .populate('mentor', 'name')
          .sort({ date: -1 })
          .limit(10),
        Feedback.find({ mentee: menteeId })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate('mentor', 'name')
          .populate('meeting', 'title'),
        Connection.find({ mentee: menteeId }),
        Notification.find({ user: menteeId, read: false }).limit(20),
      ]);

      // CSV: Goals progress
      const goalsData = goals.map((g) => ({
        title: g.title,
        status: g.status.replace('_', ' '),
        due_date: g.dueDate ? formatDateServer(g.dueDate) : '',
      }));
      const goalsCSV = exportCSV(goalsData, ['title', 'status', 'due_date']);

      // CSV: Meetings (upcoming and past)
      const upRows = meetingsUpcoming.map((m) => ({
        mentor_name: m.mentor ? m.mentor.name : 'Unknown',
        date: formatDateServer(m.date),
        title: m.title,
        mode: m.mode,
        status: m.status,
      }));
      const pastRows = meetingsPast.map((m) => ({
        mentor_name: m.mentor ? m.mentor.name : 'Unknown',
        date: formatDateServer(m.date),
        title: m.title,
        mode: m.mode,
        status: m.status,
      }));
      const meetingsCSV = exportCSV([...upRows, ...pastRows], ['mentor_name', 'date', 'title', 'mode', 'status']);

      // CSV: Feedback received
      const feedbackRows = feedbackGiven.map((f) => ({
        meeting: f.meeting ? (f.meeting.title || 'Unknown session') : '',
        rating: f.rating,
        comment: f.comment ? f.comment.substring(0, 80) : '',
        date: formatDateServer(f.createdAt),
      }));
      const feedbackCSV = exportCSV(feedbackRows, ['meeting', 'rating', 'comment', 'date']);

      // CSV: Connections
      const connRows = connections.map((c) => ({
        status: c.status,
        note: c.note.substring(0, 50) || '',
        created: formatDateServer(c.createdAt),
      }));
      const connectionsCSV = exportCSV(connRows, ['status', 'note', 'created']);

      // CSV: Unread notifications
      const notifRows = notifications.map((n) => ({
        type: n.type,
        title: n.title,
        body: n.body.substring(0, 80) || '',
        date: formatDateServer(n.createdAt),
        read: n.read,
      }));
      const notificationsCSV = exportCSV(notifRows, ['type', 'title', 'body', 'date', 'read']);

      res.attachment('handholding-mentee-progress.csv');
      res.set('Content-Type', 'text/csv');
      res.status(200).send(goalsCSV + '\n' + meetingsCSV + '\n' + feedbackCSV + '\n' + connectionsCSV + '\n' + notificationsCSV);
    }

    return;
  } catch (err) {
    console.error('Progress CSV export error:', err);
    res.status(500).json({ error: 'Could not generate progress report' });
  }
});

/** Small helper used by the CSV generator (running on server) */
function formatDateServer(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default router;