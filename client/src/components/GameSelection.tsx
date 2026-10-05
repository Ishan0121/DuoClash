import { X, Sword, Check, Grid, Hash, Pickaxe, Circle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function GameSelection({ room, socket, sessionId }: any) {
  const myVote = room.me.gameVote;
  const oppVote = room.opponent?.gameVote;

  const handleVote = (game: 'word' | 'mine' | 'dots' | 'tictactoe' | 'connectfour') => {
    socket.emit('vote_game', { roomId: room.roomId, gameVote: game });
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item: any = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 max-w-md mx-auto relative bg-background">
      
      {room.scores && room.opponent && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-6 left-6 flex items-center bg-secondary/40 border-2 border-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider"
        >
          <span className="text-emerald-500">You: {room.scores[sessionId] || 0}</span>
          <span className="mx-2 opacity-30">|</span>
          <span className="text-amber-500">Opp: {room.scores[room.opponent.id] || 0}</span>
        </motion.div>
      )}

      <motion.button 
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => socket.emit('leave_room', { roomId: room.roomId })}
        className="absolute top-6 right-6 flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-destructive border-2 border-destructive text-destructive-foreground text-xs font-black hover:bg-destructive/90 transition-all shadow-[0_3px_0_0_rgba(153,27,27,1)] hover:translate-y-[1px] hover:shadow-[0_2px_0_0_rgba(153,27,27,1)] active:translate-y-[3px] active:shadow-none"
      >
        <X className="w-4 h-4" /> Leave
      </motion.button>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-1 mt-14 mb-8"
      >
        <h2 className="text-3xl font-black tracking-tight text-foreground">
          Choose Duel
        </h2>
        <p className="text-xs text-muted-foreground font-semibold">Both players must select the same game</p>
        
        <div className="inline-flex items-center justify-center gap-2 text-xs mt-3 bg-secondary/40 px-4 py-1.5 rounded-full border-2 border-border">
          <span className="font-bold">Opponent:</span>
          <span className="text-muted-foreground capitalize font-bold">{oppVote || 'Waiting...'}</span>
          {!oppVote ? (
            <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500" />
          ) : (
            <Check className="w-4 h-4 text-emerald-500" />
          )}
        </div>
      </motion.div>

      {room.state === 'selecting_game_conflict' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full p-3 mb-6 bg-destructive/10 border-2 border-destructive/20 text-destructive rounded-2xl text-center"
        >
          <p className="font-bold text-sm">Choices didn't match!</p>
        </motion.div>
      )}

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full space-y-3 pb-8"
      >
        <motion.button 
          variants={item}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVote('word')}
          className={`w-full p-4 rounded-3xl border-2 text-left transition-colors relative ${myVote === 'word' ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-secondary/40 hover:border-blue-500/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${myVote === 'word' ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-500'}`}>
              <Sword className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-none mb-1 text-foreground">Word Deduction</h3>
              <p className="text-xs text-muted-foreground font-semibold">Guess the secret word.</p>
            </div>
          </div>
          {myVote === 'word' && <Check className="absolute top-1/2 -translate-y-1/2 right-5 w-6 h-6 text-blue-500" />}
        </motion.button>

        <motion.button 
          variants={item}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVote('mine')}
          className={`w-full p-4 rounded-3xl border-2 text-left transition-colors relative ${myVote === 'mine' ? 'border-red-500 bg-red-500/10' : 'border-border bg-secondary/40 hover:border-red-500/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${myVote === 'mine' ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-500'}`}>
              <Pickaxe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-none mb-1 text-foreground">Treasure Field</h3>
              <p className="text-xs text-muted-foreground font-semibold">Find treasures, avoid bombs.</p>
            </div>
          </div>
          {myVote === 'mine' && <Check className="absolute top-1/2 -translate-y-1/2 right-5 w-6 h-6 text-red-500" />}
        </motion.button>

        <motion.button 
          variants={item}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVote('dots')}
          className={`w-full p-4 rounded-3xl border-2 text-left transition-colors relative ${myVote === 'dots' ? 'border-purple-500 bg-purple-500/10' : 'border-border bg-secondary/40 hover:border-purple-500/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${myVote === 'dots' ? 'bg-purple-500 text-white' : 'bg-purple-500/20 text-purple-500'}`}>
              <Grid className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-none mb-1 text-foreground">Dots & Boxes</h3>
              <p className="text-xs text-muted-foreground font-semibold">Classic grid claiming.</p>
            </div>
          </div>
          {myVote === 'dots' && <Check className="absolute top-1/2 -translate-y-1/2 right-5 w-6 h-6 text-purple-500" />}
        </motion.button>

        <motion.button 
          variants={item}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVote('tictactoe')}
          className={`w-full p-4 rounded-3xl border-2 text-left transition-colors relative ${myVote === 'tictactoe' ? 'border-pink-500 bg-pink-500/10' : 'border-border bg-secondary/40 hover:border-pink-500/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${myVote === 'tictactoe' ? 'bg-pink-500 text-white' : 'bg-pink-500/20 text-pink-500'}`}>
              <Hash className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-none mb-1 text-foreground">Tic-Tac-Toe</h3>
              <p className="text-xs text-muted-foreground font-semibold">Three in a row wins.</p>
            </div>
          </div>
          {myVote === 'tictactoe' && <Check className="absolute top-1/2 -translate-y-1/2 right-5 w-6 h-6 text-pink-500" />}
        </motion.button>

        <motion.button 
          variants={item}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleVote('connectfour')}
          className={`w-full p-4 rounded-3xl border-2 text-left transition-colors relative ${myVote === 'connectfour' ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-secondary/40 hover:border-amber-500/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl transition-colors ${myVote === 'connectfour' ? 'bg-amber-500 text-white' : 'bg-amber-500/20 text-amber-500'}`}>
              <Circle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-none mb-1 text-foreground">Connect Four</h3>
              <p className="text-xs text-muted-foreground font-semibold">Four in a row wins.</p>
            </div>
          </div>
          {myVote === 'connectfour' && <Check className="absolute top-1/2 -translate-y-1/2 right-5 w-6 h-6 text-amber-500" />}
        </motion.button>
      </motion.div>
    </div>
  );
}
