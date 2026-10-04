import { random } from './game.js';
export async function loadRewards() {
  const url = new URL('../assets/rewards/manifest.json', import.meta.url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('報酬リストを読み込めませんでした。');
  const entries = await response.json();
  if (!Array.isArray(entries) || !entries.length) throw new Error('報酬画像が登録されていません。');
  const ids = new Set();
  return entries.map(entry => {
    if (!entry || !['id', 'name', 'src', 'alt'].every(key => typeof entry[key] === 'string' && entry[key].trim()) || ids.has(entry.id)) throw new Error('報酬リストの形式を確認してください。');
    ids.add(entry.id);
    const src = new URL(entry.src, url);
    if (src.origin !== url.origin || !['http:', 'https:'].includes(src.protocol)) throw new Error('報酬画像には同じサイト内のパスを指定してください。');
    return { ...entry, src: src.href };
  });
}
export function chooseReward(rewards, rng = random) {
  if (!rewards.length) throw new Error('報酬画像が登録されていません。');
  return rewards[Math.floor(rng() * rewards.length)];
}
