import { RULES, newGame, reveal, toggleFlag, expire } from './game.js';
import { loadRewards, chooseReward } from './rewards.js';
import { emit } from './events.js';
import { createAnalytics } from './analytics.js';

const $ = id => document.getElementById(id);
let game, mode, startedAt, endedAt, interval, round = 0;
const rewardList = loadRewards().then(data => ({ data }), error => ({ error }));
const format = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const elapsed = () => startedAt === null ? 0 : Math.min(RULES.seconds, Math.floor(((endedAt ?? Date.now()) - startedAt) / 1000));
const active = () => ['ready', 'playing'].includes(game.status);
const analytics = createAnalytics(RULES);

function render() {
  $('timer').textContent = format(RULES.seconds - elapsed());
  $('flags').textContent = String(RULES.mines - game.flags);
  $('progress').textContent = `${game.opened} / ${RULES.size ** 2 - RULES.mines}`;
  [...$('board').children].forEach((button, i) => {
    const cell = game.cells[i], showMine = cell.mine && !active();
    button.className = `cell${cell.open ? ' revealed' : ''}${cell.flag ? ' flagged' : ''}${showMine ? ' mine' : ''}${game.hit === i ? ' hit' : ''}`;
    button.textContent = showMine ? '✹' : cell.flag ? '⚑' : cell.open && cell.adjacent ? cell.adjacent : '';
    button.dataset.number = cell.open ? cell.adjacent : '';
    button.disabled = cell.open || !active();
    const state = showMine ? '地雷' : cell.flag ? '旗あり' : cell.open ? `周囲の地雷${cell.adjacent}個` : '未開封';
    button.setAttribute('aria-label', `${Math.floor(i / RULES.size) + 1}行${i % RULES.size + 1}列、${state}`);
  });
  $('open-mode').disabled = $('flag-mode').disabled = !active();
}
function selectMode(next) {
  mode = next;
  $('open-mode').setAttribute('aria-pressed', String(next === 'open'));
  $('flag-mode').setAttribute('aria-pressed', String(next === 'flag'));
  $('status').textContent = next === 'flag' ? '地雷だと思うマスをタップ。再タップで旗を外せます。' : game.status === 'ready' ? '最初のタップは安全です。' : '地雷を避けて、安全なマスをすべて開こう。';
}
function tick() {
  if (game.status === 'playing' && elapsed() >= RULES.seconds && expire(game)) finish();
  render();
}
async function showReward(currentRound) {
  const result = await rewardList;
  if (round !== currentRound || game.status !== 'won') return;
  if (result.error) { $('status').textContent = `クリア！ ${result.error.message}`; return; }
  const reward = chooseReward(result.data);
  const image = $('reward-image');
  image.hidden = false;
  $('image-error').hidden = true;
  image.onerror = () => { image.hidden = true; $('image-error').hidden = false; };
  image.alt = reward.alt;
  image.src = reward.src;
  $('reward-name').textContent = reward.name;
  $('clear-time').textContent = `${format(elapsed())} でクリア`;
  emit('reward_granted', { round, rewardId: reward.id });
  $('reward-dialog').showModal();
}
function finish() {
  if (endedAt !== null) return;
  endedAt = Date.now();
  clearInterval(interval);
  const messages = { won: 'クリア！あなたの宝ものが届きました。', lost: '地雷でした。もう一度、宝さがしに出かけよう。', timeout: '時間になりました。もう一度挑戦してみよう。' };
  $('status').textContent = messages[game.status];
  $('status').classList.toggle('ended', game.status !== 'won');
  emit('game_finished', { round, outcome: game.status, elapsedSeconds: elapsed(), opened: game.opened });
  analytics.finish(game.status, { elapsed_seconds: elapsed(), opened_cells: game.opened, flags_used: game.flags });
  render();
  if (game.status === 'won') void showReward(round);
}
function move(index) {
  if (!active()) return;
  tick();
  if (!active()) return;
  const before = game.status;
  const changed = mode === 'flag' ? toggleFlag(game, index) : reveal(game, index);
  if (!changed) {
    if (mode === 'flag' && game.flags >= RULES.mines) $('status').textContent = `旗は${RULES.mines}本まで。別の旗を外すと置けます。`;
    return;
  }
  if (before === 'ready' && game.status !== 'ready') {
    startedAt = Date.now();
    interval = setInterval(tick, 250);
    emit('game_started', { round, rules: RULES });
    analytics.start();
    $('status').textContent = '地雷を避けて、安全なマスをすべて開こう。';
  }
  render();
  if (!active()) finish();
}
function restart(userAction = false) {
  if (userAction) analytics.retry();
  const wasDialog = $('reward-dialog').open;
  if (game?.status === 'playing') emit('game_abandoned', { round, elapsedSeconds: elapsed(), opened: game.opened });
  clearInterval(interval);
  $('reward-dialog').close();
  game = newGame();
  round++;
  startedAt = null;
  endedAt = null;
  $('status').classList.remove('ended');
  selectMode('open');
  $('board').replaceChildren(...game.cells.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => move(index));
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (!active()) return;
      tick();
      if (toggleFlag(game, index)) render();
    });
    return button;
  }));
  $('board').style.setProperty('--columns', RULES.size);
  $('board').setAttribute('aria-label', `${RULES.size}行${RULES.size}列の地雷フィールド`);
  $('rule-mines').textContent = RULES.mines;
  $('rule-seconds').textContent = RULES.seconds / 60;
  $('rule-safe').textContent = RULES.size ** 2 - RULES.mines;
  render();
  if (wasDialog) $('board').firstElementChild.focus();
}
$('open-mode').addEventListener('click', () => selectMode('open'));
$('flag-mode').addEventListener('click', () => selectMode('flag'));
$('restart').addEventListener('click', () => restart(true));
$('reward-restart').addEventListener('click', () => restart(true));
$('close-reward').addEventListener('click', () => { $('reward-dialog').close(); $('restart').focus(); });
document.addEventListener('visibilitychange', tick);
restart();
analytics.pageView();
