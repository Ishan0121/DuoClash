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
  showOpponentProgress: boolean;
  mineGridSize: number;
  mineTreasureCount: number;
  mineBombCount: number;
  dotsGridSize: number;
  [key: string]: any;
}

export interface ActionLogItem {
  playerId: string;
  text: string;
  timestamp: number;
}

export interface Player {
  id: string;
  word: string | null;
  knownTiles: string[];
  gameVote: GameType | null;
  mines: Mine[];
  revealed: RevealedBlock[];
  extraTurns?: number;
}

export interface Room {
  roomId: string;
  hostId: string;
  lastActivity: number;
  scores: Record<string, number>;
  settings: RoomSettings;
  players: Record<string, Player>;
  turn: string | null;
  turnStartTime: number | null;
  mode: GameMode;
  state: GameState;
  gameType: GameType | null;
  actionLog: ActionLogItem[];
  dotsLines: string[];
  dotsBoxes: Record<string, string>;
  tictactoeBoard: (string | null)[];
  connectfourBoard: (string | null)[];
  changeGameRequest?: { requesterId: string };
}

export interface ClientMeState {
  id: string;
  word: string | null;
  isHost: boolean;
  gameVote: GameType | null;
  isPlanted: boolean;
  revealed: RevealedBlock[];
  mines: Mine[];
}

export interface ClientOpponentState {
  id: string;
  wordLength: number;
  isLocked: boolean;
  knownTiles: string[];
  gameVote: GameType | null;
  isPlanted: boolean;
  revealed: RevealedBlock[];
  mines?: Mine[];
}

export interface ClientGameState {
  roomId: string;
  scores: Record<string, number>;
  turn: string | null;
  turnStartTime: number | null;
  mode: GameMode;
  settings: RoomSettings;
  state: GameState;
  gameType: GameType | null;
  me: ClientMeState;
  opponent: ClientOpponentState | null;
  actionLog: ActionLogItem[];
  dotsLines: string[];
  dotsBoxes: Record<string, string>;
  tictactoeBoard: (string | null)[];
  connectfourBoard: (string | null)[];
}
