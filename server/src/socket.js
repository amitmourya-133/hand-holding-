import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',')
        : ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.on('disconnect', () => {});
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitToUser(userId, event, data) {
  if (io && userId) io.to(`user:${String(userId)}`).emit(event, data);
}
