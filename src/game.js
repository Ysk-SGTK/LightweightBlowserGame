// Pure game rules. No DOM, storage, analytics, or reward coupling.
export const RULES = Object.freeze({ size: 10, mines: 12, seconds: 120 });
export function random() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
export function neighbors(index, size = RULES.size) {
  const row = Math.floor(index / size), col = index % size, result = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const y = row + dy, x = col + dx;
    if (y >= 0 && y < size && x >= 0 && x < size) result.push(y * size + x);
  }
  return result;
}
export function newGame() {
  return { cells: Array.from({ length: RULES.size ** 2 }, () => ({ mine: false, adjacent: 0, open: false, flag: false })), status: 'ready', opened: 0, flags: 0, hit: null };
}
function plant(game, first, rng) {
  const safe = new Set([first, ...neighbors(first)]);
  const positions = game.cells.map((_, i) => i).filter(i => !safe.has(i));
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  positions.slice(0, RULES.mines).forEach(i => { game.cells[i].mine = true; });
  game.cells.forEach((cell, i) => { cell.adjacent = neighbors(i).filter(n => game.cells[n].mine).length; });
  game.status = 'playing';
}
export function toggleFlag(game, index) {
  const cell = game.cells[index];
  if (!cell || cell.open || !['ready', 'playing'].includes(game.status)) return false;
  if (!cell.flag && game.flags >= RULES.mines) return false;
  cell.flag = !cell.flag;
  game.flags += cell.flag ? 1 : -1;
  return true;
}
export function reveal(game, index, rng = random) {
  const cell = game.cells[index];
  if (!cell || cell.flag || cell.open || !['ready', 'playing'].includes(game.status)) return false;
  if (game.status === 'ready') plant(game, index, rng);
  if (cell.mine) { cell.open = true; game.hit = index; game.status = 'lost'; return true; }
  const stack = [index];
  while (stack.length) {
    const i = stack.pop(), next = game.cells[i];
    if (next.open || next.flag || next.mine) continue;
    next.open = true;
    game.opened++;
    if (next.adjacent === 0) stack.push(...neighbors(i));
  }
  if (game.opened === game.cells.length - RULES.mines) game.status = 'won';
  return true;
}
export function expire(game) {
  if (game.status === 'playing') { game.status = 'timeout'; return true; }
  return false;
}
