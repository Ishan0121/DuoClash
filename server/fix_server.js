const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// Add sessions map and middleware
content = content.replace('const rooms = {};', `const rooms = {};\nconst sessions = {};\n\nio.use((socket, next) => {\n  const sessionId = socket.handshake.auth.sessionId;\n  if (!sessionId) {\n    return next(new Error("invalid session"));\n  }\n  socket.sessionId = sessionId;\n  next();\n});`);

// Update connection log and auto-rejoin
content = content.replace("  console.log('User connected:', socket.id);", `  socket.join(socket.sessionId);\n  console.log('User connected:', socket.sessionId);\n\n  // Auto-reconnect if session has a room\n  if (sessions[socket.sessionId] && rooms[sessions[socket.sessionId]]) {\n    const roomId = sessions[socket.sessionId];\n    socket.join(roomId);\n    broadcastGameState(roomId);\n  }`);

// Replace socket.id with socket.sessionId everywhere else (except in the replacements above)
// We'll just carefully do a global replace of socket.id -> socket.sessionId
// Wait, we need to be careful not to replace it where not needed. But actually everywhere it's used inside the connection handler, it SHOULD be socket.sessionId.
content = content.replace(/socket\.id/g, 'socket.sessionId');

// Wait, the first replacement of console.log already has socket.id which was replaced if we do it globally?
// Yes, so it's safer to do the global replacement FIRST, then the specific ones.

let cleanContent = fs.readFileSync('index.js', 'utf8');

cleanContent = cleanContent.replace(/socket\.id/g, 'socket.sessionId');

cleanContent = cleanContent.replace('const rooms = {};', `const rooms = {};\nconst sessions = {};\n\nio.use((socket, next) => {\n  const sessionId = socket.handshake.auth.sessionId;\n  if (!sessionId) {\n    return next(new Error("invalid session"));\n  }\n  socket.sessionId = sessionId;\n  next();\n});`);

cleanContent = cleanContent.replace("  console.log('User connected:', socket.sessionId);", `  socket.join(socket.sessionId);\n  console.log('User connected:', socket.sessionId);\n\n  // Auto-reconnect if session has a room\n  if (sessions[socket.sessionId] && rooms[sessions[socket.sessionId]]) {\n    const roomId = sessions[socket.sessionId];\n    socket.join(roomId);\n    broadcastGameState(roomId);\n  }`);

// Also we need to add saving to sessions when joining or creating a room
cleanContent = cleanContent.replace(`        room.players[socket.sessionId] = { id: socket.sessionId, word: null };\n        socket.join(roomId);`, `        room.players[socket.sessionId] = { id: socket.sessionId, word: null };\n        sessions[socket.sessionId] = roomId;\n        socket.join(roomId);`);

cleanContent = cleanContent.replace(`      players: {\n        [socket.sessionId]: { id: socket.sessionId, word: null }\n      },`, `      players: {\n        [socket.sessionId]: { id: socket.sessionId, word: null }\n      },`);
cleanContent = cleanContent.replace(`    socket.join(roomId);\n    socket.emit('room_created', { roomId, playerId: socket.sessionId });`, `    sessions[socket.sessionId] = roomId;\n    socket.join(roomId);\n    socket.emit('room_created', { roomId, playerId: socket.sessionId });`);

fs.writeFileSync('index.js', cleanContent);
