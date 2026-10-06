import { observeResult } from './result-cards.js';
// IDs live only in this module's instance; no cookies or browser storage.
function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // getRandomValues also works on a phone's HTTP LAN origin.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isTestAccess(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('test') === '1';
}

// Preserve the test marker when navigating between local game pages.
export function preserveTestLinks(root = globalThis.document) {
  if (!root || !isTestAccess()) return;
  for (const link of root.querySelectorAll('a[href]')) {
    const url = new URL(link.href, globalThis.location.href);
    if (url.origin !== globalThis.location.origin) continue;
    url.searchParams.set('test', '1');
    link.href = url.href;
  }
}

preserveTestLinks();

export async function sendEvent(event, endpoint = '/api/events') {
  try { observeResult(event,sendEvent); } catch { /* Card failure cannot stop gameplay or logging. */ }
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, is_test: isTestAccess() }), credentials: 'omit', keepalive: true,
      redirect: 'error', signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error('unavailable');
  } catch {
    // No payload, IDs, URLs, or personal data in diagnostics. No retries.
    console.warn('匿名ログを送信できませんでした。ゲームは引き続き遊べます。');
  }
}

export function createAnalytics(rules, { send = sendEvent, id = uuid, now = () => new Date().toISOString() } = {}) {
  const sessionId = id();
  let current = null, pending = true, ended = false, viewed = false, sequence = 0;
  function record(eventName, extra = {}, page = false) {
    const event = {
      game_id: 'minesweeper', event_id: id(), event_seq: ++sequence, event_name: eventName, timestamp: now(),
      session_id: sessionId, play_id: page ? null : current?.id ?? null,
      previous_play_id: page ? null : current?.previous ?? null,
      board_width: rules.size, board_height: rules.size, mine_count: rules.mines, ...extra
    };
    // Even a synchronously throwing custom sender cannot interrupt gameplay.
    try { Promise.resolve(send(event)).catch(() => console.warn('匿名ログを送信できませんでした。')); }
    catch { console.warn('匿名ログを送信できませんでした。'); }
    return event;
  }
  return {
    pageView() { if (viewed) return; viewed = true; return record('page_view', {}, true); },
    start() {
      if (!pending) return;
      current = { id: id(), previous: current?.id ?? null };
      pending = false; ended = false;
      return record('game_start');
    },
    finish(outcome, stats) {
      const name = { won: 'game_clear', lost: 'game_over', timeout: 'game_timeout' }[outcome];
      if (!name || pending || ended || !current) return;
      ended = true;
      return record(name, stats);
    },
    retry() {
      const event = record('retry'); // play_id is the source, not a new/unstarted game.
      pending = true;
      return event;
    }
  };
}
