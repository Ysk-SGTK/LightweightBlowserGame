import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createGame, shuffle } from '../number-tap/game.js';
import { settings } from '../number-tap/config.js';
import { createNumberAnalytics } from '../number-tap/analytics.js';
import { onRequest } from '../functions/api/events.js';
const seed = n => () => { n = (Math.imul(n,1664525)+1013904223) >>> 0; return n / 2 ** 32; };

test('three sizes, 1500 complete permutations, retry always rearranges', () => {
  for (const [difficulty,size] of [['Easy',4],['Normal',5],['Hard',6]]) {
    assert.deepEqual(settings(difficulty), { difficulty,board_width:size,board_height:size,max_number:size*size });
    for (let n=1;n<=500;n++) {
      const numbers=shuffle(size*size,seed(n));
      assert.deepEqual([...numbers].sort((a,b)=>a-b),Array.from({length:size*size},(_,i)=>i+1));
      assert.notDeepEqual(shuffle(size*size,seed(n),numbers),numbers);
    }
  }
});
test('explicit start starts timer once; waiting taps ignored, misses do not advance, final tap freezes time', () => {
  let time=1000;
  const g=createGame('Easy',{now:()=>time});time=9000;
  assert.equal(g.snapshot().elapsed_seconds,0);
  assert.equal(g.tap(1),'ignored');assert.equal(g.tap(2),'ignored');assert.equal(g.snapshot().miss_count,0);assert.equal(g.snapshot().started,false);
  assert.equal(g.start(),true);time=9500;assert.equal(g.start(),false);assert.equal(g.snapshot().elapsed_seconds,0.5);
  assert.equal(g.tap(2),'miss');assert.equal(g.snapshot().next,1);
  assert.equal(g.tap(1),'correct');assert.equal(g.snapshot().elapsed_seconds,0.5);
  for(let i=0;i<100;i++)assert.equal(g.tap(1),'ignored');
  time=10234;assert.equal(g.snapshot().elapsed_seconds,1.2);
  for(let n=2;n<=15;n++)assert.equal(g.tap(n),'correct');
  time=32456;assert.equal(g.tap(16),'clear');const final=g.snapshot();time=99000;
  assert.equal(final.elapsed_seconds,23.5);assert.deepEqual(g.snapshot(),final);assert.equal(g.tap(16),'ignored');
  assert.equal(final.miss_count,1);
  const retry=createGame('Easy',{previous:final.numbers});assert.equal(retry.snapshot().elapsed_seconds,0);assert.equal(retry.snapshot().next,1);assert.notDeepEqual(retry.snapshot().numbers,final.numbers);
});
test('D1 adds only two columns and retains four-game history; strict decimal logs deduplicate and chain',async()=>{
  const db=new DatabaseSync(':memory:');
  for(const file of ['0001_events.sql','0002_memory_events.sql','0003_game_events.sql','0004_one_stroke.sql','0005_color_blocks.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  for(const name of ['minesweeper','memory','one-stroke','color-blocks'])db.prepare("INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id,play_id) VALUES(?,?,1,'game_start','time','session',?)").run(name,name,name);
  const old=db.prepare('SELECT * FROM game_events ORDER BY id').all();db.exec(readFileSync(new URL('../migrations/0006_number_tap.sql',import.meta.url),'utf8'));
  const updated=db.prepare('SELECT * FROM game_events ORDER BY id').all();
  old.forEach((row,i)=>Object.keys(row).forEach(k=>assert.equal(updated[i][k],row[k])));
  const env={GAME_LOG_DB:{prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args)})})}};
  const events=[],a=createNumberAnalytics({send:e=>events.push(e)}),spec=settings('Normal');
  a.pageView(spec);a.pageView(spec);a.retry(spec);a.start(spec);a.start(spec);a.clear(spec,{elapsed_seconds:23.4,miss_count:2});a.clear(spec,{elapsed_seconds:23.4,miss_count:2});a.retry(spec);a.retry(spec);a.start(spec);a.retry(spec);a.start(spec);
  const request=e=>new Request('https://local.test/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});
  for(const e of events)for(let i=0;i<2;i++)assert.equal((await onRequest({env,request:request(e)})).status,204);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM game_events WHERE game_id='number-tap'").get().n,events.length);
  const starts=events.filter(e=>e.event_name==='game_start');assert.equal(starts[1].previous_play_id,starts[0].play_id);assert.equal(starts[2].previous_play_id,starts[1].play_id);
  const clear=events.find(e=>e.event_name==='game_clear');const saved=db.prepare('SELECT * FROM game_events WHERE id=?').get(clear.event_id);
  assert.equal(saved.elapsed_seconds,23.4);assert.equal(saved.miss_count,2);assert.equal(saved.max_number,25);
  for(const e of [{...clear,ip:'x'},{...clear,user_agent:'x'},{...clear,max_number:36},{...clear,miss_count:-1},{...clear,elapsed_seconds:1.23},{...clear,elapsed_seconds:'1'},{...clear,event_name:'game_over'}])assert.equal((await onRequest({env,request:request(e)})).status,400);
  assert.equal((await onRequest({env:{},request:request(clear)})).status,503);db.close();
});
test('sync and async logging errors leave fast completion and retry usable',async()=>{
  for(const send of [()=>{throw Error('offline');},()=>Promise.reject(Error('offline'))]){
    const a=createNumberAnalytics({send}),spec=settings('Hard'),g=createGame('Hard');a.pageView(spec);
    g.start();a.start(spec);for(let n=1;n<=36;n++)g.tap(n);
    a.clear(spec,{elapsed_seconds:g.snapshot().elapsed_seconds,miss_count:0});assert.equal(g.snapshot().clear,true);a.retry(spec);
  }
  await new Promise(resolve=>setTimeout(resolve,0));
});
