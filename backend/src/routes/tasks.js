const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = Router();

// All task routes require authentication
router.use(authenticate);

// Get all tasks (filtered by date window for non-admin)
router.get('/', async (req, res) => {
  const prisma = req.app.locals.prisma;
  const now = new Date();

  const where = req.user.role === 'ADMIN' ? {} : {
    startDate: { lte: now },
    endDate: { gte: now },
  };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignments: {
        include: { user: { select: { id: true, userId: true, name: true, lastName: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

// Get tasks assigned to current user
router.get('/mine', async (req, res) => {
  const prisma = req.app.locals.prisma;
  const now = new Date();

  const whereTask = req.user.role === 'ADMIN' ? {} : {
    startDate: { lte: now },
    endDate: { gte: now },
  };

  const tasks = await prisma.task.findMany({
    where: {
      ...whereTask,
      assignments: { some: { userId: req.user.id } },
    },
    include: {
      assignments: {
        include: { user: { select: { id: true, userId: true, name: true, lastName: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tasks);
});

// Get single task with paths
router.get('/:id', async (req, res) => {
  const prisma = req.app.locals.prisma;

  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignments: {
        include: { user: { select: { id: true, userId: true, name: true, lastName: true } } },
      },
      trackingSessions: {
        include: {
          user: { select: { id: true, userId: true, name: true, lastName: true } },
          points: { orderBy: { timestamp: 'asc' } },
        },
      },
    },
  });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// Get active tracking session for current user on a task
router.get('/:id/active-session', async (req, res) => {
  const prisma = req.app.locals.prisma;

  const session = await prisma.trackingSession.findFirst({
    where: {
      taskId: req.params.id,
      userId: req.user.id,
      endedAt: null,
    },
    include: {
      points: { orderBy: { timestamp: 'asc' } },
    },
  });
  res.json(session);
});

// Get recorded paths for a task
router.get('/:id/paths', async (req, res) => {
  const prisma = req.app.locals.prisma;

  const sessions = await prisma.trackingSession.findMany({
    where: { taskId: req.params.id },
    include: {
      user: { select: { id: true, userId: true, name: true, lastName: true } },
      points: { orderBy: { timestamp: 'asc' } },
    },
    orderBy: { startedAt: 'desc' },
  });
  res.json(sessions);
});

// Admin-only routes below
// Create task
router.post('/', requireAdmin, async (req, res) => {
  const prisma = req.app.locals.prisma;
  const { title, area, startDate, endDate } = req.body;

  const task = await prisma.task.create({
    data: {
      title,
      area,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });
  res.status(201).json(task);
});

// Update task
router.put('/:id', requireAdmin, async (req, res) => {
  const prisma = req.app.locals.prisma;
  const { title, area, startDate, endDate } = req.body;

  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        title,
        area,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    res.json(task);
  } catch {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Delete task
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Assign user to task
router.post('/:id/assignments', requireAdmin, async (req, res) => {
  const prisma = req.app.locals.prisma;
  const { userId } = req.body;

  try {
    const assignment = await prisma.taskAssignment.create({
      data: { taskId: req.params.id, userId },
      include: { user: { select: { id: true, userId: true, name: true, lastName: true } } },
    });
    res.status(201).json(assignment);
  } catch {
    res.status(400).json({ error: 'Assignment already exists or invalid IDs' });
  }
});

// Remove user from task
router.delete('/:id/assignments/:userId', requireAdmin, async (req, res) => {
  const prisma = req.app.locals.prisma;

  try {
    await prisma.taskAssignment.deleteMany({
      where: { taskId: req.params.id, userId: req.params.userId },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Assignment not found' });
  }
});

module.exports = router;
