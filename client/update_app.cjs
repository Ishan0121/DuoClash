const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Imports
content = content.replace(
  "import { LogIn, KeyRound, Loader2, Check, X, Trash2, Info, Play, Settings } from 'lucide-react';",
  "import { LogIn, KeyRound, Loader2, Check, X, Trash2, Info, Play, Settings, Lightbulb, NotebookPen, Send } from 'lucide-react';\nimport { Toaster, toast } from 'sonner';\nimport confetti from 'canvas-confetti';\nimport { playClick, playSuccess, playError } from './lib/sounds';"
);

// 2. Types
content = content.replace(
  "mode: GameMode;\n  settings: { greyOutUsed: boolean };",
  "mode: GameMode;\n  settings: { greyOutUsed: boolean; timerEnabled: boolean };\n  turnStartTime?: number;"
);

// 3. State
content = content.replace(
  "const [askedLetter, setAskedLetter] = useState('');",
  "const [askedLetter, setAskedLetter] = useState('');\n  const [keyboardMode, setKeyboardMode] = useState<'action'|'notes'>('action');\n  const [showScratchpad, setShowScratchpad] = useState(false);\n  const [scratchpadText, setScratchpadText] = useState('');\n  const [showHintModal, setShowHintModal] = useState(false);\n  const [hintInput, setHintInput] = useState('');\n  const [receivedHint, setReceivedHint] = useState<string|null>(null);\n  const [timeLeft, setTimeLeft] = useState<number>(60);\n  const [shakeSolve, setShakeSolve] = useState(false);"
);

content = content.replace(
  "const savedTiles = localStorage.getItem(`knownTiles_${room.roomId}`);",
  "const savedTiles = localStorage.getItem(`knownTiles_${room.roomId}`);\n      const savedScratch = localStorage.getItem(`scratch_${room.roomId}`);\n      if (savedScratch) setScratchpadText(savedScratch);"
);

content = content.replace(
  "localStorage.setItem(`knownTiles_${room.roomId}`, JSON.stringify(knownTiles));",
  "localStorage.setItem(`knownTiles_${room.roomId}`, JSON.stringify(knownTiles));\n      localStorage.setItem(`scratch_${room.roomId}`, scratchpadText);"
);

// Add turn timer effect
content = content.replace(
  "// Call Mode states",
  `useEffect(() => {
    if (room?.state === 'playing' && room.settings?.timerEnabled && room.turnStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - room.turnStartTime!) / 1000);
        setTimeLeft(Math.max(60 - elapsed, 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [room?.state, room?.settings?.timerEnabled, room?.turnStartTime]);

  // Call Mode states`
);

// Update Sockets
content = content.replace(
  "settings: { greyOutUsed: true },",
  "settings: { greyOutUsed: true, timerEnabled: false },"
);

content = content.replace(
  "socket.on('error', (msg) => {\n      setError(msg);\n      setTimeout(() => setError(''), 3000);\n    });",
  "socket.on('error', (msg) => {\n      toast.error(msg);\n      playError();\n    });"
);

content = content.replace(
  "setAskedLetter(letter);",
  "playClick();\n      setAskedLetter(letter);"
);

content = content.replace(
  "socket.emit('start_game', { roomId: room?.roomId });",
  "socket.emit('start_game', { roomId: room?.roomId });\n    playClick();"
);

content = content.replace(
  "setNotes(prev => [{ char: letter, occurrences: count.toString() }, ...prev]);",
  "setNotes(prev => [{ char: letter, occurrences: count.toString() }, ...prev]);\n      playSuccess();"
);

content = content.replace(
  "socket.on('turn_skipped', ({ playerId }) => {",
  "socket.on('receive_hint', ({ hint }) => {\n      setReceivedHint(hint);\n      playSuccess();\n      setTimeout(() => setReceivedHint(null), 4000);\n    });\n    socket.on('turn_skipped_timeout', ({ playerId }) => {\n      if (playerId === sessionId) {\n        toast.error('Time is up! You lost your turn.');\n        playError();\n      } else {\n        toast('Opponent ran out of time! Your turn.');\n      }\n    });\n    socket.on('turn_skipped', ({ playerId }) => {"
);

