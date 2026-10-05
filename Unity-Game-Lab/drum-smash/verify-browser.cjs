// Drives actual mouse input into the Unity canvas. Telemetry is read-only.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('C:/Users/Yusuke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const out=path.join(__dirname,'evidence');
  const browser=await chromium.launch({channel:'chrome',headless:false});
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  const errors=[],messages=[],checks={};
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());messages.push(m.text());});
  async function latest(){return page.evaluate(()=>window.drumSmash.latest);}
  async function waitReady(){await page.waitForFunction(()=>window.drumSmash.latest.ready,null,{timeout:25000});}
  async function drag(dx,dy){
    const b=await page.locator('#unity-canvas').boundingBox();
    const x=b.x+b.width*.5,y=b.y+b.height*.45;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:16});
    await page.waitForTimeout(220);await page.screenshot({path:path.join(out,'browser-aim.png')});await page.mouse.up();
  }
  async function retry(result){
    const b=await page.locator('#unity-canvas').boundingBox();
    await page.mouse.click(b.x+b.width*(result?.5:.92),b.y+b.height*(result?.62:.935));
    await page.waitForTimeout(400);
  }
  try {
    await page.goto('http://127.0.0.1:4181',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.drumSmash?.latest?.ready,null,{timeout:120000});
    await page.waitForTimeout(8000);checks.initial=await latest();checks.stable=checks.initial.fallen===0;
    await page.screenshot({path:path.join(out,'browser-start.png')});
    for(let i=0;i<3;i++){
      await waitReady();const before=await latest();await drag(i===0?0:(i===1?24:-24),245);
      await page.waitForFunction(n=>window.drumSmash.latest.shots===n,before.shots+1,{timeout:5000});
      if(i===0){await drag(80,180);checks.concurrentBlocked=(await latest()).shots===1;}
      await page.waitForFunction(()=>['READY','CLEAR','GAME OVER'].includes(window.drumSmash.latest.state),null,{timeout:30000});
      if((await latest()).state==='CLEAR')break;
    }
    await page.waitForTimeout(4000);checks.hit=await latest();checks.clear=checks.hit.state==='CLEAR'&&checks.hit.fallen>=12;
    checks.physics=checks.hit.impacts>0&&checks.hit.maxBarrelSpeed>1&&checks.hit.fallen>1;
    checks.effects=checks.hit.sparks>0&&checks.hit.shakes>0;
    await page.screenshot({path:path.join(out,'browser-clear.png')});
    await retry(checks.clear);await waitReady();checks.reset=await latest();checks.retry=checks.reset.shots===0&&checks.reset.fallen===0&&checks.reset.combo===0&&checks.reset.impacts===0;
    await drag(-360,220);await page.waitForTimeout(300);checks.direction=(await latest()).vx>0;
    await page.waitForFunction(()=>window.drumSmash.latest.ready,null,{timeout:30000});
    await drag(360,220);await page.waitForTimeout(300);checks.direction=checks.direction&&(await latest()).vx<0;
    await waitReady();await drag(-360,220);
    await page.waitForFunction(()=>window.drumSmash.latest.state==='GAME OVER',null,{timeout:60000});
    checks.miss=await latest();checks.gameOver=checks.miss.shots===3&&checks.miss.fallen<12;
    await drag(0,220);checks.limit=(await latest()).shots===3;
    await page.screenshot({path:path.join(out,'browser-game-over.png')});
    await retry(true);await waitReady();checks.retryFromGameOver=(await latest()).shots===0;
    await page.screenshot({path:path.join(out,'browser-retry.png')});
    const telemetry=await page.evaluate(()=>window.drumSmash);
    const passed=['stable','concurrentBlocked','clear','physics','effects','retry','direction','gameOver','limit','retryFromGameOver'].every(k=>checks[k]===true)&&errors.length===0;
    const result={passed,browser:browser.version(),checks,errors,messages,telemetry};fs.writeFileSync(path.join(out,'browser-tests.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({passed,browser:result.browser,checks,errors},null,2));if(!passed)process.exitCode=1;
  } catch(e) {fs.writeFileSync(path.join(out,'browser-failure.json'),JSON.stringify({error:e.message,checks,errors,messages},null,2));await page.screenshot({path:path.join(out,'browser-failure.png')}).catch(()=>{});console.error(e);process.exitCode=1;}
  finally {await browser.close();}
})();
