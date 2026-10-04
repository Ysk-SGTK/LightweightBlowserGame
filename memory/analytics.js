import { sendEvent } from '../src/analytics.js';

function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export function createMemoryAnalytics(theme, { send = sendEvent, id = uuid } = {}) {
  const session = id();
  let play = id(), previous = null, sequence = 0, viewed = false, started = false, cleared = false;
  function record(name, stats = {}) {
    const event = { game_id: 'memory', event_id: id(), event_seq: ++sequence, event_name: name,
      timestamp: new Date().toISOString(), session_id: session, play_id: play,
      previous_play_id: previous, card_theme: theme, ...stats };
    try { Promise.resolve(send(event)).catch(() => console.warn('匿名ログを送信できませんでした。')); }
    catch { console.warn('匿名ログを送信できませんでした。'); }
    return event;
  }
  return {
    pageView() { if (viewed) return; viewed = true; return record('page_view'); },
    start() { if (started) return; started = true; return record('game_start'); },
    clear(stats) { if (!started || cleared) return; cleared = true; return record('game_clear', stats); },
    retry() {
      previous = play; play = id(); started = false; cleared = false;
      // retry identifies the NEW board and its immediate predecessor.
      return record('retry');
    }
  };
}
