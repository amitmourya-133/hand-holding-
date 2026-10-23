import { Router } from 'express';
import { Notification } from '../models.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const notifications = await Notification.find({ user: req.userId }).sort({ createdAt: -1 }).limit(30);
  const unreadCount = await Notification.countDocuments({ user: req.userId, read: false });
  res.json({ notifications, unreadCount });
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.userId, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    { $set: { read: true } },
    { new: true }
  );
  if (!n) return res.status(404).json({ error: 'Notification not found' });
  res.json({ notification: n });
});

export default router;
