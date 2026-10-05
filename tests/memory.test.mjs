import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createGame, shuffledDeck } from '../memory/game.js';
import { cardSet } from '../memory/cards.js';
import { createMemoryAnalytics } from '../memory/analytics.js';
import { ingest, validMemoryEvent } from '../worker/index.js';

test('1000 shuffled boards have 16 cards and 8 exact pairs; restart always changes', () => {
  let previous = [], layouts = new Set();
  for (let n=0;n<1000;n++) {
    const deck = shuffledDeck(Math.random, previous);
    assert.equal(deck.length,16);
    for (let id=0;id<8;id++) assert.equal(deck.filter(v=>v===id).length,2);
    assert.notDeepEqual(deck,previous); layouts.add(deck.join(',')); previous=deck;
  }
  assert.ok(layouts.size>990);
  assert.notDeepEqual(shuffledDeck(()=>.999,previous),previous);
  const fixed=shuffledDeck(()=>.999);
  assert.notDeepEqual(shuffledDeck(()=>.999,fixed),fixed);
});
test('duplicate clicks, mismatch lock, matched cards and completion are guarded', () => {
  const g=createGame([],()=>.999);
  assert.equal(g.flip(0,0),'first'); assert.equal(g.flip(0,1),'ignored');
  assert.equal(g.flip(1,2),'mismatch');
  for(let n=0;n<100;n++) assert.equal(g.flip(n%16,3),'ignored');
  assert.equal(g.snapshot(1000).flip_count,2); g.conceal();
  assert.deepEqual(g.snapshot().open,[]);
  for(let i=0;i<8;i++) {
    assert.equal(g.flip(i,1000+i*100),'first');
    assert.equal(g.flip(i+8,1050+i*100),i===7?'clear':'match');
    assert.equal(g.flip(i,1200),'ignored');
  }
  const s=g.snapshot(99999);
  assert.equal(s.pairs_matched,8); assert.equal(s.flip_count,18); assert.equal(s.mismatch_count,1);
  assert.equal(s.elapsed_seconds,1); assert.equal(g.flip(0),'ignored');
});
test('theme sets have eight different original SVG motifs and shared framing', () => {
  for(const theme of ['gem','botanical']) {
    const cards=cardSet(theme); assert.equal(cards.length,8);
    assert.equal(new Set(cards.map(c=>c.name)).size,8);
    assert.equal(new Set(cards.map(c=>c.svg)).size,8);
    assert.ok(cards.every(c=>c.svg.includes('viewBox="0 0 100 125"') && !c.svg.includes('<image')));
  }
});
test('memory events are once only, P1 -> P2 -> P3, resets create a fresh session', () => {
  const events=[],a=createMemoryAnalytics('gem',{send:e=>events.push(e)});
  a.pageView();a.pageView();a.start();a.start();
  const stats={elapsed_seconds:32,flip_count:20,mismatch_count:2,pairs_matched:8};
  a.clear(stats);a.clear(stats);a.retry();a.start();a.retry();a.start();a.clear(stats);
  assert.deepEqual(events.map(e=>e.event_name),['page_view','game_start','game_clear','retry','game_start','retry','game_start','game_clear']);
  assert.ok(events.every(validMemoryEvent));
  const starts=events.filter(e=>e.event_name==='game_start');
  assert.equal(starts[0].previous_play_id,null);
  assert.equal(starts[1].previous_play_id,starts[0].play_id);
  assert.equal(starts[2].previous_play_id,starts[1].play_id);
  assert.equal(new Set(events.map(e=>e.session_id)).size,1);
  const next=createMemoryAnalytics('gem',{send:e=>events.push(e)});next.pageView();
  assert.notEqual(events.at(-1).session_id,events[0].session_id);
  // Even unstarted restarts retain the exact immediate board predecessor.
  next.retry();next.retry(); assert.equal(events.at(-1).previous_play_id,events.at(-2).play_id);
});
test('real SQLite migration stores memory stats, deduplicates and rejects extra data',async()=>{
  const db=new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0001_events.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0002_memory_events.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0003_game_events.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0004_one_stroke.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/0005_color_blocks.sql',import.meta.url),'utf8'));
  const env={GAME_LOG_DB:{prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args)})})}};
  const events=[],a=createMemoryAnalytics('botanical',{send:e=>events.push(e)});
  a.pageView();a.start();a.clear({elapsed_seconds:45,flip_count:22,mismatch_count:3,pairs_matched:8});
  const req=e=>new Request('http://localhost/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});
  for(const e of events){assert.equal((await ingest(req(e),env)).status,204);assert.equal((await ingest(req(e),env)).status,204);}
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM game_events').get().n,3);
  assert.equal(db.prepare("SELECT mismatch_count FROM game_events WHERE event_name='game_clear'").get().mismatch_count,3);
  assert.equal((await ingest(req({...events[0],ip:'unexpected'}),env)).status,400);
  assert.equal((await ingest(req({...events[2],flip_count:16}),env)).status,400);
  assert.equal((await ingest(req(events[0]),{GAME_LOG_DB:{prepare(){throw Error('offline');}}})).status,503);
  db.close();
});
test('throwing and rejecting senders never stop the lifecycle',async()=>{
  const original=console.warn;let warnings=0;console.warn=()=>warnings++;
  try {
    for(const send of [()=>{throw Error('offline');},()=>Promise.reject(Error('offline'))]) {
      const a=createMemoryAnalytics('gem',{send});
      a.pageView();a.start();a.clear({elapsed_seconds:10,flip_count:16,mismatch_count:0,pairs_matched:8});a.retry();a.start();
    }
    await new Promise(resolve=>setImmediate(resolve));assert.equal(warnings,10);
  }finally{console.warn=original;}
});