content = content.replace(
  "if (playerId === sessionId) {\n        setError('Incorrect solve! You lose a turn.');\n      } else {\n        setError('Opponent guessed incorrectly! They lose a turn.');\n      }\n      setTimeout(() => setError(''), 3000);",
  "if (playerId === sessionId) {\n        toast.error('Incorrect solve! You lose a turn.');\n        setShakeSolve(true);\n        setTimeout(() => setShakeSolve(false), 500);\n        playError();\n      } else {\n        toast.success('Opponent guessed incorrectly! They lose a turn.');\n      }"
);

content = content.replace(
  "setWinner(data);",
  "setWinner(data);\n      if (data.winnerId === sessionId) {\n        playSuccess();\n        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });\n      } else {\n        playError();\n      }"
);

// UI adjustments

content = content.replace(
  "<button onClick={() => setShowSettings(true)} className=\"p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80\">\n                <Settings className=\"w-4 h-4\" />\n              </button>",
  `<button onClick={() => setShowSettings(true)} className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => setShowScratchpad(true)} className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 ml-1">
                <NotebookPen className="w-4 h-4" />
              </button>
              <button onClick={() => setShowHintModal(true)} className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 ml-1">
                <Lightbulb className="w-4 h-4" />
              </button>`
);

content = content.replace(
  "Your word: <span className=\"font-mono font-bold tracking-widest text-primary\">{room.me.word}</span>",
  "Your word: <span className=\"font-mono font-bold tracking-widest text-primary\">{room.me.word}</span>\n          {room.settings?.timerEnabled && room.state === 'playing' && (\n            <div className=\"flex items-center justify-center text-xs mt-1 font-bold text-amber-500\">\n              Timer: {timeLeft}s\n            </div>\n          )}"
);

content = content.replace(
  "onClick={() => socket.emit('change_mode', { roomId: room.roomId, mode: room.mode === 'automated' ? 'call' : 'automated' })}",
  "onClick={() => setKeyboardMode(prev => prev === 'action' ? 'notes' : 'action')}"
);

content = content.replace(
  "{room.mode === 'automated' ? 'Auto Mode' : 'Call Mode'}",
  "{keyboardMode === 'action' ? 'Play/Ask' : 'Take Notes'}"
);

content = content.replace(
  "room.mode === 'automated' ? 'bg-emerald-500' : 'bg-amber-500'",
  "keyboardMode === 'action' ? 'bg-emerald-500' : 'bg-amber-500'"
);

content = content.replace(
  "{error && (",
  "{false && ("
);

// Add Toaster at root level
content = content.replace(
  "return (\n      <div className=\"min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto\">",
  "return (\n      <div className=\"min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto\">\n        <Toaster position=\"top-center\" theme=\"dark\" />"
);
content = content.replace(
  "return (\n      <div className=\"min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto\">\n        <div className=\"text-center space-y-2\">\n          <h2 className=\"text-3xl font-bold tracking-tight\">Lock Your Word</h2>",
  "return (\n      <div className=\"min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto\">\n        <Toaster position=\"top-center\" theme=\"dark\" />\n        <div className=\"text-center space-y-2\">\n          <h2 className=\"text-3xl font-bold tracking-tight\">Lock Your Word</h2>"
);
content = content.replace(
  "return (\n    <div className=\"h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background\">",
  "return (\n    <div className=\"h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background\">\n      <Toaster position=\"top-center\" theme=\"dark\" />"
);

// Replace timer setting
content = content.replace(
  "className=\"w-full py-3 rounded-xl bg-destructive/10 text-destructive font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform\"\n              >\n                Leave Room\n              </button>",
  `className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Leave Room
              </button>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/20 mt-4">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Turn Timer</p>
                  <p className="text-sm text-muted-foreground">Enable a 60-second timer per turn.</p>
                </div>
                <button
                  onClick={() => socket.emit('toggle_setting', { roomId: room.roomId, key: 'timerEnabled' })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    room.settings?.timerEnabled ? "bg-primary" : "bg-secondary"
                  )}
                >
                  <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out", room.settings?.timerEnabled ? "translate-x-2.5" : "-translate-x-2.5")} />
                </button>
              </div>`
);

