import { createGame, findGroup } from './game.js';
import { settings, REWARD } from './config.js';
import { createBlockAnalytics } from './analytics.js';
const $ = id => document.getElementById(id);
const colors = ['#ef9476','#e4c765','#77bea1','#80b8da','#bda0cf','#e8b5ce'];
const symbols = ['●','◆','▲','■','✦','＋'];
const names = ['朱色','黄色','緑色','青色','紫色','桃色'];
const analytics = createBlockAnalytics();
let game, spec, locked = false, version = 0;
const nodes = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const duration = ms => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms;
const timeText = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
function stats() {
  const s = game.snapshot();
  $('score').textContent = s.final_score; $('target').textContent = s.target_score;
  $('time').textContent = timeText(s.elapsed_seconds); $('largest').textContent = s.largest_group_removed;
  $('progress').style.width = `${Math.min(100, s.final_score / s.target_score * 100)}%`;
}
function draw() {
  const s = game.snapshot(), live = new Set();
  s.board.forEach((col, x) => col.forEach((cell, y) => {
    if (!cell) return;
    live.add(cell.id);
    let node = nodes.get(cell.id);
    if (!node) {
      node = document.createElement('button'); node.className = 'block'; node.dataset.id = cell.id;
      const face = document.createElement('span'); face.textContent = symbols[cell.color]; face.setAttribute('aria-hidden', 'true'); node.append(face);
      node.style.setProperty('--color', colors[cell.color]); nodes.set(cell.id, node); $('board').append(node);
    }
    node.dataset.x = x; node.dataset.y = y; node.dataset.color = cell.color;
    node.setAttribute('aria-label', `${names[cell.color]} ${x + 1}列 ${y + 1}行`);
    node.style.setProperty('--x', x); node.style.setProperty('--y', y);
    node.disabled = Boolean(s.result);
  }));
  for (const [id, node] of nodes) if (!live.has(id)) { node.remove(); nodes.delete(id); }
  stats();
}
function finish() {
  const s = game.snapshot();
  if (!s.result) return;
  const { final_score, elapsed_seconds, total_blocks_removed, largest_group_removed, move_count, remaining_blocks } = s;
  analytics.finish(s.result, spec, { final_score, elapsed_seconds, total_blocks_removed, largest_group_removed, move_count, remaining_blocks });
  $('outcome').textContent = s.result === 'clear' ? 'CLEAR' : 'GAME OVER';
  $('summary').replaceChildren();
  for (const [name, value] of [['最終スコア', final_score], ['目標スコア', s.target_score], ['消したブロック', total_blocks_removed], ['最大同時消去', largest_group_removed], ['プレイ時間', timeText(elapsed_seconds)]]) {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = name; dd.textContent = value; row.append(dt, dd); $('summary').append(row);
  }
  $('reward').hidden = s.result !== 'clear';
  $('reward').querySelector('img').src = REWARD.src; $('reward').querySelector('img').alt = REWARD.name;
  $('reward').querySelector('figcaption').textContent = REWARD.name;
  $('result').hidden = false; $('result').focus({ preventScroll: true });
  $('hint').textContent = '消せるグループがなくなりました';
}
async function choose(node) {
  if (locked || game.snapshot().result) return;
  const x = Number(node.dataset.x), y = Number(node.dataset.y), before = game.snapshot();
  const group = findGroup(before.board, x, y);
  if (group.length < 2) { $('hint').textContent = '1個だけでは消せません。2個以上のまとまりを探そう'; return; }
  locked = true; $('board').setAttribute('aria-busy', 'true');
  const token = version;
  analytics.start(spec);
  const removed = game.remove(x, y);
  for (const [gx, gy] of group) nodes.get(before.board[gx][gy].id).classList.add('removing', ...(group.length >= 5 ? ['big'] : []));
  $('popup').textContent = `+${removed.points}`; $('popup').classList.remove('show'); void $('popup').offsetWidth; $('popup').classList.add('show');
  await wait(duration(150)); if (token !== version) return;
  draw();
  await wait(duration(200)); if (token !== version) return;
  locked = false; $('board').setAttribute('aria-busy', 'false');
  $('hint').textContent = game.snapshot().final_score >= spec.target_score ? '目標達成！ 消せなくなるまで続けよう' : '上下左右で2個以上つながった色をタップ';
  finish();
}
function reset(retry = false) {
  if (retry) analytics.retry(spec);
  version++; locked = false;
  spec = settings($('difficulty').value); game = createGame(spec.difficulty);
  nodes.clear(); $('board').replaceChildren(); $('board').setAttribute('aria-busy', 'false');
  $('board').style.setProperty('--w', spec.board_width); $('board').style.setProperty('--h', spec.board_height);
  $('board').style.aspectRatio = `${spec.board_width}/${spec.board_height}`;
  $('result').hidden = true; $('popup').classList.remove('show');
  $('hint').textContent = '上下左右で2個以上つながった色をタップ'; draw();
}
$('board').addEventListener('click', e => { const node = e.target.closest('.block'); if (node) void choose(node); });
$('restart').addEventListener('click', () => reset(true));
$('retry').addEventListener('click', () => { reset(true); $('restart').focus({ preventScroll: true }); });
$('difficulty').addEventListener('change', () => reset(true));
reset(); analytics.pageView(spec); setInterval(stats, 250);
