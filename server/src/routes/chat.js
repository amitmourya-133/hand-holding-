import { Router } from 'express';
import { Conversation, Message, Connection, User } from '../models.js';
import { requireAuth } from '../auth.js';
import { emitToUser } from '../socket.js';
import { notify } from '../helpers.js';

const router = Router();
router.use(requireAuth);

function pairKey(a, b) {
  return [String(a), String(b)].sort().join('_');
}

router.get('/conversations', async (req, res) => {
  const conversations = await Conversation.find({ participants: req.userId })
    .populate('participants', 'name email role color mentorType department company designation')
    .sort({ updatedAt: -1 });

  res.json({
    conversations: conversations.map((c) => {
      const partner = c.participants.find((p) => String(p._id) !== String(req.userId));
      return {
        id: c._id,
        partner: partner || null,
        lastMessage: c.lastMessage,
        unread: Number(c.unread?.[String(req.userId)] || 0),
        updatedAt: c.updatedAt,
      };
    }),
  });
});

router.post('/conversations', async (req, res) => {
  const { partnerId } = req.body;
  if (!partnerId) return res.status(400).json({ error: 'partnerId is required' });
  if (String(partnerId) === String(req.userId)) return res.status(400).json({ error: 'You cannot chat with yourself' });

  const isSelf = String(req.userId) === String(partnerId);
  const linked = await Connection.findOne({
    status: 'accepted',
    $or: [
      { mentee: req.userId, mentor: partnerId },
      { mentee: partnerId, mentor: req.userId },
    ],
  });
  const isAdmin = req.userRole === 'admin';
  if (!linked && !isAdmin && !isSelf) {
    return res.status(403).json({ error: 'You can only chat with your connected mentor or mentee' });
  }

  const key = pairKey(req.userId, partnerId);
  let conversation = await Conversation.findOne({ pairKey: key });
  if (!conversation) {
    conversation = await Conversation.create({
      pairKey: key,
      participants: [req.userId, partnerId],
      unread: {},
    });
  }
  res.status(201).json({ id: conversation._id });
});

router.get('/conversations/:id/messages', async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !conversation.participants.some((p) => String(p) === String(req.userId))) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const messages = await Message.find({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'name color role');

  await Message.updateMany(
    { conversation: conversation._id, readBy: { $ne: req.userId } },
    { $addToSet: { readBy: req.userId } }
  );
  const unread = { ...(conversation.unread || {}) };
  unread[String(req.userId)] = 0;
  conversation.unread = unread;
  await conversation.save();

  res.json({ messages: messages.reverse() });
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message text is required' });

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation || !conversation.participants.some((p) => String(p) === String(req.userId))) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const partner = conversation.participants.find((p) => String(p) !== String(req.userId));
    const hadUnread = Number(conversation.unread?.[String(partner)] || 0) > 0;

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.userId,
      text,
      readBy: [req.userId],
    });

    const unread = { ...(conversation.unread || {}) };
    unread[String(partner)] = Number(unread[String(partner)] || 0) + 1;
    conversation.unread = unread;
    conversation.lastMessage = { text, sender: req.userId, at: new Date() };
    await conversation.save();

    const populated = await message.populate('sender', 'name color role');

    emitToUser(String(req.userId), 'message:new', {
      conversationId: conversation._id,
      message: populated,
      partnerId: String(partner),
    });
    emitToUser(String(partner), 'message:new', {
      conversationId: conversation._id,
      message: populated,
      partnerId: String(req.userId),
    });

    if (!hadUnread) {
      const sender = await User.findById(req.userId).select('name');
      notify(partner, {
        type: 'message',
        title: `New message from ${sender.name}`,
        body: text.length > 90 ? `${text.slice(0, 90)}...` : text,
        link: '/messages',
      });
    }

    res.status(201).json({ message: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send message' });
  }
});

export default router;
