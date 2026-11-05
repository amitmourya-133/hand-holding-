import { Roadmap, Milestone, User, Connection } from '../models.js';
import { requireAuth } from '../auth.js';
import { notify } from '../helpers.js';
import { createRouter } from '../asyncRouter.js';

const router = createRouter();
router.use(requireAuth);

// GET /api/roadmaps — list roadmaps for the authenticated user
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.userRole === 'mentee') {
      filter.user = req.userId;
    } else if (req.userRole === 'mentor') {
      filter.createdBy = req.userId;
    } else {
      // admin can see all
    }

    const roadmaps = await Roadmap.find(filter)
      .populate('user', 'name color')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    // Attach milestones to each roadmap
    const roadmapsWithMilestones = await Promise.all(
      roadmaps.map(async (r) => {
        const milestones = await Milestone.find({ roadmap: r._id }).sort({ order: 1, createdAt: 1 });
        return { ...r.toObject(), milestones };
      })
    );

    res.json({ roadmaps: roadmapsWithMilestones });
  } catch (err) {
    console.error('Roadmap list error:', err);
    res.status(500).json({ error: 'Could not load roadmaps' });
  }
});

// GET /api/roadmaps/:id — get a specific roadmap with milestones
router.get('/:id', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id)
      .populate('user', 'name color')
      .populate('createdBy', 'name');

    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });

    // Authorization: only owner, creator, or admin can view
    const isOwner = String(roadmap.user) === String(req.userId);
    const isCreator = String(roadmap.createdBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    if (!isOwner && !isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const milestones = await Milestone.find({ roadmap: roadmap._id }).sort({ order: 1, createdAt: 1 });
    res.json({ roadmap: { ...roadmap.toObject(), milestones } });
  } catch (err) {
    console.error('Roadmap get error:', err);
    res.status(500).json({ error: 'Could not load roadmap' });
  }
});

// POST /api/roadmaps — create a new roadmap
router.post('/', async (req, res) => {
  try {
    if (!['mentor', 'admin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only mentors can create roadmaps' });
    }

    const { userId, title, description = '', category = '' } = req.body;
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
    const cleanDescription = typeof description === 'string' ? description.trim().slice(0, 2000) : '';
    const cleanCategory = typeof category === 'string' ? category.trim().slice(0, 100) : '';

    if (!userId || !cleanTitle) return res.status(400).json({ error: 'User and title are required' });
    if (!/^[0-9a-fA-F]{24}$/.test(String(userId))) return res.status(400).json({ error: 'Invalid user id' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Authorization: mentor can only create roadmaps for their mentees
    if (req.userRole === 'mentor') {
      const linked = await Connection.findOne({
        status: 'accepted',
        mentee: userId,
        mentor: req.userId,
      });
      if (!linked) {
        return res.status(403).json({ error: 'You can create roadmaps only for your own mentees' });
      }
    }

    const roadmap = await Roadmap.create({
      user: userId,
      title: cleanTitle,
      description: cleanDescription,
      category: cleanCategory,
      createdBy: req.userId,
    });

    await notify(userId, {
      type: 'info',
      title: 'New career roadmap created',
      body: cleanTitle,
      link: '/roadmaps',
      category: cleanCategory,
    });

    res.status(201).json({ roadmap });
  } catch (err) {
    console.error('Roadmap create error:', err);
    res.status(500).json({ error: 'Could not create roadmap' });
  }
});

// PATCH /api/roadmaps/:id — update a roadmap
router.patch('/:id', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });

    const isCreator = String(roadmap.createdBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { title, description, category, status } = req.body;
    if (title !== undefined) {
      const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
      if (!cleanTitle) return res.status(400).json({ error: 'Title cannot be empty' });
      roadmap.title = cleanTitle;
    }
    if (description !== undefined) {
      roadmap.description = typeof description === 'string' ? description.trim().slice(0, 2000) : '';
    }
    if (category !== undefined) {
      roadmap.category = typeof category === 'string' ? category.trim().slice(0, 100) : '';
    }
    if (status && ['not_started', 'in_progress', 'completed'].includes(status)) {
      roadmap.status = status;
    }

    await roadmap.save();
    res.json({ roadmap });
  } catch (err) {
    console.error('Roadmap update error:', err);
    res.status(500).json({ error: 'Could not update roadmap' });
  }
});

// DELETE /api/roadmaps/:id — delete a roadmap and its milestones
router.delete('/:id', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });

    const isCreator = String(roadmap.createdBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await Milestone.deleteMany({ roadmap: roadmap._id });
    await roadmap.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('Roadmap delete error:', err);
    res.status(500).json({ error: 'Could not delete roadmap' });
  }
});

// POST /api/roadmaps/:id/milestones — add a milestone to a roadmap
router.post('/:id/milestones', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });

    const isCreator = String(roadmap.createdBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { title, description = '', order = 0, dueDate } = req.body;
    const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
    if (!cleanTitle) return res.status(400).json({ error: 'Title is required' });

    let due;
    if (dueDate !== undefined && dueDate !== null && dueDate !== '') {
      due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) return res.status(400).json({ error: 'Invalid due date' });
    }

    const milestone = await Milestone.create({
      roadmap: roadmap._id,
      title: cleanTitle,
      description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
      order: Number(order) || 0,
      dueDate: due,
    });

    res.status(201).json({ milestone });
  } catch (err) {
    console.error('Milestone create error:', err);
    res.status(500).json({ error: 'Could not create milestone' });
  }
});

// PATCH /api/roadmaps/:id/milestones/:milestoneId — update a milestone
router.patch('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });

    const milestone = await Milestone.findOne({ _id: req.params.milestoneId, roadmap: roadmap._id });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    const isCreator = String(roadmap.createdBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    const isOwner = String(roadmap.user) === String(req.userId);
    if (!isCreator && !isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const { title, description, order, completed, dueDate } = req.body;
    if (title !== undefined) {
      const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 200) : '';
      if (!cleanTitle) return res.status(400).json({ error: 'Title cannot be empty' });
      milestone.title = cleanTitle;
    }
    if (description !== undefined) {
      milestone.description = typeof description === 'string' ? description.trim().slice(0, 2000) : '';
    }
    if (order !== undefined) {
      milestone.order = Number(order) || 0;
    }
    if (completed !== undefined) {
      milestone.completed = Boolean(completed);
      if (milestone.completed) {
        milestone.completedAt = new Date();
      } else {
        milestone.completedAt = null;
      }
    }
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        milestone.dueDate = null;
      } else {
        const parsed = new Date(dueDate);
        if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid due date' });
        milestone.dueDate = parsed;
      }
    }

    await milestone.save();
    res.json({ milestone });
  } catch (err) {
    console.error('Milestone update error:', err);
    res.status(500).json({ error: 'Could not update milestone' });
  }
});

// DELETE /api/roadmaps/:id/milestones/:milestoneId — delete a milestone
router.delete('/:id/milestones/:milestoneId', async (req, res) => {
  try {
    const roadmap = await Roadmap.findById(req.params.id);
    if (!roadmap) return res.status(404).json({ error: 'Roadmap not found' });

    const isCreator = String(roadmap.createdBy) === String(req.userId);
    const isAdmin = req.userRole === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const milestone = await Milestone.findOne({ _id: req.params.milestoneId, roadmap: roadmap._id });
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    await milestone.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('Milestone delete error:', err);
    res.status(500).json({ error: 'Could not delete milestone' });
  }
});

export default router;
