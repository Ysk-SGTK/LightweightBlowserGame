import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, newGame, reveal, neighbors, toggleFlag, expire } from '../src/game.js';
import { chooseReward } from '../src/rewards.js';

function seeded(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
test('1000 seeded boards: exact mine count, safe first opening, adjacency and flood invariant', () => {
  for (let first = 0; first < RULES.size ** 2; first++) for (let seed = 1; seed <= 10; seed++) {
    const game = newGame();
    reveal(game, first, seeded(seed));
    assert.equal(game.cells.filter(c => c.mine).length, RULES.mines);
    for (const i of [first, ...neighbors(first)]) assert.equal(game.cells[i].mine, false);
    assert.equal(game.cells[first].adjacent, 0);
    assert.equal(game.cells.some(c => c.open && c.mine), false);
    assert.equal(game.opened, game.cells.filter(c => c.open).length);
    game.cells.forEach((cell, i) => {
      let count = 0;
      for (let j = 0; j < RULES.size ** 2; j++) if (j !== i && Math.abs(Math.floor(j / RULES.size) - Math.floor(i / RULES.size)) <= 1 && Math.abs(j % RULES.size - i % RULES.size) <= 1 && game.cells[j].mine) count++;
      assert.equal(cell.adjacent, count);
    });
  }
});
test('clearing all safe cells wins without requiring mine flags; terminal board is immutable', () => {
  const game = newGame();
  reveal(game, 0, seeded(1));
  game.cells.forEach((cell, index) => { if (!cell.mine) reveal(game, index); });
  assert.equal(game.status, 'won');
  assert.equal(game.opened, RULES.size ** 2 - RULES.mines);
  const snapshot = JSON.stringify(game);
  assert.equal(reveal(game, game.cells.findIndex(c => c.mine)), false);
  assert.equal(toggleFlag(game, game.cells.length - 1), false);
  assert.equal(expire(game), false);
  assert.equal(JSON.stringify(game), snapshot);
});
test('mine loses and preserves the clicked mine location', () => {
  const game = newGame();
  reveal(game, 0, seeded(4));
  const mine = game.cells.findIndex(c => c.mine);
  assert.equal(reveal(game, mine), true);
  assert.equal(game.status, 'lost');
  assert.equal(game.hit, mine);
});
test('flags are capped, reversible, and prevent opening; a flagged safe cell blocks victory', () => {
  const game = newGame();
  for (let i = 0; i < RULES.mines; i++) assert.equal(toggleFlag(game, i), true);
  assert.equal(toggleFlag(game, RULES.mines), false);
  assert.equal(reveal(game, 0), false);
  assert.equal(game.status, 'ready');
  for (let i = 0; i < RULES.mines; i++) toggleFlag(game, i);
  toggleFlag(game, 1);
  reveal(game, 0, seeded(1));
  game.cells.forEach((cell, index) => { if (!cell.mine && !cell.flag) reveal(game, index); });
  assert.equal(game.status, 'playing');
  toggleFlag(game, 1);
  reveal(game, 1);
  assert.equal(game.status, 'won');
});
test('timeout applies only to a live game; restart is completely independent', () => {
  const game = newGame();
  assert.equal(expire(game), false);
  reveal(game, 0, seeded(2));
  assert.equal(expire(game), true);
  assert.equal(game.status, 'timeout');
  assert.equal(reveal(game, 1), false);
  const fresh = newGame();
  assert.equal(fresh.status, 'ready');
  assert.equal(fresh.opened, 0);
  assert.equal(fresh.flags, 0);
  assert.equal(fresh.cells.some(c => c.mine || c.flag || c.open), false);
});
test('reward selection uses the entire configured pool and returns exactly one item', () => {
  const rewards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(chooseReward(rewards, () => 0).id, 'a');
  assert.equal(chooseReward(rewards, () => .5).id, 'b');
  assert.equal(chooseReward(rewards, () => .999999).id, 'c');
  assert.throws(() => chooseReward([]));
});
