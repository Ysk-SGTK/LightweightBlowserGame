import { settings } from './config.js';
const base = ['game_id','event_id','event_seq','event_name','timestamp','session_id','play_id','previous_play_id','difficulty','board_width','board_height','color_count','target_score'];
const stats = ['final_score','elapsed_seconds','total_blocks_removed','largest_group_removed','move_count','remaining_blocks'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validBlockEvent(e) {
  const terminal = ['game_clear','game_over'].includes(e.event_name), keys = terminal ? [...base, ...stats] : base;
  if (Object.keys(e).length !== keys.length || !keys.every(k => Object.hasOwn(e, k))) return false;
  if (!['page_view','game_start','game_clear','game_over','retry'].includes(e.event_name)) return false;
  if (!['event_id','session_id'].every(k => typeof e[k] === 'string' && uuid.test(e[k]))) return false;
  for (const k of ['play_id','previous_play_id']) if (e[k] !== null && (typeof e[k] !== 'string' || !uuid.test(e[k]))) return false;
  if (e.play_id !== null && e.play_id === e.previous_play_id || e.play_id === null && e.previous_play_id !== null) return false;
  if (e.event_name === 'page_view' && (e.play_id !== null || e.previous_play_id !== null)) return false;
  if (['game_start','game_clear','game_over'].includes(e.event_name) && e.play_id === null) return false;
  if (!Number.isSafeInteger(e.event_seq) || e.event_seq < 1) return false;
  if (typeof e.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.timestamp) || !Number.isFinite(Date.parse(e.timestamp))) return false;
  let spec; try { spec = settings(e.difficulty); } catch { return false; }
  if (!Object.keys(spec).every(k => e[k] === spec[k])) return false;
  if (terminal) {
    if (!stats.every(k => Number.isSafeInteger(e[k]) && e[k] >= 0)) return false;
    const count = e.board_width * e.board_height;
    if (e.total_blocks_removed + e.remaining_blocks !== count || e.total_blocks_removed > count) return false;
    if (e.move_count < 1 || e.move_count * 2 > e.total_blocks_removed || e.largest_group_removed < 2 || e.largest_group_removed > e.total_blocks_removed) return false;
    if (e.final_score < 2 * e.total_blocks_removed || e.final_score > e.total_blocks_removed * e.largest_group_removed) return false;
    if ((e.final_score >= e.target_score) !== (e.event_name === 'game_clear')) return false;
  }
  return true;
}
