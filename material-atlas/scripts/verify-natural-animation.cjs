const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local/natural-animation-verification');let browser,page;const checks=[],errors=[];
const snapshot=()=>page.evaluate(()=>harness.map.network.nodes.map(n=>({id:n.id,x:n.x,y:n.y,pinned:n.pinned})));
const distance=(a,b)=>a.reduce((s,n,i)=>s+Math.hypot(n.x-b[i].x,n.y-b[i].y),0)/Math.max(1,a.length);
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="../../dist/graph.css"><style>
  :root{--paper:#101316;--canvas:#101316;--surface:#25282a;--ink:#f0e8de;--muted:#b6ada1;--teal:#ffac62;--warning:#b5c68d;--line:#ffffff25}body{margin:0;background:var(--paper);color:var(--ink);font:13px Arial}button{padding:10px 20px;margin:15px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:18px}#star-map{width:1100px;height:680px;display:block;margin:0 20px}.node-core{fill:var(--teal)}.node-label,.tag-node-label{fill:var(--muted)}.node-hit-area{fill:transparent}</style>
  <button id="arrange">自然整理</button><button id="zoom">中止并放大</button><svg id="star-map" viewBox="0 0 1000 620"></svg><script type="module">
  import {StarMap} from '../../dist/graph-view.js';
  const papers=Array.from({length:28},(_,i)=>({id:String(i),title:'Materials sample '+i,tags:['Group '+Math.floor(i/10)],collection:'folder-'+Math.floor(i/10)}));
  const map=new StarMap(document.querySelector('#star-map'),{onSelect:id=>map.select(id),onZoom:()=>{},onHover:()=>{},onLayout:points=>{window.saved=points;},onNaturalLayoutState:state=>{document.querySelector('#arrange').disabled=state.busy;}});
  map.options={showEdges:true,showLabels:true};map.configure({},[],[{kind:'tag',value:'Group 0'},{kind:'tag',value:'Group 1'}]);
  map.setLayout(Object.fromEntries(papers.map(p=>['paper:'+p.id,{x:500,y:310,pinned:false}])));map.setData(papers,'0',[]);map.paused=true;cancelAnimationFrame(map.frame);map.frame=null;
  function scatter(){map.cancelNaturalLayout();map.network.nodes.forEach((n,i)=>Object.assign(n,{x:500+(i%3)*3,y:310+(i%4)*3,pinned:i===0,vx:0,vy:0}));map.paint();map.saveLayout();window.done=false;}
  scatter();window.harness={map,scatter};document.querySelector('#arrange').onclick=async()=>{window.result=await map.arrangeNaturalLayout();window.done=true;};document.querySelector('#zoom').onclick=()=>map.zoom(1.2);
  </script></html>`);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files','--disable-gpu','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});page=await browser.newPage({viewport:{width:1180,height:800}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.waitForFunction(()=>window.harness);await page.emulateMedia({reducedMotion:'no-preference'});
  await check('normal-motion layout visibly interpolates over time and settles without changing pins or links',async()=>{
    const before=await snapshot(),edges=await page.evaluate(()=>harness.map.network.edges.length);await page.locator('#arrange').click();
    await page.waitForFunction(()=>{const m=harness.map;return m.naturalTask&&m.network.nodes.some(n=>Math.abs(n.x-500)>30);});const middle=await snapshot();await page.waitForTimeout(120);const later=await snapshot();assert.ok(distance(middle,later)>1);
    await page.waitForFunction(()=>window.done);const final=await snapshot();assert.deepEqual(final[0],before[0]);assert.ok(distance(before,final)>70);assert.equal(await page.evaluate(()=>harness.map.network.edges.length),edges);assert.equal(await page.evaluate(()=>harness.map.paused),true);await page.screenshot({path:path.join(out,'natural-settled.png')});
  });
  await check('interrupting an active transition stops every later animation frame',async()=>{
    await page.evaluate(()=>harness.scatter());await page.locator('#arrange').click();await page.waitForFunction(()=>harness.map.naturalTask&&harness.map.network.nodes.some(n=>Math.abs(n.x-500)>30));await page.locator('#zoom').click();const interrupted=await snapshot();await page.waitForTimeout(900);assert.deepEqual(await snapshot(),interrupted);assert.equal(await page.evaluate(()=>harness.map.naturalTask),null);assert.equal(await page.evaluate(()=>window.result),false);
  });
  await check('reduced motion applies a final layout directly and undo restores the original camera and points',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>harness.scatter());const before=await snapshot(),camera=await page.evaluate(()=>({x:harness.map.x,y:harness.map.y,scale:harness.map.scale}));await page.locator('#arrange').click();await page.waitForFunction(()=>window.done);assert.equal(await page.evaluate(()=>harness.map.naturalTask),null);assert.ok(distance(before,await snapshot())>70);
    await page.evaluate(()=>harness.map.undoNaturalLayout());assert.deepEqual(await snapshot(),before);assert.deepEqual(await page.evaluate(()=>({x:harness.map.x,y:harness.map.y,scale:harness.map.scale})),camera);
  });
  await check('without Worker support, chunked fallback computation keeps the UI event loop responsive',async()=>{
    await page.evaluate(()=>{harness.scatter();window.Worker=undefined;window.ticks=0;window.tickTimer=setInterval(()=>ticks++,10);});await page.locator('#arrange').click();await page.waitForFunction(()=>window.done);const ticks=await page.evaluate(()=>{clearInterval(tickTimer);return ticks;});assert.ok(ticks>10,ticks);assert.ok(await page.evaluate(()=>!!window.result.points.length));
  });
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
})().catch(async error=>{console.error(error);process.exitCode=1;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'failure.txt'),error.stack);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}).finally(async()=>browser?.close());
