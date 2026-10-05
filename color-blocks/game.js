import { settings, scoreGroup } from './config.js';

// Columns run left to right; each column runs top to bottom. IDs survive movement.
export function findGroup(board, x, y) {
  const first = board[x]?.[y];
  if (!first) return [];
  const found = [], seen = new Set(), pending = [[x, y]];
  while (pending.length) {
    const [cx, cy] = pending.pop(), key = `${cx},${cy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (board[cx]?.[cy]?.color !== first.color) continue;
    found.push([cx, cy]);
    pending.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
  }
  return found;
}
export const hasMoves = board => board.some((col, x) => col.some((cell, y) => cell &&
  (board[x + 1]?.[y]?.color === cell.color || col[y + 1]?.color === cell.color)));
export const remainingBlocks = board => board.flat().filter(Boolean).length;
export function removeGroup(board, group) {
  const next = board.map(col => col.slice());
  for (const [x, y] of group) next[x][y] = null;
  return next;
}
export function applyGravity(board) {
  return board.map(col => { const cells = col.filter(Boolean); return [...Array(col.length - cells.length).fill(null), ...cells]; });
}
export function compactColumns(board) {
  const occupied = board.filter(col => col.some(Boolean));
  return [...occupied, ...Array.from({ length: board.length - occupied.length }, () => Array(board[0].length).fill(null))];
}
export function outcome(board, score, target) {
  return hasMoves(board) ? null : score >= target ? 'clear' : 'over';
}
export function generateBoard(spec, random = Math.random) {
  const count = spec.board_width * spec.board_height;
  // Equal color inventory avoids extreme bias without planting easy groups.
  for (let attempt = 0; attempt < 100; attempt++) {
    const colors = Array.from({ length: count }, (_, i) => i % spec.color_count);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    const board = Array.from({ length: spec.board_width }, (_, x) =>
      Array.from({ length: spec.board_height }, (_, y) => ({ id: x * spec.board_height + y, color: colors[x * spec.board_height + y] })));
    if (hasMoves(board)) return board;
  }
  throw new Error('Could not generate a playable board');
}
export function createGame(difficulty = 'Normal', { random = Math.random, now = () => performance.now(), board: initial } = {}) {
  const spec = settings(difficulty);
  let board = initial ? initial.map(col => col.slice()) : generateBoard(spec, random);
  let score = 0, total = 0, largest = 0, moves = 0, started = null, ended = null, result = null;
  return {
    snapshot() { return { ...spec, board: board.map(col => col.slice()), final_score: score,
      total_blocks_removed: total, largest_group_removed: largest, move_count: moves,
      remaining_blocks: remainingBlocks(board), elapsed_seconds: started === null ? 0 : Math.floor(((ended ?? now()) - started) / 1000), result }; },
    remove(x, y) {
      if (result) return null;
      const group = findGroup(board, x, y);
      if (group.length < 2) return null;
      if (started === null) started = now();
      board = compactColumns(applyGravity(removeGroup(board, group)));
      score += scoreGroup(group.length); total += group.length; largest = Math.max(largest, group.length); moves++;
      result = outcome(board, score, spec.target_score);
      if (result) ended = now();
      return { group, points: scoreGroup(group.length) };
    }
  };
}
