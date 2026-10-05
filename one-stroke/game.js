export function createGame(puzzle, { now = () => performance.now(), resetCount = 0 } = {}) {
  const blocked = new Set(puzzle.blocked_cells);
  let path = [], startedAt = null, endedAt = null, moveCount = 0, undoCount = 0;
  function adjacent(a,b) { return Math.abs(a%puzzle.width-b%puzzle.width)+Math.abs(Math.floor(a/puzzle.width)-Math.floor(b/puzzle.width)) === 1; }
  return {
    step(cell) {
      if (endedAt !== null || !Number.isInteger(cell) || cell < 0 || cell >= puzzle.width*puzzle.height || blocked.has(cell)) return 'ignored';
      if (!path.length) {
        if (cell !== puzzle.start) return 'ignored';
        path.push(cell); startedAt = now(); return 'start';
      }
      if (!adjacent(path.at(-1),cell)) return 'ignored';
      if (cell === path.at(-2)) { path.pop(); undoCount++; return 'undo'; }
      // GOAL can be entered only as the final cell; an early attempt is ignored.
      if (path.includes(cell) || (cell === puzzle.goal && path.length !== puzzle.playable_cells-1)) return 'ignored';
      path.push(cell); moveCount++;
      if (path.length === puzzle.playable_cells && cell === puzzle.goal) { endedAt = now(); return 'clear'; }
      return 'move';
    },
    undo() { if (endedAt !== null || path.length < 2) return false; path.pop(); undoCount++; return true; },
    snapshot() { return {path:[...path],started:startedAt!==null,cleared:endedAt!==null,
      elapsed_seconds: startedAt===null ? 0 : Math.floor(((endedAt??now())-startedAt)/1000),
      move_count:moveCount,undo_count:undoCount,reset_count:resetCount}; }
  };
}
