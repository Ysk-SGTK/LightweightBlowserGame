export const PAIRS = 8;
export const MISMATCH_MS = 750;

export function shuffledDeck(random = Math.random, previous = []) {
  const deck = Array.from({ length: 16 }, (_, i) => i % PAIRS);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  // Make a restart visibly different, even on the rare identical shuffle.
  if (deck.every((value, i) => value === previous[i])) {
    const j = deck.findIndex(value => value !== deck[0]);
    [deck[0], deck[j]] = [deck[j], deck[0]];
  }
  return deck;
}

export function createGame(previous = [], random = Math.random) {
  const deck = shuffledDeck(random, previous);
  const matched = new Set();
  let open = [], flips = 0, mismatches = 0, startedAt = null, endedAt = null;
  return {
    snapshot(now = performance.now()) {
      return { deck: [...deck], open: [...open], matched: [...matched], flip_count: flips,
        mismatch_count: mismatches, pairs_matched: matched.size / 2,
        elapsed_seconds: startedAt === null ? 0 : Math.floor(((endedAt ?? now) - startedAt) / 1000),
        started: startedAt !== null, cleared: endedAt !== null, locked: open.length === 2 };
    },
    flip(index, now = performance.now()) {
      if (!Number.isInteger(index) || index < 0 || index >= 16 || endedAt !== null || open.length === 2 || matched.has(index) || open.includes(index)) return 'ignored';
      if (startedAt === null) startedAt = now;
      open.push(index); flips++;
      if (open.length === 1) return 'first';
      if (deck[open[0]] !== deck[open[1]]) { mismatches++; return 'mismatch'; }
      open.forEach(i => matched.add(i)); open = [];
      if (matched.size === 16) { endedAt = now; return 'clear'; }
      return 'match';
    },
    conceal() { if (open.length === 2) open = []; }
  };
}
