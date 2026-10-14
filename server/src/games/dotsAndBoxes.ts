export interface ClaimBoxResult {
  newBoxes: Record<string, string>;
  boxesCompleted: number;
}

export function drawLineAndClaimBoxes(
  currentLines: string[],
  currentBoxes: Record<string, string>,
  lineId: string,
  gridSize: number,
  playerId: string
): {
  alreadyDrawn: boolean;
  newLines: string[];
  newBoxes: Record<string, string>;
  boxesCompleted: number;
} {
  if (currentLines.includes(lineId)) {
    return {
      alreadyDrawn: true,
      newLines: currentLines,
      newBoxes: currentBoxes,
      boxesCompleted: 0,
    };
  }

  const newLines = [...currentLines, lineId];
  const newBoxes = { ...currentBoxes };
  const parts = lineId.split('-');
  const type = parts[0];
  const r = parseInt(parts[1], 10);
  const c = parseInt(parts[2], 10);

  const checkAndClaimBox = (br: number, bc: number): number => {
    if (br < 0 || bc < 0 || br >= gridSize || bc >= gridSize) return 0;
    const boxId = `${br}-${bc}`;
    if (newBoxes[boxId]) return 0;

    const top = newLines.includes(`h-${br}-${bc}`);
    const bottom = newLines.includes(`h-${br + 1}-${bc}`);
    const left = newLines.includes(`v-${br}-${bc}`);
    const right = newLines.includes(`v-${br}-${bc + 1}`);

    if (top && bottom && left && right) {
      newBoxes[boxId] = playerId;
      return 1;
    }
    return 0;
  };

  let boxesCompleted = 0;
  if (type === 'h') {
    boxesCompleted += checkAndClaimBox(r - 1, c);
    boxesCompleted += checkAndClaimBox(r, c);
  } else if (type === 'v') {
    boxesCompleted += checkAndClaimBox(r, c - 1);
    boxesCompleted += checkAndClaimBox(r, c);
  }

  return {
    alreadyDrawn: false,
    newLines,
    newBoxes,
    boxesCompleted,
  };
}

export function checkDotsGameOver(
  boxes: Record<string, string>,
  gridSize: number,
  playerIds: string[]
): {
  isOver: boolean;
  winnerId: string | 'draw' | null;
  scores: Record<string, number>;
} {
  const totalBoxes = gridSize * gridSize;
  const claimedCount = Object.keys(boxes).length;

  const scores: Record<string, number> = {};
  playerIds.forEach((id) => {
    scores[id] = 0;
  });

  Object.values(boxes).forEach((ownerId) => {
    if (scores[ownerId] !== undefined) {
      scores[ownerId]++;
    } else {
      scores[ownerId] = 1;
    }
  });

  if (claimedCount < totalBoxes) {
    return { isOver: false, winnerId: null, scores };
  }

  const p1 = playerIds[0];
  const p2 = playerIds[1];
  const s1 = scores[p1] || 0;
  const s2 = scores[p2] || 0;

  let winnerId: string | 'draw' = 'draw';
  if (s1 > s2) winnerId = p1;
  else if (s2 > s1) winnerId = p2;

  return {
    isOver: true,
    winnerId,
    scores,
  };
}
