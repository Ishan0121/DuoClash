const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// In-memory store for rooms
// Room structure:
// {
//   roomId: string,
//   players: {
//     [socketId]: { id: socketId, word: string | null }
//   },
//   turn: socketId, // current turn
//   mode: 'automated' | 'call', // game mode
//   state: 'lobby' | 'locking' | 'playing' | 'ended'
// }
const rooms = {};
const sessions = {};

io.use((socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  if (!sessionId) {
    return next(new Error("invalid session"));
  }
  socket.sessionId = sessionId;
  next();
});

// Helper to generate a 6-digit alphanumeric code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Basic length validation (API check removed for flexibility/speed)
function validateWord(word) {
  return word.length >= 1 && word.length <= 12;
}

io.on('connection', (socket) => {
  socket.join(socket.sessionId);
  console.log('User connected:', socket.sessionId);

  // Auto-reconnect if session has a room
  if (sessions[socket.sessionId] && rooms[sessions[socket.sessionId]]) {
    const roomId = sessions[socket.sessionId];
    socket.join(roomId);
    broadcastGameState(roomId);
  }

  socket.on('create_room', () => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      roomId,
      hostId: socket.sessionId,
      settings: { greyOutUsed: true },
      players: {
        [socket.sessionId]: { id: socket.sessionId, word: null }
      },
      turn: null,
      mode: 'automated',
      state: 'lobby'
    };
    sessions[socket.sessionId] = roomId;
    socket.join(roomId);
    socket.emit('room_created', { roomId, playerId: socket.sessionId });
    console.log(`Room ${roomId} created by ${socket.sessionId}`);
  });

  socket.on('join_room', (roomId) => {
    const room = rooms[roomId];
    if (room && room.state === 'lobby') {
      const playerIds = Object.keys(room.players);
      if (playerIds.length < 2) {
        room.players[socket.sessionId] = { id: socket.sessionId, word: null };
        sessions[socket.sessionId] = roomId;
        socket.join(roomId);
        room.state = 'locking';
        broadcastGameState(roomId);
        console.log(`User ${socket.sessionId} joined room ${roomId}`);
      } else {
        socket.emit('error', 'Room is full');
      }
    } else {
      socket.emit('error', 'Room not found or already started');
    }
  });

  socket.on('lock_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room || (room.state !== 'locking' && room.state !== 'ready')) return;

    const isValid = validateWord(word);
    if (!isValid) {
      socket.emit('error', 'Invalid word');
      return;
    }

    room.players[socket.sessionId].word = word.toUpperCase();
    
    const playerIds = Object.keys(room.players);
    if (playerIds.length === 2 && room.players[playerIds[0]].word && room.players[playerIds[1]].word) {
      room.state = 'ready';
    }
    broadcastGameState(roomId);
  });

  socket.on('unlock_word', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || (room.state !== 'locking' && room.state !== 'ready')) return;
    
    room.players[socket.sessionId].word = null;
    room.state = 'locking';
    broadcastGameState(roomId);
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'ready' || room.hostId !== socket.sessionId) return;
    
    const playerIds = Object.keys(room.players);
    if (playerIds.length === 2 && room.players[playerIds[0]].word && room.players[playerIds[1]].word) {
      room.state = 'playing';
      room.turn = playerIds[Math.floor(Math.random() * 2)];
      broadcastGameState(roomId);
    }
  });

  socket.on('change_mode', ({ roomId, mode }) => {
    const room = rooms[roomId];
    if (room && room.state === 'playing') {
      room.mode = mode;
      broadcastGameState(roomId);
    }
  });

  socket.on('toggle_setting', ({ roomId, key }) => {
    const room = rooms[roomId];
    if (room && room.settings && typeof room.settings[key] !== 'undefined') {
      room.settings[key] = !room.settings[key];
      broadcastGameState(roomId);
    }
  });

  // Automated Mode Events
  socket.on('ask_letter', ({ roomId, letter }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.mode !== 'automated' || room.turn !== socket.sessionId) return;

    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    if (!opponentId) return;

    // Trigger lock on opponent's screen to verify letter count/positions
    io.to(opponentId).emit('verify_letter', { letter, askerId: socket.sessionId });
  });

  socket.on('verify_letter_response', ({ roomId, letter, count, positions }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing') return;
    if (!room.players[socket.sessionId]) return;

    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    const expectedWord = room.players[socket.sessionId].word;
    
    // Validate that count and positions match the actual word
    let actualPositions = [];
    for (let i = 0; i < expectedWord.length; i++) {
      if (expectedWord[i] === letter) actualPositions.push(i);
    }

    if (count === actualPositions.length && JSON.stringify(positions.sort()) === JSON.stringify(actualPositions.sort())) {
       // Valid response, inform the asker
       io.to(opponentId).emit('letter_result', { letter, count, positions });
       // Switch turn
       room.turn = socket.sessionId;
       broadcastGameState(roomId);
    } else {
       // Cheating/Mistake detected
       socket.emit('error', 'Mistake detected! Your response does not match your word. You lose your turn.');
       io.to(opponentId).emit('error', 'Opponent made a mistake verifying! They lose a turn, you go again.');
       
       // Inform the asker of the ACTUAL correct result so they aren't stuck
       io.to(opponentId).emit('letter_result', { letter, count: actualPositions.length, positions: actualPositions });
       
       // Turn stays with the asker (opponentId), effectively skipping the cheater's turn
       room.turn = opponentId;
       broadcastGameState(roomId);
    }
  });

  socket.on('solve_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.turn !== socket.sessionId) return;

    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    if (!opponentId) return;

    const opponentWord = room.players[opponentId].word;

    if (word.toUpperCase() === opponentWord) {
      room.state = 'ended';
      io.to(roomId).emit('game_over', { winnerId: socket.sessionId, word: opponentWord });
    } else {
      // Incorrect solve, skip next turn
      // Note: Skip logic can be complex if we only have 2 players, effectively they lose a turn, 
      // which means opponent goes twice. We can model this by emitting a 'turn_skipped' event
      io.to(roomId).emit('turn_skipped', { playerId: socket.sessionId });
      // Keep turn as opponent, they will effectively get 2 actions
      room.turn = opponentId;
      broadcastGameState(roomId);
    }
  });


  // Helper to send game state without leaking opponent's word
  function broadcastGameState(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const playerIds = Object.keys(room.players);
    playerIds.forEach(id => {
      const stateForPlayer = {
        roomId: room.roomId,
        turn: room.turn,
        mode: room.mode,
        settings: room.settings,
        state: room.state,
        me: { id: id, word: room.players[id].word, isHost: room.hostId === id },
        opponent: null
      };

      const opponentId = playerIds.find(pId => pId !== id);
      if (opponentId && room.players[opponentId]) {
        stateForPlayer.opponent = {
          id: opponentId,
          wordLength: room.players[opponentId].word ? room.players[opponentId].word.length : 0,
          isLocked: !!room.players[opponentId].word
        };
      }
      io.to(id).emit('game_state_update', stateForPlayer);
    });
  }


  socket.on('restart_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'ended') return;
    
    room.state = 'locking';
    room.turn = null;
    Object.keys(room.players).forEach(id => {
      room.players[id].word = null;
    });
    
    io.to(roomId).emit('game_restarted', { roomId });
    broadcastGameState(roomId);
  });

  socket.on('leave_room', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      delete sessions[socket.sessionId];
      socket.emit('left_room', { roomId });
      return;
    }
    
    delete room.players[socket.sessionId];
    delete sessions[socket.sessionId];
    socket.leave(roomId);
    
    const remainingPlayers = Object.keys(room.players);
    if (remainingPlayers.length === 0) {
      delete rooms[roomId];
    } else {
      if (room.hostId === socket.sessionId) {
        room.hostId = remainingPlayers[0];
      }
      room.state = 'lobby'; 
      broadcastGameState(roomId);
      io.to(roomId).emit('error', 'Opponent left the room.');
    }
    socket.emit('left_room', { roomId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.sessionId);
    // Cleanup rooms, handle disconnect
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
