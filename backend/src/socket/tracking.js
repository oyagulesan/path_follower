const jwt = require('jsonwebtoken');

function setupTracking(io, prisma) {
  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    // Fetch full user info for name/initials
    const fullUser = await prisma.user.findUnique({
      where: { id: socket.user.id },
      select: { id: true, userId: true, name: true, lastName: true, role: true },
    });
    if (fullUser) {
      socket.user = fullUser;
    }
    console.log(`User connected: ${socket.user.userId}`);

    // Join a task room to receive live updates
    socket.on('task:join', (taskId) => {
      socket.join(`task:${taskId}`);
    });

    socket.on('task:leave', (taskId) => {
      socket.leave(`task:${taskId}`);
    });

    // Start tracking
    socket.on('tracking:start', async ({ taskId }) => {
      try {
        const session = await prisma.trackingSession.create({
          data: { taskId, userId: socket.user.id },
        });
        socket.trackingSessionId = session.id;
        socket.trackingTaskId = taskId;
        socket.join(`task:${taskId}`);

        // Broadcast that this user started tracking
        io.to(`task:${taskId}`).emit('tracking:user-started', {
          sessionId: session.id,
          userId: socket.user.id,
          userName: socket.user.userId,
          name: socket.user.name,
          lastName: socket.user.lastName,
        });

        socket.emit('tracking:started', { sessionId: session.id });
      } catch (err) {
        socket.emit('tracking:error', { message: 'Failed to start tracking' });
      }
    });

    // Resume an existing active session (e.g. after page refresh)
    socket.on('tracking:resume', async ({ sessionId, taskId }) => {
      try {
        const session = await prisma.trackingSession.findFirst({
          where: {
            id: sessionId,
            userId: socket.user.id,
            endedAt: null,
          },
        });

        if (!session) {
          socket.emit('tracking:error', { message: 'No active session found' });
          return;
        }

        socket.trackingSessionId = session.id;
        socket.trackingTaskId = session.taskId;
        socket.join(`task:${session.taskId}`);

        // Broadcast that this user resumed tracking
        io.to(`task:${session.taskId}`).emit('tracking:user-started', {
          sessionId: session.id,
          userId: socket.user.id,
          userName: socket.user.userId,
          name: socket.user.name,
          lastName: socket.user.lastName,
        });

        socket.emit('tracking:resumed', { sessionId: session.id });
      } catch (err) {
        socket.emit('tracking:error', { message: 'Failed to resume tracking' });
      }
    });

    // Receive location update
    socket.on('tracking:location', async ({ lat, lng, insideArea }) => {
      if (!socket.trackingSessionId) return;

      try {
        // Only persist the point to the path if the user is inside the area
        if (insideArea !== false) {
          await prisma.locationPoint.create({
            data: {
              sessionId: socket.trackingSessionId,
              lat,
              lng,
            },
          });
        }

        // Always broadcast location so markers are visible
        io.to(`task:${socket.trackingTaskId}`).emit('tracking:location-update', {
          sessionId: socket.trackingSessionId,
          userId: socket.user.id,
          userName: socket.user.userId,
          name: socket.user.name,
          lastName: socket.user.lastName,
          lat,
          lng,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error('Failed to save location point:', err);
      }
    });

    // End tracking
    socket.on('tracking:end', async () => {
      if (!socket.trackingSessionId) return;

      try {
        await prisma.trackingSession.update({
          where: { id: socket.trackingSessionId },
          data: { endedAt: new Date() },
        });

        io.to(`task:${socket.trackingTaskId}`).emit('tracking:user-ended', {
          sessionId: socket.trackingSessionId,
          userId: socket.user.id,
        });

        socket.trackingSessionId = null;
        socket.trackingTaskId = null;
      } catch (err) {
        socket.emit('tracking:error', { message: 'Failed to end tracking' });
      }
    });

    // Do NOT auto-end tracking on disconnect — session persists in DB
    // so the user can resume after a page refresh or reconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.userId}`);
    });
  });
}

module.exports = setupTracking;
