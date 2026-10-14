import { Server, Socket } from 'socket.io';
import { RoomManager } from '../rooms/roomManager.js';
import {
  VoteGameSchema,
  LockWordSchema,
  PlantMinesSchema,
  OpenBlockSchema,
  DrawLineSchema,
  TicTacToeMoveSchema,
  ConnectFourMoveSchema,
  AskLetterSchema,
  VerifyLetterResponseSchema,
  SolveWordSchema,
  ChangeModeSchema,
  ToggleSettingSchema,
  SendHintSchema,
  VisualHintSchema,
  UpdateProgressSchema,
  RespondChangeGameSchema,
} from '../validation/schemas.js';
import {
  validateWord,
  verifyLetterResponse,
  isCorrectSolve,
} from '../games/wordDeduction.js';
import { openBlock } from '../games/minefield.js';
import { drawLineAndClaimBoxes, checkDotsGameOver } from '../games/dotsAndBoxes.js';
import { makeTicTacToeMove } from '../games/ticTacToe.js';
import { makeConnectFourMove } from '../games/connectFour.js';

export function broadcastGameState(io: Server, roomManager: RoomManager, roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  const playerIds = Object.keys(room.players);
  playerIds.forEach((id) => {
    const stateForPlayer = roomManager.buildClientGameState(room, id);
    io.to(id).emit('game_state_update', stateForPlayer);
  });
}

export function startRoomTurnTimer(io: Server, roomManager: RoomManager, roomId: string) {
  roomManager.startTurnTimer(roomId, (currentTurn) => {
    io.to(roomId).emit('turn_skipped_timeout', { playerId: currentTurn });
    startRoomTurnTimer(io, roomManager, roomId);
    broadcastGameState(io, roomManager, roomId);
  });
}

