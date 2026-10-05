import { createGame } from './game.js';
import { settings, REWARD } from './config.js';
import { createNumberAnalytics } from './analytics.js';
const $ = id => document.getElementById(id);
const analytics = createNumberAnalytics();
let game, timer = null;
function stopTimer() { if (timer !== null) clearInterval(timer); timer = null; }
function renderStats() {
  const s = game.snapshot();
  $('next').textContent = s.clear ? '✓' : s.next;
  $('time').textContent = s.elapsed_seconds.toFixed(1);
  $('miss').textContent = s.miss_count;
}
function reset(retry = false) {
  const old = game?.snapshot();
  if (retry) analytics.retry(settings(old.difficulty));
  stopTimer();
  game = createGame($('difficulty').value, { previous: old?.numbers });
  const s = game.snapshot();
  $('board').style.setProperty('--size', s.board_width);
  $('board').replaceChildren(...s.numbers.map(number => {
    const button = document.createElement('button');
    button.className = 'number'; button.textContent = number; button.dataset.number = number;
    button.setAttribute('aria-label', String(number));
    return button;
  }));
  $('board-wrap').classList.add('ready');
  $('board').inert = true;
  $('board').setAttribute('aria-hidden', 'true');
  $('start').hidden = false;
  $('result').hidden = true;
  $('hint').textContent = 'スタートを押すと、数字が表示されます';
  renderStats();
}
$('start').addEventListener('click', () => {
  if (!game.start()) return;
  $('board-wrap').classList.remove('ready');
  $('board').inert = false;
  $('board').removeAttribute('aria-hidden');
  $('start').hidden = true;
  analytics.start(settings(game.snapshot().difficulty));
  timer = setInterval(renderStats, 50);
  $('hint').textContent = '1から順番にタップ！';
  renderStats();
});
$('board').addEventListener('click', event => {
  const button = event.target.closest('button[data-number]');
  if (!button || button.disabled) return;
  const outcome = game.tap(Number(button.dataset.number));
  if (outcome === 'ignored') return;
  if (outcome === 'miss') {
    button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong');
  } else {
    button.disabled = true; button.classList.remove('wrong'); button.classList.add('done');
    button.setAttribute('aria-label', `${button.dataset.number} 押し済み`);
  }
  renderStats();
  if (outcome !== 'clear') return;
  stopTimer();
  const s = game.snapshot();
  analytics.clear(settings(s.difficulty), { elapsed_seconds: s.elapsed_seconds, miss_count: s.miss_count });
  $('hint').textContent = 'すべて押せた！';
  $('summary').textContent = `${s.difficulty} · ${s.elapsed_seconds.toFixed(1)}秒 · MISS ${s.miss_count}`;
  const img = $('reward'); img.src = REWARD.src; img.alt = REWARD.alt;
  $('caption').textContent = REWARD.caption;
  $('result').hidden = false;
  // Keep the retry control immediately usable; the animation never locks input.
  $('result').focus({ preventScroll: true });
  $('result').scrollIntoView({ block: 'nearest', behavior: 'instant' });
});
$('restart').addEventListener('click', () => reset(true));
$('retry').addEventListener('click', () => { reset(true); $('start').focus({ preventScroll: true }); $('board-wrap').scrollIntoView({ block: 'nearest', behavior: 'instant' }); });
$('difficulty').addEventListener('change', () => reset(true));
reset();
analytics.pageView(settings(game.snapshot().difficulty));
