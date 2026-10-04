import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Gamepad2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { Toaster } from 'sonner';

export default function DotsAndBoxes({ room, socket, sessionId }: any) {
  const boxSize = room.settings?.dotsGridSize || 5;
  const gridSize = boxSize * 2 + 1; // dots + boxes

  const isMyTurn = room.turn === sessionId;

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
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-y-auto">
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
    </div>
  );
}
