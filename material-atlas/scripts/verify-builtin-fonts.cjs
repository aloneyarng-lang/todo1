// Actual packaged app with a separate profile/library, no imported theme files.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const runtime=path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=require(path.join(runtime,'playwright'));
const root=path.resolve(__dirname,'..'),out=path.join(root,'.local/builtin-font-verification');
let browser,page,child,profile,library;const checks=[],errors=[];
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
async function openThemes(){if(await page.locator('.theme-grid').isVisible())return;await page.locator('[data-menu-toggle="workspace-menu"]').click();await page.locator('#ribbon-theme').click();}
async function closeModal(){if(await page.locator('#modal').evaluate(e=>e.open))await page.locator('[data-action="close-modal"]').last().click();}
async function ready(){await page.waitForFunction(()=>document.documentElement.dataset.themeFonts==='loaded');}
async function capture(name){await page.waitForTimeout(300);try{await page.screenshot({path:path.join(out,name),scale:'css',timeout:10000});}catch(e){if(!/Timeout/.test(e.message))throw e;await page.screenshot({path:path.join(out,name),scale:'css',timeout:10000});}}
async function start(){
  const env={...process.env,MATERIA_HEADLESS:'1',MATERIA_PROFILE_DIR:profile,MATERIA_LIBRARY_DIR:library};delete env.ELECTRON_RUN_AS_NODE;
  await fs.unlink(path.join(profile,'DevToolsActivePort')).catch(e=>{if(e.code!=='ENOENT')throw e;});
  child=spawn((process.env.MATERIA_RELEASE_EXE||path.join(root,'release/v'+require(path.join(root,'package.json')).version+'/Materia-win32-x64/Materia.exe')),['--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--disable-gpu','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'],{env,windowsHide:true,stdio:'ignore'});
  let port;for(let i=0;i<150;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}if(child.exitCode!==null)throw Error('Isolated app exited '+child.exitCode);await new Promise(r=>setTimeout(r,100));}
  assert.ok(port);browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);page=browser.contexts()[0].pages()[0];
  page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:940});await page.waitForFunction(()=>document.querySelector('.import-main')?.disabled===false);
  assert.equal(path.resolve((await page.evaluate(()=>materiaDesktop.info())).path),path.resolve(library));
}
async function stop(){await browser?.close();browser=null;if(child?.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}child=null;}
(async()=>{
  await fs.mkdir(out,{recursive:true});const run=await fs.mkdtemp(path.join(out,'run-'));profile=path.join(run,'profile');library=path.join(run,'library');
  const {LocalLibrary}=await import(pathToFileURL(path.join(root,'desktop/library.mjs')).href),lib=await new LocalLibrary(library).init();
  await lib.setSetting('themePreferences',{selected:'paper'});await start();
  await check('both glass appearances are built in and usable without importing a package',async()=>{
    await openThemes();assert.equal(await page.locator('.theme-card').count(),11);
    for(const id of ['liquid-glass','liquid-glass-dark']){
      await page.locator('[data-theme-id="'+id+'"]').click();await ready();
      assert.equal(await page.locator('html').getAttribute('data-theme'),id);assert.equal(await page.locator('html').getAttribute('data-theme-style'),'glass');
      const prefs=await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'));assert.equal(prefs.selected,id);assert.deepEqual(prefs.themes,[]);
    }
    await page.locator('[data-theme-id="liquid-glass"]').click();await ready();
  });
  let glyphFonts;
  await check('SF Pro, SF Mono, New York and bundled CJK fonts decode from real local resources',async()=>{
    const rows=await page.evaluate(async()=>{const result=[];for(const family of ['Materia SF Pro','Materia SF Mono','Materia New York','Materia Inter','Materia Source Han Sans','Materia Source Code Pro']){
      const faces=await document.fonts.load('400 16px "'+family+'"');result.push({family,loaded:faces.length>0&&faces.every(f=>f.status==='loaded')});
    }return result;});assert.ok(rows.every(r=>r.loaded),JSON.stringify(rows));
    await page.locator('.theme-fonts>summary').click();
    const cdp=await browser.contexts()[0].newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    const {root:dom}=await cdp.send('DOM.getDocument');const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:dom.nodeId,selector:'.theme-font-preview strong'});
    glyphFonts=(await cdp.send('CSS.getPlatformFontsForNode',{nodeId})).fonts;
    assert.ok(glyphFonts.some(f=>/SF Pro/.test(f.familyName)&&f.isCustomFont));assert.ok(glyphFonts.some(f=>/Source Han Sans/.test(f.familyName)&&f.isCustomFont));
    await cdp.detach();await capture('01-built-in-appearance-and-fonts.png');
  });
  await check('each font role saves independently and SF Mono uses true fixed-width glyphs',async()=>{
    for(const [role,id] of [['body','apple-sf-pro'],['heading','apple-new-york'],['numeric','inter-bundled'],['mono','apple-sf-mono']]){
      await page.locator('[data-theme-font="'+role+'"]').selectOption(id);await ready();
      await page.waitForFunction(async([role,id])=>(await materiaDesktop.getSetting('themePreferences')).fonts?.[role]===id,[role,id]);
    }
    const widths=await page.evaluate(()=>{const ctx=document.createElement('canvas').getContext('2d');ctx.font='16px "Materia SF Mono"';return[ctx.measureText('iiiiii').width,ctx.measureText('MMMMMM').width];});
    assert.ok(Math.abs(widths[0]-widths[1])<.01);await capture('02-font-role-selection.png');await closeModal();
  });
  await check('builtin appearance and font choices survive complete app restart with no theme-package data',async()=>{
    await stop();await start();await ready();const prefs=await page.evaluate(()=>materiaDesktop.getSetting('themePreferences'));
    assert.equal(prefs.selected,'liquid-glass');assert.deepEqual(prefs.themes,[]);
    assert.deepEqual(prefs.fonts,{body:'apple-sf-pro',heading:'apple-new-york',mono:'apple-sf-mono',numeric:'inter-bundled'});
    const profileData=JSON.parse(await fs.readFile(path.join(profile,'preferences.json'),'utf8'));assert.equal(path.resolve(profileData.libraryPath),path.resolve(library));
  });
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'report.json'),JSON.stringify({passed:checks.length,checks,glyphFonts,errors,actualPackagedApp:true,isolatedLibrary:true,noImportedTheme:true},null,2));
})().catch(async e=>{console.error(e);process.exitCode=1;await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'failure.txt'),e.stack);await page?.screenshot({path:path.join(out,'failure.png'),timeout:10000}).catch(()=>{});}).finally(stop);
