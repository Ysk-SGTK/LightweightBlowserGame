import { sendEvent } from '../src/analytics.js';
export function createStrokeAnalytics({send = sendEvent, id = () => crypto.randomUUID()} = {}) {
  const session = id(); let play = null, previous = null, sequence = 0, viewed = false, started = false, cleared = false;
  function record(name,p,stats={}) {
    const event = {game_id:'one-stroke',event_id:id(),event_seq:++sequence,event_name:name,
      timestamp:new Date().toISOString(),session_id:session,play_id:play,previous_play_id:previous,
      puzzle_id:p.id,difficulty:p.difficulty,width:p.width,height:p.height,playable_cells:p.playable_cells,...stats};
    try { Promise.resolve(send(event)).catch(()=>{}); } catch { /* Gameplay never depends on logging. */ }
    return event;
  }
  return {
    pageView(p) { if(viewed)return; viewed=true; return record('page_view',p); },
    start(p) { if(started)return; previous=play; play=id(); started=true; cleared=false; return record('game_start',p); },
    clear(p,stats) { if(!started||cleared)return; cleared=true; return record('game_clear',p,stats); },
    change(name,p) { if(!['retry','next_level'].includes(name))return; const e=record(name,p); started=false;cleared=false;return e; }
  };
}
