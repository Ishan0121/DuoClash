import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bomb, Gem, Lightbulb, Gamepad2, X, History, Clock, Info, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster, toast } from 'sonner';

const playSound = (type: 'treasure' | 'bomb') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'treasure') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'bomb') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error(e);
  }
};

export default function TreasureField({ room, socket, sessionId }: any) {
  const gridSize = room.settings?.mineGridSize || 5;
  const reqTreasures = room.settings?.mineTreasureCount || 3;
  const reqBombs = room.settings?.mineBombCount || 1;

  const [localMines, setLocalMines] = useState<{ index: number, type: 'treasure' | 'bomb' }[]>([]);
  const [paintMode, setPaintMode] = useState<'treasure' | 'bomb' | 'erase'>('treasure');
  const [showHintModal, setShowHintModal] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [hintInput, setHintInput] = useState('');
  const [receivedHint, setReceivedHint] = useState<string | null>(null);

  // visual hint tracking
  const [visualHints, setVisualHints] = useState<{ index: number, type: 'treasure' | 'bomb' }[]>([]);

  const [viewingOwnField, setViewingOwnField] = useState(false);
  const [hintType, setHintType] = useState<'treasure' | 'bomb'>('treasure');

  // Change game confirmation state
  const [changeGameWaiting, setChangeGameWaiting] = useState(false);
  const [changeGameConfirm, setChangeGameConfirm] = useState(false);

  // New Features State
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [justGotTurn, setJustGotTurn] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastLogLen = useRef(room.actionLog?.length || 0);

  const isMyTurn = room.turn === sessionId;

  useEffect(() => {
    if (isMyTurn && room.state === 'playing') {
      setJustGotTurn(true);
      playSound('treasure'); // Play a nice sound to grab attention
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
    if (room.actionLog && room.actionLog.length > lastLogLen.current) {
      const latest = room.actionLog[room.actionLog.length - 1];
      if (latest.text.includes('found treasure')) playSound('treasure');
      else if (latest.text.includes('hit a bomb')) playSound('bomb');
      lastLogLen.current = room.actionLog.length;
    }
  }, [room.actionLog]);

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
    const handleVisualHint = ({ index, type }: any) => {
      setVisualHints(prev => [...prev.filter(h => h.index !== index), { index, type }]);
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;
      toast(`Opponent hinted a ${type} at (${row}, ${col})!`, { icon: type === 'treasure' ? '💎' : '💣' });
      setTimeout(() => {
        setVisualHints(prev => prev.filter(h => h.index !== index || h.type !== type));
      }, 5000);
    };
    const handleHint = ({ hint }: any) => {
      setReceivedHint(hint);
      setTimeout(() => setReceivedHint(null), 4000);
    };

    socket.on('receive_visual_hint', handleVisualHint);
    socket.on('receive_hint', handleHint);

    const handleChangeGameWaiting = () => setChangeGameWaiting(true);
    const handleChangeGameConfirm = () => setChangeGameConfirm(true);
    const handleChangeGameResolved = ({ accepted }: { accepted: boolean }) => {
      setChangeGameWaiting(false);
      setChangeGameConfirm(false);
      if (!accepted) toast('Game change was declined.');
    };

    socket.on('change_game_waiting', handleChangeGameWaiting);
    socket.on('change_game_confirm_request', handleChangeGameConfirm);
    socket.on('change_game_resolved', handleChangeGameResolved);

    return () => {
      socket.off('receive_visual_hint', handleVisualHint);
      socket.off('receive_hint', handleHint);
      socket.off('change_game_waiting', handleChangeGameWaiting);
      socket.off('change_game_confirm_request', handleChangeGameConfirm);
      socket.off('change_game_resolved', handleChangeGameResolved);
    };
  }, [socket]);

  const handlePlantClick = (index: number) => {
    setLocalMines(prev => {
      let next = prev.filter(m => m.index !== index);
      if (paintMode !== 'erase') {
        const count = next.filter(m => m.type === paintMode).length;
        const max = paintMode === 'treasure' ? reqTreasures : reqBombs;
        if (count < max) {
          next.push({ index, type: paintMode });
        } else {
          toast.error(`You can only plant ${max} ${paintMode}s.`);
        }
      }
      return next;
    });
  };

  const handleConfirmPlant = () => {
    socket.emit('plant_mines', { roomId: room.roomId, mines: localMines });
  };

  const handleBlockClick = (index: number) => {
    if (viewingOwnField) {
      socket.emit('visual_hint', { roomId: room.roomId, index, type: hintType });
      toast.success('Hint sent to opponent!');
      return;
    }
    if (room.turn !== sessionId) {
      toast.error("Not your turn!");
      return;
    }
    socket.emit('open_block', { roomId: room.roomId, index });
  };

  if (room.state === 'planting' || room.state === 'ready') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
        <Toaster position="top-center" theme="dark" />
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Hide Your Treasures</h2>
          <p className="text-muted-foreground">Hide {reqTreasures} treasures and {reqBombs} bombs.</p>
        </div>

        <div className="flex gap-4">
          <button onClick={() => setPaintMode('treasure')} className={cn("px-4 py-2 rounded-xl flex items-center gap-2", paintMode === 'treasure' ? 'bg-emerald-500 text-white' : 'bg-secondary')}>
            <Gem className="w-5 h-5" /> Treasure ({reqTreasures - localMines.filter(m => m.type === 'treasure').length})
          </button>
          <button onClick={() => setPaintMode('bomb')} className={cn("px-4 py-2 rounded-xl flex items-center gap-2", paintMode === 'bomb' ? 'bg-destructive text-white' : 'bg-secondary')}>
            <Bomb className="w-5 h-5" /> Bomb ({reqBombs - localMines.filter(m => m.type === 'bomb').length})
          </button>
          <button onClick={() => setPaintMode('erase')} className={cn("px-4 py-2 rounded-xl flex items-center gap-2", paintMode === 'erase' ? 'bg-primary text-white' : 'bg-secondary')}>
            Erase
          </button>
        </div>

        <div
          className="grid gap-2 p-4 bg-secondary/30 rounded-2xl border border-border"
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, i) => {
            const m = localMines.find(m => m.index === i);
            return (
              <button
                key={i}
                onClick={() => handlePlantClick(i)}
                disabled={room.me.isPlanted}
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center transition-all",
                  m?.type === 'treasure' ? 'bg-emerald-500/20 border-emerald-500 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                    m?.type === 'bomb' ? 'bg-destructive/20 border-destructive shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                      'bg-background border-border hover:bg-secondary shadow-[inset_0_2px_0_rgba(255,255,255,0.15),inset_1px_0_0_rgba(255,255,255,0.1),_0_4px_6px_rgba(0,0,0,0.5)]'
                )}
              >
                {m?.type === 'treasure' && <Gem className="w-6 h-6 text-emerald-500" />}
                {m?.type === 'bomb' && <Bomb className="w-6 h-6 text-destructive" />}
              </button>
            )
          })}
        </div>

        {!room.me.isPlanted ? (
          <button
            onClick={handleConfirmPlant}
            disabled={localMines.filter(m => m.type === 'treasure').length !== reqTreasures || localMines.filter(m => m.type === 'bomb').length !== reqBombs}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Confirm Placement
          </button>
        ) : (
          <button
            onClick={() => socket.emit('replant_mines', { roomId: room.roomId })}
            className="w-full py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold text-lg"
          >
            Edit Placement
          </button>
        )}

        {room.state === 'ready' && room.me.isHost && (
          <button onClick={() => socket.emit('start_game', { roomId: room.roomId })} className="w-full py-4 rounded-xl bg-emerald-500 text-white font-bold text-xl flex items-center justify-center gap-2">
            <Play className="w-6 h-6" /> Start Game
          </button>
        )}
        {room.state === 'ready' && !room.me.isHost && (
          <p className="animate-pulse text-muted-foreground">Waiting for host to start...</p>
        )}
        {room.state === 'planting' && room.me.isPlanted && (
          <p className="animate-pulse text-muted-foreground">Waiting for opponent...</p>
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
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-destructive text-destructive-foreground font-black border-2 border-destructive shadow-[0_4px_0_0_rgba(153,27,27,1)] active:translate-y-[4px] active:shadow-none hover:bg-destructive/90 hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(153,27,27,1)] transition-all"
          >
            <X className="w-5 h-5" /> Leave Room
          </button>
        </div>

        <AnimatePresence>
          {changeGameWaiting && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Gamepad2 className="w-12 h-12 text-primary" /></motion.div>
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game Request Sent</h3>
              <p className="text-muted-foreground text-center text-sm">Waiting for your opponent to accept...</p>
              <button onClick={() => { socket.emit('cancel_change_game', { roomId: room.roomId }); setChangeGameWaiting(false); }} className="px-8 py-3 rounded-xl bg-secondary text-secondary-foreground font-semibold active:scale-[0.98] transition-transform">Cancel</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {changeGameConfirm && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-[75] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6">
              <Gamepad2 className="w-12 h-12 text-amber-400" />
              <h3 className="text-2xl font-bold tracking-tight text-center">Change Game?</h3>
              <p className="text-muted-foreground text-center text-sm max-w-xs">Your opponent wants to switch to a different game. The current game will be discarded. Do you agree?</p>
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

  // PLAYING STATE

  return (
    <div className={cn("h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background transition-colors duration-700", isMyTurn ? "shadow-[inset_0_0_100px_rgba(16,185,129,0.1)]" : "")}>
      <Toaster position="top-center" theme="dark" />
      <header className="flex flex-col gap-2 p-4 border-b border-border bg-background/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              Room {room.roomId}
              {room.scores && room.opponent && (
                <div className="flex items-center bg-secondary/50 border border-border/50 rounded-md px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider shadow-inner ml-1">
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
                <button onClick={() => setShowSettings(true)} className="p-1.5 rounded-full text-secondary-foreground hover:bg-secondary hover:text-primary transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </span>
          </div>
        </div>
      </header>


      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 overflow-y-auto">
        <div className="flex gap-4">
          <button onClick={() => setViewingOwnField(false)} className={cn("px-4 py-2 rounded-xl font-bold", !viewingOwnField ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>Opponent's Field</button>
          <button onClick={() => setViewingOwnField(true)} className={cn("px-4 py-2 rounded-xl font-bold", viewingOwnField ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>My Field</button>
        </div>

        <div className="text-center">
          <h3 className="font-bold text-xl mb-2">{viewingOwnField ? "My Field (Hint Mode)" : "Opponent's Field"}</h3>
          {viewingOwnField ? (
            <div className="flex items-center justify-center gap-4 text-sm mt-2">
              <span className="font-semibold text-muted-foreground">Hint Type:</span>
              <button onClick={() => setHintType('treasure')} className={cn("px-3 py-1 rounded-lg font-bold border-2 flex items-center gap-1", hintType === 'treasure' ? "bg-emerald-500 text-white border-emerald-500" : "border-emerald-500 text-emerald-500 hover:bg-emerald-500/20")}><Gem className="w-4 h-4" /> Treasure</button>
              <button onClick={() => setHintType('bomb')} className={cn("px-3 py-1 rounded-lg font-bold border-2 flex items-center gap-1", hintType === 'bomb' ? "bg-destructive text-white border-destructive" : "border-destructive text-destructive hover:bg-destructive/20")}><Bomb className="w-4 h-4" /> Bomb</button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Find {reqTreasures} treasures to win.</p>
          )}
        </div>

        <div className="flex w-full gap-2 px-2 max-w-sm">
          <button onClick={() => setShowLog(true)} className="flex-1 py-2 bg-secondary rounded-xl font-bold flex items-center justify-center gap-2 text-sm hover:bg-secondary/80"><History className="w-4 h-4" /> Log</button>
        </div>

        <div
          className={cn(
            "grid gap-2 p-4 bg-secondary/30 rounded-2xl border-2 relative transition-colors duration-500",
            isMyTurn ? "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]" : "border-border"
          )}
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, i) => {
            if (viewingOwnField) {
              const myMine = room.me.mines?.find((m: any) => m.index === i);
              const revealedByOpponent = room.opponent?.revealed?.find((r: any) => r.index === i);
              return (
                <button
                  key={`own-${i}`}
                  onClick={() => handleBlockClick(i)}
                  className={cn(
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center transition-all relative overflow-hidden hover:opacity-80",
                    revealedByOpponent?.type === 'treasure' ? 'bg-emerald-500/20 border-emerald-500 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                      revealedByOpponent?.type === 'bomb' ? 'bg-destructive/20 border-destructive shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                        revealedByOpponent?.type === 'empty' ? 'bg-secondary/50 border-secondary shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                          myMine?.type === 'treasure' ? 'border-emerald-500 border-dashed shadow-[inset_0_2px_0_rgba(255,255,255,0.15),inset_1px_0_0_rgba(255,255,255,0.1),_0_4px_6px_rgba(0,0,0,0.5)]' :
                            myMine?.type === 'bomb' ? 'border-destructive border-dashed shadow-[inset_0_2px_0_rgba(255,255,255,0.15),inset_1px_0_0_rgba(255,255,255,0.1),_0_4px_6px_rgba(0,0,0,0.5)]' :
                              'bg-background border-border hover:bg-secondary shadow-[inset_0_2px_0_rgba(255,255,255,0.15),inset_1px_0_0_rgba(255,255,255,0.1),_0_4px_6px_rgba(0,0,0,0.5)]'
                  )}
                >
                  {myMine?.type === 'treasure' && <Gem className={cn("w-6 h-6 text-emerald-500", revealedByOpponent ? "" : "opacity-30")} />}
                  {myMine?.type === 'bomb' && <Bomb className={cn("w-6 h-6 text-destructive", revealedByOpponent ? "" : "opacity-30")} />}
                  {!myMine && revealedByOpponent?.type === 'empty' && <span className="text-muted-foreground font-bold">X</span>}
                </button>
              );
            }

            const revealed = room.me.revealed?.find((r: any) => r.index === i);
            const vHint = visualHints.find(h => h.index === i);
            
            // If the game ended, we can see the opponent's true mine placements
            const unrevealedMine = room.state === 'ended' && !revealed ? room.opponent?.mines?.find((m: any) => m.index === i) : null;

            return (
              <button
                key={`opp-${i}`}
                onClick={() => handleBlockClick(i)}
                disabled={!!revealed || room.state === 'ended'}
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center transition-all relative overflow-hidden",
                  revealed?.type === 'treasure' ? 'bg-emerald-500/20 border-emerald-500 shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                    revealed?.type === 'bomb' ? 'bg-destructive/20 border-destructive shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                      revealed?.type === 'empty' ? 'bg-secondary/50 border-secondary shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' :
                        unrevealedMine ? 'bg-secondary/50 border-dashed border-muted-foreground shadow-[inset_0_4px_8px_rgba(0,0,0,0.6)]' : 
                          'bg-background border-border hover:bg-secondary shadow-[inset_0_2px_0_rgba(255,255,255,0.15),inset_1px_0_0_rgba(255,255,255,0.1),_0_4px_6px_rgba(0,0,0,0.5)] hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.25),inset_1px_0_0_rgba(255,255,255,0.2),_0_6px_10px_rgba(0,0,0,0.7)] hover:-translate-y-0.5'
                )}
              >
                {revealed?.type === 'treasure' && (
                  <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
                    <Gem className="w-6 h-6 text-emerald-500" />
                  </motion.div>
                )}
                {revealed?.type === 'bomb' && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    <Bomb className="w-6 h-6 text-destructive" />
                  </motion.div>
                )}
                {unrevealedMine && (
                  <div className="opacity-40 grayscale">
                    {unrevealedMine.type === 'treasure' ? <Gem className="w-5 h-5" /> : <Bomb className="w-5 h-5" />}
                  </div>
                )}
                {vHint && !revealed && (
                  <span className={cn("absolute inset-0 opacity-50 animate-pulse flex items-center justify-center", vHint.type === 'treasure' ? 'bg-emerald-500' : 'bg-destructive')} />
                )}
              </button>
            )
          })}
        </div>

        <div className="w-full flex justify-around">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-500">{room.me.revealed?.filter((r: any) => r.type === 'treasure').length || 0} / {reqTreasures}</p>
            <p className="text-xs text-muted-foreground">Found</p>
          </div>
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

              <button 
                onClick={() => {
                  socket.emit('leave_room', { roomId: room.roomId });
                  setShowSettings(false);
                }}
                className="w-full py-3 rounded-2xl bg-destructive text-destructive-foreground font-black flex items-center justify-center gap-2 border-2 border-destructive shadow-[0_4px_0_0_rgba(153,27,27,1)] active:translate-y-[4px] active:shadow-none hover:bg-destructive/90 hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(153,27,27,1)] transition-all"
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
            <h3 className="text-2xl font-bold mb-4">Send a Text Hint</h3>
            <input
              value={hintInput}
              onChange={e => setHintInput(e.target.value)}
              className="w-full p-4 rounded-xl bg-secondary border border-border mb-4 text-center font-bold"
              placeholder="Type hint..."
            />
            <div className="flex gap-4 w-full">
              <button onClick={() => setShowHintModal(false)} className="flex-1 py-4 bg-secondary rounded-xl font-bold">Cancel</button>
              <button
                onClick={() => { socket.emit('send_hint', { roomId: room.roomId, hint: hintInput }); setShowHintModal(false); setHintInput(''); toast.success('Hint sent!'); }}
                className="flex-[2] py-4 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2"
              >Send Hint</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {justGotTurn && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
            className="absolute left-0 right-0 top-20 pointer-events-none flex justify-center z-[100]"
          >
            <div className="bg-emerald-500 text-white px-8 py-3 rounded-full shadow-[0_10px_30px_rgba(16,185,129,0.5)] font-black text-2xl tracking-tight uppercase border-2 border-emerald-300">
              Your Turn!
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
              <p><strong className="text-foreground">Goal:</strong> Find all {room.settings?.mineTreasureCount || 3} of your opponent's treasures before they find yours!</p>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Setup</h4>
                <p>Hide your treasures and bombs on your grid. Your opponent won't know where they are.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Gameplay</h4>
                <p>On your turn, click a tile on the <strong className="text-foreground">Opponent's Field</strong> to reveal it.</p>
                <p><strong className="text-emerald-400">Treasure:</strong> You found one! Keep looking for the rest to win.</p>
                <p><strong className="text-destructive">Bomb:</strong> Oh no! You lose your next turn.</p>
                <p><strong className="text-amber-400">Empty:</strong> Nothing here. Your turn ends.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground text-base">Hints</h4>
                <p>Click the <strong className="text-foreground">Lightbulb</strong> icon to send a hint to your opponent. You can mark a tile on your own field and tell them if it's a Treasure or a Bomb!</p>
              </div>
            </div>
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
    </div>
  );
}
