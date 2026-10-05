import { RULES } from '../src/game.js';
import { validStrokeEvent } from '../one-stroke/events.js';

const COMMON = ['game_id', 'event_id', 'event_seq', 'event_name', 'timestamp', 'session_id', 'play_id', 'previous_play_id', 'board_width', 'board_height', 'mine_count'];
const STATS = ['elapsed_seconds', 'opened_cells', 'flags_used'];
const NAMES = ['page_view', 'game_start', 'game_clear', 'game_over', 'game_timeout', 'retry'];
const TERMINALS = ['game_clear', 'game_over', 'game_timeout'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMORY_COMMON = ['game_id','event_id','event_seq','event_name','timestamp','session_id','play_id','previous_play_id','card_theme'];
const MEMORY_STATS = ['elapsed_seconds','flip_count','mismatch_count','pairs_matched'];

export function validMemoryEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
  if (event.game_id !== 'memory') return false;
  const keys = event.event_name === 'game_clear' ? [...MEMORY_COMMON, ...MEMORY_STATS] : MEMORY_COMMON;
  if (Object.keys(event).length !== keys.length || !keys.every(key => Object.hasOwn(event,key))) return false;
  if (!['page_view','game_start','game_clear','retry'].includes(event.event_name) || !['gem','botanical'].includes(event.card_theme)) return false;
  if (!['event_id','session_id','play_id'].every(key => typeof event[key] === 'string' && UUID.test(event[key]))) return false;
  if (event.previous_play_id !== null && (typeof event.previous_play_id !== 'string' || !UUID.test(event.previous_play_id))) return false;
  if (event.previous_play_id === event.play_id || (event.event_name === 'page_view' && event.previous_play_id !== null)) return false;
  if (!Number.isSafeInteger(event.event_seq) || event.event_seq < 1) return false;
  if (typeof event.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.timestamp) || !Number.isFinite(Date.parse(event.timestamp))) return false;
  if (event.event_name === 'game_clear') {
    if (!MEMORY_STATS.every(key => Number.isSafeInteger(event[key]) && event[key] >= 0)) return false;
    if (event.pairs_matched !== 8 || event.flip_count !== 16 + event.mismatch_count * 2) return false;
  }
  return true;
}

export function validEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return false;
  if (event.game_id === 'one-stroke') return validStrokeEvent(event);
  if (event.game_id === 'memory') return validMemoryEvent(event);
  if (event.game_id !== 'minesweeper') return false;
  const terminal = TERMINALS.includes(event.event_name);
  const keys = terminal ? [...COMMON, ...STATS] : COMMON;
  if (Object.keys(event).length !== keys.length || !keys.every(key => Object.hasOwn(event, key))) return false;
  if (!NAMES.includes(event.event_name) || !['event_id', 'session_id'].every(key => typeof event[key] === 'string' && UUID.test(event[key]))) return false;
  if (!Number.isSafeInteger(event.event_seq) || event.event_seq < 1) return false;
  if (typeof event.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.timestamp) || !Number.isFinite(Date.parse(event.timestamp))) return false;
  if (event.board_width !== RULES.size || event.board_height !== RULES.size || event.mine_count !== RULES.mines) return false;
  if (event.play_id !== null && (typeof event.play_id !== 'string' || !UUID.test(event.play_id))) return false;
  if (event.previous_play_id !== null && (typeof event.previous_play_id !== 'string' || !UUID.test(event.previous_play_id))) return false;
  if (event.play_id && event.play_id === event.previous_play_id) return false;
  if (event.event_name === 'page_view' && (event.play_id !== null || event.previous_play_id !== null)) return false;
  if (!['page_view', 'retry'].includes(event.event_name) && event.play_id === null) return false;
  if (event.play_id === null && event.previous_play_id !== null) return false;
  if (terminal) {
    if (!Number.isInteger(event.elapsed_seconds) || event.elapsed_seconds < 0 || event.elapsed_seconds > RULES.seconds) return false;
    if (!Number.isInteger(event.opened_cells) || event.opened_cells < 0 || event.opened_cells > RULES.size ** 2 - RULES.mines) return false;
    if (!Number.isInteger(event.flags_used) || event.flags_used < 0 || event.flags_used > RULES.mines) return false;
    if (event.event_name === 'game_clear' && event.opened_cells !== RULES.size ** 2 - RULES.mines) return false;
  }
  return true;
}

async function readLimitedJson(request) {
  if (!request.body) throw new Error('empty');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2048) { await reader.cancel(); throw new Error('large'); }
    chunks.push(value);
  }
  const data = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(data));
}

export async function ingest(request, env) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return new Response(null, { status: 403, headers });
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return new Response(null, { status: 415, headers });
  let event;
  try { event = await readLimitedJson(request); } catch { return new Response(null, { status: 400, headers }); }
  if (!validEvent(event)) return new Response(null, { status: 400, headers });
  try {
    // Store only explicit anonymous columns. Never read/log IP or User-Agent.
    const columns = ['game_id','event_seq','event_name','timestamp','session_id','play_id','previous_play_id','board_width','board_height','mine_count','card_theme','elapsed_seconds','opened_cells','flags_used','flip_count','mismatch_count','pairs_matched','puzzle_id','difficulty','width','height','playable_cells','move_count','undo_count','reset_count'];
    await env.GAME_LOG_DB.prepare(`INSERT INTO game_events
      (id,${columns.join(',')}) VALUES (${Array(columns.length+1).fill('?').join(',')}) ON CONFLICT DO NOTHING`)
      .bind(event.event_id, ...columns.map(key => event[key] ?? null)).run();
    return new Response(null, { status: 204, headers });
  } catch {
    // No request/header/payload/error-body logging.
    return new Response(null, { status: 503, headers });
  }
}
