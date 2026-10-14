import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './rooms/roomManager.js';
import { registerSocketHandlers } from './sockets/socketHandlers.js';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;
const roomManager = new RoomManager();

// Session authentication middleware
io.use((socket, next) => {
  const sessionId = socket.handshake.auth?.sessionId;
  if (!sessionId) {
    return next(new Error('invalid session'));
  }
  (socket as any).sessionId = sessionId;
  next();
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket, roomManager);
});

// Cleanup inactive rooms every 5 minutes (threshold: 1 hour)
const INACTIVITY_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INACTIVITY_THRESHOLD_MS = 60 * 60 * 1000;

setInterval(() => {
  roomManager.cleanInactiveRooms(INACTIVITY_THRESHOLD_MS, (roomId) => {
    io.to(roomId).emit('error', 'Session closed due to 1 hour of inactivity.');
    io.to(roomId).emit('left_room', { roomId });
  });
}, INACTIVITY_CHECK_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export { app, server, io, roomManager };
