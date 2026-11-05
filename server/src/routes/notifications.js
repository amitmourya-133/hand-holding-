import { Notification } from '../models.js';
import { requireAuth } from '../auth.js';
import { createRouter } from '../asyncRouter.js';

const router = createRouter();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const filter = { user: req.userId };
  if (req.query.category) {
    filter.category = req.query.category;
  }
  if (req.query.type) {
    filter.type = req.query.type;
  }
  const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(30);
  const unreadCount = await Notification.countDocuments({ user: req.userId, read: false });
  res.json({ notifications, unreadCount });
});

router.post('/read-all', async (req, res) => {
  const filter = { user: req.userId, read: false };
  if (req.query.category) {
    filter.category = req.query.category;
  }
  await Notification.updateMany(filter, { $set: { read: true } });
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
