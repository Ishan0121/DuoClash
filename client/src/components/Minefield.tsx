import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bomb, Gem, Lightbulb, Gamepad2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster, toast } from 'sonner';

export default function Minefield({ room, socket, sessionId }: any) {
  const gridSize = room.settings?.mineGridSize || 5;
  const reqTreasures = room.settings?.mineTreasureCount || 3;
  const reqBombs = room.settings?.mineBombCount || 1;

  const [localMines, setLocalMines] = useState<{ index: number, type: 'treasure' | 'bomb' }[]>([]);
  const [paintMode, setPaintMode] = useState<'treasure' | 'bomb' | 'erase'>('treasure');
  const [showHintModal, setShowHintModal] = useState(false);
  const [hintInput, setHintInput] = useState('');
  const [receivedHint, setReceivedHint] = useState<string | null>(null);

  // visual hint tracking
  const [visualHints, setVisualHints] = useState<{ index: number, color: string }[]>([]);

  const [viewingOwnField, setViewingOwnField] = useState(false);
  const [hintColor, setHintColor] = useState<'green' | 'red'>('green');

  // Change game confirmation state
  const [changeGameWaiting, setChangeGameWaiting] = useState(false);
  const [changeGameConfirm, setChangeGameConfirm] = useState(false);

  useEffect(() => {
    const handleVisualHint = ({ index, color }: any) => {
      setVisualHints(prev => [...prev.filter(h => h.index !== index), { index, color }]);
      setTimeout(() => {
        setVisualHints(prev => prev.filter(h => h.index !== index || h.color !== color));
      }, 3000);
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
      socket.emit('visual_hint', { roomId: room.roomId, index, color: hintColor });
      toast.success('Visual hint sent!');
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
          <h2 className="text-3xl font-bold tracking-tight">Plant Your Mines</h2>
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
                  m?.type === 'treasure' ? 'bg-emerald-500/20 border-emerald-500' :
                  m?.type === 'bomb' ? 'bg-destructive/20 border-destructive' :
                  'bg-background border-border hover:bg-secondary'
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
            disabled={localMines.filter(m=>m.type==='treasure').length !== reqTreasures || localMines.filter(m=>m.type==='bomb').length !== reqBombs}
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
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-destructive/10 text-destructive font-bold hover:bg-destructive/20 transition-colors active:scale-[0.98]"
          >
            <X className="w-5 h-5" /> Leave Room
          </button>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  const isMyTurn = room.turn === sessionId;
  
  return (
    <div className="h-[100dvh] flex flex-col max-w-md mx-auto relative overflow-hidden bg-background">
      <Toaster position="top-center" theme="dark" />
      <header className="flex flex-col gap-2 p-4 border-b border-border bg-background/80 backdrop-blur z-10 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide flex items-center gap-2">
              Room {room.roomId}
              <button onClick={() => setShowHintModal(true)} className="p-1 rounded-full bg-secondary">
                <Lightbulb className="w-4 h-4" />
              </button>
              <button onClick={() => socket.emit('request_change_game', { roomId: room.roomId })} className="p-1 rounded-full bg-primary/20 text-primary hover:bg-primary/30 ml-1" title="Change Game">
                <Gamepad2 className="w-4 h-4" />
              </button>
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full transition-colors", isMyTurn ? "bg-primary/20 text-primary font-bold animate-pulse" : "text-muted-foreground")}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8 overflow-y-auto">
        <div className="flex gap-4">
          <button onClick={() => setViewingOwnField(false)} className={cn("px-4 py-2 rounded-xl font-bold", !viewingOwnField ? "bg-primary text-white" : "bg-secondary")}>Opponent's Field</button>
          <button onClick={() => setViewingOwnField(true)} className={cn("px-4 py-2 rounded-xl font-bold", viewingOwnField ? "bg-primary text-white" : "bg-secondary")}>My Field</button>
        </div>

        <div className="text-center">
          <h3 className="font-bold text-xl mb-2">{viewingOwnField ? "My Field (Hint Mode)" : "Opponent's Field"}</h3>
          {viewingOwnField ? (
            <div className="flex items-center justify-center gap-4 text-sm mt-2">
              <span className="font-semibold text-muted-foreground">Hint Color:</span>
              <button onClick={() => setHintColor('green')} className={cn("px-3 py-1 rounded-lg font-bold border-2", hintColor === 'green' ? "bg-emerald-500 text-white border-emerald-500" : "border-emerald-500 text-emerald-500 hover:bg-emerald-500/20")}>Green</button>
              <button onClick={() => setHintColor('red')} className={cn("px-3 py-1 rounded-lg font-bold border-2", hintColor === 'red' ? "bg-destructive text-white border-destructive" : "border-destructive text-destructive hover:bg-destructive/20")}>Red</button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Find {reqTreasures} treasures to win.</p>
          )}
        </div>

        <div 
          className="grid gap-2 p-4 bg-secondary/30 rounded-2xl border border-border relative" 
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
                    revealedByOpponent?.type === 'treasure' ? 'bg-emerald-500/20 border-emerald-500' :
                    revealedByOpponent?.type === 'bomb' ? 'bg-destructive/20 border-destructive' :
                    revealedByOpponent?.type === 'empty' ? 'bg-secondary/50 border-secondary' :
                    myMine?.type === 'treasure' ? 'border-emerald-500 border-dashed' :
                    myMine?.type === 'bomb' ? 'border-destructive border-dashed' :
                    'bg-background border-border hover:bg-secondary'
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
            
            return (
              <button
                key={`opp-${i}`}
                onClick={() => handleBlockClick(i)}
                disabled={!!revealed}
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center transition-all relative overflow-hidden",
                  revealed?.type === 'treasure' ? 'bg-emerald-500/20 border-emerald-500' :
                  revealed?.type === 'bomb' ? 'bg-destructive/20 border-destructive' :
                  revealed?.type === 'empty' ? 'bg-secondary/50 border-secondary' :
                  'bg-background border-border hover:bg-secondary'
                )}
              >
                {revealed?.type === 'treasure' && <Gem className="w-6 h-6 text-emerald-500" />}
                {revealed?.type === 'bomb' && <Bomb className="w-6 h-6 text-destructive" />}
                {vHint && !revealed && (
                  <span className={cn("absolute inset-0 opacity-50 animate-pulse", vHint.color === 'green' ? 'bg-emerald-500' : 'bg-destructive')} />
                )}
              </button>
            )
          })}
        </div>

        <div className="w-full flex justify-around">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-500">{room.me.revealed?.filter((r:any) => r.type === 'treasure').length || 0} / {reqTreasures}</p>
            <p className="text-xs text-muted-foreground">Found</p>
          </div>
        </div>
      </div>

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
        {receivedHint && (
          <motion.div initial={{ y: -50, opacity: 0, scale: 0.8 }} animate={{ y: window.innerHeight / 3, opacity: 1, scale: 1.2 }} exit={{ opacity: 0, scale: 1.5 }} transition={{ type: 'spring', damping: 15 }} className="absolute left-0 right-0 z-[80] flex justify-center pointer-events-none">
            <div className="bg-primary text-primary-foreground px-6 py-4 rounded-3xl shadow-2xl font-bold text-3xl font-mono tracking-widest border-4 border-background">
              {receivedHint}
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
