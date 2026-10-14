export type GameType = 'word' | 'mine' | 'dots' | 'tictactoe' | 'connectfour';

export type GameState =
  | 'lobby'
  | 'selecting_game'
  | 'selecting_game_conflict'
  | 'locking'
  | 'planting'
  | 'ready'
  | 'playing'
  | 'ended';

export type GameMode = 'automated' | 'call';

export interface Mine {
  index: number;
  type: 'treasure' | 'bomb';
}

export interface RevealedBlock {
  index: number;
  type: 'treasure' | 'bomb' | 'empty';
}

export interface RoomSettings {
  greyOutUsed: boolean;
  timerEnabled: boolean;
  showOpponentProgress?: boolean;
  mineGridSize?: number;
  mineTreasureCount?: number;
  mineBombCount?: number;
  dotsGridSize?: number;
  [key: string]: any;
}

export interface ActionLogItem {
  playerId: string;
  text: string;
  timestamp: number;
}

export interface PlayerState {
  id: string;
  word: string | null;
  isHost?: boolean;
}

export interface OpponentState {
  id: string;
  wordLength: number;
  isLocked: boolean;
  knownTiles?: string[];
}

export interface RoomState {
  roomId: string;
  scores?: Record<string, number>;
  turn: string | null;
  mode: GameMode;
  settings: RoomSettings;
  turnStartTime?: number;
  state: GameState;
  gameType?: GameType | null;
  dotsLines?: string[];
  dotsBoxes?: Record<string, string>;
  tictactoeBoard?: (string | null)[];
  connectfourBoard?: (string | null)[];
  actionLog?: ActionLogItem[];
  me: PlayerState & {
    gameVote?: GameType | null;
    isPlanted?: boolean;
    revealed?: RevealedBlock[];
    mines?: Mine[];
  };
  opponent: (OpponentState & {
    gameVote?: GameType | null;
    isPlanted?: boolean;
    revealed?: RevealedBlock[];
    mines?: Mine[];
  }) | null;
}
