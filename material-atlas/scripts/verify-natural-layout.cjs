const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local/natural-layout-verification'),packaged=process.argv.includes('--packaged');
let browser,page,child,profile,library;const checks=[],errors=[],workers=[];
const wait=(fn,arg,options={})=>page.waitForFunction(fn,arg,{polling:100,...options});
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function capture(name){for(let i=0;i<3;i++)try{await page.screenshot({path:path.join(out,(packaged?'packaged-':'')+name),timeout:15000,animations:'disabled'});return;}catch(error){if(i===2)throw error;}}
async function closeModal(){if(await page.locator('#modal').evaluate(e=>e.open)){await page.locator('#modal [data-action="close-modal"]').last().click();await wait(()=>!document.querySelector('#modal').open);}}
async function themes(){await closeModal();await page.locator('[data-menu-toggle="workspace-menu"]').click();await page.locator('#ribbon-theme').click();}
const positions=()=>page.evaluate(()=>materiaDesktop.getSetting('graphLayout'));
const business=()=>page.evaluate(async()=>({papers:await materiaDesktop.getPapers(),notes:await materiaDesktop.getSetting('notes'),groups:await materiaDesktop.getSetting('collections'),activity:await materiaDesktop.getSetting('importActivity')}));
async function arranged(){await wait(()=>document.querySelector('#star-map').dataset.naturalLayout==='settled'&&document.querySelector('#graph-arrange').getAttribute('aria-busy')==='false',null,{timeout:25000});await page.waitForTimeout(650);}
async function arrangeMenu(action){await page.locator('#graph-arrange').click({button:'right'});await page.locator('#graph-arrange-menu [data-action="'+action+'"]').click();}
async function start(){
  const env={...process.env,MATERIA_HEADLESS:'1',MATERIA_PROFILE_DIR:profile,MATERIA_LIBRARY_DIR:library};delete env.ELECTRON_RUN_AS_NODE;
  await fs.unlink(path.join(profile,'DevToolsActivePort')).catch(e=>{if(e.code!=='ENOENT')throw e;});
  const exe=packaged?(process.env.MATERIA_RELEASE_EXE||path.join(root,'release/v'+require(path.join(root,'package.json')).version+'/Materia-win32-x64/Materia.exe')):path.join(root,'node_modules/electron/dist/electron.exe');
  child=spawn(exe,[...(packaged?[]:[root]),'--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--disable-gpu','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],{env,windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<150;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}if(child.exitCode!==null)throw Error('Test app exited '+child.exitCode);await new Promise(r=>setTimeout(r,100));}
  assert.ok(port);browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const context=browser.contexts()[0];page=context.pages()[0]||await context.waitForEvent('page',{timeout:20000});page.on('pageerror',error=>errors.push(error.message));page.on('worker',worker=>workers.push(worker.url()));
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:940});await wait(()=>document.querySelector('.import-main')?.disabled===false);
  assert.equal(path.resolve((await page.evaluate(()=>materiaDesktop.info())).path),path.resolve(library));
}
async function stop(){await browser?.close();browser=null;if(child?.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}child=null;}
function pdf(text){const content=`BT /F1 18 Tf 72 740 Td (${text}) Tj ET`,objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];let data='%PDF-1.4\n',offsets=[];objects.forEach((obj,i)=>{offsets.push(data.length);data+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=data.length;return Buffer.from(data+`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);}
(async()=>{
  await fs.mkdir(out,{recursive:true});const run=await fs.mkdtemp(path.join(out,'run-'));profile=path.join(run,'profile');library=path.join(run,'library');
  const {LocalLibrary}=await import(pathToFileURL(path.join(root,'desktop/library.mjs')).href),{createNetwork}=await import(pathToFileURL(path.join(root,'dist/force-layout.js')).href);const lib=await new LocalLibrary(library).init();
  await lib.setSetting('collections',[{id:'folder-a',name:'磁性合金',color:'#97491e'},{id:'folder-b',name:'界面强化',color:'#6c7e63'},{id:'folder-c',name:'二维材料',color:'#a17b48'}]);
  const labels=['磁性合金','界面强化','二维材料'];
  await lib.putPapers(Array.from({length:46},(_,i)=>({id:i===45?'hidden':'fixture-'+i,title:i===45?'Hidden archived reference':`Verification · ${labels[Math.floor(i/15)]} ${String(i+1).padStart(2,'0')}`,filename:'sample-'+i+'.pdf',authors:'Researcher A',journal:'Materials',year:'2025',tags:i===45?['Hidden']:[labels[Math.floor(i/15)]],collection:'folder-'+String.fromCharCode(97+Math.floor(i/15)%3),fileBytes:pdf('Materials research sample '+i)})));
  await lib.setSetting('notes',{'paper:fixture-0':[{id:'n',body:'Original research note',createdAt:1,updatedAt:1}]});await lib.setSetting('graphAssociations',labels.map(value=>({kind:'tag',value})));
  const graph=createNetwork(lib.getPapers(),[],{},lib.getSetting('graphAssociations')),initial=Object.fromEntries(graph.nodes.map(n=>[n.id,{x:500,y:310,pinned:false}]));
  Object.assign(initial['paper:fixture-0'],{x:180,y:130,pinned:true});Object.assign(initial['paper:fixture-1'],{x:850,y:500,pinned:true});Object.assign(initial['paper:hidden'],{x:-1200,y:800,pinned:true});
  await lib.setSetting('graphLayout',initial);await lib.setSetting('themePreferences',{selected:'steins-gate',mode:'dark'});await lib.setSetting('graphPreferences',{appearance:'theme'});await start();
  await page.locator('#search').fill('Verification');await wait(()=>document.querySelectorAll('.paper-node').length===45);const original=await business();let originalPositions;
  await check('one-click natural layout separates a piled graph, preserves pins and hidden positions, and leaves literature untouched',async()=>{
    originalPositions=await positions();const labelsBefore=await page.locator('.node-label').evaluateAll(nodes=>nodes.filter(n=>Number(n.style.opacity)>.05).length);
    assert.ok(await page.locator('#graph-arrange').isVisible());await page.locator('#graph-arrange').click();await arranged();const next=await positions();
    for(const id of ['paper:fixture-0','paper:fixture-1','paper:hidden'])assert.deepEqual(next[id],originalPositions[id]);
    assert.ok(Object.entries(next).filter(([id,p])=>id!=='paper:hidden'&&(p.x!==500||p.y!==310)).length>35);
    const labelsAfter=await page.locator('.node-label').evaluateAll(nodes=>nodes.filter(n=>Number(n.style.opacity)>.05).length);assert.ok(labelsAfter>labelsBefore+8,{labelsBefore,labelsAfter});
    assert.equal(await page.locator('.network-edges path').count(),45);assert.deepEqual(await business(),original);assert.ok(workers.some(url=>url.includes('natural-layout-worker.js')));await capture('01-natural-pinned-dark.png');
  });
  await check('right-click and keyboard menus undo layout and release only visible pins',async()=>{
    await page.locator('#graph-arrange').focus();await page.keyboard.press('Shift+F10');await page.locator('[data-action="graph-arrange-undo"]').click();await wait(()=>document.querySelector('#star-map').dataset.naturalLayout==='restored');await page.waitForTimeout(650);assert.deepEqual(await positions(),originalPositions);
    await arrangeMenu('graph-arrange-all');await arranged();const released=await positions();assert.equal(released['paper:fixture-0'].pinned,false);assert.equal(released['paper:fixture-1'].pinned,false);assert.deepEqual(released['paper:hidden'],originalPositions['paper:hidden']);
    const first=await positions();await page.locator('#graph-arrange').click();await arranged();assert.deepEqual(await positions(),first);await capture('02-worldline-natural-dark.png');
  });
  await check('zoom interrupts an in-flight layout without a late jump or stale save',async()=>{
    const before=await positions();await page.locator('#graph-arrange').click();await wait(()=>document.querySelector('#graph-arrange').getAttribute('aria-busy')==='true');await page.locator('[data-action="zoom-in"]').click();await wait(()=>document.querySelector('#graph-arrange').getAttribute('aria-busy')==='false');await page.waitForTimeout(1200);assert.deepEqual(await positions(),before);
  });
  await check('Steins Gate is a seventh builtin with two readable glass modes and original symbols',async()=>{
    await themes();assert.equal(await page.locator('.theme-card').count(),7);
    for(const mode of ['light','dark']){await page.locator('button[data-theme-mode-choice="'+mode+'"]').click();await wait(mode=>document.documentElement.dataset.themeMode===mode,mode);assert.equal(await page.locator('html').getAttribute('data-liquid-glass'),'true');await page.locator('[data-theme-id="steins-gate"]').scrollIntoViewIfNeeded();await capture('03-steins-theme-'+mode+'.png');}
    await page.locator('button[data-theme-mode-choice="light"]').click();await closeModal();await capture('04-worldline-natural-light.png');
    assert.equal(await page.locator('.paper-node .theme-symbol-art').count(),45);assert.ok(await page.evaluate(async()=>Boolean((await document.fonts.load('400 13px "Materia SF Mono"')).length)));
  });
  await check('portable theme previews and cancels correctly, and reader, notes and material controls inherit the theme',async()=>{
    await themes();await page.locator('[data-menu-toggle="theme-file-menu"]').click();await page.locator('[data-theme-action="import"]').click();await page.locator('#theme-input').setInputFiles(path.join(root,'theme-examples/steins-gate/命运石之门-世界线.mtheme.json'));await wait(()=>document.documentElement.dataset.theme.startsWith('custom-'));
    assert.deepEqual((await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'))).themes,[]);await page.locator('[data-theme-action="cancel-preview"]').click();assert.equal(await page.locator('html').getAttribute('data-theme'),'steins-gate');await closeModal();
    await page.locator('.paper-node[data-paper-id="fixture-0"]').dispatchEvent('contextmenu',{clientX:600,clientY:350});await page.locator('[data-paper-command="more"]').click();await page.locator('[data-paper-command="parameters"]').click();assert.equal(await page.locator('#modal').evaluate(e=>e.open),true);await closeModal();
    await page.locator('#detail-panel [data-action="open-pdf"]').click();await wait(()=>document.querySelector('#pdf-reader').open&&document.querySelector('#pdf-reader canvas'));await capture('05-reader-light.png');
    await page.keyboard.press('Escape');await wait(()=>!document.querySelector('#pdf-reader').open);
    await page.locator('#detail-panel [data-action="paper-notes"]').last().click();assert.ok(await page.locator('#modal').evaluate(e=>e.open));await closeModal();assert.deepEqual(await business(),original);
  });
  await check('settled natural positions survive view changes and a complete packaged-app restart',async()=>{
    const saved=await positions();await page.locator('[data-view="list"]').click();await page.locator('[data-view="graph"]').click();await page.waitForTimeout(800);assert.deepEqual(await positions(),saved);
    await stop();await start();assert.equal(await page.locator('html').getAttribute('data-theme'),'steins-gate');assert.equal(await page.locator('html').getAttribute('data-theme-mode'),'light');
    const current=await positions();for(const [id,p]of Object.entries(saved))assert.deepEqual(current[id],p);
    await page.setViewportSize({width:1024,height:768});await themes();await page.locator('[data-theme-id="steins-gate"]').scrollIntoViewIfNeeded();assert.ok(await page.locator('[data-theme-id="steins-gate"]').isVisible());await capture('06-compact-theme.png');
  });
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,(packaged?'packaged-':'')+'report.json'),JSON.stringify({passed:checks.length,checks,errors,workers,packaged,isolatedLibrary:true},null,2));
})().catch(async error=>{console.error(error);process.exitCode=1;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,(packaged?'packaged-':'')+'failure.txt'),error.stack);await page?.screenshot({path:path.join(out,(packaged?'packaged-':'')+'failure.png'),timeout:10000,animations:'disabled'}).catch(()=>{});}).finally(stop);
