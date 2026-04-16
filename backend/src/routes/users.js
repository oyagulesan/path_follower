const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = Router();

router.use(authenticate, requireAdmin);

// List all users
router.get('/', async (req, res) => {
  const prisma = req.app.locals.prisma;
  const users = await prisma.user.findMany({
    select: { id: true, userId: true, name: true, lastName: true, telephone: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// Create user
router.post('/', async (req, res) => {
  const prisma = req.app.locals.prisma;
  const { userId, name, lastName, telephone, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { userId } });
  if (existing) {
    return res.status(400).json({ error: 'User ID already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { userId, name, lastName, telephone, password: hashedPassword, role: role || 'USER' },
    select: { id: true, userId: true, name: true, lastName: true, telephone: true, role: true },
  });
  res.status(201).json(user);
});

// Update user
router.put('/:id', async (req, res) => {
  const prisma = req.app.locals.prisma;
  const { userId, name, lastName, telephone, password, role } = req.body;

  const data = { userId, name, lastName, telephone, role };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, userId: true, name: true, lastName: true, telephone: true, role: true },
    });
    res.json(user);
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const prisma = req.app.locals.prisma;
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

module.exports = router;
