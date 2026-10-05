import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { solve, validatePuzzle, neighbors } from './one-stroke-solver.mjs';
import { qualityReport } from './one-stroke-quality.mjs';
import { catalog } from '../one-stroke/catalog.js';
import { createStrokeAnalytics } from '../one-stroke/analytics.js';
import { validStrokeEvent } from '../one-stroke/events.js';

// Exhaustive 3x3 oracle compares bridge/pruning logic with plain DFS.
let oracleCases=0;
const gridEdges=Array.from({length:9},(_,c)=>neighbors(c,3,3));
for(let mask=1;mask<512;mask++) {
  const cells=Array.from({length:9},(_,c)=>c).filter(c=>mask&(1<<c));
  if(cells.length<2)continue;
  for(const start of cells)for(const goal of cells)if(start!==goal) {
    function brute(current,visited) {
      if(current===goal)return visited===mask;
      for(const n of gridEdges[current])if((mask&(1<<n))&&!(visited&(1<<n))&&brute(n,visited|(1<<n)))return true;
      return false;
    }
    const expected=brute(start,1<<start),p={width:3,height:3,start,goal,blocked_cells:Array.from({length:9},(_,c)=>c).filter(c=>!(mask&(1<<c))),playable_cells:cells.length};
    const result=solve(p);
    assert.equal(Boolean(result.solution),expected,`Oracle mask ${mask}, ${start}->${goal}`);
    if(result.solution)validatePuzzle(p,result.solution);
    oracleCases++;
  }
}
console.log(`Solver exhaustive oracle: PASS ${oracleCases} masked 3x3 endpoint cases`);
const puzzles=JSON.parse(await readFile(new URL('../one-stroke/puzzles.json',import.meta.url),'utf8'));
assert.equal(puzzles.length,20);assert.equal(new Set(puzzles.map(p=>p.id)).size,20);
assert.deepEqual(['Easy','Normal','Hard','Expert','Challenge'].map(d=>puzzles.filter(p=>p.difficulty===d).length),[5,5,5,4,1]);
const reports=[];
for(const p of puzzles) {
  validatePuzzle(p);
  const {solution,metrics}=solve(p);
  assert.ok(solution,`Unsolved ${p.id}: ${JSON.stringify(metrics)}`);validatePuzzle(p,solution);
  assert.deepEqual(catalog.find(c=>c.id===p.id),Object.fromEntries(['id','difficulty','width','height','playable_cells'].map(k=>[k,p[k]])),`API metadata ${p.id}`);
  const q=qualityReport(p);assert.deepEqual(p.quality,q,`Stored audit drift ${p.id}`);
  assert.equal(p.difficulty_score,p.solver_metrics.branches+p.solver_metrics.backtracks);
  const events=[],analytics=createStrokeAnalytics({send:e=>events.push(e)});
  analytics.pageView(p);analytics.start(p);analytics.clear(p,{elapsed_seconds:1,move_count:p.playable_cells-1,undo_count:0,reset_count:0});
  assert.ok(events.every(validStrokeEvent),`Existing API accepts updated board ${p.id}`);
  if(p.difficulty==='Easy')assert.equal(q.holes.length,0,`${p.id} should teach without internal holes`);
  else {assert.ok(q.simple_snake.passed,`${p.id} simple snake clear`);assert.ok(q.holes.length>=1);assert.ok(q.junctions>=12);}
  if(['Hard','Expert','Challenge'].includes(p.difficulty)){assert.ok(q.holes.length>=2);assert.ok(q.isolation_witnesses.length>=8);}
  if(['Expert','Challenge'].includes(p.difficulty))assert.ok(q.holes.length>=3);
  reports.push({id:p.id,width:p.width,height:p.height,playable_cells:p.playable_cells,holes:q.holes.length,central:q.central_holes>0,narrow:q.narrow_cells>0,multi_region:q.region_separators.length>0,central_start:q.central_start,
    single_central:q.single_central_pattern,small_central:q.small_central_pattern,isolating_choices:q.isolation_witnesses.length,nodes:metrics.nodes,backtracks:metrics.backtracks,branches:metrics.branches,forced_fraction:q.forced_fraction});
  console.log(`${p.id}: PASS ${p.width}x${p.height}, ${p.playable_cells} cells, ${q.holes.length} holes, ${q.isolation_witnesses.length} isolating choices, ${metrics.nodes} nodes, ${metrics.backtracks} backtracks`);
}
assert.ok(reports.filter(r=>r.single_central).length>=2,'Multiple pattern A boards');
assert.ok(reports.filter(r=>r.small_central).length>=2,'Multiple pattern B boards');
assert.ok(reports.filter(r=>r.multi_region).length>=4,'Room-chain variety');
assert.ok(puzzles.filter(p=>p.difficulty==='Expert'&&p.quality.central_start).length>=2,'Expert central START');
const challenge=puzzles.find(p=>p.difficulty==='Challenge');assert.ok(challenge.quality.narrow_cells>=2&&challenge.quality.region_separators.length>=2);
console.log(JSON.stringify({total:20,central_hole_boards:reports.filter(r=>r.central).length,single_central_boards:reports.filter(r=>r.single_central).length,small_central_boards:reports.filter(r=>r.small_central).length,
  narrow_boards:reports.filter(r=>r.narrow).length,multi_region_boards:reports.filter(r=>r.multi_region).length,non_easy_simple_snake_clears:0,reports},null,2));
console.log('20/20 independently solved; geometry, catalog and non-Easy snake gates PASS');
