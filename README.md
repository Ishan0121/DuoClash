# DuoClash

A real-time multiplayer word-guessing and deduction game where players try to outsmart their opponents by guessing their locked word first.

## 🎮 How to Play

1. **Create or Join a Room:** Start a new room and share the 6-digit code, or join an existing one.
2. **Lock Your Word:** Both players secretly choose a word between 1 and 12 letters long.
3. **Deduce:** Take turns asking your opponent if their word contains specific letters. 
4. **Take Notes:** Use the built-in tracking tools to keep track of known letters and occurrences.
5. **Solve:** Once you know their word, type it in to solve! Guess correctly to win. Guess incorrectly, and you skip your next turn!

### Game Modes
- 🤖 **Auto Mode:** The server acts as a referee. You tap a letter to ask if it's in their word. Your opponent must answer truthfully, and the server verifies their response.
- 📞 **Call Mode:** Designed for playing over voice chat! The server stops validating. Ask questions verbally, and use the on-screen split keyboard to log your own notes manually.

## 🚀 Technologies Used

This project is split into a separated client and server architecture.

**Frontend (`/client`)**
- React 19 (via Vite)
- TypeScript
- Tailwind CSS v4
- Framer Motion (Animations)
- Lucide React (Icons)
- Socket.io Client

**Backend (`/server`)**
- Node.js
- Express
- Socket.io
- Axios & CORS

## 🛠️ Local Setup

Follow these steps to run the game locally on your machine.

### 1. Start the Server

Open a terminal and navigate to the server directory:

```bash
cd server
npm install
node index.js
```
*The server typically runs on `http://localhost:3000` (or another port if specified).*

### 2. Start the Client

Open a new terminal window and navigate to the client directory:

```bash
cd client
npm install
npm run dev
```

By default, the Vite development server will start at `http://localhost:5173`. Open this URL in two different browser windows to test the multiplayer functionality against yourself!

## 🔧 Environment Variables

If your server runs on a different port/URL, you can configure the client to connect to it by adding a `.env` file in the `client/` directory:

```env
VITE_SERVER_URL=http://localhost:3000
```
