export const GAME_NAMES = {minesweeper:'ちいさな宝さがし',memory:'神経衰弱', 'one-stroke':'一筆書き','color-blocks':'色ブロック消し','number-tap':'数字タップ','drum-smash':'ドラム缶スマッシュ','small-konbini':'ちいさなコンビニ'};
export function cleanGameUrl(url) { const u=new URL(url); u.search=''; u.hash=''; return u.href; }
const number = n => Number(n).toLocaleString('ja-JP');
export function toCardData(id,s,url) {
  let prefix,core,comment,primaryScoreLabel,primaryScoreValue,stats, axes={};
  const stat=(label,value)=>({label,value:String(value)}), seconds=`${Number(s.elapsed_seconds ?? 0).toFixed(1)}秒`;
  switch(id) {
    case 'minesweeper':
      prefix=s.flags_used>=s.mine_count/2?'旗を制する':s.elapsed_seconds<40?'速攻派の':'慎重派の';
      core=s.event_name==='game_clear'?'解除職人':'地雷探索者';
      primaryScoreLabel=s.event_name==='game_clear'?'CLEAR':s.event_name==='game_timeout'?'TIME UP':'GAME OVER';primaryScoreValue=seconds;
      stats=[stat('開いたマス',s.opened_cells),stat('使用した旗',s.flags_used),stat('盤面',`${s.board_width}×${s.board_height}`)];comment=s.event_name==='game_clear'?'安全なマスをすべて見つけました。':'今回の探索を記録。次の挑戦につなげよう。';break;
    case 'memory':
      prefix=s.mismatch_count===0?'ノーミスの':s.mismatch_count<=4?'正確派の':'粘り強い';core=s.elapsed_seconds<40?'紋章鑑定士':'記憶探索者';
      primaryScoreLabel='クリア時間';primaryScoreValue=seconds;stats=[stat('めくった回数',s.flip_count),stat('ミスマッチ',s.mismatch_count),stat('そろえたペア',s.pairs_matched)];comment=s.mismatch_count<=4?'少ない手数で着実にペアを見抜きました。':'何度も確かめて、すべてのペアを見つけました。';break;
    case 'one-stroke':
      prefix=s.undo_count===0&&s.reset_count===0?'迷わぬ':s.reset_count>0?'粘り強い':'試行錯誤する';core=['Hard','Expert','Challenge'].includes(s.difficulty)?'難問突破者':'経路設計士';
      primaryScoreLabel='クリア時間';primaryScoreValue=seconds;stats=[stat('踏破マス',s.playable_cells),stat('戻る / リセット',`${s.undo_count} / ${s.reset_count}`),stat('難易度',s.difficulty)];comment=s.undo_count===0?'一度も戻らずゴールまで到達しました。':'経路を見直しながら、最後までつなぎました。';break;
    case 'color-blocks':
      prefix=s.largest_group_removed>=15?'一撃重視の':s.remaining_blocks<=10?'盤面整理型の':'堅実消去型の';core=s.event_name==='game_clear'?'大消去マスター':'色彩整理士';
      primaryScoreLabel=s.event_name==='game_clear'?'CLEAR SCORE':'FINAL SCORE';primaryScoreValue=number(s.final_score);stats=[stat('消したブロック',s.total_blocks_removed),stat('最大グループ',s.largest_group_removed),stat('残り / 手数',`${s.remaining_blocks} / ${s.move_count}`)];comment=s.largest_group_removed>=15?'大きなまとまりを見つけて、一気に消しました。':'盤面を少しずつ整理して得点を重ねました。';break;
    case 'number-tap':
      prefix=s.miss_count===0?'正確無比の':'猪突猛進の';core=s.elapsed_seconds/s.max_number<1?'高速探索者':'順番マスター';
      primaryScoreLabel='クリア時間';primaryScoreValue=seconds;stats=[stat('MISS',s.miss_count),stat('数字',`1〜${s.max_number}`),stat('難易度',s.difficulty)];comment=s.miss_count===0?'順番を間違えず、すべての数字を見つけました。':'ミスから立て直し、最後の数字まで到達しました。';break;
    case 'drum-smash':
      prefix=s.shots===1?'一撃型の':s.combo>=3?'連鎖型の':'豪快型の';core=s.fallen===15?'ドラム缶破壊王':'鉄球職人';primaryScoreLabel=s.state;primaryScoreValue=number(s.score);stats=[stat('倒したドラム缶',`${s.fallen} / 15`),stat('使用した球',s.shots),stat('結果時のコンボ',s.combo)];comment=s.fallen===15?'すべてのドラム缶を倒しました。':s.state==='CLEAR'?'狙いを定めて、12本以上のドラム缶を倒しました。':'鉄球の一投を、次の挑戦につなげよう。';break;
    case 'small-konbini': {
      const history=s.history, sales=Array(5).fill(0);let revenue=0,weighted=0,sold=0;
      for(const d of history){revenue+=d.revenue;d.sales.forEach((v,i)=>{sales[i]+=v;weighted+=v*d.priceTiers[i];sold+=v;});}
      const avg=sold?weighted/sold:history.reduce((a,d)=>a+d.priceTiers.reduce((x,y)=>x+y,0)/5,0)/7;
      const management=avg<.75?'薄利多売':avg>=2?'高単価':'バランス経営';
      const leader=sales.indexOf(Math.max(...sales)), names=['おにぎり','弁当','飲料','菓子','日用品'];
      const product=sold&&sales[leader]/sold>=.35?names[leader]+'主力':'万遍型';
      const operation=s.twoStaffDays>=4?'人員投資型':s.twoStaffDays===0?'ワンオペ派':s.totalWaste/Math.max(1,sold+s.totalWaste)<=.05?'廃棄削減型':'売上優先型';
      axes={management_style:management,product_style:product,operation_style:operation,final_profit:s.totalProfit};prefix=management+'の';core=product+'・'+operation+'店長';
      primaryScoreLabel='7日間利益';primaryScoreValue=number(s.totalProfit)+'円';stats=[stat('7日間売上',number(revenue)+'円'),stat('主力商品',sold?names[leader]:'販売なし'),stat('廃棄',s.totalWaste+'個'),stat('機会損失',s.totalMissed+'件'),stat('2人体制',s.twoStaffDays+'日'),stat('販売数',sold+'個')];
      comment=`${management}で${product}の品ぞろえ。${operation}の7日間でした。`;break;
    }
    default:throw Error('Unknown game');
  }
  return {gameId:id,gameName:GAME_NAMES[id],title:prefix+core,titleKey:[id,prefix,core].join(':'),subtitle:id==='small-konbini'?'7日間経営記録':'プレイ記録',primaryScoreLabel,primaryScoreValue,stats,comment,gameUrl:cleanGameUrl(url),hashtag:'#LightweightBrowserGames',...axes};
}
export function shareText(c) {return `${c.gameName}｜${c.subtitle}\n称号「${c.title}」\n${c.primaryScoreLabel}: ${c.primaryScoreValue}\n${c.hashtag}\n${c.gameUrl}`;}
export function xShareUrl(c) {return 'https://x.com/intent/tweet?'+new URLSearchParams({text:shareText(c)});}
