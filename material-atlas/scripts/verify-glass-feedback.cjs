// Exercise the production interaction/runtime in an active Chromium compositor.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local/glass-feedback-verification');
let browser,page;const checks=[],errors=[];
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
async function scale(){return page.locator('#press').evaluate(e=>parseFloat(getComputedStyle(e).scale)||1);}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  const pack=JSON.parse(await fs.readFile(path.join(root,'theme-examples/liquid-glass/01-澄璃-浅色.mtheme.json'),'utf8'));
  const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="../../dist/theme-appearance.css"><style>
  *{box-sizing:border-box}body{margin:0;background:var(--paper)}button{cursor:pointer;font:inherit;padding:10px 22px;border-radius:20px;border:1px solid var(--glass-edge);color:var(--ink);background:var(--glass-field)}button:disabled{opacity:.35;cursor:default}.library-surface{margin:40px;padding:28px;width:640px}h1{font-size:23px;margin:0 0 9px}.hint{color:var(--muted);font-size:13px}.controls{display:flex;gap:12px;margin:26px 0}.primary{min-width:155px}.paper-row{margin:0;padding:18px}#count{font-variant-numeric:tabular-nums;font-size:12px;color:var(--muted)}
  </style><div class="library-surface"><h1>澄璃 · Clear Glass</h1><div class="hint">按下收缩，松手回弹；纯色背景与透明材质分别设置。</div><div class="controls"><button id="press" class="primary">按住试试</button><button id="secondary">普通按钮</button><button id="disabled" disabled>不可用</button></div><div class="paper-row">中性纯色背景 · 透明玻璃 · 局部反光</div><p id="count">0 次点击</p></div><script type="module">
  import {resolveTheme,importThemeFiles} from '../../dist/theme-model.js';import {createThemeRuntime} from '../../dist/theme-runtime.js';
  const prefs=importThemeFiles({},[{name:'glass.mtheme.json',text:${JSON.stringify(JSON.stringify(pack))}}],()=> 'custom-demo');
  const runtime=createThemeRuntime();runtime.apply(resolveTheme(prefs));let clicks=0;
  document.querySelector('#press').addEventListener('click',()=>{clicks++;document.querySelector('#count').textContent=clicks+' 次点击';});
  globalThis.feedbackTest={runtime,prefs,resolveTheme,clicks:()=>clicks};
  </script></html>`;
  await fs.writeFile(path.join(out,'index.html'),html);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files','--disable-gpu','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows']});
  page=await browser.newPage({viewport:{width:720,height:390},reducedMotion:'no-preference'});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(out,'index.html')).href);await page.waitForFunction(()=>globalThis.feedbackTest);
  const button=page.locator('#press'),box=await button.boundingBox();
  await check('pointer pressure reaches the target in real time and spring settles without changing click behavior',async()=>{
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(115);
    const down=await scale();assert.ok(down<.97&&down>.9,'Pressed scale '+down);
    await page.screenshot({path:path.join(out,'pressed.png')});await page.mouse.up();
    await page.waitForTimeout(110);const spring=await scale();assert.ok(spring>1,'Spring scale '+spring);
    await page.waitForTimeout(420);assert.equal(await scale(),1);assert.equal(await page.evaluate(()=>feedbackTest.clicks()),1);
    assert.equal(await button.evaluate(e=>e.getAnimations().length),0);
  });
  await check('keyboard activation and cancellation clear pressure; disabled controls do not animate',async()=>{
    await button.focus();await page.keyboard.down('Space');await page.waitForTimeout(110);assert.ok(await scale()<.97);
    await page.keyboard.up('Space');await page.waitForTimeout(480);assert.equal(await scale(),1);assert.equal(await page.evaluate(()=>feedbackTest.clicks()),2);
    await page.mouse.down();await button.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.move(10,10);await page.mouse.up();
    assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-pressed')),false);assert.equal(await scale(),1);
    await page.locator('#disabled').dispatchEvent('pointerdown',{button:0,isPrimary:true});assert.equal(await page.locator('#disabled').evaluate(e=>e.hasAttribute('data-glass-pressed')),false);
  });
  await check('reduced motion keeps static feedback and switching themes clears active animation and listeners',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(60);await button.focus();await page.keyboard.down('Space');await page.waitForTimeout(110);
    assert.equal(await scale(),1);assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-pressed')),true);await page.keyboard.up('Space');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(60);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await page.evaluate(()=>feedbackTest.runtime.apply(feedbackTest.resolveTheme({selected:'paper'})));await page.mouse.move(10,10);await page.mouse.up();
    assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-interactive')),false);assert.equal(await scale(),1);
    await page.evaluate(()=>{for(let i=0;i<8;i++)feedbackTest.runtime.apply(feedbackTest.resolveTheme(feedbackTest.prefs));});
    await button.click();await page.waitForTimeout(480);assert.equal(await page.evaluate(()=>feedbackTest.clicks()),4);assert.equal(await scale(),1);
  });
  await check('a short tap still produces a visible impulse and returns to rest exactly once',async()=>{
    await button.click();const frames=await button.evaluate(e=>e.getAnimations().find(a=>a.effect.getKeyframes().some(f=>f.scale!==undefined)).effect.getKeyframes().map(f=>Number(f.scale)));
    assert.ok(Math.min(...frames)<=.975);assert.ok(Math.max(...frames)>1);
    await page.waitForTimeout(480);assert.equal(await scale(),1);assert.equal(await page.evaluate(()=>feedbackTest.clicks()),5);
  });
  assert.deepEqual(errors,[]);await page.mouse.move(15,15);await page.screenshot({path:path.join(out,'neutral.png')});
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:checks.length,checks,errors,realTimeAnimation:true},null,2));
})().catch(async e=>{console.error(e);process.exitCode=1;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'failure.txt'),e.stack);if(page)console.error(await page.locator('#press').evaluate(e=>({scale:getComputedStyle(e).scale,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,animations:e.getAnimations().map(a=>({time:a.currentTime,pending:a.pending,state:a.playState,frames:a.effect.getKeyframes()}))})).catch(()=>{}));}).finally(async()=>browser?.close());
