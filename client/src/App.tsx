import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { LogIn, KeyRound, Loader2, Check, ArrowRight, X, Trash2, Info, Play, Settings } from 'lucide-react';

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  sessionId = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('sessionId', sessionId);
}
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';
const socket = io(SERVER_URL, { auth: { sessionId } });

type GameState = 'lobby' | 'locking' | 'ready' | 'playing' | 'ended';
type GameMode = 'automated' | 'call';

interface PlayerState {
  id: string;
  word: string | null;
  isHost?: boolean;
}

interface OpponentState {
  id: string;
  wordLength: number;
  isLocked: boolean;
}

interface RoomState {
  roomId: string;
  turn: string | null;
  mode: GameMode;
  settings: { greyOutUsed: boolean };
  state: GameState;
  me: PlayerState;
  opponent: OpponentState | null;
}

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string>('');
  const [joinCode, setJoinCode] = useState('');
  const [myWord, setMyWord] = useState('');
  
  // Gameplay states
  const [notes, setNotes] = useState<{ char: string; occurrences: string }[]>([]);
  const [knownTiles, setKnownTiles] = useState<string[]>([]);
  const [solveAttempt, setSolveAttempt] = useState('');

  // Persist state to local storage
  useEffect(() => {
    if (room?.roomId) {
      const savedWord = localStorage.getItem(`myWord_${room.roomId}`);
      if (savedWord) setMyWord(savedWord);
      
      const savedNotes = localStorage.getItem(`notes_${room.roomId}`);
      if (savedNotes) setNotes(JSON.parse(savedNotes));
      
      const savedTiles = localStorage.getItem(`knownTiles_${room.roomId}`);
      if (savedTiles) {
        setKnownTiles(JSON.parse(savedTiles));
      }
    }
  }, [room?.roomId]);

  useEffect(() => {
    if (room?.roomId) {
      localStorage.setItem(`myWord_${room.roomId}`, myWord);
      localStorage.setItem(`notes_${room.roomId}`, JSON.stringify(notes));
      localStorage.setItem(`knownTiles_${room.roomId}`, JSON.stringify(knownTiles));
    }
  }, [myWord, notes, knownTiles, room?.roomId]);
  
  // Call Mode states
  const [selectedLetter, setSelectedLetter] = useState('');
  const [noteNumber, setNoteNumber] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [askedLetter, setAskedLetter] = useState('');

  // Automated Mode verification state
  const [verifyRequest, setVerifyRequest] = useState<{ letter: string, askerId: string } | null>(null);
  const [verifyCount, setVerifyCount] = useState<number | null>(null);
  const [verifyPositions, setVerifyPositions] = useState<number[]>([]);

  // Winner state
  const [winner, setWinner] = useState<{ winnerId: string, word: string } | null>(null);

  useEffect(() => {
    socket.on('room_created', ({ roomId }) => {
      setRoom(prev => prev ? { ...prev, roomId } : { 
        roomId, 
        turn: null, 
        mode: 'automated',
        settings: { greyOutUsed: true },
        state: 'lobby', 
        me: { id: sessionId, word: null }, 
        opponent: null 
      });
    });

    socket.on('game_state_update', (state: RoomState) => {
      setRoom(state);
      if (state.turn !== sessionId) setWaitingForOpponent(false);
      if (state.opponent) {
        setKnownTiles(prev => {
          if (prev.length === state.opponent!.wordLength) return prev;
          const savedTiles = localStorage.getItem(`knownTiles_${state.roomId}`);
          if (savedTiles) {
            const parsed = JSON.parse(savedTiles);
            if (parsed.length === state.opponent!.wordLength) return parsed;
          }
          return Array(state.opponent!.wordLength).fill('');
        });
      }
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    socket.on('verify_letter', (data) => {
      setVerifyRequest(data);
      setVerifyCount(null);
      setVerifyPositions([]);
    });

    socket.on('letter_result', ({ letter, count, positions }) => {
      setWaitingForOpponent(false);
      // We asked for a letter and got the result
      setNotes(prev => [{ char: letter, occurrences: count.toString() }, ...prev]);
      
      // Update known tiles
      setKnownTiles(prev => {
        const next = [...prev];
        positions.forEach((p: number) => {
          next[p] = letter;
        });
        return next;
      });
    });

    socket.on('turn_skipped', ({ playerId }) => {
      if (playerId === sessionId) {
        setError('Incorrect solve! You lose a turn.');
      } else {
        setError('Opponent guessed incorrectly! They lose a turn.');
      }
      setTimeout(() => setError(''), 3000);
    });

    socket.on('game_over', (data) => {
      setRoom(prev => prev ? { ...prev, state: 'ended' } : null);
      setWinner(data);
    });

    socket.on('game_restarted', ({ roomId }) => {
      setMyWord('');
      setNotes([]);
      setKnownTiles([]);
      setWinner(null);
      localStorage.removeItem(`myWord_${roomId}`);
      localStorage.removeItem(`notes_${roomId}`);
      localStorage.removeItem(`knownTiles_${roomId}`);
    });

    socket.on('left_room', ({ roomId }) => {
      if (roomId) {
        localStorage.removeItem(`myWord_${roomId}`);
        localStorage.removeItem(`notes_${roomId}`);
        localStorage.removeItem(`knownTiles_${roomId}`);
      }
      setRoom(null);
      setMyWord('');
      setNotes([]);
      setKnownTiles([]);
      setWinner(null);
    });

    return () => {
      socket.off('room_created');
      socket.off('game_state_update');
      socket.off('error');
      socket.off('verify_letter');
      socket.off('letter_result');
      socket.off('turn_skipped');
      socket.off('game_over');
      socket.off('game_restarted');
      socket.off('left_room');
    };
  }, [knownTiles.length]);

  const handleCreateRoom = () => socket.emit('create_room');
  const handleJoinRoom = () => {
    if (joinCode.length === 6) socket.emit('join_room', joinCode.toUpperCase());
  };
  const handleLockWord = () => {
    if (myWord.length >= 1 && myWord.length <= 12) {
      socket.emit('lock_word', { roomId: room?.roomId, word: myWord });
    }
  };
  const handleUnlockWord = () => {
    socket.emit('unlock_word', { roomId: room?.roomId });
  };
  const handleStartGame = () => {
    socket.emit('start_game', { roomId: room?.roomId });
  };

  const handleLetterTap = (letter: string) => {
    if (room?.mode === 'automated') {
      setAskedLetter(letter);
      setWaitingForOpponent(true);
      socket.emit('ask_letter', { roomId: room.roomId, letter });
    } else {
      // Call mode step 1
      setSelectedLetter(letter);
    }
  };

  const handleNumberTap = (num: number) => {
    if (!selectedLetter) return;
    setNoteNumber(prev => {
      const next = prev + num.toString();
      return next.length > 2 ? next.slice(-2) : next;
    });
  };

  const handleSaveNote = () => {
    if (!selectedLetter || !noteNumber) return;
    setNotes(prev => [{ char: selectedLetter, occurrences: noteNumber }, ...prev]);
    setSelectedLetter('');
    setNoteNumber('');
  };

  const handleVerifySubmit = () => {
    if (verifyCount !== null && verifyRequest) {
      socket.emit('verify_letter_response', {
        roomId: room?.roomId,
        letter: verifyRequest.letter,
        count: verifyCount,
        positions: verifyPositions
      });
      setVerifyRequest(null);
    }
  };

  const handleSolve = () => {
    if (solveAttempt.length === room?.opponent?.wordLength) {
      socket.emit('solve_word', { roomId: room?.roomId, word: solveAttempt });
      setSolveAttempt('');
    }
  };

  const isMyTurn = room?.turn === sessionId;

  if (!room || room.state === 'lobby') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Word Deduction</h1>
          <p className="text-muted-foreground">Outsmart your opponent in real-time.</p>
        </div>

        {error && <div className="text-destructive font-medium">{error}</div>}

        <div className="w-full space-y-4">
          {room?.roomId ? (
            <div className="p-6 rounded-xl bg-secondary/50 text-center space-y-3 border">
              <p className="text-sm text-muted-foreground uppercase tracking-wider">Room Code</p>
              <h2 className="text-5xl font-mono tracking-widest">{room.roomId}</h2>
              <p className="text-sm mt-4">Waiting for opponent...</p>
              <div className="flex flex-col items-center gap-4 mt-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto opacity-50" />
                <button 
                  onClick={() => socket.emit('leave_room', { roomId: room.roomId })}
                  className="px-4 py-2 mt-2 rounded-xl bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 transition-colors text-sm flex items-center gap-2"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button 
                onClick={handleCreateRoom}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <LogIn className="w-5 h-5" /> Create Room
              </button>
              
              <div className="relative py-4 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
                <div className="relative bg-background px-4 text-sm text-muted-foreground uppercase tracking-widest">or</div>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-4 text-center text-lg font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button 
                  onClick={handleJoinRoom}
                  disabled={joinCode.length !== 6}
                  className="px-6 rounded-xl bg-secondary text-secondary-foreground font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
                >
                  Join
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (room.state === 'locking' || room.state === 'ready') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Lock Your Word</h2>
          <p className="text-muted-foreground">Choose a word between 1 and 12 letters. Make it hard to guess.</p>
        </div>

        {error && <div className="text-destructive font-medium">{error}</div>}

        <div className="w-full space-y-4">
          <input 
            type="text"
            placeholder="Type your word..."
            value={myWord}
            onChange={(e) => setMyWord(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
            disabled={!!room.me.word}
            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {!room.me.word ? (
            <button 
              onClick={handleLockWord}
              disabled={myWord.length < 1 || myWord.length > 12}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <KeyRound className="w-5 h-5" /> Lock Word
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleUnlockWord}
                className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <X className="w-5 h-5" /> Edit
              </button>
              <div className="flex-[2] py-4 rounded-xl bg-primary/20 text-primary border border-primary/30 font-semibold text-lg flex items-center justify-center gap-2">
                <Check className="w-5 h-5" /> Locked
              </div>
            </div>
          )}
        </div>

        {room.state === 'ready' ? (
          room.me.isHost ? (
            <div className="text-center space-y-4 mt-8 animate-in fade-in slide-in-from-bottom-4">
              <p className="text-muted-foreground font-medium">Both players are ready.</p>
              <button onClick={handleStartGame} className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xl active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                <Play className="w-6 h-6 fill-current" /> Start Game
              </button>
            </div>
          ) : (
            <div className="text-center animate-pulse text-muted-foreground mt-8">
              Waiting for host to start the game...
            </div>
          )
        ) : (
          room.me.word && (
            <div className="text-center animate-pulse text-muted-foreground mt-8">
              Waiting for opponent to lock their word...
            </div>
          )
        )}

        <div className="pt-8 w-full">
          <button 
            onClick={() => socket.emit('leave_room', { roomId: room.roomId })}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-destructive/10 text-destructive font-bold hover:bg-destructive/20 transition-colors active:scale-[0.98]"
          >
            <X className="w-5 h-5" /> Leave Room
          </button>
        </div>
      </div>
    );
  }

  if (room.state === 'ended') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto text-center">
        <h2 className="text-5xl font-bold tracking-tighter">
          {winner?.winnerId === sessionId ? 'You Won!' : 'You Lost!'}
        </h2>
        <p className="text-xl text-muted-foreground">The word was: <span className="font-mono font-bold text-foreground">{winner?.word}</span></p>
        <div className="flex gap-4 w-full">
          <button onClick={() => socket.emit('leave_room', { roomId: room.roomId })} className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform">Leave Room</button>
          <button onClick={() => socket.emit('restart_game', { roomId: room.roomId })} className="flex-[2] py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform">Play Again</button>
        </div>
      </div>
    );
  }

  // Playing State
  return (
    <div className="h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background">
      {/* Header */}
      <header className="flex flex-col gap-2 p-4 border-b border-border bg-background/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              Room {room.roomId}
              <button onClick={() => setShowRules(true)} className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <Info className="w-4 h-4" />
              </button>
              <button onClick={() => setShowSettings(true)} className="p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <Settings className="w-4 h-4" />
              </button>
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full transition-colors", isMyTurn ? "bg-primary/20 text-primary font-bold animate-pulse" : "text-muted-foreground")}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </span>
          </div>
          <button 
            onClick={() => socket.emit('change_mode', { roomId: room.roomId, mode: room.mode === 'automated' ? 'call' : 'automated' })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 text-xs font-medium border border-border"
          >
            <div className={cn("w-2 h-2 rounded-full", room.mode === 'automated' ? 'bg-emerald-500' : 'bg-amber-500')} />
            {room.mode === 'automated' ? 'Auto Mode' : 'Call Mode'}
          </button>
        </div>
        <div className="text-xs text-center font-medium bg-secondary/30 py-1.5 rounded-md mt-1">
          Your word: <span className="font-mono font-bold tracking-widest text-primary">{room.me.word}</span>
        </div>
      </header>

      {error && (
        <div className="absolute top-16 left-4 right-4 z-50 bg-destructive text-destructive-foreground p-3 rounded-lg text-sm text-center font-medium shadow-lg">
          {error}
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold tracking-tight">Game Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6 pb-8">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/20">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Grey out used letters</p>
                  <p className="text-sm text-muted-foreground">Visually dim letters on the keyboard that you've already asked about. (Applies to both players)</p>
                </div>
                <button
                  onClick={() => socket.emit('toggle_setting', { roomId: room.roomId, key: 'greyOutUsed' })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    room.settings?.greyOutUsed ? "bg-primary" : "bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out",
                      room.settings?.greyOutUsed ? "translate-x-2.5" : "-translate-x-2.5"
                    )}
                  />
                </button>
              </div>
              <button 
                onClick={() => {
                  socket.emit('leave_room', { roomId: room.roomId });
                  setShowSettings(false);
                }}
                className="w-full py-3 rounded-xl bg-destructive/10 text-destructive font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                Leave Room
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col p-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold tracking-tight">How to Play</h3>
              <button onClick={() => setShowRules(false)} className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground pb-8">
              <p><strong className="text-foreground">Goal:</strong> Guess your opponent's exact word before they guess yours.</p>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Modes</h4>
                <p><strong className="text-emerald-400">Auto Mode:</strong> The server acts as referee. Tap a letter to ask if it's in their word. Your opponent must answer truthfully, verified by the server.</p>
                <p><strong className="text-amber-400">Call Mode:</strong> Play over voice chat! The server stops validating. Ask questions verbally, and use the split keyboard to log notes (Select a Letter, then tap a Number to save).</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Winning & Losing</h4>
                <p>When you know the word, type it in the <strong className="text-foreground">Solve word...</strong> box and tap Solve.</p>
                <p>If you guess correctly, you win! If you are wrong, you <strong className="text-destructive">skip your next turn</strong>.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verification Modal (Lock screen) */}
      <AnimatePresence>
        {verifyRequest && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-6"
          >
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold tracking-tight">Verify Letter</h3>
              <p className="text-muted-foreground mb-4">Your word: <strong className="text-primary tracking-widest text-lg font-mono">{room.me.word}</strong></p>
              <p className="text-muted-foreground">Opponent guessed: <strong className="text-foreground text-xl">{verifyRequest.letter}</strong></p>
            </div>
            
            <div className="w-full space-y-4">
              <p className="text-sm font-medium">How many times does it appear?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {Array.from({ length: (room.me.word?.length || 12) + 1 }).map((_, num) => (
                  <button 
                    key={num}
                    onClick={() => { setVerifyCount(num); if(num===0) setVerifyPositions([]); }}
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg font-bold border transition-colors",
                      verifyCount === num ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 border-border"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {verifyCount !== null && verifyCount > 0 && (
              <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <p className="text-sm font-medium">Select exact positions:</p>
                <div className="flex justify-center gap-1 flex-wrap">
                  {room.me.word?.split('').map((char, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setVerifyPositions(prev => 
                          prev.includes(idx) ? prev.filter(p => p !== idx) : 
                          (prev.length < verifyCount ? [...prev, idx] : prev)
                        )
                      }}
                      className={cn(
                        "w-10 h-12 rounded-md flex items-center justify-center font-mono font-bold text-lg border transition-colors",
                        verifyPositions.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"
                      )}
                    >
                      {char}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleVerifySubmit}
              disabled={verifyCount === null || (verifyCount > 0 && verifyPositions.length !== verifyCount)}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold mt-4 disabled:opacity-50"
            >
              Confirm
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waiting for Opponent Modal */}
      <AnimatePresence>
        {waitingForOpponent && isMyTurn && room.mode === 'automated' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-[55] bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-4"
          >
            <Loader2 className="w-10 h-10 animate-spin text-primary opacity-80" />
            <h3 className="text-xl font-bold tracking-tight text-center">Opponent is verifying...</h3>
            <p className="text-muted-foreground text-center">Waiting for them to count <strong className="text-foreground text-2xl ml-1">{askedLetter}</strong></p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top: Opponent's word tiles */}
      <div className="p-6 shrink-0 flex justify-center border-b border-border">
        <div className="flex gap-1.5 flex-wrap justify-center">
          {knownTiles.map((char, i) => (
            <input
              key={i}
              type="text"
              maxLength={1}
              value={char}
              onChange={(e) => {
                const next = [...knownTiles];
                next[i] = e.target.value.toUpperCase();
                setKnownTiles(next);
              }}
              className="w-10 h-12 sm:w-12 sm:h-14 bg-secondary/30 border-2 border-border/50 rounded-md text-center text-xl font-bold font-mono focus:border-primary focus:outline-none transition-colors"
            />
          ))}
        </div>
      </div>

      {/* Middle: Notes section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
        {notes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50 text-sm italic">
            No deductions yet
          </div>
        ) : (
          <AnimatePresence>
            {notes.map((note, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex justify-between items-center bg-secondary/20 p-3 rounded-lg border border-border/30"
              >
                <span className="font-mono font-bold text-lg">{note.char}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground font-medium">{note.occurrences} {note.occurrences === '1' ? 'time' : 'times'}</span>
                  <button onClick={() => setNotes(prev => prev.filter((_, idx) => idx !== i))} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Bottom: Drawer Input */}
      <div className="shrink-0 border-t border-border bg-background p-4 pt-2">
        {/* Solve Section */}
        <div className="flex gap-2 mb-4">
          <input 
            type="text"
            placeholder="Solve word..."
            value={solveAttempt}
            onChange={(e) => setSolveAttempt(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
            maxLength={room.opponent?.wordLength}
            className="flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-center font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button 
            onClick={handleSolve}
            disabled={!isMyTurn || solveAttempt.length !== room.opponent?.wordLength}
            className="px-6 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Solve
          </button>
        </div>

        {/* Input Guidance */}
        <div className="text-center text-xs font-medium text-muted-foreground mb-2 mt-2">
          {room.mode === 'automated' ? 'Use keyboard to ask opponent about a letter' : 'Use keyboard to take notes (Select Letter, then Number)'}
        </div>

        {/* Input Grid / Numpad */}
        <div className="relative h-48">
          <AnimatePresence mode="wait">
            {room.mode === 'automated' ? (
              <motion.div
                key="auto"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 grid grid-cols-7 gap-1"
              >
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => {
                  const isAsked = room.settings?.greyOutUsed && notes.some(n => n.char === char);
                  return (
                    <button
                      key={char}
                      disabled={!isMyTurn || waitingForOpponent}
                      onClick={() => handleLetterTap(char)}
                      className={cn(
                        "flex items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                        isAsked 
                          ? "bg-secondary/10 border-border/20 text-muted-foreground/30 opacity-50" 
                          : "bg-secondary/40 border-border/50 active:bg-secondary disabled:opacity-50"
                      )}
                    >
                      {char}
                    </button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="call"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 flex gap-2"
              >
                <div className="w-[65%] grid grid-cols-5 gap-1">
                  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => {
                    const isAsked = room.settings?.greyOutUsed && notes.some(n => n.char === char);
                    return (
                      <button
                        key={char}
                        onClick={() => setSelectedLetter(char)}
                        className={cn(
                          "flex items-center justify-center rounded-md text-sm font-medium transition-colors border",
                          selectedLetter === char 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : isAsked 
                              ? "bg-secondary/10 border-border/20 text-muted-foreground/30 opacity-50"
                              : "bg-secondary/40 border-border/50 active:bg-secondary"
                        )}
                      >
                        {char}
                      </button>
                    );
                  })}
                </div>
                <div className="w-[35%] flex flex-col gap-1 border-l border-border/50 pl-2">
                  <div className="flex items-center justify-between px-2 py-1 bg-secondary rounded-md shadow-inner mb-1">
                    <span className="text-xs text-muted-foreground font-medium">Qty:</span>
                    <span className="font-bold font-mono">{noteNumber || '-'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <button
                        key={num}
                        onClick={() => handleNumberTap(num)}
                        disabled={!selectedLetter}
                        className="flex items-center justify-center rounded-md bg-secondary/80 border border-border font-bold active:bg-secondary disabled:opacity-30 transition-colors"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      onClick={() => setNoteNumber('')}
                      disabled={!noteNumber}
                      className="flex items-center justify-center rounded-md bg-destructive/10 border border-destructive/20 text-destructive active:bg-destructive/20 disabled:opacity-30 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleNumberTap(0)}
                      disabled={!selectedLetter}
                      className="flex items-center justify-center rounded-md bg-secondary/80 border border-border font-bold active:bg-secondary disabled:opacity-30 transition-colors"
                    >
                      0
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={!selectedLetter || !noteNumber}
                      className="flex items-center justify-center rounded-md bg-primary/20 border border-primary/30 text-primary active:bg-primary/30 disabled:opacity-30 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
