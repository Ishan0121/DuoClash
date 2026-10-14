import { describe, it, expect } from 'vitest';
import { RoomManager } from '../src/rooms/roomManager.js';

describe('RoomManager Lifecycle & State Masking', () => {
  it('generates 6-character alphanumeric room codes', () => {
    const manager = new RoomManager();
    const code = manager.generateRoomCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('creates room with correct initial state', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('user-session-1');

    expect(room.hostId).toBe('user-session-1');
    expect(room.state).toBe('lobby');
    expect(room.scores['user-session-1']).toBe(0);
    expect(room.players['user-session-1']).toBeDefined();
    expect(manager.getRoom(room.roomId)).toBe(room);
  });

  it('allows second player to join and moves to selecting_game', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('user-session-1');

    const joinResult = manager.joinRoom(room.roomId, 'user-session-2');
    expect(joinResult.success).toBe(true);
    expect(room.state).toBe('selecting_game');
    expect(Object.keys(room.players)).toHaveLength(2);
  });

  it('prevents third player from joining full room', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('user-session-1');
    manager.joinRoom(room.roomId, 'user-session-2');

    const thirdResult = manager.joinRoom(room.roomId, 'user-session-3');
    expect(thirdResult.success).toBe(false);
    expect(thirdResult.error).toBe('Room is full');
  });

  it('masks opponent private information in buildClientGameState', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('p1');
    manager.joinRoom(room.roomId, 'p2');

    room.state = 'playing';
    room.gameType = 'word';
    room.players['p1'].word = 'SECRET1';
    room.players['p2'].word = 'SECRET2';
    room.players['p1'].mines = [{ index: 0, type: 'treasure' }];
    room.players['p2'].mines = [{ index: 5, type: 'treasure' }, { index: 6, type: 'bomb' }];

    // Check state for P1:
    const stateForP1 = manager.buildClientGameState(room, 'p1');
    expect(stateForP1.me.id).toBe('p1');
    expect(stateForP1.me.word).toBe('SECRET1'); // Me gets own word
    expect(stateForP1.me.mines).toHaveLength(1);

    // Opponent info for P1:
    expect(stateForP1.opponent).toBeDefined();
    expect(stateForP1.opponent?.id).toBe('p2');
    expect((stateForP1.opponent as any).word).toBeUndefined(); // Opponent word MUST be hidden!
    expect(stateForP1.opponent?.wordLength).toBe(7);
    expect(stateForP1.opponent?.isLocked).toBe(true);
    expect(stateForP1.opponent?.mines).toBeUndefined(); // Opponent mines MUST be hidden while playing!

    // When room state is 'ended', opponent mines are revealed
    room.state = 'ended';
    const endedState = manager.buildClientGameState(room, 'p1');
    expect(endedState.opponent?.mines).toBeDefined();
    expect(endedState.opponent?.mines).toHaveLength(2);
  });

  it('handles player leaving and assigns new host or cleans up', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('p1');
    manager.joinRoom(room.roomId, 'p2');

    // P1 (host) leaves -> P2 becomes new host
    const leaveResult = manager.leaveRoom('p1', room.roomId);
    expect(leaveResult.roomDeleted).toBe(false);
    expect(room.hostId).toBe('p2');
    expect(room.players['p1']).toBeUndefined();

    // P2 leaves -> room is deleted
    const finalLeave = manager.leaveRoom('p2', room.roomId);
    expect(finalLeave.roomDeleted).toBe(true);
    expect(manager.getRoom(room.roomId)).toBeUndefined();
  });

  it('resets game state properly while retaining scores', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('p1');
    manager.joinRoom(room.roomId, 'p2');

    room.scores['p1'] = 3;
    room.scores['p2'] = 2;
    room.gameType = 'mine';
    room.state = 'ended';
    room.players['p1'].mines = [{ index: 1, type: 'bomb' }];

    manager.resetGame(room);

    expect(room.state).toBe('planting');
    expect(room.scores['p1']).toBe(3); // Score preserved
    expect(room.scores['p2']).toBe(2); // Score preserved
    expect(room.players['p1'].mines).toEqual([]);
    expect(room.actionLog).toEqual([]);
  });
});