// Add Scratchpad and Hint Modal in the JSX
const modalsStr = `
      {/* Hint Modal */}
      <AnimatePresence>
        {showHintModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-background/95 backdrop-blur-sm flex flex-col p-6 items-center justify-center">
            <h3 className="text-2xl font-bold mb-4">Send a Hint</h3>
            <input 
              value={hintInput} 
              onChange={e => setHintInput(e.target.value)} 
              className="w-full p-4 rounded-xl bg-secondary border border-border mb-4 text-center font-bold" 
              placeholder="Type hint word..." 
            />
            <div className="flex gap-4 w-full">
              <button onClick={() => setShowHintModal(false)} className="flex-1 py-4 bg-secondary rounded-xl font-bold">Cancel</button>
              <button 
                onClick={() => { socket.emit('send_hint', { roomId: room.roomId, hint: hintInput }); setShowHintModal(false); setHintInput(''); toast.success('Hint sent!'); playClick(); }} 
                className="flex-[2] py-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
              ><Send className="w-5 h-5"/> Send Hint</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Hint */}
      <AnimatePresence>
        {receivedHint && (
          <motion.div initial={{ y: -50, opacity: 0, scale: 0.8 }} animate={{ y: window.innerHeight / 3, opacity: 1, scale: 1.2 }} exit={{ opacity: 0, scale: 1.5 }} transition={{ type: 'spring', damping: 15 }} className="absolute left-0 right-0 z-[80] flex justify-center pointer-events-none">
            <div className="bg-primary text-primary-foreground px-6 py-4 rounded-3xl shadow-2xl font-bold text-3xl font-mono tracking-widest border-4 border-background">
              {receivedHint}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scratchpad */}
      <AnimatePresence>
        {showScratchpad && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="absolute inset-0 top-24 z-[65] bg-background/95 backdrop-blur-md rounded-t-3xl border-t border-border flex flex-col p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2"><NotebookPen className="w-5 h-5"/> My Scratchpad</h3>
              <button onClick={() => setShowScratchpad(false)} className="p-2 rounded-full bg-secondary"><X className="w-5 h-5"/></button>
            </div>
            <textarea 
              value={scratchpadText} 
              onChange={e => setScratchpadText(e.target.value)}
              className="flex-1 w-full bg-secondary/30 rounded-xl border border-border p-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Write your deductions here... (e.g. word ends in T, second letter is A or E)"
            />
          </motion.div>
        )}
      </AnimatePresence>
`;
content = content.replace("{/* Verification Modal (Lock screen) */}", modalsStr + "\n      {/* Verification Modal (Lock screen) */}");

// Solve shake
content = content.replace(
  "className=\"flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-center font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-ring\"",
  "className={cn(\"flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-center font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-ring\", shakeSolve && \"animate-[shake_0.5s_ease-in-out]\")}"
);

content = content.replace(
  "{room.mode === 'automated' ? (",
  "{keyboardMode === 'action' ? ("
);

content = content.replace(
  "const isAsked = room.settings?.greyOutUsed && notes.some(n => n.char === char);",
  "const isAsked = room.settings?.greyOutUsed && notes.some(n => n.char === char);\n                  const isKnown = knownTiles.includes(char);"
);

content = content.replace(
  "isAsked \n                          ? \"bg-secondary/10 border-border/20 text-muted-foreground/30 opacity-50\" \n                          : \"bg-secondary/40 border-border/50 active:bg-secondary disabled:opacity-50\"",
  "isKnown ? \"bg-emerald-500 text-white border-emerald-600 shadow-sm\" : isAsked ? \"bg-secondary/10 border-border/20 text-muted-foreground/30 opacity-50\" : \"bg-secondary/40 border-border/50 active:bg-secondary disabled:opacity-50\""
);

// Note taking guide update
content = content.replace(
  "{room.mode === 'automated' ? 'Use keyboard to ask opponent about a letter' : 'Use keyboard to take notes (Select Letter, then Number)'}",
  "{keyboardMode === 'action' ? 'Tap letter to ask opponent' : 'Use notes keyboard to log numbers'}"
);


fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx updated');
