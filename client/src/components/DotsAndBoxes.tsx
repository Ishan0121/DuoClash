import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Gamepad2, X, Info, MessageCircle, History, Clock, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster, toast } from 'sonner';

export default function DotsAndBoxes({ room, socket, sessionId }: any) {
  const boxSize = room.settings?.dotsGridSize || 5;
  const gridSize = boxSize * 2 + 1; // dots + boxes

  const isMyTurn = room.turn === sessionId;

  const [showRules, setShowRules] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintInput, setHintInput] = useState('');
  const [receivedHint, setReceivedHint] = useState<string | null>(null);
  const [changeGameWaiting, setChangeGameWaiting] = useState(false);
  const [changeGameConfirm, setChangeGameConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  let myBoxes = 0;
  let oppBoxes = 0;
  if (room.dotsBoxes) {
    Object.values(room.dotsBoxes).forEach((owner) => {
      if (owner === sessionId) myBoxes++;
      else oppBoxes++;
    });
  }

  const handleDrawLine = (lineId: string) => {
    if (!isMyTurn || room.state !== 'playing') return;
    if (room.dotsLines?.includes(lineId)) return;
    socket.emit('draw_line', { roomId: room.roomId, lineId });
  };

  // Turn announcement
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
    if (showLog && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [room.actionLog, showLog]);

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

  const renderGrid = () => {
    const cells = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const isDot = r % 2 === 0 && c % 2 === 0;
        const isHLine = r % 2 === 0 && c % 2 !== 0;
        const isVLine = r % 2 !== 0 && c % 2 === 0;
        const isBox = r % 2 !== 0 && c % 2 !== 0;

        if (isDot) {
          cells.push(
            <div key={`${r}-${c}`} className="w-3 h-3 rounded-full bg-foreground/80 m-auto" />
          );
        } else if (isHLine) {
          const lineId = `h-${r / 2}-${(c - 1) / 2}`;
          const drawn = room.dotsLines?.includes(lineId);
          cells.push(
            <div
              key={lineId}
              onClick={() => handleDrawLine(lineId)}
              className={cn(
                "h-3 w-full my-auto transition-all duration-200 rounded-full",
                drawn ? "bg-primary" : (isMyTurn ? "bg-secondary hover:bg-primary/40 cursor-pointer" : "bg-secondary/50")
              )}
            />
          );
        } else if (isVLine) {
          const lineId = `v-${(r - 1) / 2}-${c / 2}`;
          const drawn = room.dotsLines?.includes(lineId);
          cells.push(
            <div
              key={lineId}
              onClick={() => handleDrawLine(lineId)}
              className={cn(
                "w-3 h-full mx-auto transition-all duration-200 rounded-full",
                drawn ? "bg-primary" : (isMyTurn ? "bg-secondary hover:bg-primary/40 cursor-pointer" : "bg-secondary/50")
              )}
            />
          );
        } else if (isBox) {
          const boxId = `${(r - 1) / 2}-${(c - 1) / 2}`;
          const owner = room.dotsBoxes?.[boxId];
          cells.push(
            <div
              key={boxId}
              className={cn(
                "w-full h-full rounded-sm transition-all duration-300 flex items-center justify-center font-bold text-xs",
                owner ? (owner === sessionId ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400") : ""
              )}
            >
              {owner ? (owner === sessionId ? "You" : "Opp") : ""}
            </div>
          );
        }
      }
    }

    return (
      <div
        className="grid gap-1 mx-auto max-w-full p-4 bg-background border border-border/50 rounded-xl shadow-lg"
        style={{
          gridTemplateColumns: `repeat(${boxSize}, 12px minmax(30px, 1fr)) 12px`,
          gridTemplateRows: `repeat(${boxSize}, 12px minmax(30px, 1fr)) 12px`,
          width: 'fit-content'
        }}
      >
        {cells}
      </div>
    );
  };

  if (room.state === 'ready') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto relative">
        <Toaster position="top-center" theme="dark" />

        <div className="text-center space-y-2">
          <h2 className="text-4xl font-bold tracking-tight">Dots and Boxes</h2>
          <p className="text-muted-foreground">The classic grid game.</p>
        </div>

        {room.me.isHost ? (
          <div className="text-center space-y-4 w-full animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => socket.emit('start_game', { roomId: room.roomId })} className="w-full py-4 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold text-xl active:scale-[0.98] transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
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

      <header className="flex flex-col gap-2 p-4 border-b border-border bg-background/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              Room {room.roomId}
              {room.scores && room.opponent && (
                <div className="flex items-center bg-secondary/50 border border-border/50 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider shadow-inner ml-2">
                  <span className="text-emerald-400">You: {room.scores[sessionId as string] || 0}</span>
                  <span className="mx-1.5 opacity-30">|</span>
                  <span className="text-amber-400">Opp: {room.scores[room.opponent.id] || 0}</span>
                </div>
              )}
              <div className={cn("ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-colors shadow-sm", isMyTurn ? "bg-emerald-500 text-white" : "bg-secondary text-muted-foreground")}>
                {isMyTurn ? "Your Turn" : "Opponent"}
              </div>
              {room.settings?.timerEnabled && timeLeft !== null && (
                <div className={cn("ml-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold flex items-center gap-1", isMyTurn ? "bg-amber-500/20 text-amber-500" : "bg-secondary text-muted-foreground")}>
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

      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex w-full gap-2 px-4 max-w-sm mx-auto mt-4">
          <button onClick={() => setShowLog(true)} className="flex-1 py-2 bg-secondary rounded-xl font-bold flex items-center justify-center gap-2 text-sm hover:bg-secondary/80"><History className="w-4 h-4" /> Log</button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="flex gap-8 mb-8 items-center bg-secondary/30 px-6 py-3 rounded-full border border-border/50 shadow-inner">
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">You</span>
              <span className="text-3xl font-bold text-emerald-400 font-mono">{myBoxes}</span>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div className="flex flex-col items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Opp</span>
              <span className="text-3xl font-bold text-amber-400 font-mono">{oppBoxes}</span>
            </div>
          </div>
          {renderGrid()}
        </div>
      </div>

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
                onClick={() => { socket.emit('send_hint', { roomId: room.roomId, hint: hintInput }); setShowHintModal(false); setHintInput(''); toast.success('Message sent!'); }}
                className="flex-[2] py-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
              >Send Message</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {receivedHint && (
          <motion.div initial={{ y: -50, opacity: 0, scale: 0.8 }} animate={{ y: window.innerHeight / 3, opacity: 1, scale: 1.2 }} exit={{ opacity: 0, scale: 1.5 }} transition={{ type: 'spring', damping: 15 }} className="absolute left-0 right-0 z-[80] flex justify-center pointer-events-none">
            <div className="bg-primary text-primary-foreground px-6 py-4 rounded-3xl shadow-2xl font-bold text-3xl font-mono tracking-widest border-4 border-background">
              {receivedHint}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLog && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }} className="absolute bottom-0 left-0 right-0 h-2/3 bg-background border-t border-border z-50 p-6 flex flex-col rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl flex items-center gap-2"><History className="w-6 h-6" /> Action Log</h3>
              <button onClick={() => setShowLog(false)} className="p-2 bg-secondary rounded-full hover:bg-secondary/80"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pb-8">
              {room.actionLog?.map((log: any, i: number) => (
                <div key={i} className="bg-secondary/50 p-3 rounded-xl border border-border flex items-start gap-3">
                  <span className="text-muted-foreground text-xs whitespace-nowrap mt-1 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <p className="text-sm font-medium">
                    {log.playerId && (
                      <strong className={log.playerId === sessionId ? "text-emerald-400" : "text-amber-400"}>
                        {log.playerId === sessionId ? "You " : "Opponent "}
                      </strong>
                    )}
                    {log.text}
                  </p>
                </div>
              ))}
              {(!room.actionLog || room.actionLog.length === 0) && <p className="text-muted-foreground text-center py-8">No actions yet.</p>}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <p><strong className="text-foreground">Goal:</strong> Capture more boxes than your opponent!</p>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Gameplay</h4>
                <p>On your turn, click between two adjacent dots to draw a line.</p>
                <p>If your line completes a 1x1 box, you capture it and get <strong className="text-emerald-400">another turn</strong>!</p>
                <p>The game ends when all boxes are captured. The player with the most boxes wins.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Tease / Chat</h4>
                <p>Click the <strong className="text-foreground">Message</strong> icon in the header to send a quick text message or tease to your opponent.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
}
