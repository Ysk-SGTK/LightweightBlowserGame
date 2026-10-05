import { settings } from './config.js';

export function shuffle(max, random = Math.random, previous = []) {
  const numbers = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = max - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  // Even an unlikely identical shuffle must change on retry.
  if (numbers.every((n, i) => n === previous[i])) numbers.push(numbers.shift());
  return numbers;
}

export function createGame(difficulty = 'Normal', { now = () => performance.now(), random = Math.random, previous = [] } = {}) {
  const spec = settings(difficulty), numbers = shuffle(spec.max_number, random, previous);
  let next = 1, misses = 0, startedAt = null, endedAt = null;
  function snapshot() {
    const elapsed = startedAt === null ? 0 : Math.max(0, (endedAt ?? now()) - startedAt);
    return { ...spec, numbers: [...numbers], next, miss_count: misses, started: startedAt !== null,
      clear: endedAt !== null, elapsed_seconds: Math.round(elapsed / 100) / 10 };
  }
  return {
    snapshot,
    start() {
      if (startedAt !== null) return false;
      startedAt = now();
      return true;
    },
    tap(number) {
      if (startedAt === null || endedAt !== null || !Number.isInteger(number) || number < 1 || number > spec.max_number || number < next) return 'ignored';
      if (number !== next) { misses++; return 'miss'; }
      const time = now();
      next++;
      if (number === spec.max_number) endedAt = time;
      return endedAt === null ? 'correct' : 'clear';
    }
  };
}
