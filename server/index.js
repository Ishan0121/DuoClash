const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

const rooms = {};
const sessions = {};
const disconnectTimeouts = {};
const turnTimeouts = {};

function clearTurnTimer(roomId) {
  if (turnTimeouts[roomId]) {
    clearTimeout(turnTimeouts[roomId]);
    delete turnTimeouts[roomId];
  }
}

function startTurnTimer(roomId) {
  clearTurnTimer(roomId);
  const room = rooms[roomId];
  if (!room || room.state !== 'playing' || !room.settings.timerEnabled) return;
  
  room.turnStartTime = Date.now();
  
  turnTimeouts[roomId] = setTimeout(() => {
    const r = rooms[roomId];
    if (!r || r.state !== 'playing') return;
    
    const currentTurn = r.turn;
    const opponentId = Object.keys(r.players).find(id => id !== currentTurn);
    if (!opponentId) return;
    
    r.turn = opponentId;
    io.to(roomId).emit('turn_skipped_timeout', { playerId: currentTurn });
    startTurnTimer(roomId);
    broadcastGameState(roomId);
  }, 60000);
}

io.use((socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  if (!sessionId) {
    return next(new Error("invalid session"));
  }
  socket.sessionId = sessionId;
  next();
});

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function validateWord(word) {
  return word && word.length >= 1 && word.length <= 12;
}

function broadcastGameState(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const playerIds = Object.keys(room.players);
  playerIds.forEach(id => {
    const stateForPlayer = {
      roomId: room.roomId,
      scores: room.scores,
      turn: room.turn,
      turnStartTime: room.turnStartTime,
      mode: room.mode,
      settings: room.settings,
      state: room.state,
      gameType: room.gameType,
      me: { 
        id: id, 
        word: room.players[id].word, 
        isHost: room.hostId === id,
        gameVote: room.players[id].gameVote,
        isPlanted: room.players[id].mines && room.players[id].mines.length > 0,
        revealed: room.players[id].revealed,
        mines: room.players[id].mines
      },
      opponent: null,
      actionLog: room.actionLog,
      dotsLines: room.dotsLines,
      dotsBoxes: room.dotsBoxes
    };

    const opponentId = playerIds.find(pId => pId !== id);
    if (opponentId && room.players[opponentId]) {
      stateForPlayer.opponent = {
        id: opponentId,
        wordLength: room.players[opponentId].word ? room.players[opponentId].word.length : 0,
        isLocked: !!room.players[opponentId].word,
        knownTiles: room.players[opponentId].knownTiles,
        gameVote: room.players[opponentId].gameVote,
        isPlanted: room.players[opponentId].mines && room.players[opponentId].mines.length > 0,
        revealed: room.players[opponentId].revealed
      };
    }
    io.to(id).emit('game_state_update', stateForPlayer);
  });
}

