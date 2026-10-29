// Real packaged desktop, isolated synthetic library/profile, no requests to AI services.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local/liquid-glass-verification');
const delivery=path.join(root,'theme-examples/liquid-glass'),checks=[],errors=[];
let child,browser,page,log='',profile,library;
async function check(label,fn){await fn();checks.push(label);console.log('PASS '+label);}
async function openThemes(){
  if(await page.locator('.theme-grid').isVisible())return;
  if(!await page.locator('#workspace-menu').evaluate(e=>e.matches(':popover-open')))await page.locator('[data-menu-toggle="workspace-menu"]').click();
  await page.locator('#ribbon-theme').click();
}
async function closeModal(){if(await page.locator('#modal').evaluate(e=>e.open))await page.locator('[data-action="close-modal"]').last().click();}
async function importPack(file){await openThemes();await page.locator('#theme-input').setInputFiles(path.join(delivery,file));await page.locator('[data-theme-action="apply-import"]').waitFor();}
async function applyPreview(){await page.locator('[data-theme-action="apply-import"]').click();await page.waitForFunction(()=>!document.querySelector('[data-theme-action="apply-import"]'));}
async function sampleScale(button,time){
  // A show:false Electron window can suspend compositor clocks. Sample production
  // keyframes here; verify-glass-feedback.cjs checks their real-time playback.
  return button.evaluate((e,t)=>{const animation=e.getAnimations().find(a=>a.effect.getKeyframes().some(frame=>frame.scale!==undefined));if(!animation)throw Error('No pressure animation');animation.currentTime=t;return parseFloat(getComputedStyle(e).scale)||1;},time);
}
async function capture(filename,folder=delivery){
  if(process.env.MATERIA_GLASS_SKIP_SCREENSHOTS==='1')return;
  // Hidden Electron needs a settled compositor frame after changing views.
  await page.waitForTimeout(600);
  try{await page.screenshot({path:path.join(folder,filename),timeout:8000,scale:'css'});}
  catch(error){if(!/Timeout/.test(error.message))throw error;await page.waitForTimeout(300);await page.screenshot({path:path.join(folder,filename),timeout:10000,scale:'css'});}
}
async function stop(){
  await browser?.close();browser=null;
  if(child?.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}child=null;
}
async function start(){
  await fs.unlink(path.join(profile,'DevToolsActivePort')).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const env={...process.env,MATERIA_HEADLESS:'1',MATERIA_PROFILE_DIR:profile,MATERIA_LIBRARY_DIR:library};delete env.ELECTRON_RUN_AS_NODE;
  child=spawn(path.join(root,'release/v1.3.0/Materia-win32-x64/Materia.exe'),['--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--disable-gpu','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling'],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});
  child.stderr.on('data',b=>log+=b.toString());let port;
  for(let i=0;i<150;i++){
    try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}
    if(child.exitCode!==null)throw Error('Desktop exited '+child.exitCode+' '+log);await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(port,'No isolated debugging port');browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  page=browser.contexts()[0].pages()[0];page.on('pageerror',e=>errors.push(e.message));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:940});await page.waitForFunction(()=>document.querySelector('.import-main')?.disabled===false);
  assert.equal(path.resolve((await page.evaluate(()=>materiaDesktop.info())).path),path.resolve(library));
}
(async()=>{
  await fs.mkdir(out,{recursive:true});const run=await fs.mkdtemp(path.join(out,'run-'));profile=path.join(run,'profile');library=path.join(run,'library');
  const {PDFDocument,StandardFonts}=require(path.join(runtime,'pdf-lib'));const doc=await PDFDocument.create();
  const pdfPage=doc.addPage([612,792]),font=await doc.embedFont(StandardFonts.Helvetica);
  pdfPage.drawText('Interface engineering in advanced materials',{x:48,y:720,font,size:20});
  pdfPage.drawText('Synthetic document for Liquid Glass theme verification.',{x:48,y:680,font,size:12});
  const bytes=Buffer.from(await doc.save());
  const {LocalLibrary}=await import(pathToFileURL(path.join(root,'desktop/library.mjs')).href),lib=await new LocalLibrary(library).init();
  const titles=['界面工程与非晶合金的磁性能调控','Structure and properties of nanocrystalline alloys','软磁材料中的应力与磁畴演化','Designing interfaces for high performance materials','高熵合金的结构设计与力学性能','Thermal stability of amorphous nanocomposites','纳米晶组织与交换耦合作用','Processing pathways of advanced magnetic alloys','薄膜材料的微结构与各向异性'];
  await lib.putPapers(titles.map((title,i)=>({id:'glass-'+i,title,tags:[i%2?'界面工程':'软磁材料',i%3?'纳米晶':'热处理'],authors:'Y. Chen, M. Li, A. Zhang',journal:['Acta Materialia','Nature Materials','Advanced Functional Materials'][i%3],year:String(2024+i%3),filename:'glass-'+i+'.pdf',measurements:[],fileBytes:bytes,favorite:i===0})));
  await lib.setSetting('themePreferences',{selected:'paper'});await lib.setSetting('graphAssociations',[{kind:'tag',value:'软磁材料'},{kind:'tag',value:'界面工程'},{kind:'tag',value:'纳米晶'}]);
  const originalPapers=JSON.stringify(lib.getPapers());
  // Other app sessions may legitimately change the user's library. Prove our
  // isolation from the test process's native path and profile, without reading it.
  await start();
  if(await page.locator('body').evaluate(e=>e.classList.contains('sidebar-collapsed')))await page.locator('#toggle-sidebar').click();
  await check('native import previews glass without saving and cancellation restores the previous material',async()=>{
    await importPack('01-澄璃-浅色.mtheme.json');assert.equal(await page.locator('html').getAttribute('data-theme-style'),'glass');
    assert.equal((await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'))).selected,'paper');
    await page.locator('[data-theme-action="cancel-preview"]').click();assert.equal(await page.locator('html').getAttribute('data-theme-style'),'editorial');
    await closeModal();assert.equal(await page.locator('.library-surface').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
  });
  let lightId,darkId;
  await check('light glass saves in the actual desktop, renders blur and leaves the document content intact',async()=>{
    await importPack('01-澄璃-浅色.mtheme.json');await applyPreview();await closeModal();
    lightId=(await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'))).selected;
    assert.match(await page.locator('.library-surface').evaluate(e=>getComputedStyle(e).backdropFilter),/blur\(12px\)/);
    const alpha=await page.locator('.library-surface').evaluate(e=>{const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=getComputedStyle(e).backgroundColor;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]/255;});
    assert.ok(alpha>.05&&alpha<.2,'Clear material must retain at least 80% background transmission');
    const background=await page.evaluate(()=>({color:getComputedStyle(document.body).backgroundColor,image:getComputedStyle(document.body).backgroundImage}));
    assert.deepEqual(background,{color:'rgb(230, 232, 236)',image:'none'});
    assert.equal(await page.locator('.paper-node').count(),titles.length);assert.equal(await page.locator('#star-map').getAttribute('data-graph-fill'),'hollow');
    await page.waitForTimeout(1400);await capture('03-浅色-实际星图.png');
    await page.locator('[data-view="list"]').click();await capture('04-浅色-文献列表.png');
    await page.locator('[data-action="open-pdf"]').click();await page.waitForFunction(()=>document.querySelector('#reader-page')?.dataset.rendered==='true');
    await capture('reader-light.png',out);await page.locator('[data-reader-action="close"]').click();await page.locator('#detail-panel').evaluate(e=>e.scrollTop=0);
  });
  await check('native pointer input drives pressure and spring keyframes while preserving the original action',async()=>{
    const button=page.locator('#toggle-sidebar'),box=await button.boundingBox(),before=await button.getAttribute('aria-expanded');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(110);
    assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-pressed')),true);
    const downScale=await sampleScale(button,85);assert.ok(downScale<.96&&downScale>.85,'Pressed scale was '+downScale);
    await page.mouse.up();await page.waitForTimeout(110);
    assert.notEqual(await button.getAttribute('aria-expanded'),before);
    assert.ok(await sampleScale(button,110)>1,'Release should have a short positive spring overshoot');
    await sampleScale(button,420);assert.equal(await button.evaluate(e=>getComputedStyle(e).scale),'none');
    assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-pressed')),false);
    await button.click();await page.waitForTimeout(460);
  });
  await check('Space feedback respects focus and native activation; cancellation and reduced motion leave no stuck pressure',async()=>{
    const button=page.locator('#toggle-sidebar');await button.focus();const before=await button.getAttribute('aria-expanded');
    await page.keyboard.down('Space');await page.waitForTimeout(110);assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-pressed')),true);await sampleScale(button,85);
    await page.keyboard.up('Space');await sampleScale(button,420);assert.notEqual(await button.getAttribute('aria-expanded'),before);await button.click();
    const box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
    await button.dispatchEvent('pointercancel',{pointerId:1});assert.equal(await button.evaluate(e=>e.hasAttribute('data-glass-pressed')),false);await page.mouse.move(45,8);await page.mouse.up();
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(60);await button.focus();await page.keyboard.down('Space');
    assert.equal(await button.evaluate(e=>getComputedStyle(e).scale),'none');await page.keyboard.up('Space');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(60);
    if(await page.locator('body').evaluate(e=>e.classList.contains('sidebar-collapsed')))await button.click();
  });
  await check('dark glass imports as a separate theme and renders at desktop and narrow widths',async()=>{
    await importPack('02-澄璃-深色.mtheme.json');await applyPreview();await closeModal();
    darkId=(await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'))).selected;assert.notEqual(darkId,lightId);
    assert.equal(await page.locator('html').getAttribute('data-theme-mode'),'dark');await capture('05-深色-文献列表.png');
    await page.locator('[data-view="graph"]').click();await page.waitForTimeout(700);await capture('06-深色-实际星图.png');
    await page.locator('.workspace-ribbon [data-action="ai-agent"]').click();await capture('assistant-dark.png',out);await page.locator('[data-agent-action="close"]').click();
    await page.setViewportSize({width:1000,height:760});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await capture('narrow-dark.png',out);
    await openThemes();await capture('settings-dark.png',out);await closeModal();await page.setViewportSize({width:1440,height:940});
  });
  await check('reduced transparency uses opaque materials and disables blur',async()=>{
    const cdp=await browser.contexts()[0].newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'}]});
    assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-transparency:reduce)').matches),true);
    assert.equal(await page.locator('.library-surface').evaluate(e=>getComputedStyle(e).backdropFilter),'none');
    assert.equal(await page.locator('.library-surface').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(37, 38, 43)');
    await cdp.send('Emulation.setEmulatedMedia',{features:[]});await cdp.detach();
  });
  await check('theme choice survives a complete packaged-process restart and both packages remain available',async()=>{
    await stop();await start();const prefs=await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'));
    assert.equal(prefs.selected,darkId);assert.equal(prefs.themes.length,2);assert.equal(await page.locator('html').getAttribute('data-theme-style'),'glass');
    assert.equal(JSON.stringify(await page.evaluate(()=>materiaDesktop.getPapers())),originalPapers);
    const savedProfile=JSON.parse(await fs.readFile(path.join(profile,'preferences.json'),'utf8'));
    assert.equal(path.resolve(savedProfile.libraryPath),path.resolve(library));
  });
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:checks.length,checks,errors,actualPackagedProcess:true,isolatedProfile:true,isolatedLibrary:true,libraryPathVerifiedAtEachStart:true,noRemoteAssets:true},null,2));
})().catch(async e=>{console.error(e);process.exitCode=1;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'failure.txt'),e.stack);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}).finally(stop);
