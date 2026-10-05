import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createGame } from '../one-stroke/game.js';
import { createStrokeAnalytics } from '../one-stroke/analytics.js';
import { solve,validatePuzzle } from '../scripts/one-stroke-solver.mjs';
import { onRequest } from '../functions/api/events.js';
const puzzles=JSON.parse(readFileSync(new URL('../one-stroke/puzzles.json',import.meta.url)));
const tiny={id:'tiny',width:3,height:3,start:0,goal:8,blocked_cells:[4],playable_cells:8,solution:[0,1,2,5,8,7,6,3]};
test('path rules: start, orthogonal, no jump/diagonal/hole/revisit; immediate undo only',()=>{
 const g=createGame(tiny);
 for(const c of [1,4,8])assert.equal(g.step(c),'ignored');
 assert.equal(g.step(0),'start');for(const c of [4,2,3+1,8])assert.equal(g.step(c),'ignored');
 assert.equal(g.step(1),'move');assert.equal(g.step(2),'move');assert.equal(g.step(0),'ignored');
 assert.equal(g.step(1),'undo');assert.deepEqual(g.snapshot().path,[0,1]);
 assert.equal(g.step(4),'ignored');assert.equal(g.undo(),true);assert.deepEqual(g.snapshot().path,[0]);
 const loop=createGame({width:3,height:3,start:0,goal:8,blocked_cells:[],playable_cells:9});
 for(const c of [0,1,4,3])loop.step(c);assert.equal(loop.step(0),'ignored');assert.deepEqual(loop.snapshot().path,[0,1,4,3]);
});
test('early goal excluded, complete path clears once; frozen clock and counters',()=>{
 const p={...tiny,goal:3,solution:[0,1,2,5,8,7,6,3]};let t=0;const g=createGame(p,{now:()=>t,resetCount:2});
 g.step(0);assert.equal(g.step(3),'ignored');g.step(1);g.step(0);g.step(1);t=2500;
 for(const c of p.solution.slice(2))g.step(c);
 const s=g.snapshot();assert.equal(s.cleared,true);assert.equal(s.move_count,8);assert.equal(s.undo_count,1);assert.equal(s.reset_count,2);
 t=9000;assert.equal(g.snapshot().elapsed_seconds,2);assert.equal(g.step(6),'ignored');assert.equal(g.undo(),false);
});
test('20 fixed puzzles independently solved, full coverage, shape and count distribution',()=>{
 assert.equal(puzzles.length,20);assert.equal(new Set(puzzles.map(p=>p.id)).size,20);
 assert.deepEqual(['Easy','Normal','Hard','Expert','Challenge'].map(d=>puzzles.filter(p=>p.difficulty===d).length),[5,5,5,4,1]);
 for(const p of puzzles){validatePuzzle(p);const r=solve(p);assert.ok(r.solution,p.id);validatePuzzle(p,r.solution);
 const g=createGame(p);for(const c of r.solution)g.step(c);assert.ok(g.snapshot().cleared,p.id);}
 assert.ok(puzzles.some(p=>p.shape==='u-shape'));assert.ok(puzzles.some(p=>p.shape==='comb'));assert.ok(puzzles.some(p=>p.shape==='rooms-and-bridge'));
 assert.ok(puzzles.every(p=>p.blocked_cells.length>0));
 assert.ok(puzzles.every(p=>p.solution.slice(2).filter((c,i)=>c-p.solution[i+1]!==p.solution[i+1]-p.solution[i]).length>=p.playable_cells*.28));
});
test('solver reports unsolvable and search budget separately; malformed witness rejected',()=>{
 assert.equal(solve({...tiny,goal:4}).solution,null);
 assert.equal(solve(puzzles[0],{maxNodes:1}).metrics.limited,true);
 assert.throws(()=>validatePuzzle(puzzles[0],[0]));
});
test('one-stroke common D1 events deduplicate, link actual plays, reject private fields',async()=>{
 const db=new DatabaseSync(':memory:');for(const f of ['0001_events.sql','0002_memory_events.sql','0003_game_events.sql','0004_one_stroke.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const env={GAME_LOG_DB:{prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args)})})}};
 const sent=[],a=createStrokeAnalytics({send:e=>sent.push(e)}),p=puzzles[0];
 a.pageView(p);a.pageView(p);a.start(p);a.start(p);a.clear(p,{elapsed_seconds:2,move_count:p.playable_cells-1,undo_count:0,reset_count:0});a.clear(p,{});
 a.change('retry',p);a.change('retry',p);a.start(p);a.change('next_level',puzzles[1]);a.start(puzzles[1]);
 async function send(e){return onRequest({env,request:new Request('https://local.test/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)})});}
 for(const e of sent){assert.equal((await send(e)).status,204);assert.equal((await send(e)).status,204);}
 assert.equal(db.prepare('SELECT COUNT(*) n FROM game_events').get().n,sent.length);
 const starts=sent.filter(e=>e.event_name==='game_start');assert.equal(starts[1].previous_play_id,starts[0].play_id);assert.equal(starts[2].previous_play_id,starts[1].play_id);
 for(const e of [{...sent[0],ip:'x'},{...sent[0],width:20},{...sent[2],move_count:0},{...sent[0],puzzle_id:'unknown'}])assert.equal((await send(e)).status,400);
 db.close();
});
test('throwing and rejecting log senders cannot interrupt gameplay',async()=>{
 for(const send of [()=>{throw Error('offline');},()=>Promise.reject(Error('offline'))]){
 const a=createStrokeAnalytics({send});a.pageView(puzzles[0]);a.start(puzzles[0]);a.clear(puzzles[0],{});a.change('retry',puzzles[0]);}
 await new Promise(resolve=>setTimeout(resolve,0));
});
test('0004 preserves history and unique indices for existing games',()=>{
 const db=new DatabaseSync(':memory:');for(const f of ['0001_events.sql','0002_memory_events.sql','0003_game_events.sql'])db.exec(readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 db.exec("INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id,play_id,elapsed_seconds) VALUES('old','memory',1,'game_clear','time','s','p',9)");
 const before=db.prepare('SELECT * FROM game_events').get();db.exec(readFileSync(new URL('../migrations/0004_one_stroke.sql',import.meta.url),'utf8'));
 const after=db.prepare('SELECT * FROM game_events').get();for(const k of Object.keys(before))assert.equal(after[k],before[k]);
 assert.throws(()=>db.exec("INSERT INTO game_events(id,game_id,event_seq,event_name,timestamp,session_id,play_id) VALUES('other','memory',2,'game_clear','time','s','p')"));db.close();
});