io.on('connection', (socket) => {
  socket.join(socket.sessionId);
  
  if (!global.activeSockets) global.activeSockets = {};
  global.activeSockets[socket.sessionId] = socket.id;

  if (disconnectTimeouts[socket.sessionId]) {
    clearTimeout(disconnectTimeouts[socket.sessionId]);
    delete disconnectTimeouts[socket.sessionId];
  }

  if (sessions[socket.sessionId] && rooms[sessions[socket.sessionId]]) {
    const roomId = sessions[socket.sessionId];
    socket.join(roomId);
    broadcastGameState(roomId);
  }

  socket.use(([event, ...args], next) => {
    const roomId = sessions[socket.sessionId];
    if (roomId && rooms[roomId]) {
      rooms[roomId].lastActivity = Date.now();
    }
    next();
  });

  socket.on('create_room', () => {
    const roomId = generateRoomCode();
    rooms[roomId] = {
      roomId,
      hostId: socket.sessionId,
      lastActivity: Date.now(),
      scores: { [socket.sessionId]: 0 },
      settings: { 
        greyOutUsed: true, timerEnabled: false, showOpponentProgress: true,
        mineGridSize: 5, mineTreasureCount: 3, mineBombCount: 1, dotsGridSize: 5
      },
      players: {
        [socket.sessionId]: { id: socket.sessionId, word: null, knownTiles: [], gameVote: null, mines: [], revealed: [] }
      },
      turn: null,
      mode: 'automated',
      state: 'lobby',
      gameType: null, // 'word' or 'mine'
      actionLog: []
    };
    sessions[socket.sessionId] = roomId;
    socket.join(roomId);
    socket.emit('room_created', { roomId, playerId: socket.sessionId });
  });

  socket.on('join_room', (roomId) => {
    const room = rooms[roomId];
    if (room && room.state === 'lobby') {
      const playerIds = Object.keys(room.players);
      if (playerIds.length < 2) {
        room.players[socket.sessionId] = { id: socket.sessionId, word: null, knownTiles: [], gameVote: null, mines: [], revealed: [] };
        room.scores[socket.sessionId] = 0;
        sessions[socket.sessionId] = roomId;
        socket.join(roomId);
        room.state = 'selecting_game';
        broadcastGameState(roomId);
      } else {
        socket.emit('error', 'Room is full');
      }
    } else {
      socket.emit('error', 'Room not found or already started');
    }
  });

  socket.on('vote_game', ({ roomId, gameVote }) => {
    const room = rooms[roomId];
    if (!room || (room.state !== 'selecting_game' && room.state !== 'selecting_game_conflict')) return;
    
    room.players[socket.sessionId].gameVote = gameVote;
    
    const pIds = Object.keys(room.players);
    if (pIds.length === 2) {
      const v1 = room.players[pIds[0]].gameVote;
      const v2 = room.players[pIds[1]].gameVote;
      if (v1 && v2) {
        if (v1 === v2) {
          room.gameType = v1;
          room.state = v1 === 'word' ? 'locking' : (v1 === 'mine' ? 'planting' : 'ready');
          if (v1 === 'dots') {
            room.dotsLines = [];
            room.dotsBoxes = {};
          }
        } else {
          room.state = 'selecting_game_conflict';
        }
      }
    }
    broadcastGameState(roomId);
  });

  // WORD DEDUCTION
  socket.on('lock_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room || (room.state !== 'locking' && room.state !== 'ready')) return;
    if (!validateWord(word)) return socket.emit('error', 'Invalid word');

    room.players[socket.sessionId].word = word.toUpperCase();
    
    const pIds = Object.keys(room.players);
    if (pIds.length === 2 && room.players[pIds[0]].word && room.players[pIds[1]].word) {
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

  // MINE GAME
  socket.on('plant_mines', ({ roomId, mines }) => {
    const room = rooms[roomId];
    if (!room || (room.state !== 'planting' && room.state !== 'ready')) return;
    
    // mines is an array of objects: { index: number, type: 'treasure' | 'bomb' }
    room.players[socket.sessionId].mines = mines;
    
    const pIds = Object.keys(room.players);
    if (pIds.length === 2 && room.players[pIds[0]].mines.length > 0 && room.players[pIds[1]].mines.length > 0) {
      room.state = 'ready';
    }
    broadcastGameState(roomId);
  });

  socket.on('replant_mines', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || (room.state !== 'planting' && room.state !== 'ready')) return;
    room.players[socket.sessionId].mines = [];
    room.state = 'planting';
    broadcastGameState(roomId);
  });

  socket.on('open_block', ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.turn !== socket.sessionId || room.gameType !== 'mine') return;
    
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    const opponentMines = room.players[opponentId].mines;
    const myRevealed = room.players[socket.sessionId].revealed || [];
    
    if (myRevealed.find(r => r.index === index)) return; // already revealed
    
    const mineAtBlock = opponentMines.find(m => m.index === index);
    const type = mineAtBlock ? mineAtBlock.type : 'empty';
    
    myRevealed.push({ index, type });
    room.players[socket.sessionId].revealed = myRevealed;

    const row = Math.floor(index / room.settings.mineGridSize);
    const col = index % room.settings.mineGridSize;
    
    // Check win condition
    const totalOpponentTreasures = opponentMines.filter(m => m.type === 'treasure').length;
    const myFoundTreasures = myRevealed.filter(r => r.type === 'treasure').length;
    
    if (myFoundTreasures === totalOpponentTreasures) {
      room.scores[socket.sessionId] = (room.scores[socket.sessionId] || 0) + 1;
      room.actionLog.push({ text: `Player ${socket.sessionId.substring(0,4)} found the last treasure and won!`, timestamp: Date.now() });
      room.state = 'ended';
      clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', {
        winnerId: socket.sessionId,
        reason: 'found_all_treasures'
      });
    } else if (type === 'bomb') {
      // Hit a bomb -> penalty! (lose turn)
      room.actionLog.push({ text: `Player ${socket.sessionId.substring(0,4)} hit a bomb at (${row}, ${col})!`, timestamp: Date.now() });
      io.to(roomId).emit('turn_skipped', { playerId: socket.sessionId, reason: 'Hit a bomb!' });
      room.turn = opponentId; // skip their turn
      startTurnTimer(roomId);
    } else {
      // Normal turn switch
      room.actionLog.push({ text: `Player ${socket.sessionId.substring(0,4)} opened (${row}, ${col}) and found ${type}.`, timestamp: Date.now() });
      room.turn = opponentId;
      startTurnTimer(roomId);
    }
    broadcastGameState(roomId);
  });

  // DOTS AND BOXES
  socket.on('draw_line', ({ roomId, lineId }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.turn !== socket.sessionId || room.gameType !== 'dots') return;
    
    if (room.dotsLines.includes(lineId)) return;
    
    room.dotsLines.push(lineId);
    
    let boxesCompleted = 0;
    const parts = lineId.split('-');
    const type = parts[0];
    const r = parseInt(parts[1]);
    const c = parseInt(parts[2]);
    
    const checkAndClaimBox = (br, bc) => {
      if (br < 0 || bc < 0 || br >= room.settings.dotsGridSize || bc >= room.settings.dotsGridSize) return 0;
      const boxId = `${br}-${bc}`;
      if (room.dotsBoxes[boxId]) return 0;
      
      const top = room.dotsLines.includes(`h-${br}-${bc}`);
      const bottom = room.dotsLines.includes(`h-${br+1}-${bc}`);
      const left = room.dotsLines.includes(`v-${br}-${bc}`);
      const right = room.dotsLines.includes(`v-${br}-${bc+1}`);
      
      if (top && bottom && left && right) {
        room.dotsBoxes[boxId] = socket.sessionId;
        return 1;
      }
      return 0;
    };
    
    if (type === 'h') {
      boxesCompleted += checkAndClaimBox(r - 1, c);
      boxesCompleted += checkAndClaimBox(r, c);
    } else {
      boxesCompleted += checkAndClaimBox(r, c - 1);
      boxesCompleted += checkAndClaimBox(r, c);
    }
    
    if (boxesCompleted > 0) {
      room.actionLog.push({ text: `Player ${socket.sessionId.substring(0,4)} completed a box!`, timestamp: Date.now() });
      startTurnTimer(roomId);
      
      const totalBoxes = room.settings.dotsGridSize * room.settings.dotsGridSize;
      if (Object.keys(room.dotsBoxes).length === totalBoxes) {
        room.state = 'ended';
        clearTurnTimer(roomId);
        
        const pIds = Object.keys(room.players);
        let s1 = 0;
        let s2 = 0;
        Object.values(room.dotsBoxes).forEach(ownerId => {
          if (ownerId === pIds[0]) s1++;
          else if (ownerId === pIds[1]) s2++;
        });
        
        let winnerId = null;
        if (s1 > s2) {
          winnerId = pIds[0];
          room.scores[pIds[0]] = (room.scores[pIds[0]] || 0) + 1;
        } else if (s2 > s1) {
          winnerId = pIds[1];
          room.scores[pIds[1]] = (room.scores[pIds[1]] || 0) + 1;
        }
        
        io.to(roomId).emit('game_over', {
          winnerId: winnerId || 'draw',
          reason: 'all_boxes_claimed'
        });
      }
    } else {
      room.actionLog.push({ text: `Player ${socket.sessionId.substring(0,4)} drew a line.`, timestamp: Date.now() });
      const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
      room.turn = opponentId;
      startTurnTimer(roomId);
    }
    
    broadcastGameState(roomId);
  });

  // GENERAL
  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'ready' || room.hostId !== socket.sessionId) return;
    
    room.state = 'playing';
    const pIds = Object.keys(room.players);
    room.turn = pIds[Math.floor(Math.random() * 2)];
    startTurnTimer(roomId);
    broadcastGameState(roomId);
  });

  socket.on('change_mode', ({ roomId, mode }) => {
    const room = rooms[roomId];
    if (room && room.state === 'playing' && room.gameType === 'word') {
      room.mode = mode;
      broadcastGameState(roomId);
    }
  });

  socket.on('toggle_setting', ({ roomId, key, value }) => {
    const room = rooms[roomId];
    if (room && room.settings) {
      room.settings[key] = value !== undefined ? value : !room.settings[key];
      
      if (key === 'timerEnabled' && room.state === 'playing') {
        if (room.settings.timerEnabled) startTurnTimer(roomId);
        else clearTurnTimer(roomId);
      }

      broadcastGameState(roomId);
    }
  });

  socket.on('send_hint', ({ roomId, hint }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing') return;
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    if (opponentId) {
      io.to(opponentId).emit('receive_hint', { hint });
    }
  });

  // New visual hint logic for Mine game
  socket.on('visual_hint', ({ roomId, index, type }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.gameType !== 'mine') return;
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    if (opponentId) {
      const row = Math.floor(index / room.settings.mineGridSize);
      const col = index % room.settings.mineGridSize;
      room.actionLog.push({ text: `Player ${socket.sessionId.substring(0,4)} hinted a ${type} at (${row}, ${col}).`, timestamp: Date.now() });
      io.to(opponentId).emit('receive_visual_hint', { index, type }); // type = 'treasure' or 'bomb'
      broadcastGameState(roomId);
    }
  });

  socket.on('update_progress', ({ roomId, knownTiles }) => {
    const room = rooms[roomId];
    if (room && room.players[socket.sessionId]) {
      room.players[socket.sessionId].knownTiles = knownTiles;
      broadcastGameState(roomId);
    }
  });

  // WORD DEDUCTION - AUTOMATED MODE
  socket.on('ask_letter', ({ roomId, letter }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.mode !== 'automated' || room.turn !== socket.sessionId) return;
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    if (opponentId) io.to(opponentId).emit('verify_letter', { letter, askerId: socket.sessionId });
  });

  socket.on('verify_letter_response', ({ roomId, letter, count, positions }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing') return;
    
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    const expectedWord = room.players[socket.sessionId].word;
    
    let actualPositions = [];
    for (let i = 0; i < expectedWord.length; i++) {
      if (expectedWord[i] === letter) actualPositions.push(i);
    }

    if (count === actualPositions.length && JSON.stringify(positions.sort()) === JSON.stringify(actualPositions.sort())) {
       io.to(opponentId).emit('letter_result', { letter, count, positions });
       room.turn = socket.sessionId;
       startTurnTimer(roomId);
       broadcastGameState(roomId);
    } else {
       socket.emit('error', 'Mistake detected! Your response does not match your word. You lose your turn.');
       io.to(opponentId).emit('error', 'Opponent made a mistake verifying! They lose a turn, you go again.');
       io.to(opponentId).emit('letter_result', { letter, count: actualPositions.length, positions: actualPositions });
       room.turn = opponentId;
       startTurnTimer(roomId);
       broadcastGameState(roomId);
    }
  });

  socket.on('solve_word', ({ roomId, word }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'playing' || room.turn !== socket.sessionId || room.gameType !== 'word') return;
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    
    if (word.toUpperCase() === room.players[opponentId].word) {
      room.scores[socket.sessionId] = (room.scores[socket.sessionId] || 0) + 1;
      room.state = 'ended';
      clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', { 
        winnerId: socket.sessionId, 
        winnerWord: room.players[socket.sessionId].word,
        loserWord: room.players[opponentId].word 
      });
    } else {
      io.to(roomId).emit('turn_skipped', { playerId: socket.sessionId, reason: 'Incorrect solve!' });
      room.turn = opponentId;
      startTurnTimer(roomId);
      broadcastGameState(roomId);
    }
  });

  socket.on('restart_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.state !== 'ended') return;
    
    room.state = 'selecting_game';
    room.gameType = null;
    room.dotsLines = [];
    room.dotsBoxes = {};
    room.turn = null;
    room.turnStartTime = null;
    room.actionLog = [];
    Object.keys(room.players).forEach(id => {
      room.players[id].word = null;
      room.players[id].knownTiles = [];
      room.players[id].gameVote = null;
      room.players[id].mines = [];
      room.players[id].revealed = [];
    });
    
    io.to(roomId).emit('game_restarted', { roomId });
    broadcastGameState(roomId);
  });

  socket.on('request_change_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.changeGameRequest) return; // already pending
    
    room.changeGameRequest = { requesterId: socket.sessionId };
    
    const opponentId = Object.keys(room.players).find(id => id !== socket.sessionId);
    // Notify the requester they're waiting
    io.to(socket.sessionId).emit('change_game_waiting');
    // Notify the opponent to confirm
    if (opponentId) {
      io.to(opponentId).emit('change_game_confirm_request', { requesterId: socket.sessionId });
    }
  });

  socket.on('respond_change_game', ({ roomId, accepted }) => {
    const room = rooms[roomId];
    if (!room || !room.changeGameRequest) return;
    
    // Only the non-requester can respond
    if (socket.sessionId === room.changeGameRequest.requesterId) return;
    
    if (accepted) {
      // Both agreed — proceed with game change
      room.state = 'selecting_game';
      room.gameType = null;
      room.turn = null;
      room.turnStartTime = null;
      room.actionLog = [];
      delete room.changeGameRequest;
      Object.keys(room.players).forEach(id => {
        room.players[id].word = null;
        room.players[id].knownTiles = [];
        room.players[id].gameVote = null;
        room.players[id].mines = [];
        room.players[id].revealed = [];
      });
      
      clearTurnTimer(roomId);
      io.to(roomId).emit('change_game_resolved', { accepted: true });
      io.to(roomId).emit('game_restarted', { roomId });
      broadcastGameState(roomId);
    } else {
      // Opponent declined
      delete room.changeGameRequest;
      io.to(roomId).emit('change_game_resolved', { accepted: false });
    }
  });

  socket.on('cancel_change_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.changeGameRequest) return;
    if (socket.sessionId !== room.changeGameRequest.requesterId) return;
    
    delete room.changeGameRequest;
    io.to(roomId).emit('change_game_resolved', { accepted: false, cancelled: true });
  });

  socket.on('leave_room', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      delete sessions[socket.sessionId];
      socket.emit('left_room', { roomId });
      return;
    }
    
    clearTurnTimer(roomId);
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
    if (global.activeSockets && global.activeSockets[socket.sessionId] !== socket.id) return;

    disconnectTimeouts[socket.sessionId] = setTimeout(() => {
      const roomId = sessions[socket.sessionId];
      if (roomId) {
        const room = rooms[roomId];
        if (room) {
          clearTurnTimer(roomId);
          delete room.players[socket.sessionId];
          delete sessions[socket.sessionId];
          
          const remainingPlayers = Object.keys(room.players);
          if (remainingPlayers.length === 0) {
            delete rooms[roomId];
          } else {
            if (room.hostId === socket.sessionId) {
              room.hostId = remainingPlayers[0];
            }
            room.state = 'lobby'; 
            broadcastGameState(roomId);
            io.to(roomId).emit('error', 'Opponent disconnected.');
          }
        }
      }
    }, 30000);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room && room.lastActivity && now - room.lastActivity > 60 * 60 * 1000) { // 1 hour
      clearTurnTimer(roomId);
      io.to(roomId).emit('error', 'Session closed due to 1 hour of inactivity.');
      io.to(roomId).emit('left_room', { roomId });
      delete rooms[roomId];
      for (const socketId in sessions) {
        if (sessions[socketId] === roomId) delete sessions[socketId];
      }
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
