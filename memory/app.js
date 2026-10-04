import { CARD_THEME, REWARD_IMAGE } from './config.js';
import { cardSet, BACK_SVG } from './cards.js';
import { createGame } from './game.js';
import { createMemoryAnalytics } from './analytics.js';

const cards = cardSet(CARD_THEME), analytics = createMemoryAnalytics(CARD_THEME);
const board = document.querySelector('#board'), dialog = document.querySelector('#clear-dialog');
const status = document.querySelector('#status'), reward = document.querySelector('#reward-image');
const HALF_FLIP_MS = 160, REVEAL_MS = 550, MATCH_MS = 200, COMPLETE_MS = 320;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let game = createGame(), clock, presentation = new AbortController(), resolving = false;
const visibleCards = new Set(), matchedCards = new Set(), flipping = new Map();
let mismatchCards = [], complete = false;
const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
if (CARD_THEME === 'botanical') {
  document.querySelector('h1').textContent = '花あわせ';
  document.querySelector('header p').textContent = '2枚めくって、同じ花を見つけよう。';
  document.querySelector('#clear-title').textContent = 'すべての花が、そろいました。';
  document.title = '花あわせ — 小さな神経衰弱';
}
function stats() {
  const s = game.snapshot();
  document.querySelector('#elapsed').textContent = formatTime(s.elapsed_seconds);
  document.querySelector('#flips').innerHTML = `${s.flip_count}<span> 回</span>`;
  document.querySelector('#pairs').innerHTML = `${s.pairs_matched}<span> / 8</span>`;
}
function render() {
  const s = game.snapshot();
  [...board.children].forEach((button, i) => {
    const matched = matchedCards.has(i), visible = visibleCards.has(i);
    button.classList.toggle('face-up', visible); button.classList.toggle('matched', matched);
    button.classList.toggle('is-mismatch', mismatchCards.includes(i));
    button.disabled = matched || flipping.has(i) || resolving || s.locked || s.cleared;
    button.setAttribute('aria-label', `${i + 1}枚目、${visible ? cards[s.deck[i]].name : '裏向き'}${matched ? '、ペア成立' : ''}`);
    button.setAttribute('aria-pressed', String(visible));
  });
  board.classList.toggle('is-complete', complete);
  stats();
}
function buildBoard() {
  const s = game.snapshot();
  board.replaceChildren(...s.deck.map((value, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'card';
    button.innerHTML = `<span class="card-inner"><span class="card-face card-back">${BACK_SVG}</span><span class="card-face card-front">${cards[value].svg}</span></span>`;
    button.addEventListener('click', () => flip(i));
    return button;
  }));
  render();
}
// Presentation owns the visible face; game state and analytics still update once.
function wait(ms, signal, motion = true) {
  return new Promise(resolve => {
    if (signal.aborted) return resolve(false);
    const done = value => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(value); };
    const abort = () => done(false);
    const timer = setTimeout(() => done(true), motion && reducedMotion.matches ? 0 : ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
async function flipFace(index, faceUp, signal) {
  const inner = board.children[index].querySelector('.card-inner');
  async function phase(from, to) {
    if (signal.aborted) return false;
    if (reducedMotion.matches) return true;
    const animation = inner.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }],
      { duration: HALF_FLIP_MS, easing: 'ease-in-out', fill: 'forwards' });
    const cancel = () => animation.cancel();
    signal.addEventListener('abort', cancel, { once: true });
    try {
      await animation.finished;
      // Keep the final width while swapping the visible face between phases.
      inner.style.transform = `scaleX(${to})`;
      return !signal.aborted;
    } catch { return false; }
    finally { signal.removeEventListener('abort', cancel); animation.cancel(); }
  }
  if (!await phase(1, .05)) return false;
  if (signal.aborted) return false;
  if (faceUp) visibleCards.add(index); else visibleCards.delete(index);
  render(); // Swap ONLY at the narrow midpoint, for both open and close.
  if (!await phase(.05, 1)) return false;
  inner.style.transform = '';
  return !signal.aborted;
}
async function flip(index) {
  if (resolving || flipping.has(index) || visibleCards.has(index)) return;
  const signal = presentation.signal;
  const firstIndex = game.snapshot().open[0];
  const wasStarted = game.snapshot().started;
  const result = game.flip(index);
  if (result === 'ignored') return;
  if (!wasStarted) { analytics.start(); clock = setInterval(stats, 250); }
  if (result === 'first') status.textContent = 'もう1枚、めくってみよう。';
  if (result !== 'first') resolving = true;
  // Freeze time/log the result at the original logical completion, before effects.
  if (result === 'clear') {
    clearInterval(clock);
    const s = game.snapshot();
    analytics.clear({ elapsed_seconds: s.elapsed_seconds, flip_count: s.flip_count,
      mismatch_count: s.mismatch_count, pairs_matched: s.pairs_matched });
    document.querySelector('#clear-stats').textContent = `${formatTime(s.elapsed_seconds)} · ${s.flip_count}回めくってクリア`;
  }
  const opening = flipFace(index, true, signal);
  flipping.set(index, opening); render();
  const firstOpening = flipping.get(firstIndex);
  await Promise.all([opening, firstOpening]);
  if (signal.aborted) return;
  flipping.delete(index); render();
  if (result === 'first') return;
  const pair = [firstIndex, index];
  if (result === 'mismatch') {
    mismatchCards = pair; status.textContent = 'よく覚えて、次の2枚へ。'; render();
    if (!await wait(REVEAL_MS, signal, false)) return;
    mismatchCards = []; render();
    await Promise.all(pair.map(i => flipFace(i, false, signal)));
    if (signal.aborted) return;
    game.conceal(); resolving = false; status.textContent = '次のペアを探そう。'; render();
    return;
  }
  pair.forEach(i => matchedCards.add(i));
  status.textContent = 'ペアがそろいました。';
  if (result === 'match') resolving = false;
  render();
  if (result === 'clear') {
    if (!await wait(MATCH_MS, signal)) return;
    complete = true; status.textContent = '8ペア完成！'; render();
    if (!await wait(COMPLETE_MS, signal)) return;
    document.querySelector('#restart').firstChild.textContent = 'もう一度遊ぶ ';
    reward.hidden = false; document.querySelector('#reward-fallback').hidden = true;
    reward.src = REWARD_IMAGE;
    dialog.showModal();
  }
}
function restart() {
  presentation.abort(); presentation = new AbortController(); clearInterval(clock);
  board.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
  visibleCards.clear(); matchedCards.clear(); flipping.clear();
  mismatchCards = []; complete = false; resolving = false;
  analytics.retry(); game = createGame(game.snapshot().deck);
  if (dialog.open) dialog.close();
  status.textContent = '好きなカードから、どうぞ。';
  buildBoard();
}
reward.addEventListener('error', () => { reward.hidden = true; document.querySelector('#reward-fallback').hidden = false; });
document.querySelector('#restart').addEventListener('click', restart);
document.querySelector('#play-again').addEventListener('click', restart);
document.querySelector('#view-board').addEventListener('click', () => dialog.close());
buildBoard(); analytics.pageView();
