import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gamepad2, Eye, EyeOff } from 'lucide-react';


export default function GameOverOverlay({ room, socket, sessionId, winner, changeGameWaiting, changeGameConfirm, setChangeGameWaiting, setChangeGameConfirm }: any) {
  const [minimized, setMinimized] = useState(false);

  const isWinner = winner?.winnerId === sessionId;
  const isDraw = winner?.winnerId === 'draw';
  const opponentWordToShow = isWinner ? winner?.loserWord : winner?.winnerWord;

  if (minimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
        <button 
          onClick={() => setMinimized(false)}
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-bold shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <Eye className="w-5 h-5" /> Show Results
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-8 text-center"
    >


      {room.scores && room.opponent && (
        <div className="absolute top-6 left-6 flex items-center bg-secondary/50 border border-border/50 rounded-md px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider shadow-inner">
          <span className="text-emerald-400">You: {room.scores[sessionId] || 0}</span>
          <span className="mx-2 opacity-30">|</span>
          <span className="text-amber-400">Opp: {room.scores[room.opponent.id] || 0}</span>
        </div>
      )}
      
      <motion.h2 
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring" }}
        className="text-5xl font-bold tracking-tighter mt-8"
      >
        {isDraw ? "It's a Draw!" : isWinner ? 'You Won!' : 'You Lost!'}
      </motion.h2>

      {room.gameType === 'word' && (
        <p className="text-xl text-muted-foreground">
          Opponent's word was: <span className="font-mono font-bold text-foreground">{opponentWordToShow}</span>
        </p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
        <button onClick={() => socket.emit('restart_game', { roomId: room.roomId })} className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg active:scale-[0.98] transition-transform shadow-lg shadow-primary/20">Play Again</button>
        
        {room.gameType !== 'word' && (
          <button 
            onClick={() => setMinimized(true)}
            className="w-full py-4 rounded-xl bg-secondary/80 text-secondary-foreground font-bold text-lg hover:bg-secondary transition-colors flex items-center justify-center gap-2"
          >
            <EyeOff className="w-5 h-5" /> View Board
          </button>
        )}

        <div className="flex gap-3 w-full">
          <button onClick={() => socket.emit('request_change_game', { roomId: room.roomId })} className="flex-[2] py-4 rounded-xl bg-primary/20 text-primary font-bold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"><Gamepad2 className="w-5 h-5" /> Change Game</button>
          <button onClick={() => socket.emit('leave_room', { roomId: room.roomId })} className="flex-1 py-4 rounded-2xl bg-destructive text-destructive-foreground font-black active:scale-95 transition-all border-2 border-destructive shadow-[0_4px_0_0_rgba(153,27,27,1)] active:translate-y-[4px] active:shadow-none hover:bg-destructive/90 hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(153,27,27,1)]">Leave</button>
        </div>
      </div>

      {/* Change Game Confirmation Modals */}
      <AnimatePresence>
        {changeGameWaiting && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
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
            className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-6"
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
    </motion.div>
  );
}
