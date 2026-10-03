# DuoClash

A real-time multiplayer deduction game platform where players go head-to-head in strategic logic battles. Currently featuring two thrilling games!

## 🎮 How to Play

1. **Create or Join a Room:** Start a new room and share the 6-digit code, or join an existing one.
2. **Choose Your Duel:** Both players must vote for and agree on which game to play: **Word Deduction** or **Minefield**.

### ⚔️ Word Deduction
A race to deduce your opponent's secret word before they figure out yours.
1. **Lock Your Word:** Both players secretly choose a word between 1 and 12 letters long.
2. **Deduce:** Take turns asking your opponent if their word contains specific letters. 
3. **Take Notes:** Use the built-in tracking tools to keep track of known letters and occurrences.
4. **Solve:** Once you know their word, type it in to solve! Guess correctly to win. Guess incorrectly, and you skip your next turn!

**Word Deduction Modes:**
- 🤖 **Auto Mode:** The server acts as a referee. You tap a letter to ask if it's in their word. Your opponent must answer truthfully, and the server verifies their response.
- 📞 **Call Mode:** Designed for playing over voice chat! The server stops validating. Ask questions verbally, and use the on-screen split keyboard to log your own notes manually.

### 💣 Minefield
A tense game of risk and strategy on a hidden grid.
1. **Plant Your Grid:** Hide your designated number of Treasures and Bombs on the grid.
2. **Hunt:** Take turns opening blocks on your opponent's field.
3. **Win:** Find all of your opponent's treasures before they find yours to claim victory!

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
