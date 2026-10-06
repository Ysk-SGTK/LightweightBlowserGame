import { sendEvent } from './analytics.js';

// The existing Unity builds have no gameplay event bridge. Record page access
// outside game logic; do not infer game starts, retries or results from loading.
const gameId = document.body.dataset.gameId;
if (['drum-smash', 'small-konbini'].includes(gameId)) {
  sendEvent({
    game_id: gameId, event_id: crypto.randomUUID(), event_seq: 1,
    event_name: 'page_view', timestamp: new Date().toISOString(),
    session_id: crypto.randomUUID(), play_id: null, previous_play_id: null
  });
}
