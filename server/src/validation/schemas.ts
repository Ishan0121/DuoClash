import { z } from 'zod';

export const RoomIdSchema = z.object({
  roomId: z.string().min(1).max(20),
});

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1).max(20),
});

export const VoteGameSchema = z.object({
  roomId: z.string().min(1),
  gameVote: z.enum(['word', 'mine', 'dots', 'tictactoe', 'connectfour']),
});

export const LockWordSchema = z.object({
  roomId: z.string().min(1),
  word: z.string().min(1).max(12),
});

export const PlantMinesSchema = z.object({
  roomId: z.string().min(1),
  mines: z.array(
    z.object({
      index: z.number().int().min(0),
      type: z.enum(['treasure', 'bomb']),
    })
  ),
});

export const OpenBlockSchema = z.object({
  roomId: z.string().min(1),
  index: z.number().int().min(0),
});

export const DrawLineSchema = z.object({
  roomId: z.string().min(1),
  lineId: z.string().regex(/^[hv]-\d+-\d+$/),
});

export const TicTacToeMoveSchema = z.object({
  roomId: z.string().min(1),
  index: z.number().int().min(0).max(8),
});

export const ConnectFourMoveSchema = z.object({
  roomId: z.string().min(1),
  column: z.number().int().min(0).max(6),
});

export const AskLetterSchema = z.object({
  roomId: z.string().min(1),
  letter: z.string().length(1),
});

export const VerifyLetterResponseSchema = z.object({
  roomId: z.string().min(1),
  letter: z.string().length(1),
  count: z.number().int().min(0),
  positions: z.array(z.number().int().min(0)),
});

export const SolveWordSchema = z.object({
  roomId: z.string().min(1),
  word: z.string().min(1).max(12),
});

export const ChangeModeSchema = z.object({
  roomId: z.string().min(1),
  mode: z.enum(['automated', 'call']),
});

export const ToggleSettingSchema = z.object({
  roomId: z.string().min(1),
  key: z.string().min(1),
  value: z.any().optional(),
});

export const SendHintSchema = z.object({
  roomId: z.string().min(1),
  hint: z.string().max(200),
});

export const VisualHintSchema = z.object({
  roomId: z.string().min(1),
  index: z.number().int().min(0),
  type: z.enum(['treasure', 'bomb']),
});

export const UpdateProgressSchema = z.object({
  roomId: z.string().min(1),
  knownTiles: z.array(z.string()),
});

export const RespondChangeGameSchema = z.object({
  roomId: z.string().min(1),
  accepted: z.boolean(),
});
