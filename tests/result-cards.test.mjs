import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {toCardData,cleanGameUrl,xShareUrl,GAME_NAMES} from '../src/card-data.js';
import {ingest,validEvent} from '../worker/index.js';
import {CARD_EVENTS} from '../src/card-events.js';
const url='https://lightweight-browser-games.pages.dev/number-tap/?test=1&debug=1#dev';
const shop=(tier,staff,sales)=>({history:Array.from({length:7},()=>({revenue:10000,sales,priceTiers:Array(5).fill(tier)})),twoStaffDays:staff,totalProfit:20000,totalWaste:4,totalMissed:10});
test('titles change with style and result, including all three konbini axes',()=>{
  const cases={
    minesweeper:[{elapsed_seconds:10,flags_used:0},{elapsed_seconds:90,flags_used:0},{elapsed_seconds:90,flags_used:8}],
    memory:[{mismatch_count:0},{mismatch_count:4},{mismatch_count:5}],
    'one-stroke':[{undo_count:0,reset_count:0},{undo_count:1,reset_count:0},{undo_count:1,reset_count:2}],
    'color-blocks':[{largest_group_removed:15,remaining_blocks:20},{largest_group_removed:14,remaining_blocks:10},{largest_group_removed:14,remaining_blocks:11}],
    'number-tap':[{elapsed_seconds:10,miss_count:0},{elapsed_seconds:10,miss_count:5},{elapsed_seconds:40,miss_count:0}],
    'drum-smash':[{shots:1,combo:1,fallen:15},{shots:2,combo:3,fallen:14},{shots:3,combo:1,fallen:4}],
    'small-konbini':[shop(0,0,[1,1,20,1,1]),shop(3,5,[1,20,1,1,1]),shop(1,2,[4,4,4,4,4])]
  };
  for(const [id,inputs] of Object.entries(cases)){
    const cards=inputs.map(s=>toCardData(id,{elapsed_seconds:60,mine_count:12,event_name:'game_clear',max_number:25,...s},url));
    assert.equal(new Set(cards.map(c=>c.titleKey)).size,3,id);assert(cards.every(c=>c.gameUrl==='https://lightweight-browser-games.pages.dev/number-tap/'));
  }
  const a=toCardData('small-konbini',shop(0,0,[1,1,20,1,1]),url), b=toCardData('small-konbini',shop(3,5,[1,20,1,1,1]),url);
  for(const key of ['management_style','product_style','operation_style'])assert.notEqual(a[key],b[key]);
  assert.equal(a.stats.find(s=>s.label==='7日間売上').value,'70,000円');
  assert.equal(cleanGameUrl(url),'https://lightweight-browser-games.pages.dev/number-tap/');
  assert(!new URL(xShareUrl(a)).searchParams.get('text').includes('test=1'));
});
test('card API stores all seven games/actions, is_test, axes, deduplication and rejects extra fields',async()=>{
  const db=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../migrations/',import.meta.url)).sort())db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const env={GAME_LOG_DB:{prepare:sql=>({bind:(...args)=>({run:async()=>db.prepare(sql).run(...args)})})}};
  const request=e=>new Request('http://localhost/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});
  for(const game_id of Object.keys(GAME_NAMES))for(const event_name of CARD_EVENTS){
    const e={game_id,event_name,event_id:crypto.randomUUID(),event_seq:2,timestamp:new Date().toISOString(),session_id:crypto.randomUUID(),play_id:crypto.randomUUID(),previous_play_id:null,title_key:'test',primary_result:'100円',is_test:true};
    if(game_id==='small-konbini')Object.assign(e,{management_style:'薄利多売',product_style:'飲料主力',operation_style:'ワンオペ派',final_profit:-100});
    assert(validEvent(e));assert.equal((await ingest(request(e),env)).status,204);assert.equal((await ingest(request(e),env)).status,204);
    assert(!validEvent({...e,email:'private'}));assert(!validEvent({...e,play_id:null}));assert(!validEvent({...e,primary_result:100}));assert(!validEvent({...e,timestamp:[e.timestamp]}));assert(!validEvent({...e,previous_play_id:[crypto.randomUUID()]}));
  }
  assert.equal(db.prepare('SELECT count(*) n FROM result_card_events WHERE is_test=1').get().n,35);
  assert.equal(db.prepare('SELECT count(*) n FROM game_events').get().n,0);
  assert.equal(db.prepare("SELECT final_profit FROM result_card_events WHERE game_id='small-konbini'").get().final_profit,-100);db.close();
});
