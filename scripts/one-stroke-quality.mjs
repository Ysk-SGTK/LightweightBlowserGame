import { neighbors, validatePuzzle } from './one-stroke-solver.mjs';

export function simpleSnakeCheck(p) {
  const blocked = new Set(p.blocked_cells), successes = [];
  for (const axis of ['row','column']) for (const lineDirection of [1,-1]) for (const initialDirection of [1,-1]) {
    const lines=axis==='row'?p.height:p.width, length=axis==='row'?p.width:p.height, path=[];
    for(let i=0;i<lines;i++) for(let j=0;j<length;j++) {
      const line=lineDirection===1?i:lines-1-i, direction=initialDirection*(i%2?-1:1), position=direction===1?j:length-1-j;
      const c=axis==='row'?line*p.width+position:position*p.width+line;
      if(!blocked.has(c))path.push(c);
    }
    for(const candidate of [path,[...path].reverse()]) {
      const index=candidate.indexOf(p.start);
      for(const route of [candidate,[...candidate.slice(index),...candidate.slice(0,index)]]) {
        try { validatePuzzle(p,route);successes.push({axis,lineDirection,initialDirection}); } catch { /* Not a valid complete path. */ }
      }
    }
    // Sweep from START, go straight until blocked, then change row/column
    // and reverse. No search, detours, skipping cells, or return to past rows.
    const visited=new Set([p.start]), route=[p.start];let c=p.start, direction=initialDirection;
    const primary=n=>axis==='row'?n%p.width:Math.floor(n/p.width);
    while(route.length<p.playable_cells) {
      const options=neighbors(c,p.width,p.height).filter(n=>!blocked.has(n)&&!visited.has(n)&&(n!==p.goal||route.length===p.playable_cells-1));
      let next=options.find(n=>primary(n)-primary(c)===direction);
      if(next===undefined) {
        next=options.find(n=>primary(n)===primary(c)&&(axis==='row'?Math.floor(n/p.width)-Math.floor(c/p.width):n%p.width-c%p.width)===lineDirection);
        if(next===undefined)break;
        direction*=-1;
      }
      c=next;visited.add(c);route.push(c);
    }
    try {validatePuzzle(p,route);successes.push({axis,lineDirection,initialDirection,method:'straight-sweep'});}catch{}
  }
  return {passed:successes.length===0,successful_sweeps:successes};
}

export function inspectShape(p) {
  const blocked=new Set(p.blocked_cells), playable=[];
  for(let c=0;c<p.width*p.height;c++)if(!blocked.has(c))playable.push(c);
  const edges=new Map(playable.map(c=>[c,neighbors(c,p.width,p.height).filter(n=>!blocked.has(n))]));
  const remaining=new Set(blocked),holes=[];
  while(remaining.size) {
    const cells=[remaining.values().next().value];remaining.delete(cells[0]);let boundary=false;
    for(let i=0;i<cells.length;i++) {
      const c=cells[i],x=c%p.width,y=Math.floor(c/p.width);
      if(x===0||y===0||x===p.width-1||y===p.height-1)boundary=true;
      for(const n of neighbors(c,p.width,p.height))if(remaining.delete(n))cells.push(n);
    }
    if(!boundary)holes.push(cells.sort((a,b)=>a-b));
  }
  const centralHoles=holes.filter(h=>h.some(c=>Math.abs(c%p.width-(p.width-1)/2)<=p.width/4&&Math.abs(Math.floor(c/p.width)-(p.height-1)/2)<=p.height/4));
  const narrow=playable.filter(c=>{const ns=edges.get(c);return ns.length===2&&(ns[0]+ns[1]===2*c);});
  const separators=[];
  for(const cut of narrow) {
    const seen=new Set([cut]),parts=[];
    for(const c of playable)if(!seen.has(c)) {
      const stack=[c];seen.add(c);let count=0;
      while(stack.length){count++;for(const n of edges.get(stack.pop()))if(!seen.has(n)){seen.add(n);stack.push(n);}}
      parts.push(count);
    }
    if(parts.filter(n=>n>=8).length>=2)separators.push({cell:cut,regions:parts});
  }
  const corners=[0,p.width-1,(p.height-1)*p.width,p.width*p.height-1];
  const centralStart=Math.abs(p.start%p.width-(p.width-1)/2)<=p.width/4&&Math.abs(Math.floor(p.start/p.width)-(p.height-1)/2)<=p.height/4;
  return {holes,central_holes:centralHoles.length,small_central_holes:centralHoles.filter(h=>h.length<=3).length,
    narrow_cells:narrow.length,region_separators:separators,outer_missing:[...blocked].filter(c=>c%p.width===0||c%p.width===p.width-1||c<p.width||c>=p.width*(p.height-1)).length,
    junctions:playable.filter(c=>edges.get(c).length>=3).length,central_start:centralStart,
    noncorner_endpoints:!corners.includes(p.start)&&!corners.includes(p.goal),
    endpoint_distance:Math.abs(p.start%p.width-p.goal%p.width)+Math.abs(Math.floor(p.start/p.width)-Math.floor(p.goal/p.width))};
}

// A concrete, legal wrong step whose remaining board becomes disconnected.
// This proves ordering matters; it does not estimate human solving time.
export function isolationWitnesses(p) {
  const available=new Set(p.solution),witnesses=[];
  for(let i=0;i<p.solution.length-2;i++) {
    const current=p.solution[i];available.delete(current);
    for(const wrong of neighbors(current,p.width,p.height))if(available.has(wrong)&&wrong!==p.solution[i+1]&&wrong!==p.goal) {
      const first=[...available].find(c=>c!==wrong),seen=new Set([first]),stack=[first];
      while(stack.length)for(const n of neighbors(stack.pop(),p.width,p.height))if(n!==wrong&&available.has(n)&&!seen.has(n)){seen.add(n);stack.push(n);}
      if(seen.size!==available.size-1)witnesses.push({prefix_length:i+1,current,correct:p.solution[i+1],wrong,unreachable_cells:available.size-1-seen.size});
    }
  }
  return witnesses;
}

export function qualityReport(p) {
  const shape=inspectShape(p),snake=simpleSnakeCheck(p),witnesses=isolationWitnesses(p);
  const centralCells=shape.holes.flat().filter(c=>Math.abs(c%p.width-(p.width-1)/2)<=Math.floor(p.width/5)&&Math.abs(Math.floor(c/p.width)-(p.height-1)/2)<=Math.floor(p.height/5));
  return {...shape,simple_snake:snake,isolation_witnesses:witnesses,
    central_missing_cells:centralCells.length,
    single_central_pattern:centralCells.length===1&&shape.holes.length===1&&p.playable_cells/(p.width*p.height)>.9,
    small_central_pattern:centralCells.length>=2&&centralCells.length<=3,
    forced_fraction:p.solver_metrics.forced/Math.max(1,p.solver_metrics.nodes-1)};
}
