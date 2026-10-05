export function neighbors(cell, width, height) {
  const x = cell % width, y = Math.floor(cell / width);
  return [x > 0 ? cell - 1 : -1, x < width - 1 ? cell + 1 : -1,
    y > 0 ? cell - width : -1, y < height - 1 ? cell + width : -1].filter(c => c >= 0);
}

export function validatePuzzle(p, solution = p.solution) {
  const total = p.width * p.height;
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 2 || p.height < 2) throw Error('Invalid size');
  const blocked = new Set(p.blocked_cells);
  if (blocked.size !== p.blocked_cells.length || [...blocked].some(c => !Number.isInteger(c) || c < 0 || c >= total)) throw Error('Invalid blocked cells');
  if (p.playable_cells !== total - blocked.size) throw Error('Invalid playable count');
  if (!solution || solution.length !== p.playable_cells || new Set(solution).size !== solution.length) throw Error('Invalid coverage');
  if (solution[0] !== p.start || solution.at(-1) !== p.goal || p.start === p.goal) throw Error('Invalid endpoints');
  solution.forEach((c, i) => {
    if (!Number.isInteger(c) || c < 0 || c >= total || blocked.has(c)) throw Error('Invalid cell');
    if (i && !neighbors(solution[i - 1], p.width, p.height).includes(c)) throw Error('Non-adjacent step');
  });
  return true;
}

// Independent Hamilton-path DFS: no access to the stored solution.
// Minimum remaining degree ordering, early-goal exclusion and connectivity pruning.
export function solve(p, { maxNodes = 50000, decompose = true } = {}) {
  const blocked = new Set(p.blocked_cells), available = new Set();
  for (let c = 0; c < p.width * p.height; c++) if (!blocked.has(c)) available.add(c);
  const edges = new Map([...available].map(c => [c, neighbors(c, p.width, p.height).filter(n => available.has(n))]));
  const metrics = { nodes: 0, backtracks: 0, branches: 0, forced: 0, limited: false };
  if (!available.has(p.start) || !available.has(p.goal)) return { solution: null, metrics };
  // A graph bridge can only be crossed once. Solve its room chain with the
  // actual entry/exit of each room, rather than exploring the wrong room first.
  // This is still independent of p.solution and does not run in the browser.
  if (decompose) {
    const discovered=new Map(),low=new Map(),bridges=new Set();let tick=0;
    const key=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
    function visit(c,parent) {
      discovered.set(c,++tick);low.set(c,tick);
      for(const n of edges.get(c))if(n!==parent) {
        if(!discovered.has(n)){visit(n,c);low.set(c,Math.min(low.get(c),low.get(n)));if(low.get(n)>discovered.get(c))bridges.add(key(c,n));}
        else low.set(c,Math.min(low.get(c),discovered.get(n)));
      }
    }
    visit(p.start,-1);
    if(discovered.size!==available.size)return {solution:null,metrics};
    if(bridges.size) {
      const groups=[],groupOf=new Map();
      for(const c of available)if(!groupOf.has(c)) {
        const group=[],stack=[c],index=groups.length;groupOf.set(c,index);
        while(stack.length){const cell=stack.pop();group.push(cell);for(const n of edges.get(cell))if(!bridges.has(key(cell,n))&&!groupOf.has(n)){groupOf.set(n,index);stack.push(n);}}
        groups.push(group);
      }
      const links=groups.map(()=>[]);
      for(const b of bridges){const [a,c]=b.split(':').map(Number),ga=groupOf.get(a),gc=groupOf.get(c);links[ga].push({next:gc,exit:a,entry:c});links[gc].push({next:ga,exit:c,entry:a});}
      const startGroup=groupOf.get(p.start),goalGroup=groupOf.get(p.goal);
      if(links.some(g=>g.length>2)||links[startGroup].length!==1||links[goalGroup].length!==1||startGroup===goalGroup)return {solution:null,metrics};
      const solution=[];let index=startGroup,parent=-1,entry=p.start;
      while(true) {
        const link=links[index].find(l=>l.next!==parent),exit=index===goalGroup?p.goal:link?.exit;
        if(exit===undefined)return {solution:null,metrics};
        const cells=new Set(groups[index]),blocked_cells=[];
        for(let c=0;c<p.width*p.height;c++)if(!cells.has(c))blocked_cells.push(c);
        const result=solve({...p,start:entry,goal:exit,blocked_cells,playable_cells:cells.size},{maxNodes:Math.max(0,maxNodes-metrics.nodes),decompose:false});
        for(const k of ['nodes','backtracks','branches','forced'])metrics[k]+=result.metrics[k];
        metrics.limited ||= result.metrics.limited;
        if(!result.solution)return {solution:null,metrics};
        solution.push(...result.solution);
        if(index===goalGroup)break;
        parent=index;index=link.next;entry=link.entry;
      }
      return {solution,metrics};
    }
  }
  const path = [p.start]; available.delete(p.start);
  function connected(current) {
    // Current is already visited: it cannot reconnect two untouched regions
    // after the next step. Check connectivity of untouched cells themselves.
    const first=available.values().next().value;
    const seen = new Set([first]), stack = [first];
    while (stack.length) for (const n of edges.get(stack.pop())) if (available.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    if (seen.size !== available.size) return false;
    // Every unvisited non-goal needs an entry and exit in the remaining graph.
    for (const c of available) if (c !== p.goal && edges.get(c).filter(n => available.has(n) || n === current).length < 2) return false;
    return true;
  }
  function dfs(current) {
    if (++metrics.nodes > maxNodes) { metrics.limited = true; return false; }
    if (!available.size) return current === p.goal;
    let choices = edges.get(current).filter(n => available.has(n) && (n !== p.goal || available.size === 1));
    choices.sort((a,b) => edges.get(a).filter(n => available.has(n)).length - edges.get(b).filter(n => available.has(n)).length || a-b);
    if (choices.length === 1) metrics.forced++;
    if (choices.length > 1) metrics.branches++;
    for (const n of choices) {
      available.delete(n); path.push(n);
      if ((!available.size || connected(n)) && dfs(n)) return true;
      path.pop(); available.add(n); metrics.backtracks++;
      if (metrics.limited) return false;
    }
    return false;
  }
  const found = dfs(p.start);
  return { solution: found ? [...path] : null, metrics };
}
