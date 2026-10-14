import {
  Room,
  ClientGameState,
  GameType,
  RoomSettings,
  Player,
} from '../types/index.js';

export const DEFAULT_SETTINGS: RoomSettings = {
  greyOutUsed: true,
  timerEnabled: false,
  showOpponentProgress: true,
  mineGridSize: 5,
  mineTreasureCount: 3,
  mineBombCount: 1,
  dotsGridSize: 5,
};

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private sessions: Map<string, string> = new Map(); // sessionId -> roomId
  private disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private turnTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private activeSockets: Map<string, string> = new Map(); // sessionId -> socketId

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public registerSocket(sessionId: string, socketId: string): void {
    this.activeSockets.set(sessionId, socketId);
    this.cancelDisconnectTimeout(sessionId);
  }

  public getActiveSocketId(sessionId: string): string | undefined {
    return this.activeSockets.get(sessionId);
  }

  public createRoom(sessionId: string): Room {
    let roomId = this.generateRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomCode();
    }

    const room: Room = {
      roomId,
      hostId: sessionId,
      lastActivity: Date.now(),
      scores: { [sessionId]: 0 },
      settings: { ...DEFAULT_SETTINGS },
      players: {
        [sessionId]: {
          id: sessionId,
          word: null,
          knownTiles: [],
          gameVote: null,
          mines: [],
          revealed: [],
        },
      },
      turn: null,
      turnStartTime: null,
      mode: 'automated',
      state: 'lobby',
      gameType: null,
      actionLog: [],
      dotsLines: [],
      dotsBoxes: {},
      tictactoeBoard: Array(9).fill(null),
      connectfourBoard: Array(42).fill(null),
    };

    this.rooms.set(roomId, room);
    this.sessions.set(sessionId, roomId);
    return room;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  public getRoomBySessionId(sessionId: string): Room | undefined {
    const roomId = this.sessions.get(sessionId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  public getRoomIdForSession(sessionId: string): string | undefined {
    return this.sessions.get(sessionId);
  }

  public setSessionRoom(sessionId: string, roomId: string): void {
    this.sessions.set(sessionId, roomId);
  }

  public joinRoom(
    roomId: string,
    sessionId: string
  ): { success: boolean; error?: string; room?: Room } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Room not found or already started' };
    }

    const playerIds = Object.keys(room.players);
    if (playerIds.length >= 2) {
      return { success: false, error: 'Room is full' };
    }

    if (room.state !== 'lobby') {
      return { success: false, error: 'Room not found or already started' };
    }

    room.players[sessionId] = {
      id: sessionId,
      word: null,
      knownTiles: [],
      gameVote: null,
      mines: [],
      revealed: [],
    };
    room.scores[sessionId] = 0;
    room.state = 'selecting_game';
    this.sessions.set(sessionId, roomId);
    room.lastActivity = Date.now();

    return { success: true, room };
  }

  public leaveRoom(sessionId: string, roomId: string): {
    roomDeleted: boolean;
    remainingPlayers: string[];
    room?: Room;
  } {
    const room = this.rooms.get(roomId);
    this.clearTurnTimer(roomId);
    this.sessions.delete(sessionId);

    if (!room) {
      return { roomDeleted: true, remainingPlayers: [] };
    }

    delete room.players[sessionId];
    const remainingPlayers = Object.keys(room.players);

    if (remainingPlayers.length === 0) {
      this.rooms.delete(roomId);
      return { roomDeleted: true, remainingPlayers: [] };
    }

    if (room.hostId === sessionId) {
      room.hostId = remainingPlayers[0];
    }
    room.state = 'lobby';
    room.lastActivity = Date.now();

    return { roomDeleted: false, remainingPlayers, room };
  }

  public recordActivity(sessionId: string): void {
    const roomId = this.sessions.get(sessionId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.lastActivity = Date.now();
      }
    }
  }

  public cancelDisconnectTimeout(sessionId: string): void {
    const timeout = this.disconnectTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.disconnectTimeouts.delete(sessionId);
    }
  }

  public scheduleDisconnectTimeout(
    sessionId: string,
    onTimeout: (roomId: string, room: Room | undefined, opponentLeft: boolean) => void
  ): void {
    this.cancelDisconnectTimeout(sessionId);

    const timeout = setTimeout(() => {
      this.disconnectTimeouts.delete(sessionId);
      const roomId = this.sessions.get(sessionId);
      if (!roomId) return;

      const room = this.rooms.get(roomId);
      if (!room) return;

      this.clearTurnTimer(roomId);
      delete room.players[sessionId];
      this.sessions.delete(sessionId);

      const remainingPlayers = Object.keys(room.players);
      if (remainingPlayers.length === 0) {
        this.rooms.delete(roomId);
        onTimeout(roomId, undefined, true);
      } else {
        if (room.hostId === sessionId) {
          room.hostId = remainingPlayers[0];
        }
        room.state = 'lobby';
        onTimeout(roomId, room, true);
      }
    }, 30000);

    this.disconnectTimeouts.set(sessionId, timeout);
  }

  public clearTurnTimer(roomId: string): void {
    const timeout = this.turnTimeouts.get(roomId);
    if (timeout) {
      clearTimeout(timeout);
      this.turnTimeouts.delete(roomId);
    }
  }

  public startTurnTimer(
    roomId: string,
    onTimeout: (currentTurn: string, opponentId: string) => void
  ): void {
    this.clearTurnTimer(roomId);
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'playing' || !room.settings.timerEnabled) return;

    room.turnStartTime = Date.now();

    const timeout = setTimeout(() => {
      const r = this.rooms.get(roomId);
      if (!r || r.state !== 'playing' || !r.turn) return;

      const currentTurn = r.turn;
      const opponentId = Object.keys(r.players).find((id) => id !== currentTurn);
      if (!opponentId) return;

      r.turn = opponentId;
      onTimeout(currentTurn, opponentId);
    }, 60000);

    this.turnTimeouts.set(roomId, timeout);
  }

  public resetGame(room: Room): void {
    if (room.gameType === 'word') {
      room.state = 'locking';
    } else if (room.gameType === 'mine') {
      room.state = 'planting';
    } else {
      room.state = 'ready';
    }

    room.dotsLines = [];
    room.dotsBoxes = {};
    room.tictactoeBoard = Array(9).fill(null);
    room.connectfourBoard = Array(42).fill(null);

    room.turn = null;
    room.turnStartTime = null;
    room.actionLog = [];

    Object.keys(room.players).forEach((id) => {
      const player = room.players[id];
      player.word = null;
      player.knownTiles = [];
      player.mines = [];
      player.revealed = [];
      player.extraTurns = 0;
    });
  }

  public buildClientGameState(room: Room, forPlayerId: string): ClientGameState {
    const playerIds = Object.keys(room.players);
    const mePlayer = room.players[forPlayerId] || {
      id: forPlayerId,
      word: null,
      knownTiles: [],
      gameVote: null,
      mines: [],
      revealed: [],
    };

    const opponentId = playerIds.find((id) => id !== forPlayerId);
    const opponentPlayer = opponentId ? room.players[opponentId] : null;

    return {
      roomId: room.roomId,
      scores: room.scores,
      turn: room.turn,
      turnStartTime: room.turnStartTime,
      mode: room.mode,
      settings: room.settings,
      state: room.state,
      gameType: room.gameType,
      me: {
        id: forPlayerId,
        word: mePlayer.word,
        isHost: room.hostId === forPlayerId,
        gameVote: mePlayer.gameVote,
        isPlanted: Boolean(mePlayer.mines && mePlayer.mines.length > 0),
        revealed: mePlayer.revealed,
        mines: mePlayer.mines,
      },
      opponent: opponentPlayer
        ? {
            id: opponentPlayer.id,
            wordLength: opponentPlayer.word ? opponentPlayer.word.length : 0,
            isLocked: Boolean(opponentPlayer.word),
            knownTiles: opponentPlayer.knownTiles,
            gameVote: opponentPlayer.gameVote,
            isPlanted: Boolean(opponentPlayer.mines && opponentPlayer.mines.length > 0),
            revealed: opponentPlayer.revealed,
            mines: room.state === 'ended' ? opponentPlayer.mines : undefined,
          }
        : null,
      actionLog: room.actionLog,
      dotsLines: room.dotsLines,
      dotsBoxes: room.dotsBoxes,
      tictactoeBoard: room.tictactoeBoard,
      connectfourBoard: room.connectfourBoard,
    };
  }

  public cleanInactiveRooms(
    maxAgeMs: number,
    onRoomClosed: (roomId: string, room: Room) => void
  ): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.lastActivity && now - room.lastActivity > maxAgeMs) {
        this.clearTurnTimer(roomId);
        onRoomClosed(roomId, room);
        this.rooms.delete(roomId);
        for (const [sessionId, rId] of this.sessions.entries()) {
          if (rId === roomId) {
            this.sessions.delete(sessionId);
          }
        }
      }
    }
  }

  // Accessor for all rooms (useful for testing and monitoring)
  public getAllRooms(): Map<string, Room> {
    return this.rooms;
  }
}