export function registerSocketHandlers(
  io: Server,
  socket: Socket & { sessionId?: string },
  roomManager: RoomManager
) {
  const sessionId = socket.sessionId;
  if (!sessionId) return;

  socket.join(sessionId);
  roomManager.registerSocket(sessionId, socket.id);

  // Re-join existing room if previously connected
  const existingRoomId = roomManager.getRoomIdForSession(sessionId);
  if (existingRoomId && roomManager.getRoom(existingRoomId)) {
    socket.join(existingRoomId);
    broadcastGameState(io, roomManager, existingRoomId);
  }

  // Update activity timestamp on any message
  socket.use(([_, ...__], next) => {
    roomManager.recordActivity(sessionId);
    next();
  });

  // --- ROOM MANAGEMENT ---

  socket.on('create_room', () => {
    const room = roomManager.createRoom(sessionId);
    socket.join(room.roomId);
    socket.emit('room_created', { roomId: room.roomId, playerId: sessionId });
  });

  socket.on('join_room', (data: string | { roomId: string }) => {
    const roomId = typeof data === 'string' ? data : data?.roomId;
    if (!roomId) {
      socket.emit('error', 'Room not found or already started');
      return;
    }

    const result = roomManager.joinRoom(roomId, sessionId);
    if (!result.success || !result.room) {
      socket.emit('error', result.error || 'Failed to join room');
      return;
    }

    socket.join(roomId);
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('vote_game', (raw) => {
    const parsed = VoteGameSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, gameVote } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || (room.state !== 'selecting_game' && room.state !== 'selecting_game_conflict')) return;

    if (!room.players[sessionId]) return;
    room.players[sessionId].gameVote = gameVote;

    const pIds = Object.keys(room.players);
    if (pIds.length === 2) {
      const v1 = room.players[pIds[0]].gameVote;
      const v2 = room.players[pIds[1]].gameVote;
      if (v1 && v2) {
        if (v1 === v2) {
          room.gameType = v1;
          room.state = v1 === 'word' ? 'locking' : v1 === 'mine' ? 'planting' : 'ready';
          if (v1 === 'dots') {
            room.dotsLines = [];
            room.dotsBoxes = {};
          }
          if (v1 === 'tictactoe') {
            room.tictactoeBoard = Array(9).fill(null);
          }
          if (v1 === 'connectfour') {
            room.connectfourBoard = Array(42).fill(null);
          }
        } else {
          room.state = 'selecting_game_conflict';
        }
      }
    }

    broadcastGameState(io, roomManager, roomId);
  });

  // --- WORD DEDUCTION ---

  socket.on('lock_word', (raw) => {
    const parsed = LockWordSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, word } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || (room.state !== 'locking' && room.state !== 'ready')) return;
    if (!validateWord(word)) {
      socket.emit('error', 'Invalid word');
      return;
    }

    room.players[sessionId].word = word.toUpperCase();

    const pIds = Object.keys(room.players);
    if (pIds.length === 2 && room.players[pIds[0]].word && room.players[pIds[1]].word) {
      room.state = 'ready';
    }
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('unlock_word', ({ roomId }: { roomId: string }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || (room.state !== 'locking' && room.state !== 'ready')) return;
    if (room.players[sessionId]) {
      room.players[sessionId].word = null;
    }
    room.state = 'locking';
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('ask_letter', (raw) => {
    const parsed = AskLetterSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, letter } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.mode !== 'automated' || room.turn !== sessionId) return;

    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
    if (opponentId) {
      io.to(opponentId).emit('verify_letter', { letter: letter.toUpperCase(), askerId: sessionId });
    }
  });

  socket.on('verify_letter_response', (raw) => {
    const parsed = VerifyLetterResponseSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, letter, count, positions } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing') return;

    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
    const expectedWord = room.players[sessionId]?.word;
    if (!expectedWord || !opponentId) return;

    const verification = verifyLetterResponse(expectedWord, letter, count, positions);

    if (verification.isCorrect) {
      io.to(opponentId).emit('letter_result', { letter, count, positions });
      room.turn = sessionId;
      startRoomTurnTimer(io, roomManager, roomId);
      broadcastGameState(io, roomManager, roomId);
    } else {
      socket.emit('error', 'Mistake detected! Your response does not match your word. You lose your turn.');
      io.to(opponentId).emit('error', 'Opponent made a mistake verifying! They lose a turn, you go again.');
      io.to(opponentId).emit('letter_result', {
        letter,
        count: verification.actualPositions.length,
        positions: verification.actualPositions,
      });
      room.turn = opponentId;
      startRoomTurnTimer(io, roomManager, roomId);
      broadcastGameState(io, roomManager, roomId);
    }
  });

  socket.on('solve_word', (raw) => {
    const parsed = SolveWordSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, word } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.turn !== sessionId || room.gameType !== 'word') return;

    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
    if (!opponentId) return;

    const opponentWord = room.players[opponentId]?.word || '';

    if (isCorrectSolve(word, opponentWord)) {
      room.scores[sessionId] = (room.scores[sessionId] || 0) + 1;
      room.state = 'ended';
      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', {
        winnerId: sessionId,
        winnerWord: room.players[sessionId]?.word,
        loserWord: opponentWord,
      });
    } else {
      io.to(roomId).emit('turn_skipped', { playerId: sessionId, reason: 'Incorrect solve!' });
      room.turn = opponentId;
      startRoomTurnTimer(io, roomManager, roomId);
      broadcastGameState(io, roomManager, roomId);
    }
  });

  // --- MINEFIELD ---

  socket.on('plant_mines', (raw) => {
    const parsed = PlantMinesSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, mines } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || (room.state !== 'planting' && room.state !== 'ready')) return;

    if (room.players[sessionId]) {
      room.players[sessionId].mines = mines;
    }

    const pIds = Object.keys(room.players);
    if (pIds.length === 2 && room.players[pIds[0]].mines.length > 0 && room.players[pIds[1]].mines.length > 0) {
      room.state = 'ready';
    }
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('replant_mines', ({ roomId }: { roomId: string }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || (room.state !== 'planting' && room.state !== 'ready')) return;

    if (room.players[sessionId]) {
      room.players[sessionId].mines = [];
    }
    room.state = 'planting';
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('open_block', (raw) => {
    const parsed = OpenBlockSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, index } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.turn !== sessionId || room.gameType !== 'mine') return;

    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
    if (!opponentId) return;

    const opponentMines = room.players[opponentId].mines || [];
    const myRevealed = room.players[sessionId].revealed || [];

    const result = openBlock(opponentMines, myRevealed, index, room.settings.mineGridSize);
    if (result.alreadyRevealed || !result.newRevealed) return;

    room.players[sessionId].revealed = result.newRevealed;
    const row = result.row ?? Math.floor(index / room.settings.mineGridSize);
    const col = result.col ?? (index % room.settings.mineGridSize);

    if (result.isWin) {
      room.scores[sessionId] = (room.scores[sessionId] || 0) + 1;
      room.actionLog.push({ playerId: sessionId, text: 'found the last treasure and won!', timestamp: Date.now() });
      room.state = 'ended';
      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', {
        winnerId: sessionId,
        reason: 'found_all_treasures',
      });
    } else if (result.isBomb) {
      room.actionLog.push({ playerId: sessionId, text: `hit a bomb at (${row}, ${col})!`, timestamp: Date.now() });
      room.players[opponentId].extraTurns = (room.players[opponentId].extraTurns || 0) + 1;
      io.to(sessionId).emit('turn_skipped', {
        playerId: sessionId,
        reason: 'You hit a bomb, you cannot move! Opponent gets two hits.',
      });
      io.to(opponentId).emit('turn_skipped', {
        playerId: sessionId,
        reason: 'hit a bomb! You get two hits.',
      });
      room.turn = opponentId;
      startRoomTurnTimer(io, roomManager, roomId);
    } else {
      room.actionLog.push({
        playerId: sessionId,
        text: `opened (${row}, ${col}) and found ${result.type}.`,
        timestamp: Date.now(),
      });
      if (room.players[sessionId].extraTurns && room.players[sessionId].extraTurns > 0) {
        room.players[sessionId].extraTurns -= 1;
        io.to(roomId).emit('extra_turn', { playerId: sessionId });
      } else {
        room.turn = opponentId;
      }
      startRoomTurnTimer(io, roomManager, roomId);
    }

    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('visual_hint', (raw) => {
    const parsed = VisualHintSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, index, type } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.gameType !== 'mine') return;

    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
    if (opponentId) {
      const row = Math.floor(index / room.settings.mineGridSize);
      const col = index % room.settings.mineGridSize;
      room.actionLog.push({
        playerId: sessionId,
        text: `hinted a ${type} at (${row}, ${col}).`,
        timestamp: Date.now(),
      });
      io.to(opponentId).emit('receive_visual_hint', { index, type });
      broadcastGameState(io, roomManager, roomId);
    }
  });

  // --- DOTS AND BOXES ---

  socket.on('draw_line', (raw) => {
    const parsed = DrawLineSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, lineId } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.turn !== sessionId || room.gameType !== 'dots') return;

    const result = drawLineAndClaimBoxes(
      room.dotsLines,
      room.dotsBoxes,
      lineId,
      room.settings.dotsGridSize,
      sessionId
    );

    if (result.alreadyDrawn) return;

    room.dotsLines = result.newLines;
    room.dotsBoxes = result.newBoxes;

    if (result.boxesCompleted > 0) {
      room.actionLog.push({ playerId: sessionId, text: 'completed a box!', timestamp: Date.now() });
      startRoomTurnTimer(io, roomManager, roomId);

      const pIds = Object.keys(room.players);
      const gameOver = checkDotsGameOver(room.dotsBoxes, room.settings.dotsGridSize, pIds);

      if (gameOver.isOver) {
        room.state = 'ended';
        roomManager.clearTurnTimer(roomId);

        if (gameOver.winnerId && gameOver.winnerId !== 'draw') {
          room.scores[gameOver.winnerId] = (room.scores[gameOver.winnerId] || 0) + 1;
        }

        io.to(roomId).emit('game_over', {
          winnerId: gameOver.winnerId || 'draw',
          reason: 'all_boxes_claimed',
        });
      }
    } else {
      room.actionLog.push({ playerId: sessionId, text: 'drew a line.', timestamp: Date.now() });
      const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
      room.turn = opponentId || null;
      startRoomTurnTimer(io, roomManager, roomId);
    }

    broadcastGameState(io, roomManager, roomId);
  });

  // --- TIC-TAC-TOE ---

  socket.on('tictactoe_move', (raw) => {
    const parsed = TicTacToeMoveSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, index } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.turn !== sessionId || room.gameType !== 'tictactoe') return;

    const result = makeTicTacToeMove(room.tictactoeBoard, index, sessionId);
    if (!result.valid) return;

    room.tictactoeBoard = result.newBoard;
    room.actionLog.push({ playerId: sessionId, text: 'placed a mark.', timestamp: Date.now() });

    if (result.isWin) {
      room.scores[sessionId] = (room.scores[sessionId] || 0) + 1;
      room.state = 'ended';
      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', {
        winnerId: sessionId,
        reason: 'tictactoe_win',
      });
    } else if (result.isDraw) {
      room.state = 'ended';
      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', {
        winnerId: 'draw',
        reason: 'tictactoe_draw',
      });
    } else {
      const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
      room.turn = opponentId || null;
      startRoomTurnTimer(io, roomManager, roomId);
    }

    broadcastGameState(io, roomManager, roomId);
  });

  // --- CONNECT FOUR ---

  socket.on('cf_drop_piece', (raw) => {
    const parsed = ConnectFourMoveSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, column } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing' || room.turn !== sessionId || room.gameType !== 'connectfour') return;

    const result = makeConnectFourMove(room.connectfourBoard, column, sessionId);
    if (!result.valid) return;

    room.connectfourBoard = result.newBoard;
    room.actionLog.push({ playerId: sessionId, text: 'dropped a piece.', timestamp: Date.now() });

    if (result.isWin) {
      room.scores[sessionId] = (room.scores[sessionId] || 0) + 1;
      room.state = 'ended';
      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', { winnerId: sessionId, reason: 'connectfour_win' });
    } else if (result.isDraw) {
      room.state = 'ended';
      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('game_over', { winnerId: 'draw', reason: 'connectfour_draw' });
    } else {
      room.turn = Object.keys(room.players).find((id) => id !== sessionId) || null;
      startRoomTurnTimer(io, roomManager, roomId);
    }

    broadcastGameState(io, roomManager, roomId);
  });

  // --- GENERAL CONTROLS ---

  socket.on('start_game', ({ roomId }: { roomId: string }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'ready' || room.hostId !== sessionId) return;

    room.state = 'playing';
    const pIds = Object.keys(room.players);
    room.turn = pIds[Math.floor(Math.random() * 2)];
    startRoomTurnTimer(io, roomManager, roomId);
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('change_mode', (raw) => {
    const parsed = ChangeModeSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, mode } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (room && room.state === 'playing' && room.gameType === 'word') {
      room.mode = mode;
      broadcastGameState(io, roomManager, roomId);
    }
  });

  socket.on('toggle_setting', (raw) => {
    const parsed = ToggleSettingSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, key, value } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (room && room.settings) {
      room.settings[key] = value !== undefined ? value : !room.settings[key];

      if (key === 'timerEnabled' && room.state === 'playing') {
        if (room.settings.timerEnabled) {
          startRoomTurnTimer(io, roomManager, roomId);
        } else {
          roomManager.clearTurnTimer(roomId);
        }
      }

      broadcastGameState(io, roomManager, roomId);
    }
  });

  socket.on('send_hint', (raw) => {
    const parsed = SendHintSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, hint } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'playing') return;

    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);
    if (opponentId) {
      io.to(opponentId).emit('receive_hint', { hint });
    }
  });

  socket.on('update_progress', (raw) => {
    const parsed = UpdateProgressSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, knownTiles } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (room && room.players[sessionId]) {
      room.players[sessionId].knownTiles = knownTiles;
      broadcastGameState(io, roomManager, roomId);
    }
  });

  socket.on('restart_game', ({ roomId }: { roomId: string }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.state !== 'ended') return;

    roomManager.resetGame(room);
    io.to(roomId).emit('game_restarted', { roomId });
    broadcastGameState(io, roomManager, roomId);
  });

  socket.on('request_change_game', ({ roomId }: { roomId: string }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.changeGameRequest) return;

    room.changeGameRequest = { requesterId: sessionId };
    const opponentId = Object.keys(room.players).find((id) => id !== sessionId);

    io.to(sessionId).emit('change_game_waiting');
    if (opponentId) {
      io.to(opponentId).emit('change_game_confirm_request', { requesterId: sessionId });
    }
  });

  socket.on('respond_change_game', (raw) => {
    const parsed = RespondChangeGameSchema.safeParse(raw);
    if (!parsed.success) return;

    const { roomId, accepted } = parsed.data;
    const room = roomManager.getRoom(roomId);
    if (!room || !room.changeGameRequest) return;

    if (sessionId === room.changeGameRequest.requesterId) return;

    if (accepted) {
      room.state = 'selecting_game';
      room.gameType = null;
      room.turn = null;
      room.turnStartTime = null;
      room.actionLog = [];
      delete room.changeGameRequest;

      Object.keys(room.players).forEach((id) => {
        const p = room.players[id];
        p.word = null;
        p.knownTiles = [];
        p.gameVote = null;
        p.mines = [];
        p.revealed = [];
        p.extraTurns = 0;
      });

      roomManager.clearTurnTimer(roomId);
      io.to(roomId).emit('change_game_resolved', { accepted: true });
      io.to(roomId).emit('game_restarted', { roomId });
      broadcastGameState(io, roomManager, roomId);
    } else {
      delete room.changeGameRequest;
      io.to(roomId).emit('change_game_resolved', { accepted: false });
    }
  });

  socket.on('cancel_change_game', ({ roomId }: { roomId: string }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.changeGameRequest) return;
    if (sessionId !== room.changeGameRequest.requesterId) return;

    delete room.changeGameRequest;
    io.to(roomId).emit('change_game_resolved', { accepted: false, cancelled: true });
  });

  socket.on('leave_room', ({ roomId }: { roomId: string }) => {
    const result = roomManager.leaveRoom(sessionId, roomId);
    socket.leave(roomId);

    if (!result.roomDeleted && result.room) {
      broadcastGameState(io, roomManager, roomId);
      io.to(roomId).emit('error', 'Opponent left the room.');
    }
    socket.emit('left_room', { roomId });
  });

  socket.on('disconnect', () => {
    if (roomManager.getActiveSocketId(sessionId) !== socket.id) return;

    roomManager.scheduleDisconnectTimeout(sessionId, (roomId, room, opponentLeft) => {
      if (!room) {
        // Room deleted
      } else if (opponentLeft) {
        broadcastGameState(io, roomManager, roomId);
        io.to(roomId).emit('error', 'Opponent disconnected.');
      }
    });
  });
}
