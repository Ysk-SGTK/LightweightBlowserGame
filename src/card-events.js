import {GAME_NAMES} from './card-data.js';
export const CARD_EVENTS=['result_card_open','result_card_download','result_card_copy','result_card_share','result_card_x_share'];
export const CARD_COLUMNS=['game_id','event_seq','event_name','timestamp','session_id','play_id','previous_play_id','title_key','primary_result','management_style','product_style','operation_style','final_profit'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validCardEvent(e){
  const keys=['event_id',...CARD_COLUMNS.slice(0,9)], optional=e.game_id==='small-konbini'?CARD_COLUMNS.slice(9):[];
  if(!Object.hasOwn(GAME_NAMES,e.game_id)||!CARD_EVENTS.includes(e.event_name)||!keys.every(k=>Object.hasOwn(e,k))||Object.keys(e).some(k=>!keys.includes(k)&&!optional.includes(k)))return false;
  if(!['event_id','session_id','play_id'].every(k=>typeof e[k]==='string'&&uuid.test(e[k])))return false;
  if(e.previous_play_id!==null&&(typeof e.previous_play_id!=='string'||!uuid.test(e.previous_play_id)||e.previous_play_id===e.play_id))return false;
  if(!Number.isSafeInteger(e.event_seq)||e.event_seq<1||typeof e.timestamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.timestamp)||!Number.isFinite(Date.parse(e.timestamp)))return false;
  if(!['title_key','primary_result'].every(k=>typeof e[k]==='string'&&e[k].length>0&&e[k].length<=160))return false;
  if(e.game_id==='small-konbini'&&(!optional.every(k=>Object.hasOwn(e,k))||!['management_style','product_style','operation_style'].every(k=>typeof e[k]==='string'&&e[k].length>0&&e[k].length<=40)||!Number.isSafeInteger(e.final_profit)))return false;
  return true;
}
