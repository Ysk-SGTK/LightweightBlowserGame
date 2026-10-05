import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { findGroup, removeGroup, applyGravity, compactColumns, outcome, generateBoard, createGame, hasMoves } from '../color-blocks/game.js';
import { settings, scoreGroup } from '../color-blocks/config.js';
import { createBlockAnalytics } from '../color-blocks/analytics.js';
import { onRequest } from '../functions/api/events.js';
const cells = columns => columns.map((col, x) => col.map((color, y) => color === null ? null : ({ id: x * col.length + y, color })));
const seed = n => () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 2 ** 32; };

test('orthogonal flood fill excludes diagonal, singleton and empty cells', () => {
  const b = cells([[0,1,2],[0,2,1],[3,1,2]]);
  assert.deepEqual(findGroup(b,0,0).sort(), [[0,0],[1,0]]);
  assert.deepEqual(findGroup(b,0,1), [[0,1]]);
  assert.deepEqual(findGroup(b,4,0), []);
  const g = createGame('Easy', { board:b });
  assert.equal(g.remove(0,1),null); assert.equal(g.snapshot().move_count,0);
});
test('remove, gravity and left compact preserve surviving IDs and input', () => {
  const b = cells([[0,1,1],[2,2,2],[3,4,4]]), original = structuredClone(b);
  const removed = removeGroup(b, findGroup(b,1,1));
  assert.deepEqual(b, original);
  const fall = applyGravity(removeGroup(b,findGroup(b,0,2)));
  assert.deepEqual(fall[0], [null,null,b[0][0]]);
  assert.deepEqual(compactColumns(applyGravity(removed)),[b[0],b[2],[null,null,null]]);
});
test('square score, target alone does not finish, end clear/over and frozen elapsed', () => {
  assert.deepEqual([2,3,5].map(scoreGroup), [4,9,25]);
  assert.equal(outcome(cells([[0,0]]),999,240),null);
  assert.equal(outcome(cells([[0,1]]),240,240),'clear');
  assert.equal(outcome(cells([[0,1]]),239,240),'over');
  let t=0; const g=createGame('Easy',{board:cells([Array(16).fill(0),Array(16).fill(1)]),now:()=>t});
  g.remove(0,0); assert.equal(g.snapshot().final_score,256); assert.equal(g.snapshot().result,null);
  t=2500; g.remove(0,0); assert.equal(g.snapshot().result,'clear'); t=9000;
  assert.equal(g.snapshot().elapsed_seconds,2); assert.equal(g.remove(0,0),null);
  const over=createGame('Hard',{board:cells([[0,0,1]])});over.remove(0,0);assert.equal(over.snapshot().result,'over');
});
test('1500 generated boards are playable, balanced and full; random plays conserve blocks', () => {
  for(const difficulty of ['Easy','Normal','Hard'])for(let n=1;n<=500;n++){
    const spec=settings(difficulty),b=generateBoard(spec,seed(n));assert.ok(hasMoves(b));
    assert.equal(b.length,10);assert.ok(b.every(c=>c.length===12));
    const counts=Array.from({length:spec.color_count},(_,c)=>b.flat().filter(v=>v.color===c).length);
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
    const g=createGame(difficulty,{board:b});
    while(!g.snapshot().result){const s=g.snapshot();let group=[];
      for(let x=0;x<10;x++)for(let y=0;y<12;y++){const candidate=findGroup(s.board,x,y);if(candidate.length>group.length)group=candidate;}
      assert.ok(group.length>=2);g.remove(...group[0]);const a=g.snapshot();
      assert.equal(a.total_blocks_removed+a.remaining_blocks,120);
      assert.equal(new Set(a.board.flat().filter(Boolean).map(v=>v.id)).size,a.remaining_blocks);
      let empty=false;for(const col of a.board){if(!col.some(Boolean))empty=true;else assert.equal(empty,false);
        let occupied=false;for(const c of col){if(c)occupied=true;else assert.equal(occupied,false);}}
    }
  }
});
test('four-game D1 preserves all history; logs strict, deduplicated and linked',async()=>{
  const db=new DatabaseSync(':memory:');for(const file of ['0001_events.sql','0002_memory_events.sql','0003_game_events.sql','0004_one_stroke.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  db.exec("INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id,play_id,puzzle_id,difficulty,move_count) VALUES('old','one-stroke',1,'game_clear','time','session','play','easy-1','Easy',59)");
  const old=db.prepare('SELECT * FROM game_events').get();db.exec(readFileSync(new URL('../migrations/0005_color_blocks.sql',import.meta.url),'utf8'));
  const updated=db.prepare('SELECT * FROM game_events').get();for(const k of Object.keys(old))assert.equal(updated[k],old[k]);
  const env={GAME_LOG_DB:{prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args)})})}};
  const events=[],a=createBlockAnalytics({send:e=>events.push(e)}),spec=settings('Easy');
  const stats={final_score:300,elapsed_seconds:40,total_blocks_removed:100,largest_group_removed:10,move_count:30,remaining_blocks:20};
  a.pageView(spec);a.pageView(spec);a.start(spec);a.start(spec);a.finish('clear',spec,stats);a.finish('over',spec,stats);a.retry(spec);a.start(spec);
  a.finish('over',spec,{...stats,final_score:200,largest_group_removed:3});
  const request=e=>new Request('https://local.test/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});
  for(const e of events){assert.equal((await onRequest({env,request:request(e)})).status,204);assert.equal((await onRequest({env,request:request(e)})).status,204);}
  assert.equal(db.prepare("SELECT COUNT(*) n FROM game_events WHERE game_id='color-blocks'").get().n,6);
  const starts=events.filter(e=>e.event_name==='game_start');assert.equal(starts[1].previous_play_id,starts[0].play_id);
  for(const e of [{...events[0],ip:'x'},{...events[0],color_count:99},{...events[2],remaining_blocks:0},{...events[2],event_name:'game_over'}])assert.equal((await onRequest({env,request:request(e)})).status,400);
  const row=db.prepare("SELECT * FROM game_events WHERE game_id='color-blocks' AND event_name='game_clear'").get();
  for(const [k,v] of Object.entries(stats))assert.equal(row[k],v);
  assert.throws(()=>db.exec("INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id,play_id) VALUES('duplicate','one-stroke',2,'game_over','time','session','play')"));db.close();
});
test('synchronous and async analytics failures do not block play',async()=>{
  for(const send of [()=>{throw Error('offline');},()=>Promise.reject(Error('offline'))]){
    const a=createBlockAnalytics({send}),spec=settings('Hard');a.pageView(spec);a.start(spec);a.finish('over',spec,{});a.retry(spec);
    const g=createGame('Hard',{board:cells([[0,0]])});assert.ok(g.remove(0,0));
  }
  await new Promise(resolve=>setTimeout(resolve,0));
});
