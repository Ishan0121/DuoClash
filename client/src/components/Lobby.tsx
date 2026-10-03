import { Loader2, LogIn, X } from 'lucide-react';

export default function Lobby({ isServerConnected, room, joinCode, setJoinCode, handleCreateRoom, handleJoinRoom, socket }: any) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">DuoClash</h1>
        <p className="text-muted-foreground">Outsmart your opponent in real-time.</p>
      </div>

      <div className="w-full space-y-4">
        {!isServerConnected ? (
          <div className="flex flex-col items-center justify-center p-8 space-y-4 rounded-2xl bg-secondary/30 border border-border">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">Waking up server...</p>
              <p className="text-xs text-muted-foreground">This may take up to 50 seconds if the server was asleep.</p>
            </div>
          </div>
        ) : room?.roomId ? (
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
