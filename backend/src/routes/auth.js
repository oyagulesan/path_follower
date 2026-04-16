const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.post('/login', async (req, res) => {
  const { userId, password } = req.body;
  const prisma = req.app.locals.prisma;

  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, userId: user.userId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      userId: user.userId,
      name: user.name,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

router.get('/me', authenticate, async (req, res) => {
  const prisma = req.app.locals.prisma;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, userId: true, name: true, lastName: true, telephone: true, role: true },
  });
  res.json(user);
});

module.exports = router;
