import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Circle, Play, Gamepad2, Info, MessageCircle, Clock, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster, toast } from 'sonner';
import { playClick, playError } from '../lib/sounds';

export default function TicTacToe({ room, socket, sessionId }: any) {
  const isMyTurn = room.turn === sessionId;
  const board = room.tictactoeBoard || Array(9).fill(null);
  
  const hostId = room.me.isHost ? sessionId : room.opponent?.id;
  
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintInput, setHintInput] = useState('');
  const [receivedHint, setReceivedHint] = useState<string | null>(null);
  const [changeGameWaiting, setChangeGameWaiting] = useState(false);
  const [changeGameConfirm, setChangeGameConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const getMarkForPlayer = (id: string | null) => {
    if (!id) return null;
    return id === hostId ? 'X' : 'O';
  };

  const handleCellClick = (index: number) => {
    if (!isMyTurn || room.state !== 'playing') {
      if (room.state === 'playing') {
         toast.error("Not your turn!");
         playError();
      }
      return;
    }
    if (board[index] !== null) {
      playError();
      return;
    }
    
    playClick();
    socket.emit('tictactoe_move', { roomId: room.roomId, index });
  };

  const [justGotTurn, setJustGotTurn] = useState(false);
  useEffect(() => {
    if (isMyTurn && room.state === 'playing') {
      setJustGotTurn(true);
      const t = setTimeout(() => setJustGotTurn(false), 2000);
      return () => clearTimeout(t);
    } else {
      setJustGotTurn(false);
    }
  }, [isMyTurn, room.state]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (room.settings?.timerEnabled && room.turnStartTime && room.state === 'playing') {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - room.turnStartTime) / 1000);
        setTimeLeft(Math.max(60 - elapsed, 0));
      }, 1000);
    } else {
      setTimeLeft(null);
    }
    return () => clearInterval(interval);
  }, [room.turnStartTime, room.settings?.timerEnabled, room.state]);

  useEffect(() => {
    const handleHint = ({ hint }: any) => {
      setReceivedHint(hint);
      setTimeout(() => setReceivedHint(null), 4000);
    };

    const handleChangeGameWaiting = () => setChangeGameWaiting(true);
    const handleChangeGameConfirm = () => setChangeGameConfirm(true);
    const handleChangeGameResolved = ({ accepted }: { accepted: boolean }) => {
      setChangeGameWaiting(false);
      setChangeGameConfirm(false);
      if (!accepted) toast('Game change was declined.');
    };

    socket.on('receive_hint', handleHint);
    socket.on('change_game_waiting', handleChangeGameWaiting);
    socket.on('change_game_confirm_request', handleChangeGameConfirm);
    socket.on('change_game_resolved', handleChangeGameResolved);

    return () => {
      socket.off('receive_hint', handleHint);
      socket.off('change_game_waiting', handleChangeGameWaiting);
      socket.off('change_game_confirm_request', handleChangeGameConfirm);
      socket.off('change_game_resolved', handleChangeGameResolved);
    };
  }, [socket]);

  if (room.state === 'ready') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto relative">
        <Toaster position="top-center" theme="dark" />

        <div className="text-center space-y-2">
          <h2 className="text-4xl font-bold tracking-tight">Tic-Tac-Toe</h2>
          <p className="text-muted-foreground">Three in a row wins.</p>
        </div>

        {room.me.isHost ? (
          <div className="text-center space-y-4 w-full animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => socket.emit('start_game', { roomId: room.roomId })} className="w-full py-4 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xl active:scale-[0.98] transition-all shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2">
              <Play className="w-6 h-6 fill-current" /> Start Game
            </button>
          </div>
        ) : (
          <div className="text-center animate-pulse text-muted-foreground p-8 bg-secondary/30 rounded-xl w-full border border-border">
            Waiting for host to start...
          </div>
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

        <AnimatePresence>
          {changeGameWaiting && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Gamepad2 className="w-12 h-12 text-primary" /></motion.div>
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game Request Sent</h3>
              <button onClick={() => { socket.emit('cancel_change_game', { roomId: room.roomId }); setChangeGameWaiting(false); }} className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform">Cancel</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {changeGameConfirm && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6">
              <Gamepad2 className="w-12 h-12 text-amber-400" />
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game?</h3>
              <div className="flex gap-3 w-full max-w-xs">
                <button onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: false }); setChangeGameConfirm(false); }} className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform">Decline</button>
                <button onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: true }); setChangeGameConfirm(false); }} className="flex-[2] py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform shadow-lg shadow-primary/20">Accept</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn(
      "h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background transition-all duration-700 border-x-2",
      isMyTurn ? "shadow-[inset_0_0_100px_rgba(16,185,129,0.15)] border-emerald-500/30" : "border-transparent"
    )}>
      <Toaster position="top-center" theme="dark" />

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
      
      <AnimatePresence>
        {receivedHint && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[80] bg-primary text-primary-foreground px-6 py-4 rounded-2xl shadow-xl max-w-[80%] text-center font-bold"
          >
            <p className="text-sm opacity-80 mb-1">Message from opponent:</p>
            {receivedHint}
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className={cn("ml-2 px-2 py-0.5 rounded-md text-[8px] font-bold tracking-widest uppercase transition-colors shadow-sm", isMyTurn ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground")}>
                {isMyTurn ? "Your Turn" : "Opponent"}
              </div>
              {room.settings?.timerEnabled && timeLeft !== null && (
                <div className={cn("ml-1 px-2 py-0.5 rounded-md text-[8px] font-mono font-bold flex items-center gap-1", isMyTurn ? "bg-amber-500/20 text-amber-500" : "bg-secondary text-muted-foreground")}>
                  <Clock className="w-3 h-3" /> {timeLeft}s
                </div>
              )}
              <div className="flex ml-2 border border-border/50 rounded-full bg-secondary/30 p-0.5 shadow-sm">
                <button onClick={() => setShowHintModal(true)} className="p-1.5 rounded-full text-secondary-foreground hover:bg-secondary hover:text-primary transition-colors" title="Tease / Chat">
                  <MessageCircle className="w-4 h-4" />
                </button>
                <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-full text-secondary-foreground hover:bg-secondary hover:text-primary transition-colors" title="Settings">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center space-y-12 pb-24">
        <div className="flex items-center justify-center gap-4 w-full max-w-[300px]">
           <div className={cn("flex-1 px-4 py-3 rounded-xl border-2 font-bold flex flex-col items-center gap-1 transition-colors", (room.turn === sessionId) ? "border-emerald-500 bg-emerald-500/20 text-emerald-500" : "border-border bg-secondary/50 text-muted-foreground")}>
             {getMarkForPlayer(sessionId) === 'X' ? <X className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
             <span className="text-xs uppercase tracking-widest">You</span>
           </div>
           <div className="text-muted-foreground font-bold text-xl opacity-50">VS</div>
           <div className={cn("flex-1 px-4 py-3 rounded-xl border-2 font-bold flex flex-col items-center gap-1 transition-colors", (room.turn !== sessionId) ? "border-amber-500 bg-amber-500/20 text-amber-500" : "border-border bg-secondary/50 text-muted-foreground")}>
             {getMarkForPlayer(room.opponent?.id) === 'X' ? <X className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
             <span className="text-xs uppercase tracking-widest">Opp</span>
           </div>
        </div>

        <div className="grid grid-cols-3 grid-rows-3 gap-3 w-full max-w-[300px] aspect-square mx-auto p-4 bg-secondary/30 rounded-2xl border border-border">
          {board.map((cellId: string | null, index: number) => {
            const mark = getMarkForPlayer(cellId);
            return (
              <motion.button
                key={index}
                onClick={() => handleCellClick(index)}
                whileHover={isMyTurn && !cellId ? { scale: 0.95 } : {}}
                whileTap={isMyTurn && !cellId ? { scale: 0.9 } : {}}
                className={cn(
                  "w-full h-full rounded-xl bg-background border-2 flex items-center justify-center text-4xl shadow-sm transition-colors",
                  cellId ? "border-primary/20" : "border-border hover:border-primary/50",
                  !cellId && isMyTurn ? "cursor-pointer hover:bg-primary/5" : "cursor-default"
                )}
              >
                {mark === 'X' && (
                  <motion.div initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
                    <X className="w-10 h-10 text-blue-500" strokeWidth={2.5} />
                  </motion.div>
                )}
                {mark === 'O' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    <Circle className="w-9 h-9 text-pink-500" strokeWidth={3} />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

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
              <div className="flex flex-col gap-3 mb-2">
                <button onClick={() => { setShowSettings(false); setShowRules(true); }} className="p-3 flex items-center justify-center gap-2 rounded-xl bg-secondary/40 hover:bg-secondary border border-border/50 text-sm font-bold transition-colors">
                  <Info className="w-4 h-4" /> How to Play
                </button>
                <button onClick={() => { setShowSettings(false); socket.emit('request_change_game', { roomId: room.roomId }); }} className="p-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-sm font-bold transition-colors">
                  <Gamepad2 className="w-4 h-4" /> Request Game Change
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHintModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[70] bg-background/95 backdrop-blur-sm flex flex-col p-6 items-center justify-center">
            <h3 className="text-2xl font-bold mb-4">Send a Message</h3>
            <input
              value={hintInput}
              onChange={e => setHintInput(e.target.value)}
              className="w-full p-4 rounded-xl bg-secondary border border-border mb-4 text-center font-bold"
              placeholder="Type message..."
            />
            <div className="flex gap-4 w-full">
              <button onClick={() => setShowHintModal(false)} className="flex-1 py-4 bg-secondary rounded-xl font-bold">Cancel</button>
              <button
                onClick={() => {
                  socket.emit('send_hint', { roomId: room.roomId, hint: hintInput });
                  setHintInput('');
                  setShowHintModal(false);
                }}
                disabled={!hintInput.trim()}
                className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRules && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold tracking-tight">How to Play</h3>
              <button onClick={() => setShowRules(false)} className="p-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground pb-8">
              <p><strong className="text-foreground">Goal:</strong> Be the first to get three of your marks in a row (up, down, across, or diagonally).</p>
              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Rules</h4>
                <p>1. Players take turns placing their mark on the board.</p>
                <p>2. You cannot place a mark where one already exists.</p>
                <p>3. First player to align 3 marks wins.</p>
                <p>4. If all squares are filled and no player has 3 in a row, it's a draw.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {changeGameWaiting && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Gamepad2 className="w-12 h-12 text-primary" /></motion.div>
            <h3 className="text-2xl font-bold tracking-tight text-center">Change Game Request Sent</h3>
            <button onClick={() => { socket.emit('cancel_change_game', { roomId: room.roomId }); setChangeGameWaiting(false); }} className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {changeGameConfirm && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6">
            <Gamepad2 className="w-12 h-12 text-amber-400" />
            <h3 className="text-2xl font-bold tracking-tight text-center">Change Game?</h3>
            <div className="flex gap-3 w-full max-w-xs">
              <button onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: false }); setChangeGameConfirm(false); }} className="flex-1 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold active:scale-[0.98] transition-transform">Decline</button>
              <button onClick={() => { socket.emit('respond_change_game', { roomId: room.roomId, accepted: true }); setChangeGameConfirm(false); }} className="flex-[2] py-4 rounded-xl bg-primary text-primary-foreground font-bold active:scale-[0.98] transition-transform shadow-lg shadow-primary/20">Accept</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
