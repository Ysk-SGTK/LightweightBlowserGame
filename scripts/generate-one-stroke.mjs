import { readFile, writeFile } from 'node:fs/promises';
import { neighbors, solve, validatePuzzle } from './one-stroke-solver.mjs';
import { qualityReport } from './one-stroke-quality.mjs';
let seed=20261005;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;}
const xy=(x,y)=>[x,y];
const specs=[
 {id:'easy-2',difficulty:'Easy',n:8,cut:[xy(0,0),xy(1,0)],note:'外周の小さな欠け。穴を回り込む判断は不要。'},
 {id:'easy-3',difficulty:'Easy',n:8,cut:[xy(7,0),xy(7,1)],note:'右上だけを削った素直な盤面。'},
 {id:'easy-4',difficulty:'Easy',n:8,cut:[xy(0,7),xy(1,7),xy(7,0),xy(6,0)],note:'対角の小さな外周欠損。'},
 {id:'easy-5',difficulty:'Easy',n:8,cut:[xy(0,0),xy(1,0),xy(0,1)],note:'角を小さく丸めた盤面。'},
 {id:'normal-1',difficulty:'Normal',n:9,holes:[xy(4,4)],pattern:'A',start:[xy(0,4)],goal:[xy(8,3)],note:'中央1マスの穴。中央行を直進できず、左右の回り込みを選ぶ。'},
 {id:'normal-2',difficulty:'Normal',n:8,holes:[xy(3,3)],pattern:'A',start:[xy(1,2)],goal:[xy(6,5)],note:'中央付近の1マス穴。穴の上下の帯をつなぐ場所を残す。'},
 {id:'normal-3',difficulty:'Normal',n:10,holes:[xy(3,4),xy(5,4),xy(4,6)],cut:[xy(0,0)],pattern:'B',start:[xy(4,3)],goal:[xy(6,6)],note:'中央付近の離れた3穴と非対称の外周欠損。穴の間の順序を考える。'},
 {id:'normal-4',difficulty:'Normal',n:9,mask:'u-shape',holes:[xy(1,3)],note:'幅3のコの字と小穴。片側の腕から底を回って反対側へ。'},
 {id:'normal-5',difficulty:'Normal',n:9,mask:'rooms-and-bridge',holes:[xy(1,3)],start:[xy(1,0)],goal:[xy(7,3)],note:'二領域の接続部。左側を埋める前に渡ると戻れない。'},
 {id:'hard-1',difficulty:'Hard',n:10,holes:[xy(3,3),xy(6,3),xy(3,6),xy(6,6)],cut:[xy(0,0),xy(1,0),xy(0,1)],start:[xy(4,4)],goal:[xy(7,5)],pattern:'multi-hole',note:'4つの内部穴と非対称外周。中央の十字と外周をつなぐ出口を使い切らない。'},
 {id:'hard-2',difficulty:'Hard',n:11,mask:'rooms-and-bridge',holes:[xy(1,3),xy(2,7),xy(8,6)],start:[xy(1,1)],goal:[xy(9,6)],note:'3穴と二領域。細道の入口に進む前に左領域を完了する。'},
 {id:'hard-3',difficulty:'Hard',n:10,mask:'stacked-rooms',holes:[xy(3,2),xy(5,7)],cut:[xy(0,0),xy(1,0)],note:'上下二領域と縦の1マス幅通路。先に上側の穴を囲む帯を埋める。'},
 {id:'hard-4',difficulty:'Hard',n:12,mask:'u-shape',fixedEndpoints:true,holes:[xy(1,3),xy(2,3),xy(1,4),xy(2,4),xy(9,3),xy(10,3),xy(9,4),xy(10,4),xy(5,9),xy(6,9),xy(5,10),xy(6,10)],start:[xy(1,1)],goal:[xy(2,1)],note:'幅広のコの字と3つの穴。両腕と底の回り込みを設計する。'},
 {id:'hard-5',difficulty:'Hard',n:10,holes:[xy(4,4),xy(4,5),xy(5,4),xy(7,7)],cut:[xy(9,0),xy(9,1),xy(0,6),xy(1,6),xy(2,6),xy(3,6)],start:[xy(3,4)],goal:[xy(5,6)],pattern:'C',note:'中央L字穴と右下の小穴、左からの切り込み。中央を回る経路を残す。'},
 {id:'expert-1',difficulty:'Expert',n:12,mask:'comb',holes:[xy(1,3),xy(5,5),xy(9,3)],cut:[xy(3,10),xy(7,10)],note:'幅3の櫛形と3穴。歯ごとの出入りに必要な底の帯を温存する。'},
 {id:'expert-2',difficulty:'Expert',n:11,fixedEndpoints:true,holes:[xy(4,4),xy(5,4),xy(6,4),xy(4,5),xy(5,5),xy(6,5),xy(4,6),xy(5,6),xy(6,6),xy(1,3),xy(8,7)],cut:[xy(0,0),xy(1,0)],start:[xy(3,5)],goal:[xy(3,6)],pattern:'C',note:'中央の大きな穴と小穴。STARTとGOALは近いが、中央環状領域を一周して最後に戻る。'},
 {id:'expert-3',difficulty:'Expert',n:11,mask:'rooms-and-bridge',fixedEndpoints:true,holes:[xy(1,3),xy(2,7),xy(8,3),xy(8,6)],cut:[xy(10,0),xy(10,1)],start:[xy(3,5)],goal:[xy(9,5)],note:'4穴・非対称二領域。中央付近のSTARTから左領域を先に回収し、細道を最後に渡る。'},
 {id:'expert-4',difficulty:'Expert',n:10,fixedEndpoints:true,holes:[xy(3,3),xy(6,3),xy(3,6),xy(6,6)],cut:[xy(0,0),xy(1,0),xy(2,0),xy(3,0),xy(6,9),xy(7,9),xy(8,9),xy(9,9),xy(0,6),xy(0,7)],start:[xy(4,4)],goal:[xy(5,4)],pattern:'multi-hole',note:'中央隣接START/GOALと4穴。目の前のGOALを最後に残し、上下左右の領域をつなぐ。'},
 {id:'challenge-1',difficulty:'Challenge',n:16,mask:'three-rooms',holes:[xy(2,2),xy(3,2),xy(11,2),xy(13,3),xy(6,12),xy(9,12)],start:[xy(3,3)],goal:[xy(6,14)],note:'非対称の三領域と二つの1マス幅接続部。穴を回って各領域を完了する順序を組み立てる。'}
];
function make(spec){
 const {n}=spec,blocked=new Set((spec.holes||[]).concat(spec.cut||[]).map(([x,y])=>y*n+x));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  let keep=true,mid=Math.floor(n/2);
  if(spec.mask==='u-shape'){const arm=spec.difficulty==='Hard'?4:3;keep=x<arm||x>=n-arm||y>=n-arm;}
  if(spec.mask==='comb')keep=y>=n-2||x%4<3;
  if(spec.mask==='rooms-and-bridge')keep=x<mid-1||x>mid||y===Math.floor(n/2)-Math.floor(n/2)%2;
  if(spec.mask==='stacked-rooms')keep=y<4||y>=n-4||x===5;
  if(spec.mask==='three-rooms')keep=(x<=5&&y<=6)||(x>=9&&y<=6)||(x>=3&&x<=13&&y>=10)||(y===4&&x>=6&&x<=8)||(x===11&&y>=7&&y<=9);
  if(!keep)blocked.add(y*n+x);
 }
 return {id:spec.id,difficulty:spec.difficulty,width:n,height:n,blocked_cells:[...blocked].sort((a,b)=>a-b),playable_cells:n*n-blocked.size,shape:spec.mask||'central-holes',design_note:spec.note,central_pattern:spec.pattern||null};
}
function endpointPools(spec,p){
 const blocked=new Set(p.blocked_cells),n=p.width,cells=[];
 for(let c=0;c<n*n;c++)if(!blocked.has(c)&&neighbors(c,n,n).filter(k=>!blocked.has(k)).length>=2)cells.push(c);
 let start=cells,goal=cells;
 if(spec.mask==='rooms-and-bridge'){start=cells.filter(c=>c%n<Math.floor(n/2)-1);goal=cells.filter(c=>c%n>Math.floor(n/2));}
 if(spec.mask==='stacked-rooms'){start=cells.filter(c=>Math.floor(c/n)<4);goal=cells.filter(c=>Math.floor(c/n)>=n-4);}
 if(spec.mask==='u-shape'){const arm=spec.difficulty==='Hard'?4:3;start=cells.filter(c=>c%n<arm);goal=cells.filter(c=>c%n>=n-arm);}
 if(spec.mask==='comb'){start=cells.filter(c=>c%n<3);goal=cells.filter(c=>c%n>=8);}
 if(spec.mask==='three-rooms'){start=cells.filter(c=>c%n<=5&&Math.floor(c/n)<=6);goal=cells.filter(c=>c%n>=3&&c%n<=13&&Math.floor(c/n)>=10);}
 if(spec.fixedEndpoints)return [(spec.start||[]).map(([x,y])=>y*n+x),(spec.goal||[]).map(([x,y])=>y*n+x)];
 const shuffle=a=>a.map(c=>({c,r:random()})).sort((a,b)=>a.r-b.r).map(v=>v.c);
 return [[...(spec.start||[]).map(([x,y])=>y*n+x),...shuffle(start)],[...(spec.goal||[]).map(([x,y])=>y*n+x),...shuffle(goal)]];
}
const puzzles=[JSON.parse(await readFile(new URL('./one-stroke-easy-baseline.json',import.meta.url),'utf8'))];
for(const spec of specs){
 const p=make(spec),[starts,goals]=endpointPools(spec,p),blocked=new Set(p.blocked_cells);
 const counts=[0,0];for(let c=0;c<p.width*p.height;c++)if(!blocked.has(c))counts[(c%p.width+Math.floor(c/p.width))%2]++;
 let accepted=false,attempt=0;
 for(let i=0;i<starts.length&&!accepted&&attempt<120;i++)for(let j=0;j<goals.length&&!accepted&&attempt<120;j++){
  p.start=starts[i];p.goal=goals[j];if(p.start===p.goal)continue;
  const parity=c=>(c%p.width+Math.floor(c/p.width))%2;
  if(Math.abs(counts[0]-counts[1])>1)throw Error(spec.id+' color imbalance '+counts);
  if(counts[0]===counts[1]?parity(p.start)===parity(p.goal):parity(p.start)!==(counts[0]>counts[1]?0:1)||parity(p.goal)!==parity(p.start))continue;
  attempt++;const result=solve(p,{maxNodes:40000});if(!result.solution)continue;
  p.solution=result.solution;p.solver_metrics=result.metrics;
  const turns=p.solution.slice(2).filter((c,i)=>c-p.solution[i+1]!==p.solution[i+1]-p.solution[i]).length;
  if(turns<p.playable_cells*.28)continue;
  const q=qualityReport(p);
  if(spec.difficulty!=='Easy'&&(!q.simple_snake.passed||q.junctions<12))continue;
  if(['Hard','Expert','Challenge'].includes(spec.difficulty)&&(q.isolation_witnesses.length<8||q.holes.length<2))continue;
  p.generation={seed:20261005,method:'curated-shape-and-endpoint-search',attempt,solution_turns:turns};
  p.difficulty_score=result.metrics.branches+result.metrics.backtracks;p.quality=q;
  validatePuzzle(p);puzzles.push(p);accepted=true;
  console.log(p.id,p.playable_cells,JSON.stringify({nodes:result.metrics.nodes,backtracks:result.metrics.backtracks,holes:q.holes.length,central:q.central_holes,narrow:q.narrow_cells,regions:q.region_separators.length,ordering:q.isolation_witnesses.length,start:p.start,goal:p.goal}));
 }
 if(!accepted)throw Error('No acceptable candidate '+spec.id+' '+JSON.stringify(counts));
}
puzzles[0].design_note='外周だけの小さな欠損を持つ既存Easyを維持。';
const baselineResult=solve(puzzles[0]);puzzles[0].solver_metrics=baselineResult.metrics;
puzzles[0].difficulty_score=baselineResult.metrics.branches+baselineResult.metrics.backtracks;puzzles[0].quality=qualityReport(puzzles[0]);
await writeFile(new URL('../one-stroke/puzzles.json',import.meta.url),JSON.stringify(puzzles,null,2)+'\n');
await writeFile(new URL('../one-stroke/catalog.js',import.meta.url),'// Generated fixed-board metadata for API validation.\nexport const catalog = '+JSON.stringify(puzzles.map(({id,difficulty,width,height,playable_cells})=>({id,difficulty,width,height,playable_cells})))+';\n');
