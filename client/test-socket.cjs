const { io } = require("socket.io-client");
const socket = io("https://nonexistent-server-xyz.com");
console.log("Initially:", socket.connected);
setTimeout(() => {
  console.log("After 1s:", socket.connected);
  process.exit(0);
}, 1000);
