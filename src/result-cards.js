import {toCardData,shareText,xShareUrl} from './card-data.js';
let dialog, buttons=[], active, fontReady;
const font='"Record Japanese"';
async function loadFont(){
  fontReady??=(async()=>{const face=new FontFace('Record Japanese','url(/assets/fonts/NotoSansCJKjp-Regular.otf)');document.fonts.add(await face.load());})();
  try { await fontReady; } catch(error) { fontReady=undefined; throw error; }
}
export async function renderCard(c) {
  await loadFont();
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f4f2e9';ctx.fillRect(0,0,1200,630);ctx.fillStyle='#25644f';ctx.fillRect(0,0,14,630);
  function text(value,x,y,size,width=1096,color='#19372e') {
    value=String(value);ctx.fillStyle=color;ctx.font=`${size}px ${font}`;
    while(ctx.measureText(value).width>width&&size>14)ctx.font=`${--size}px ${font}`;
    ctx.fillText(value,x,y);
  }
  text(c.gameName,52,60,30,800);text(c.subtitle,900,60,18,250,'#526b61');
  text(c.title,52,128,40);text(c.primaryScoreLabel,52,181,22,1096,'#526b61');text(c.primaryScoreValue,52,259,64);
  c.stats.slice(0,6).forEach((s,i)=>{const x=52+(i%3)*370,y=315+Math.floor(i/3)*78;text(s.label,x,y,18,330,'#526b61');text(s.value,x,y+35,28,330);});
  const commentY=c.stats.length>3?478:450;
  // Wrap Japanese by grapheme, never split surrogate pairs.
  let line='',lines=[];ctx.font=`23px ${font}`;
  for(const char of c.comment){if(ctx.measureText(line+char).width>1096){lines.push(line);line=char;}else line+=char;}lines.push(line);
  lines.slice(0,2).forEach((v,i)=>text(v,52,commentY+i*30,23));
  ctx.fillStyle='#cfdbd2';ctx.fillRect(52,548,1096,1);text('Lightweight Browser Games',52,582,20);text(c.hashtag,750,582,18,398);text(c.gameUrl,52,613,17,1096,'#526b61');return canvas;
}
function setup(){
  if(dialog)return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/src/result-cards.css';document.head.append(link);
  dialog=document.createElement('dialog');dialog.id='record-card-dialog';dialog.setAttribute('aria-label','記録カード');
  dialog.innerHTML='<h2>記録カード</h2><div class="record-preview"></div><p class="record-description"></p><div class="record-actions"></div><p class="record-status" role="status" aria-live="polite"></p><button class="record-close" type="button">閉じる</button>';
  dialog.querySelector('.record-close').onclick=()=>dialog.close();
  document.body.append(dialog);
}
export function observeResult(event,send) {
  if(typeof document==='undefined'||!document.body)return;
  if(['retry','next_level','game_start'].includes(event.event_name)){buttons.forEach(b=>b.hidden=true);active=null;dialog?.close();return;}
  if(!['game_clear','game_over','game_timeout'].includes(event.event_name))return;
  presentResult(toCardData(event.game_id,event,location.href),event,send);
}
export function presentResult(data,context,send){
  setup();buttons.forEach(b=>b.remove());buttons=[];active={data,context,send,sequence:context.event_seq};
  const selectors={minesweeper:['.reward-content','.game-shell'],memory:['#clear-dialog'],'one-stroke':['#clear-dialog'],'color-blocks':['#result'],'number-tap':['#result']};
  const targets=selectors[data.gameId]?.map(s=>document.querySelector(s)).filter(Boolean)??[document.querySelector('#unity-fullscreen-container')??document.body];
  for(const target of targets){const b=document.createElement('button');b.type='button';b.className='record-open';b.textContent='記録カードを見る';b.onclick=()=>void openCard().catch(()=>{dialog.querySelector('.record-status').textContent='画像を生成できませんでした。もう一度お試しください。';});target.append(b);buttons.push(b);}
}
function log(a,name){
  const c=a.data,e=a.context;
  const payload={game_id:c.gameId,event_id:crypto.randomUUID(),event_seq:++a.sequence,event_name:name,timestamp:new Date().toISOString(),session_id:e.session_id,play_id:e.play_id,previous_play_id:e.previous_play_id,title_key:c.titleKey,primary_result:c.primaryScoreValue};
  for(const k of ['management_style','product_style','operation_style','final_profit'])if(k in c)payload[k]=c[k];
  try{Promise.resolve(a.send(payload)).catch(()=>{});}catch{/* Sharing never depends on analytics. */}
}
async function openCard(){
  const a=active;if(!a)return;dialog.showModal();dialog.querySelector('.record-actions').replaceChildren();dialog.querySelector('.record-preview').replaceChildren();const status=dialog.querySelector('.record-status');status.textContent='画像を生成中…';
  const canvas=await renderCard(a.data);if(active!==a)return;
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG unavailable')),'image/png'));
  dialog.querySelector('.record-preview').replaceChildren(canvas);
  // The full text remains readable and accessible at narrow viewport widths.
  dialog.querySelector('.record-description').textContent=shareText(a.data)+'\n\n'+a.data.stats.map(s=>`${s.label}: ${s.value}`).join('\n')+'\n'+a.data.comment;status.textContent='';log(a,'result_card_open');
  const actions=dialog.querySelector('.record-actions');actions.replaceChildren();
  function button(label,fn,enabled=true){const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=!enabled;b.onclick=async()=>{try{await fn();}catch(error){status.textContent=error.name==='AbortError'?'共有をキャンセルしました。':'操作できませんでした。画像を保存してお試しください。';}};actions.append(b);return b;}
  button('画像を保存',()=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=a.data.gameId+'-result.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);log(a,'result_card_download');status.textContent='PNGを保存しました';});
  const canCopy=Boolean(globalThis.ClipboardItem&&navigator.clipboard?.write&&globalThis.isSecureContext);
  const copy=button('画像をコピー',async()=>{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);status.textContent='コピーしました';log(a,'result_card_copy');},canCopy);if(!canCopy)copy.title='このブラウザでは利用できません';
  const file=new File([blob],a.data.gameId+'-result.png',{type:'image/png'}),share={files:[file],title:a.data.gameName,text:shareText(a.data),url:a.data.gameUrl};
  const canShare=Boolean(navigator.share&&navigator.canShare?.({files:[file]}));
  const shareButton=button('共有',async()=>{await navigator.share(share);log(a,'result_card_share');status.textContent='共有しました';},canShare);if(!canShare)shareButton.title='このブラウザでは画像共有を利用できません';
  button('Xで共有',()=>{window.open(xShareUrl(a.data),'_blank','noopener,noreferrer');log(a,'result_card_x_share');status.textContent='保存・コピーした画像をXの投稿画面で添付できます';});
}
