import { Loader2, LogIn, X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Lobby({ isServerConnected, room, joinCode, setJoinCode, handleCreateRoom, handleJoinRoom, socket }: any) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 max-w-md mx-auto relative bg-background">
      
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2 mb-12 w-full"
      >
        <h1 className="text-5xl font-black tracking-tight text-foreground">
          DuoClash
        </h1>
        <p className="text-muted-foreground font-semibold">
          Outsmart your opponent in real-time.
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full space-y-6"
      >
        {!isServerConnected ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4 rounded-3xl bg-secondary/40 border-2 border-border">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-bold text-lg">Waking up server...</p>
              <p className="text-sm text-muted-foreground">This may take up to 50 seconds if the server was asleep.</p>
            </div>
          </div>
        ) : room?.roomId ? (
          <div className="p-8 rounded-3xl bg-secondary/40 text-center space-y-6 border-2 border-border">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-2">Room Code</p>
              <h2 className="text-6xl font-black tracking-widest text-foreground">{room.roomId}</h2>
            </div>
            <div className="flex flex-col items-center gap-4 pt-4 border-t-2 border-border">
              <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                <Loader2 className="w-5 h-5 animate-spin" /> Waiting for opponent...
              </div>
              <button 
                onClick={() => socket.emit('leave_room', { roomId: room.roomId })}
                className="px-6 py-3 mt-2 rounded-2xl bg-destructive text-destructive-foreground font-black active:scale-95 transition-all text-sm flex items-center gap-2 border-2 border-destructive hover:bg-destructive/90 shadow-[0_4px_0_0_rgba(153,27,27,1)] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_rgba(153,27,27,1)] active:translate-y-[4px] active:shadow-none"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <button 
              onClick={handleCreateRoom}
              className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
              <LogIn className="w-6 h-6" /> Create Room
            </button>
            
            <div className="relative py-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-border"></div></div>
              <div className="relative bg-background px-4 text-xs text-muted-foreground uppercase tracking-widest font-bold">or</div>
            </div>

            <div className="flex gap-3">
              <input 
                type="text" 
                maxLength={6}
                placeholder="ENTER CODE"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="flex-[2] bg-secondary/40 border-2 border-border rounded-2xl px-4 py-4 text-center text-xl font-black tracking-widest uppercase focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/40"
              />
              <button 
                onClick={handleJoinRoom}
                disabled={joinCode.length !== 6}
                className="flex-1 rounded-2xl bg-secondary border-2 border-border text-secondary-foreground font-black text-xl disabled:opacity-50 active:scale-95 transition-transform"
              >
                Join
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
