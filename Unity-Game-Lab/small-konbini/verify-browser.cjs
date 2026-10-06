// Actual canvas mouse input. The WebGL bridge is observation-only.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Yusuke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const out=path.join(__dirname,'evidence'),browser=await chromium.launch({channel:'chrome',headless:false});
 const page=await browser.newPage({viewport:{width:1280,height:860}}),errors=[],messages=[],checks={},days=[],samples=[],staffSamples=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{messages.push({type:m.type(),text:m.text()});if(m.type()==='error')errors.push(m.text());});
 async function sample(){return page.evaluate(()=>window.shopSnapshot);}
 async function click(x,y){const b=await page.locator('#unity-canvas').boundingBox();await page.mouse.click(b.x+x*b.width/1200,b.y+y*b.height/720,{delay:45});await page.waitForTimeout(70);}
 async function state(s){await page.waitForFunction(s=>window.shopSnapshot?.state===s,s,{timeout:70000});}
 async function panel(s){await page.waitForFunction(s=>window.shopSnapshot?.panel===s,s,{timeout:5000});}
 async function order(i,target){await page.waitForTimeout(170);let current=(await sample()).order[i];while(current!==target){const delta=target-current,step=Math.abs(delta)>=5?5:1,k=delta>0?(step===5?3:2):(step===5?0:1);await click(408+k*72,279+i*57);current+=delta>0?step:-step;}await page.waitForFunction(v=>window.shopSnapshot.order[v.i]===v.target,{i,target},{timeout:5000});}
 async function price(i,tier){await click(250+tier*121,279+i*57);await page.waitForFunction(v=>window.shopSnapshot.price[v.i]===v.tier,{i,tier},{timeout:5000});}
 async function screenshot(name){await page.screenshot({path:path.join(out,name+'.png')});}
 try{
  await page.goto('http://127.0.0.1:4185/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.shopSnapshot?.shelves?.length===6&&window.shopSnapshot?.state==='Morning',null,{timeout:120000});await page.waitForTimeout(3000);
  if(errors.length)throw new Error([...new Set(errors)].join("; "));let initial=await sample();checks.storeDominant=initial.sceneFraction>=.7&&initial.panel==='';await screenshot('browser-town-morning-v4');
  await click(622,690);await panel('棚配置');await click(341,210);await click(825,468);await page.waitForFunction(()=>window.shopSnapshot.shelves[0].slot===7,null,{timeout:5000});checks.placement=true;
  await click(841,210);await click(595,332);await page.waitForFunction(()=>window.shopSnapshot.shelves[5].product===2,null,{timeout:5000});checks.duplicateProducts=true;
  await click(541,210);const coldProduct=(await sample()).shelves[2].product;await click(839,332);await page.waitForTimeout(200);checks.coldRestriction=(await sample()).shelves[2].product===coldProduct;
  await click(341,210);await click(519,468);await page.waitForFunction(()=>window.shopSnapshot.shelves[0].slot===5,null,{timeout:5000});await screenshot('browser-layout-v4');await click(600,570);await panel('');
  for(let day=1;day<=7;day++){
   await state('Morning');let morning=await sample();
   if(day===2){const before=JSON.stringify({stock:morning.stock,cash:morning.cash,price:morning.price,order:morning.order});await click(1070,646);await panel('前日の結果');const review=await sample();checks.previousReview=JSON.stringify(review.displayedResult)===JSON.stringify(days[0]);await screenshot('browser-previous-result-v4');await click(600,605);await panel('');const after=await sample();checks.reviewDoesNotMutate=before===JSON.stringify({stock:after.stock,cash:after.cash,price:after.price,order:after.order});}const target=day===1?[22,12,38,16,6]:[18,10,32,16,5];
   await click(142,690);await panel('仕入れ');const beforeForecast=(await sample()).prediction;
   const staff=day===2||day===6?2:1;await click(staff===2?562:365,155);await page.waitForFunction(v=>window.shopSnapshot.staffCount===v&&window.shopSnapshot.prediction.staffCount===v,staff,{timeout:10000});
   checks.staffSelection=true;checks.laborPrediction=(await sample()).prediction.labor===(staff===2?2100:600);
   for(let i=0;i<5;i++)await order(i,Math.max(0,target[i]-morning.stock[i]));const forecastOrder=(await sample()).prediction;checks.liveOrderForecast=forecastOrder.products.every((p,i)=>p.planned_stock===morning.stock[i]+Math.max(0,target[i]-morning.stock[i]))&&forecastOrder.purchases===(await sample()).orderCost;checks.forecastRanges=forecastOrder.samples===24&&forecastOrder.products.every(p=>p.units.low<=p.units.high&&p.revenue.low<=p.revenue.high&&p.shortageRisk&&p.wasteRisk);
   if(day===1)await screenshot('browser-order-v4');if(day===2)await screenshot('browser-two-staff-forecast-v4');await click(600,598);await panel('');
   await click(385,690);await panel('価格');for(let i=0;i<5;i++)await price(i,day===3?3:1);const lockedForecast=(await sample()).prediction;checks.livePriceForecast=lockedForecast.products.every((p,i)=>p.revenue.low===p.units.low*Math.round([160,620,160,180,420][i]*[.8,1,1.2,1.4][day===3?3:1]));
   if(day===1)await screenshot('browser-price-v4');await click(600,598);await panel('');
   const planned=await sample();await click(960,690);await state('Open');let opened=await sample();checks.orderAndCash=opened.cash===morning.cash-planned.orderCost;checks.closedPanels=opened.panel==='';checks.lockedForecast=JSON.stringify(opened.report.forecast)===JSON.stringify(lockedForecast);checks.noTradingForecast=opened.prediction.samples===0;
   if(day===1){let end=false,clockChanged=false,pickupBeforeRevenue=false,restockCaptured=false,queueCaptured=false,inventory=true,closedSpawn=null;
    const startTime=Date.now();while(Date.now()-startTime<70000){let live=await sample();samples.push(live);if(live.state==='Result'){end=true;break;}inventory&&=live.inventoryMatches;clockChanged||=live.clock!=='08:00';pickupBeforeRevenue||=live.pickups>0&&live.checkouts===0&&live.report.revenue===0;
     if(!restockCaptured&&['品出しへ','補充中'].includes(live.clerkState)){await screenshot('browser-restock-v4');restockCaptured=true;}
     if(!queueCaptured&&live.queue>=2){await screenshot('browser-queue-v4');queueCaptured=true;}
     if(live.elapsed>=45){if(closedSpawn===null)closedSpawn=live.spawned;else if(live.spawned!==closedSpawn)throw new Error('Customers spawned after closing');}
     if(live.elapsed>13&&live.elapsed<14)await screenshot('browser-town-trading-v4');
     await page.waitForTimeout(200);
    }
    if(!end)throw new Error('Normal day did not finish within 70 seconds');const finished=await sample();checks.normalDay=true;checks.clock=clockChanged;checks.pickupBeforeRevenue=pickupBeforeRevenue;checks.inventory=inventory;checks.customerMovement=finished.movementSamples>0&&finished.spawned>0;checks.staffMovement=finished.staffMoves>0;checks.restock=finished.restocks>0&&restockCaptured;checks.queue=finished.maxQueue>0&&finished.maxQueue<=4&&finished.waitingFrames>0;checks.saleAtCheckout=finished.checkouts===finished.report.sold;checks.emptyShelf=finished.emptyEvents>0;
   }else{await click(1109,690);await page.waitForFunction(()=>window.shopSnapshot.speed===4,null,{timeout:5000});checks.fastForward=true;let captured=false;const start=Date.now();while(Date.now()-start<70000){const live=await sample();if(live.state==='Result')break;if(staff===2){staffSamples.push(live);if(!live.inventoryMatches)throw new Error('Second staff inventory mismatch');if(live.stockerMoves>0)checks.secondStaffMove=true;if(!captured&&['品出しへ','補充中'].includes(live.stockerState)){await screenshot('browser-two-staff-restock-v4');captured=true;}if(captured&&live.restocks>0)checks.restock=true;}await page.waitForTimeout(100);}await state('Result');}
   if(errors.length)throw new Error([...new Set(errors)].join("; "));const result=await sample();days.push(result.report);
   const rows=result.report.products,sum=key=>rows.reduce((n,r)=>n+r[key],0);
   if(rows.length!==5||rows.some((r,i)=>r.day!==day||r.product_id!==i||!r.comment||r.ending_stock!==result.stock[i])||sum('units_sold')!==result.report.sold||sum('revenue')!==result.report.revenue||sum('waste_count')!==result.report.waste||sum('opportunity_loss_count')!==result.report.missed)throw new Error('Daily product data inconsistent');
   checks.productRows=true;checks.history=result.history.length===day;
   if(day>1){checks.previousDelta=result.salesDelta.every((v,i)=>v===rows[i].units_sold-days[day-2].products[i].units_sold);if(!checks.previousDelta)throw new Error('Sales delta inconsistent');}
   if(day===2)await screenshot('browser-comparison-v4');checks.electricity=result.report.electricity===300;checks.laborResult=result.report.staffCount===staff&&result.report.laborCost===(staff===2?2100:600);checks.profitFormula=result.report.profit===result.report.revenue-result.report.soldCost-result.report.wasteCost-result.report.electricity-result.report.laborCost;
   if(staff===2){checks.parallelRoles=result.parallelFrames>0;checks.secondStaffMove=result.stockerMoves>0;}checks.ledger=result.cash+result.inventoryValue-30000===result.totalProfit;
   if(day===1)await screenshot('browser-result-v4');console.log(JSON.stringify({day,profit:result.report.profit,sold:result.report.sold,missed:result.report.missed,shelfMissed:result.report.shelfMissed,restocks:result.restocks,checkouts:result.checkouts}));
   await click(600,605);await state(day===7?'Final':'Morning');if(day<7){const next=await sample();checks.nextDay=next.day===day+1&&next.panel==='';checks.carryover=next.stock[2]===result.stock[2]&&next.stock[0]===0;}
  }
  let final=await sample();checks.productTotals=final.productTotals.every((r,i)=>r.product_id===i&&r.units_sold===days.reduce((s,d)=>s+d.products[i].units_sold,0)&&r.revenue===days.reduce((s,d)=>s+d.products[i].revenue,0));checks.immutableHistory=JSON.stringify(final.history)===JSON.stringify(days);checks.totalPayroll=final.totalLabor===7200&&final.twoStaffDays===2;checks.forecastActualComparison=days.every(d=>d.forecast.samples===24&&d.forecast.products.length===5)&&days.some(d=>d.revenue!==d.forecast.revenue.mean);checks.emptyShelf=final.emptyEvents>0;checks.displayShortage=days.some(d=>d.shelfMissed>0);checks.sevenDays=final.day===7&&days.length===7;checks.final=final.state==='Final';await screenshot('browser-final-v4');await click(600,570);await state('Morning');const reset=await sample();checks.retry=reset.cash===30000&&reset.day===1&&reset.stock.every(v=>v===0)&&reset.totalProfit===0&&reset.staffCount===1&&reset.totalLabor===0&&reset.history.length===0&&reset.productTotals.every(r=>r.units_sold===0&&r.revenue===0);await screenshot('browser-retry-v4');
  const passed=Object.values(checks).every(v=>v===true)&&errors.length===0;fs.writeFileSync(path.join(out,'browser-tests-v4.json'),JSON.stringify({passed,browser:browser.version(),checks,days,final,reset,errors,messages,samples,staffSamples},null,2));console.log(JSON.stringify({passed,checks,errorCount:errors.length,uniqueErrors:[...new Set(errors)]},null,2));if(!passed)process.exitCode=1;
 }catch(e){fs.writeFileSync(path.join(out,'browser-failure-v4.json'),JSON.stringify({error:e.message,checks,days,errors,messages},null,2));await screenshot('browser-failure-v4').catch(()=>{});console.error(e);process.exitCode=1;}finally{await browser.close();}
})();








