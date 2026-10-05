import { sendEvent } from '../src/analytics.js';
export function createNumberAnalytics({ send = sendEvent, id = () => crypto.randomUUID() } = {}) {
  const session = id(); let play = null, previous = null, sequence = 0, viewed = false, started = false, finished = false;
  function record(name, spec, stats = {}) {
    const event = { game_id: 'number-tap', event_id: id(), event_seq: ++sequence, event_name: name,
      timestamp: new Date().toISOString(), session_id: session, play_id: play, previous_play_id: previous, ...spec, ...stats };
    try { Promise.resolve(send(event)).catch(() => {}); } catch { /* Logging never blocks play. */ }
    return event;
  }
  return {
    pageView(spec) { if (viewed) return; viewed = true; return record('page_view', spec); },
    start(spec) { if (started) return; previous = play; play = id(); started = true; finished = false; return record('game_start', spec); },
    clear(spec, stats) { if (!started || finished) return; finished = true; return record('game_clear', spec, stats); },
    retry(spec) { const event = record('retry', spec); started = false; finished = false; return event; }
  };
}
