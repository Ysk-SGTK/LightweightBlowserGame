import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/events.js';
import { createAnalytics } from '../src/analytics.js';
import { createMemoryAnalytics } from '../memory/analytics.js';
import { RULES } from '../src/game.js';

function fixture(){
  const db=new DatabaseSync(':memory:');
  for(const file of ['0001_events.sql','0002_memory_events.sql','0003_game_events.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const env={GAME_LOG_DB:{prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args)})})}};
  const events=[],options={send:e=>events.push(e)};
  const mines=createAnalytics(RULES,options),memory=createMemoryAnalytics('gem',options);
  mines.pageView();mines.start();mines.finish('won',{elapsed_seconds:30,opened_cells:88,flags_used:0});
  memory.pageView();memory.start();memory.clear({elapsed_seconds:30,flip_count:18,mismatch_count:1,pairs_matched:8});
  const request=(event,init={})=>new Request('https://example.pages.dev/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event),...init});
  return {db,env,events,request};
}

test('Pages Function stores both games in one table and SQL aggregates them separately',async()=>{
  const {db,env,events,request}=fixture();
  for(const e of events)assert.equal((await onRequest({request:request(e),env})).status,204);
  const summary=readFileSync(new URL('../analysis/summary.sql',import.meta.url),'utf8').split(';')[0];
  const rows=db.prepare(summary).all();
  assert.equal(rows.length,2);
  assert.ok(rows.every(r=>r.page_views===1&&r.game_starts===1&&r.game_wins===1&&r.mean_completed_play_seconds===30));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM game_events').get().n,6);db.close();
});
test('Pages API rejects unknown games, events, extra personal fields, wrong types and cross origin',async()=>{
  const {db,env,events,request}=fixture();
  for(const event of [{...events[0],game_id:'unknown'},{...events[0],event_name:'anything'},{...events[0],event_seq:'1'},{...events[0],session_id:'not-uuid'},{...events[0],ip:'192.0.2.1'},{...events[2],opened_cells:999}])assert.equal((await onRequest({request:request(event),env})).status,400);
  assert.equal((await onRequest({request:request(events[0],{headers:{'Content-Type':'application/json',Origin:'https://other.example'}}),env})).status,403);
  assert.equal((await onRequest({request:new Request('https://example.pages.dev/api/events'),env})).status,405);
  assert.equal((await onRequest({request:request(events[0],{headers:{'Content-Type':'text/plain'}}),env})).status,415);
  assert.equal((await onRequest({request:request(events[0],{body:'{' }),env})).status,400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM game_events').get().n,0);db.close();
});
test('missing D1 or failing D1 returns 503 without exposing exceptions',async()=>{
  const {db,events,request}=fixture();
  const response=await onRequest({request:request(events[0]),env:{}});
  assert.equal(response.status,503);assert.equal(await response.text(),'');db.close();
});
test('old anonymous history projects to common table, with original tables retained',()=>{
  const db=new DatabaseSync(':memory:');
  for(const file of ['0001_events.sql','0002_memory_events.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  db.prepare('INSERT INTO events(event_id,event_seq,event_name,timestamp,session_id,play_id,board_width,board_height,mine_count) VALUES(?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),1,'game_win',new Date().toISOString(),crypto.randomUUID(),crypto.randomUUID(),10,10,12);
  db.exec(readFileSync(new URL('../migrations/0003_game_events.sql',import.meta.url),'utf8'));
  assert.equal(db.prepare('SELECT event_name FROM game_events').get().event_name,'game_clear');
  assert.equal(db.prepare('SELECT event_name FROM events').get().event_name,'game_win');db.close();
});
