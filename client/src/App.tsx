import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './lib/utils';
import { KeyRound, Loader2, Check, X, Trash2, Info, Play, Settings, Lightbulb, NotebookPen, Send, Gamepad2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import confetti from 'canvas-confetti';
import { playClick, playSuccess, playError } from './lib/sounds';

import GameSelection from './components/GameSelection';
import Minefield from './components/Minefield';
import Lobby from './components/Lobby';

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
  knownTiles?: string[];
}

interface RoomState {
  roomId: string;
  scores?: { [id: string]: number };
  turn: string | null;
  mode: GameMode;
  settings: { greyOutUsed: boolean; timerEnabled: boolean; showOpponentProgress?: boolean, mineGridSize?: number, mineTreasureCount?: number, mineBombCount?: number };
  turnStartTime?: number;
  state: GameState | 'selecting_game' | 'selecting_game_conflict' | 'planting';
  gameType?: 'word' | 'mine' | null;
  me: PlayerState & { gameVote?: string, isPlanted?: boolean, revealed?: any[], mines?: { index: number, type: 'treasure' | 'bomb' }[] };
  opponent: OpponentState & { gameVote?: string, isPlanted?: boolean, revealed?: any[] } | null;
}

export default function App() {
  const [room, setRoom] = useState<RoomState | null>(null);
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
      const savedScratch = localStorage.getItem(`scratch_${room.roomId}`);
      if (savedScratch) setScratchpadText(savedScratch);
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
      localStorage.setItem(`scratch_${room.roomId}`, scratchpadText);
    }
  }, [myWord, notes, knownTiles, room?.roomId]);
  
  useEffect(() => {
    if (room?.roomId) {
      socket.emit('update_progress', { roomId: room.roomId, knownTiles });
    }
  }, [knownTiles, room?.roomId]);
  
  useEffect(() => {
    if (room?.state === 'playing' && room.settings?.timerEnabled && room.turnStartTime) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - room.turnStartTime!) / 1000);
        setTimeLeft(Math.max(60 - elapsed, 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [room?.state, room?.settings?.timerEnabled, room?.turnStartTime]);

  // Call Mode states
  const [selectedLetter, setSelectedLetter] = useState('');
  const [noteNumber, setNoteNumber] = useState('');
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [askedLetter, setAskedLetter] = useState('');
  const [keyboardMode, setKeyboardMode] = useState<'action'|'notes'>('action');
  const [showScratchpad, setShowScratchpad] = useState(false);
  const [scratchpadText, setScratchpadText] = useState('');
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintInput, setHintInput] = useState('');
  const [receivedHint, setReceivedHint] = useState<string|null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [shakeSolve, setShakeSolve] = useState(false);

  // Automated Mode verification state
  const [verifyRequest, setVerifyRequest] = useState<{ letter: string, askerId: string } | null>(null);
  const [verifyCount, setVerifyCount] = useState<number | null>(null);
  const [verifyPositions, setVerifyPositions] = useState<number[]>([]);

  // Winner state
  const [winner, setWinner] = useState<{ winnerId: string, winnerWord: string, loserWord: string } | null>(null);

  // Change game confirmation state
  const [changeGameWaiting, setChangeGameWaiting] = useState(false);
  const [changeGameConfirm, setChangeGameConfirm] = useState(false);

  // Turn visibility state
  const [justGotTurn, setJustGotTurn] = useState(false);

  // Server connection state
  const [isServerConnected, setIsServerConnected] = useState(socket.connected);

  useEffect(() => {
    setIsServerConnected(socket.connected);
    const onConnect = () => setIsServerConnected(true);
    const onDisconnect = () => setIsServerConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_created', ({ roomId }) => {
      setRoom(prev => prev ? { ...prev, roomId } : { 
        roomId, 
        turn: null, 
        mode: 'automated',
        settings: { greyOutUsed: true, timerEnabled: false, showOpponentProgress: true },
        state: 'lobby', 
        me: { id: sessionId as string, word: null }, 
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
      toast.error(msg);
      playError();
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
      playSuccess();
      
      // Update known tiles
      setKnownTiles(prev => {
        const next = [...prev];
        positions.forEach((p: number) => {
          next[p] = letter;
        });
        return next;
      });
    });

    socket.on('receive_hint', ({ hint }) => {
      setReceivedHint(hint);
      playSuccess();
      setTimeout(() => setReceivedHint(null), 4000);
    });
    socket.on('turn_skipped_timeout', ({ playerId }) => {
      if (playerId === sessionId) {
        toast.error('Time is up! You lost your turn.');
        playError();
      } else {
        toast('Opponent ran out of time! Your turn.');
      }
    });
    socket.on('turn_skipped', ({ playerId }) => {
      if (playerId === sessionId) {
        toast.error('Incorrect solve! You lose a turn.');
        setShakeSolve(true);
        setTimeout(() => setShakeSolve(false), 500);
        playError();
      } else {
        toast.success('Opponent guessed incorrectly! They lose a turn.');
      }
    });

    socket.on('game_over', (data) => {
      setRoom(prev => prev ? { ...prev, state: 'ended' } : null);
      setWinner(data);
      if (data.winnerId === sessionId) {
        playSuccess();
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      } else {
        if (data.reason !== 'found_all_treasures') {
          playError();
        } else {
          playError(); // You lost
        }
      }
    });

    socket.on('change_game_waiting', () => {
      setChangeGameWaiting(true);
    });

    socket.on('change_game_confirm_request', () => {
      setChangeGameConfirm(true);
    });

    socket.on('change_game_resolved', ({ accepted }: { accepted: boolean, cancelled?: boolean }) => {
      setChangeGameWaiting(false);
      setChangeGameConfirm(false);
      if (!accepted) {
        toast('Game change was declined.');
      }
    });

    socket.on('game_restarted', ({ roomId }) => {
      setMyWord('');
      setNotes([]);
      setKnownTiles([]);
      setWinner(null);
      setChangeGameWaiting(false);
      setChangeGameConfirm(false);
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
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_created');
      socket.off('game_state_update');
      socket.off('error');
      socket.off('verify_letter');
      socket.off('letter_result');
      socket.off('turn_skipped');
      socket.off('game_over');
      socket.off('change_game_waiting');
      socket.off('change_game_confirm_request');
      socket.off('change_game_resolved');
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
    playClick();
  };

  const handleLetterTap = (letter: string) => {
    if (room?.mode === 'automated') {
      playClick();
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
    if (!isMyTurn) {
      toast.error("You can only guess when it's your turn.");
      playError();
      return;
    }
    if (solveAttempt.length === room?.opponent?.wordLength) {
      socket.emit('solve_word', { roomId: room?.roomId, word: solveAttempt });
      setSolveAttempt('');
    }
  };

  const isMyTurn = room?.turn === sessionId;

  useEffect(() => {
    if (isMyTurn && room?.state === 'playing') {
      setJustGotTurn(true);
      playSuccess(); // Play a nice sound to grab attention
      const t = setTimeout(() => setJustGotTurn(false), 2000);
      return () => clearTimeout(t);
    } else {
      setJustGotTurn(false);
    }
  }, [isMyTurn, room?.state]);

  if (!room || room.state === 'lobby') {
    return <Lobby isServerConnected={isServerConnected} room={room} joinCode={joinCode} setJoinCode={setJoinCode} handleCreateRoom={handleCreateRoom} handleJoinRoom={handleJoinRoom} socket={socket} />;
  }

  if (room.state === 'selecting_game' || room.state === 'selecting_game_conflict') {
    return <GameSelection room={room} socket={socket} sessionId={sessionId} />;
  }

  if (room.gameType === 'mine') {
    if (room.state === 'planting' || room.state === 'ready' || room.state === 'playing') {
      return <Minefield room={room} socket={socket} sessionId={sessionId} />;
    }
  }

  if (room.state === 'locking' || room.state === 'ready') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto relative">
        <Toaster position="top-center" theme="dark" />
        
        {room.scores && room.opponent && (
          <div className="absolute top-6 left-6 flex items-center bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider shadow-inner">
            <span className="text-emerald-400">You: {room.scores[sessionId] || 0}</span>
            <span className="mx-2 opacity-30">|</span>
            <span className="text-amber-400">Opp: {room.scores[room.opponent.id] || 0}</span>
          </div>
        )}

        <div className="text-center space-y-2 mt-8">
          <h2 className="text-3xl font-bold tracking-tight">Lock Your Word</h2>
          <p className="text-muted-foreground">Choose a word between 1 and 12 letters. Make it hard to guess.</p>
        </div>



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

        <div className="pt-8 w-full flex gap-4">
          <button 
            onClick={() => socket.emit('request_change_game', { roomId: room.roomId })}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors active:scale-[0.98]"
          >
            <Gamepad2 className="w-5 h-5" /> Change Game
          </button>
          <button 
            onClick={() => socket.emit('leave_room', { roomId: room.roomId })}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-destructive/10 text-destructive font-bold hover:bg-destructive/20 transition-colors active:scale-[0.98]"
          >
            <X className="w-5 h-5" /> Leave Room
          </button>
        </div>

        {/* Change Game Confirmation Modals */}
        <AnimatePresence>
          {changeGameWaiting && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
            >
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <Gamepad2 className="w-12 h-12 text-primary" />
              </motion.div>
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game Request Sent</h3>
              <p className="text-muted-foreground text-center text-sm">Waiting for your opponent to accept...</p>
              <button
                onClick={() => { socket.emit('cancel_change_game', { roomId: room.roomId }); setChangeGameWaiting(false); }}
                className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform"
              >Cancel</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {changeGameConfirm && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
            >
              <Gamepad2 className="w-12 h-12 text-amber-400" />
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game?</h3>
              <p className="text-muted-foreground text-center text-sm max-w-xs">Your opponent wants to switch to a different game. The current game will be discarded. Do you agree?</p>
              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: false }); setChangeGameConfirm(false); }}
                  className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform"
                >Decline</button>
                <button
                  onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: true }); setChangeGameConfirm(false); }}
                  className="flex-[2] py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
                >Accept</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (room.state === 'ended') {
    const isWinner = winner?.winnerId === sessionId;
    const opponentWordToShow = isWinner ? winner?.loserWord : winner?.winnerWord;

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto text-center relative">
        {room.scores && room.opponent && (
          <div className="absolute top-6 left-6 flex items-center bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider shadow-inner">
            <span className="text-emerald-400">You: {room.scores[sessionId] || 0}</span>
            <span className="mx-2 opacity-30">|</span>
            <span className="text-amber-400">Opp: {room.scores[room.opponent.id] || 0}</span>
          </div>
        )}
        <h2 className="text-5xl font-bold tracking-tighter mt-8">
          {isWinner ? 'You Won!' : 'You Lost!'}
        </h2>
        
        {room.gameType === 'word' && (
          <p className="text-xl text-muted-foreground">Opponent's word was: <span className="font-mono font-bold text-foreground">{opponentWordToShow}</span></p>
        )}
        
        <div className="flex flex-col gap-3 w-full mt-8">
          <button onClick={() => socket.emit('restart_game', { roomId: room.roomId })} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-transform shadow-lg shadow-primary/20">Play Again</button>
          <div className="flex gap-3 w-full">
            <button onClick={() => socket.emit('request_change_game', { roomId: room.roomId })} className="flex-[2] py-4 rounded-xl bg-primary/20 text-primary font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"><Gamepad2 className="w-5 h-5" /> Change Game</button>
            <button onClick={() => socket.emit('leave_room', { roomId: room.roomId })} className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform">Leave Room</button>
          </div>
        </div>

        {/* Change Game Confirmation Modals */}
        <AnimatePresence>
          {changeGameWaiting && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
            >
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <Gamepad2 className="w-12 h-12 text-primary" />
              </motion.div>
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game Request Sent</h3>
              <p className="text-muted-foreground text-center text-sm">Waiting for your opponent to accept...</p>
              <button
                onClick={() => { socket.emit('cancel_change_game', { roomId: room.roomId }); setChangeGameWaiting(false); }}
                className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform"
              >Cancel</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {changeGameConfirm && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
            >
              <Gamepad2 className="w-12 h-12 text-amber-400" />
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game?</h3>
              <p className="text-muted-foreground text-center text-sm max-w-xs">Your opponent wants to switch to a different game. The current game will be discarded. Do you agree?</p>
              <div className="flex gap-3 w-full max-w-xs">
                <button
                  onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: false }); setChangeGameConfirm(false); }}
                  className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform"
                >Decline</button>
                <button
                  onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: true }); setChangeGameConfirm(false); }}
                  className="flex-[2] py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
                >Accept</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Playing State
  return (
    <div className={cn("h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background transition-all duration-700 border-x-2", isMyTurn ? "shadow-[inset_0_0_100px_rgba(16,185,129,0.15)] border-emerald-500/30" : "border-transparent")}>
      <Toaster position="top-center" theme="dark" />
      
      {/* Turn Popup */}
      <AnimatePresence>
        {justGotTurn && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: -20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 1.1, opacity: 0 }} 
            transition={{ type: 'spring', damping: 15, stiffness: 150 }} 
            className="absolute left-0 right-0 top-24 pointer-events-none flex justify-center z-[100]"
          >
            <div className="bg-emerald-500 text-white px-8 py-3 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.5)] font-black text-2xl tracking-tight uppercase border-2 border-emerald-300">
              Your Turn!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header */}
      <header className="flex flex-col gap-2 p-4 border-b border-border bg-background/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              Room {room.roomId}
              {room.scores && room.opponent && (
                <div className="flex items-center bg-secondary/50 border border-border/50 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider shadow-inner ml-2">
                  <span className="text-emerald-400">You: {room.scores[sessionId] || 0}</span>
                  <span className="mx-1.5 opacity-30">|</span>
                  <span className="text-amber-400">Opp: {room.scores[room.opponent.id] || 0}</span>
                </div>
              )}
              <div className={cn("ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-colors shadow-sm", isMyTurn ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground")}>
                {isMyTurn ? "Your Turn" : "Opponent"}
              </div>
              <div className="flex ml-2 border border-border/50 rounded-full bg-secondary/30 p-0.5 shadow-sm">
                <button onClick={() => setShowScratchpad(true)} className="p-1.5 rounded-full text-secondary-foreground hover:bg-secondary hover:text-primary transition-colors">
                  <NotebookPen className="w-4 h-4" />
                </button>
                <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-full text-secondary-foreground hover:bg-secondary hover:text-primary transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </span>
          </div>

        </div>
        <div className="text-xs text-center font-medium bg-secondary/30 py-1.5 rounded-md mt-1">
          Your word: <span className="font-mono font-bold tracking-widest text-primary">{room.me.word}</span>
          {room.settings?.timerEnabled && room.state === 'playing' && (
            <div className="flex items-center justify-center text-xs mt-1 font-bold text-amber-500">
              {isMyTurn ? "Your turn: " : "Opponent: "}{timeLeft}s
            </div>
          )}
        </div>
      </header>



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
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button onClick={() => { setShowSettings(false); setShowRules(true); }} className="p-3 flex items-center justify-center gap-2 rounded-xl bg-secondary/40 hover:bg-secondary border border-border/50 text-sm font-bold transition-colors">
                  <Info className="w-4 h-4" /> How to Play
                </button>
                <button onClick={() => { setShowSettings(false); setShowHintModal(true); }} className="p-3 flex items-center justify-center gap-2 rounded-xl bg-secondary/40 hover:bg-secondary border border-border/50 text-sm font-bold transition-colors">
                  <Lightbulb className="w-4 h-4" /> Send Hint
                </button>
                <button onClick={() => { setShowSettings(false); socket.emit('request_change_game', { roomId: room.roomId }); }} className="p-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-sm font-bold transition-colors col-span-2">
                  <Gamepad2 className="w-4 h-4" /> Request Game Change
                </button>
              </div>

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
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/20 mt-4">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Opponent's Progress Viewer</p>
                  <p className="text-sm text-muted-foreground">See what your opponent has guessed about your word.</p>
                </div>
                <button
                  onClick={() => socket.emit('toggle_setting', { roomId: room.roomId, key: 'showOpponentProgress' })}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                    room.settings?.showOpponentProgress ? "bg-primary" : "bg-secondary"
                  )}
                >
                  <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out", room.settings?.showOpponentProgress ? "translate-x-2.5" : "-translate-x-2.5")} />
                </button>
              </div>
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
                <h4 className="font-semibold text-foreground text-base">How to Play</h4>
                <p>During your turn, use the <strong className="text-emerald-400">Play / Ask</strong> keyboard to tap a letter. The server will automatically tell you if that letter is in the opponent's word, and if so, exactly how many times it occurs!</p>
                <p>If the letter is in their word, it will light up Green. If not, it will be dim.</p>
                <p>Switch to the <strong className="text-amber-400">Take Notes</strong> keyboard anytime to log your own deductions. Tap a letter, then tap a number to record how many times you think it appears.</p>
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

      {/* Change Game — Requester Waiting Modal */}
      <AnimatePresence>
        {changeGameWaiting && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Gamepad2 className="w-12 h-12 text-primary" />
            </motion.div>
            <h3 className="text-2xl font-bold tracking-tight text-center">Change Game Request Sent</h3>
            <p className="text-muted-foreground text-center text-sm">Waiting for your opponent to accept...</p>
            <button
              onClick={() => { socket.emit('cancel_change_game', { roomId: room.roomId }); setChangeGameWaiting(false); }}
              className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Game — Opponent Confirmation Modal */}
      <AnimatePresence>
        {changeGameConfirm && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
          >
            <Gamepad2 className="w-12 h-12 text-amber-400" />
            <h3 className="text-2xl font-bold tracking-tight text-center">Change Game?</h3>
            <p className="text-muted-foreground text-center text-sm max-w-xs">Your opponent wants to switch to a different game. The current game will be discarded. Do you agree?</p>
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: false }); setChangeGameConfirm(false); }}
                className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform"
              >
                Decline
              </button>
              <button
                onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: true }); setChangeGameConfirm(false); }}
                className="flex-[2] py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
              >
                Accept
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top: Opponent's word tiles */}
      <div className="p-6 shrink-0 flex flex-col justify-center items-center border-b border-border">
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
        
        {room.settings?.showOpponentProgress && room.opponent?.knownTiles && room.opponent.knownTiles.length > 0 && (
          <div className="w-full flex flex-col items-center mt-4">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Opponent's Progress</span>
            <div className="flex justify-center gap-1">
              {room.opponent.knownTiles.map((char, i) => (
                <div key={i} className="w-6 h-8 bg-secondary/50 border border-border/50 rounded flex items-center justify-center text-sm font-mono font-bold text-muted-foreground">
                  {char || '?'}
                </div>
              ))}
            </div>
          </div>
        )}
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
      <div className={cn("shrink-0 border-t-2 bg-background p-4 pt-2 transition-all duration-700 relative z-20", isMyTurn ? "border-emerald-500 shadow-[0_-15px_40px_rgba(16,185,129,0.15)] bg-emerald-500/5" : "border-border")}>
        {/* Solve Section */}
        <div className="flex gap-2 mb-4">
          <input 
            type="text"
            placeholder="Solve word..."
            value={solveAttempt}
            onChange={(e) => setSolveAttempt(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
            maxLength={room.opponent?.wordLength}
            className={cn("flex-1 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-center font-mono tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-ring", shakeSolve && "animate-[shake_0.5s_ease-in-out]")}
          />
            <button 
              onClick={handleSolve}
              disabled={solveAttempt.length !== room.opponent?.wordLength}
              className="px-6 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
            >
            Solve
          </button>
        </div>

        {/* Toggle & Guidance */}
        <div className="flex flex-col items-center gap-2 mb-3 mt-1">
          <div className="relative flex items-center bg-secondary/30 p-1 rounded-full border border-border/50">
            <div 
              className={cn(
                "absolute h-7 w-[100px] rounded-full transition-transform duration-300 ease-out shadow-sm", 
                keyboardMode === 'action' ? "bg-emerald-500/20 translate-x-0" : "bg-amber-500/20 translate-x-full"
              )} 
            />
            <button 
              onClick={() => setKeyboardMode('action')}
              className={cn("w-[100px] h-7 text-xs font-bold rounded-full z-10 transition-colors", keyboardMode === 'action' ? "text-emerald-500" : "text-muted-foreground hover:text-foreground")}
            >
              Play / Ask
            </button>
            <button 
              onClick={() => setKeyboardMode('notes')}
              className={cn("w-[100px] h-7 text-xs font-bold rounded-full z-10 transition-colors", keyboardMode === 'notes' ? "text-amber-500" : "text-muted-foreground hover:text-foreground")}
            >
              Take Notes
            </button>
          </div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
            {keyboardMode === 'action' ? 'Tap letter to ask opponent' : 'Use notes keyboard to log numbers'}
          </div>
        </div>

        {/* Input Grid / Numpad */}
        <div className="relative h-48">
          <AnimatePresence mode="wait">
            {keyboardMode === 'action' ? (
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
                  const isKnown = knownTiles.includes(char);
                  return (
                    <button
                      key={char}
                      disabled={!isMyTurn || waitingForOpponent}
                      onClick={() => handleLetterTap(char)}
                      className={cn(
                        "flex items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                        isKnown ? "bg-emerald-500 text-white border-emerald-600 shadow-sm" : isAsked ? "bg-secondary/10 border-border/20 text-muted-foreground/30 opacity-50" : "bg-secondary/40 border-border/50 active:bg-secondary disabled:opacity-50"
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
