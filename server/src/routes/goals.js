import { Goal, Connection } from '../models.js';
import { requireAuth } from '../auth.js';
import { notify } from '../helpers.js';
import { createRouter } from '../asyncRouter.js';

const router = createRouter();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const filter = {};
  if (req.userRole === 'mentee') {
    filter.mentee = req.userId;
  } else if (req.userRole === 'mentor') {
    filter.mentor = req.userId;
    if (req.query.mentee) filter.mentee = req.query.mentee;
  } else {
    if (req.query.mentee) filter.mentee = req.query.mentee;
    if (req.query.mentor) filter.mentor = req.query.mentor;
  }

  const goals = await Goal.find(filter)
    .populate('mentee', 'name color department batch')
    .populate('mentor', 'name color')
    .sort({ createdAt: -1 });

  res.json({ goals });
});

router.post('/', async (req, res) => {
  try {
    if (!['mentor', 'admin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only mentors can create goals' });
    }
    const { menteeId, title, description = '', dueDate } = req.body;
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
    const cleanDescription = typeof description === 'string' ? description.trim().slice(0, 2000) : '';
    if (!menteeId || !cleanTitle) return res.status(400).json({ error: 'Mentee and title are required' });
    if (!/^[0-9a-fA-F]{24}$/.test(String(menteeId))) return res.status(400).json({ error: 'Invalid mentee id' });

    let due;
    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) return res.status(400).json({ error: 'Invalid due date' });
    }

    const linked = await Connection.findOne({
      status: 'accepted',
      mentee: menteeId,
      mentor: req.userId,
    });
    if (!linked && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'You can set goals only for your own mentees' });
    }

    const goal = await Goal.create({
      mentee: menteeId,
      mentor: req.userId,
      title: cleanTitle,
      description: cleanDescription,
      dueDate: due,
    });

    await notify(menteeId, {
      type: 'goal',
      title: 'New goal assigned',
      body: title,
      link: '/goals',
    });

    res.status(201).json({ goal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create goal' });
  }
});

router.patch('/:id', async (req, res) => {
  const goal = await Goal.findById(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const isMentor = String(goal.mentor) === String(req.userId) && req.userRole === 'mentor';
  const isMentee = String(goal.mentee) === String(req.userId);
  const isAdmin = req.userRole === 'admin';
  if (!isMentor && !isMentee && !isAdmin) return res.status(403).json({ error: 'Not allowed' });

  const { status, title, description, dueDate } = req.body;
  const previous = goal.status;

  if (status && ['not_started', 'in_progress', 'completed'].includes(status)) goal.status = status;
  if (isMentor || isAdmin) {
    if (title !== undefined) {
      const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
      if (!cleanTitle) return res.status(400).json({ error: 'Title cannot be empty' });
      goal.title = cleanTitle;
    }
    if (description !== undefined) {
      if (typeof description !== 'string') return res.status(400).json({ error: 'Invalid description' });
      goal.description = description.trim().slice(0, 2000);
    }
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        goal.dueDate = null;
      } else {
        const parsed = new Date(dueDate);
        if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid due date' });
        goal.dueDate = parsed;
      }
    }
  }
  await goal.save();

  if (previous !== goal.status) {
    const who = isMentee ? 'Your mentee' : 'Your mentor';
    await notify(isMentee ? goal.mentor : goal.mentee, {
      type: 'goal',
      title: 'Goal status updated',
      body: `${who} "${goal.title}" → ${goal.status.replace('_', ' ')}`,
      link: '/goals',
    });
  }

  res.json({ goal });
});

router.delete('/:id', async (req, res) => {
  const goal = await Goal.findById(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const allowed = req.userRole === 'admin' || (req.userRole === 'mentor' && String(goal.mentor) === String(req.userId));
  if (!allowed) return res.status(403).json({ error: 'Not allowed' });
  await goal.deleteOne();
  res.json({ ok: true });
});

export default router;
