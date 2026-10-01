const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

const newEvents = `
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

  socket.on('disconnect', () => {`;

content = content.replace(`  socket.on('disconnect', () => {`, newEvents);
fs.writeFileSync('index.js', content);
