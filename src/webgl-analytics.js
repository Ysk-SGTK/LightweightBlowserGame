import { sendEvent } from './analytics.js';
import { presentResult, observeResult } from './result-cards.js';
import { toCardData } from './card-data.js';

// Reuse the existing read-only Unity snapshot bridges. Only observed terminal
// states expose a card; loading a page never implies a gameplay result.
const gameId = document.body.dataset.gameId;
if (['drum-smash', 'small-konbini'].includes(gameId)) {
  const sessionId=crypto.randomUUID();
  sendEvent({
    game_id: gameId, event_id: crypto.randomUUID(), event_seq: 1,
    event_name: 'page_view', timestamp: new Date().toISOString(),
    session_id: sessionId, play_id: null, previous_play_id: null
  });
  let playId=crypto.randomUUID(),previous=null,finished=false,generation=null;
  setInterval(()=>{
    const s=gameId==='drum-smash'?window.drumSmash?.latest:window.shopSnapshot;
    if(!s)return;
    const terminal=gameId==='drum-smash'?['CLEAR','GAME OVER'].includes(s.state):s.state==='Final'&&s.history?.length===7;
    if((finished&&!terminal)||(gameId==='drum-smash'&&generation!==null&&generation!==s.generation)){
      observeResult({event_name:'retry'},sendEvent);previous=playId;playId=crypto.randomUUID();finished=false;
    }
    generation=s.generation;
    if(!terminal||finished)return;
    finished=true;
    presentResult(toCardData(gameId,s,location.href),{session_id:sessionId,play_id:playId,previous_play_id:previous,event_seq:1},sendEvent);
  },250);
}
