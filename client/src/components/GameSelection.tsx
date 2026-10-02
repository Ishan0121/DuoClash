import { X, Sword, Bomb, Check } from 'lucide-react';

export default function GameSelection({ room, socket, sessionId }: any) {
  const myVote = room.me.gameVote;
  const oppVote = room.opponent?.gameVote;

  const handleVote = (game: 'word' | 'mine') => {
    socket.emit('vote_game', { roomId: room.roomId, gameVote: game });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Choose Your Duel</h2>
        <p className="text-muted-foreground">Both players must select the same game to start.</p>
      </div>

      {room.state === 'selecting_game_conflict' && (
        <div className="w-full p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-center">
          <p className="font-bold">Choices didn't match!</p>
          <p className="text-sm mt-1">Please reconsider and try to agree.</p>
        </div>
      )}

      <div className="w-full space-y-4">
        <button 
          onClick={() => handleVote('word')}
          className={`w-full p-6 rounded-2xl border-2 text-left transition-all relative ${myVote === 'word' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:border-primary/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 text-blue-500 rounded-xl">
              <Sword className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Word Deduction</h3>
              <p className="text-sm text-muted-foreground">Guess the secret word.</p>
            </div>
          </div>
          {myVote === 'word' && <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />}
        </button>

        <button 
          onClick={() => handleVote('mine')}
          className={`w-full p-6 rounded-2xl border-2 text-left transition-all relative ${myVote === 'mine' ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:border-primary/50'}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 text-red-500 rounded-xl">
              <Bomb className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Minefield</h3>
              <p className="text-sm text-muted-foreground">Find treasures, avoid bombs.</p>
            </div>
          </div>
          {myVote === 'mine' && <Check className="absolute top-4 right-4 w-6 h-6 text-primary" />}
        </button>
      </div>

      <div className="w-full p-4 rounded-xl bg-secondary/30 border border-border mt-8 flex justify-between items-center">
        <div className="text-sm">
          <p className="font-semibold">Opponent's Vote:</p>
          <p className="text-muted-foreground capitalize">{oppVote || 'Waiting...'}</p>
        </div>
        {!oppVote ? (
          <div className="animate-pulse w-4 h-4 rounded-full bg-amber-500" />
        ) : (
          <Check className="w-5 h-5 text-emerald-500" />
        )}
      </div>

      <div className="pt-8 w-full">
        <button 
          onClick={() => socket.emit('leave_room', { roomId: room.roomId })}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-destructive/10 text-destructive font-bold hover:bg-destructive/20 transition-colors"
        >
          <X className="w-5 h-5" /> Leave Room
        </button>
      </div>
    </div>
  );
}
