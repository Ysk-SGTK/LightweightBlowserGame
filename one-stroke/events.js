// API allowlist and exact fixed-board metadata, with no solution data.
import { catalog } from './catalog.js';
const base = ['game_id','event_id','event_seq','event_name','timestamp','session_id','play_id','previous_play_id','puzzle_id','difficulty','width','height','playable_cells'];
const stats = ['elapsed_seconds','move_count','undo_count','reset_count'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validStrokeEvent(e) {
  const keys=e.event_name==='game_clear'?[...base,...stats]:base;
  if(Object.keys(e).length!==keys.length||!keys.every(k=>Object.hasOwn(e,k)))return false;
  if(!['page_view','game_start','game_clear','retry','next_level'].includes(e.event_name))return false;
  if(!['event_id','session_id'].every(k=>typeof e[k]==='string'&&uuid.test(e[k])))return false;
  for(const k of ['play_id','previous_play_id'])if(e[k]!==null&&(typeof e[k]!=='string'||!uuid.test(e[k])))return false;
  if(e.play_id!==null&&e.play_id===e.previous_play_id)return false;
  if(e.play_id===null&&e.previous_play_id!==null)return false;
  if(e.event_name==='page_view'&&(e.play_id!==null||e.previous_play_id!==null))return false;
  if(['game_start','game_clear'].includes(e.event_name)&&e.play_id===null)return false;
  if(!Number.isSafeInteger(e.event_seq)||e.event_seq<1)return false;
  if(typeof e.timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.timestamp)||!Number.isFinite(Date.parse(e.timestamp)))return false;
  const spec=catalog.find(p=>p.id===e.puzzle_id);
  if(!spec||!['difficulty','width','height','playable_cells'].every(k=>e[k]===spec[k]))return false;
  if(e.event_name==='game_clear') {
    if(!stats.every(k=>Number.isSafeInteger(e[k])&&e[k]>=0))return false;
    if(e.move_count!==e.playable_cells-1+e.undo_count)return false;
  }
  return true;
}
