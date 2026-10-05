import { settings } from './config.js';
const base = ['game_id','event_id','event_seq','event_name','timestamp','session_id','play_id','previous_play_id','difficulty','board_width','board_height','max_number'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validNumberEvent(e) {
  const clear = e.event_name === 'game_clear', keys = clear ? [...base,'elapsed_seconds','miss_count'] : base;
  if (Object.keys(e).length !== keys.length || !keys.every(k => Object.hasOwn(e,k))) return false;
  if (!['page_view','game_start','game_clear','retry'].includes(e.event_name)) return false;
  if (!['event_id','session_id'].every(k => typeof e[k] === 'string' && uuid.test(e[k]))) return false;
  for (const k of ['play_id','previous_play_id']) if (e[k] !== null && (typeof e[k] !== 'string' || !uuid.test(e[k]))) return false;
  if (e.play_id !== null && e.play_id === e.previous_play_id || e.play_id === null && e.previous_play_id !== null) return false;
  if (e.event_name === 'page_view' && (e.play_id !== null || e.previous_play_id !== null)) return false;
  if (['game_start','game_clear'].includes(e.event_name) && e.play_id === null) return false;
  if (!Number.isSafeInteger(e.event_seq) || e.event_seq < 1) return false;
  if (typeof e.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.timestamp) || !Number.isFinite(Date.parse(e.timestamp))) return false;
  let spec; try { spec = settings(e.difficulty); } catch { return false; }
  if (!Object.keys(spec).every(k => e[k] === spec[k])) return false;
  if (clear && (typeof e.elapsed_seconds !== 'number' || !Number.isFinite(e.elapsed_seconds) || e.elapsed_seconds < 0 || !Number.isSafeInteger(Math.round(e.elapsed_seconds * 10)) || Math.abs(e.elapsed_seconds * 10 - Math.round(e.elapsed_seconds * 10)) > 1e-6 || !Number.isSafeInteger(e.miss_count) || e.miss_count < 0)) return false;
  return true;
}
