import { createGame } from './game.js';
import { createStrokeAnalytics } from './analytics.js';
import { REWARD_IMAGE } from './config.js';
const $ = s => document.querySelector(s), board = $('#board'), dialog = $('#clear-dialog');
const analytics = createStrokeAnalytics();
let puzzles, puzzle, game, pointer = null, timer;
const time = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
function render() {
  const s=game.snapshot(), visited=new Set(s.path);
  for (const tile of board.querySelectorAll('.tile')) {
    const c=Number(tile.dataset.cell);tile.classList.toggle('visited',visited.has(c));tile.classList.toggle('current',s.path.at(-1)===c);
    tile.setAttribute('aria-pressed',String(visited.has(c)));
  }
  const rect=board.getBoundingClientRect(), gap=parseFloat(getComputedStyle(board).gap), cw=(rect.width-gap*(puzzle.width-1))/puzzle.width, ch=(rect.height-gap*(puzzle.height-1))/puzzle.height;
  board.querySelector('svg').setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  board.querySelector('polyline').setAttribute('points',s.path.map(c=>`${(c%puzzle.width)*(cw+gap)+cw/2},${Math.floor(c/puzzle.width)*(ch+gap)+ch/2}`).join(' '));
  $('#coverage').textContent=`${s.path.length} / ${puzzle.playable_cells}`;
  $('#elapsed').textContent=time(s.elapsed_seconds);$('#undo').disabled=s.path.length<2||s.cleared;
}
function build() {
  clearInterval(timer);pointer=null;
  board.style.setProperty('--width',puzzle.width);board.style.setProperty('--height',puzzle.height);board.style.setProperty('--ratio',`${puzzle.width}/${puzzle.height}`);
  const blocked=new Set(puzzle.blocked_cells);
  board.replaceChildren(...Array.from({length:puzzle.width*puzzle.height},(_,c)=>{
    const tile=document.createElement('button');tile.type='button';tile.dataset.cell=c;tile.className='tile';
    tile.disabled=blocked.has(c);tile.classList.toggle('blocked',blocked.has(c));
    tile.setAttribute('aria-label',c===puzzle.start?'START':c===puzzle.goal?'GOAL':`${c%puzzle.width+1}列 ${Math.floor(c/puzzle.width)+1}行`);
    if(c===puzzle.start){tile.textContent='S';tile.classList.add('start');}
    if(c===puzzle.goal){tile.textContent='G';tile.classList.add('goal');}
    tile.addEventListener('click',e=>{if(e.detail===0)step(c);});return tile;
  }));
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');svg.append(document.createElementNS(svg.namespaceURI,'polyline'));board.append(svg);
  $('#size').textContent=`${puzzle.width} × ${puzzle.height}`;$('#status').textContent='STARTから始めよう。S = START / G = GOAL';
  if(dialog.open)dialog.close();$('#viewport').scrollTo(0,0);render();
}
function step(c) {
  const result=game.step(c);if(result==='ignored')return;
  if(result==='start'){analytics.start(puzzle);timer=setInterval(render,250);$('#status').textContent='すべてのマスをつないで、最後にGOALへ。';}
  if(result==='clear') {
    clearInterval(timer);const s=game.snapshot();analytics.clear(puzzle,{elapsed_seconds:s.elapsed_seconds,move_count:s.move_count,undo_count:s.undo_count,reset_count:s.reset_count});
    $('#status').textContent='すべてのマスがつながりました！';$('#clear-stats').textContent=`${time(s.elapsed_seconds)} · ${puzzle.playable_cells}マス踏破`;
    $('#reward').hidden=false;$('#reward-fallback').hidden=true;$('#reward').src=REWARD_IMAGE;dialog.showModal();
  }
  render();
}
function hit(x,y) {
  const tile=document.elementFromPoint(x,y)?.closest('.tile');
  return tile&&board.contains(tile)?Number(tile.dataset.cell):null;
}
board.addEventListener('pointerdown',e=>{
  if($('#pan').checked||pointer!==null||!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
  const c=hit(e.clientX,e.clientY);if(c===null)return;
  e.preventDefault();pointer=e.pointerId;board.setPointerCapture(pointer);step(c);
});
board.addEventListener('pointermove',e=>{
  if(e.pointerId!==pointer)return;e.preventDefault();
  // Only observed cells are accepted. A fast jump is ignored, never interpolated
  // into a guessed route; coalesced events help preserve real high-speed input.
  const samples=e.getCoalescedEvents?.()??[];
  for(const sample of [...samples,e]){const c=hit(sample.clientX,sample.clientY);if(c!==null)step(c);}
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])board.addEventListener(name,e=>{if(e.pointerId===pointer)pointer=null;});
function reset(){const n=game.snapshot().reset_count+1;analytics.change('retry',puzzle);game=createGame(puzzle,{resetCount:n});build();}
function select(p){analytics.change('next_level',p);puzzle=p;game=createGame(puzzle);$('#difficulty').value=p.difficulty;options();$('#puzzle').value=p.id;build();}
function options(){const group=puzzles.filter(p=>p.difficulty===$('#difficulty').value);$('#puzzle').replaceChildren(...group.map((p,i)=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${i+1} / ${group.length}`;return o;}));}
function next(){select(puzzles[(puzzles.indexOf(puzzle)+1)%puzzles.length]);}
$('#reset').onclick=reset;$('#again').onclick=reset;$('#next').onclick=next;$('#clear-next').onclick=next;$('#close').onclick=()=>dialog.close();
$('#undo').onclick=()=>{game.undo();render();};
$('#difficulty').onchange=()=>select(puzzles.find(p=>p.difficulty===$('#difficulty').value));
$('#puzzle').onchange=()=>select(puzzles.find(p=>p.id===$('#puzzle').value));
$('#zoom').onchange=()=>{board.classList.toggle('zoomed',$('#zoom').checked);$('#pan').disabled=!$('#zoom').checked;
  if(!$('#zoom').checked){$('#pan').checked=false;board.classList.remove('panning');}render();};
$('#pan').onchange=()=>{pointer=null;board.classList.toggle('panning',$('#pan').checked);$('#status').textContent=$('#pan').checked?'移動モード：盤面をスワイプ。描くときは解除してください。':'線をつないで、最後にGOALへ。';};
$('#reward').onerror=()=>{$('#reward').hidden=true;$('#reward-fallback').hidden=false;};
new ResizeObserver(()=>{if(game)render();}).observe(board);
try {
  const response=await fetch('./puzzles.json');if(!response.ok)throw Error('data');puzzles=await response.json();puzzle=puzzles[0];game=createGame(puzzle);options();build();analytics.pageView(puzzle);
} catch { $('#status').textContent='問題を読み込めませんでした。ページを再読み込みしてください。';for(const b of document.querySelectorAll('button,select'))b.disabled=true; }
