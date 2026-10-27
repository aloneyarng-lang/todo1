// Isolated app integration test. Never opens a visible window or uses OS input.
const {pathToFileURL}=require('node:url');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.MATERIA_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'.local','verification');
const stage=path.join(root,'.local',`ui-stage-${Date.now()}`);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let win,browser;const checks=[],errors=[],exportsSaved=[];
const measure=(value,extra={})=>({id:'m1',name:'Strength',unit:'MPa',value,sample:'S1',conditions:'RT',source:'Fig. 2',qualifier:'',uncertainty:1,...extra});
const paper=(id,measurements,extra={})=>({id,title:`Paper ${id}`,year:'2024',tags:[],authors:'Ada',authorDetails:[],journal:'Advanced Materials',collection:'',filename:`${id}.pdf`,addedAt:1,favorite:false,measurements,...extra});
const fixture=[
  paper('ok',[measure(10)],{tags:['Shared','Solo'],authorDetails:[{name:'Ada',affiliations:['Institute A']}]}),
  paper('unit',[measure(1,{unit:'GPa',uncertainty:null})],{tags:['Shared']}),
  paper('invalid',[measure('')],{tags:['Shared']}),
  paper('no-year',[measure(12)],{year:''}),
  paper('approx',[measure(11,{qualifier:'≈'})]),
  paper('singleton',[measure(3,{name:'Hc',unit:'A/m'})]),
  paper('other',[measure(2,{name:'Density',unit:'g/cm3'})])
];
let data={papers:fixture,settings:{notes:{},collections:[],journalMetrics:[],graphAssociations:[],comparisonSelection:[]}};
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const exec=code=>win.webContents.executeJavaScript(`(async()=>{${code}})()`);
async function waitFor(code,label){for(let i=0;i<80;i++){if(await exec(`return Boolean(${code});`))return;await pause(80);}throw new Error(`Timed out: ${label}`);}
async function check(label,run){await run();checks.push(label);process.stdout.write(`PASS ${label}\n`);}
async function capture(name){await pause(120);const img=await win.webContents.capturePage();await fs.writeFile(path.join(output,name+'.png'),img.toPNG());}
const click=selector=>exec(`document.querySelector(${JSON.stringify(selector)})?.click();`);
const setting=(name,value)=>exec(`const input=document.querySelector('[data-chart-setting="${name}"]');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));`);
async function layout(name,width,height,left,detail,selected,zoom){
  await win.setContentSize(width,height);await exec(`const h=__testHooks;h.closeModal();Object.assign(h.state,{leftPanelOpen:${left},detailOpen:${detail},view:'graph'});h.resetFilters(false);h.state.associations=[];h.state.compareIds=new Set(h.state.papers.slice(0,${selected}).map(p=>p.id));h.render();h.map.paused=true;h.map.fit();h.map.zoom(${zoom});`);
  await pause(150);
  const result=await exec(`
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const intersect=(a,b)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
    const title=rect(document.querySelector('.network-heading')),controls=[...document.querySelectorAll('.network-header-controls>button')].map(rect),surface=rect(document.querySelector('.library-surface')),graph=rect(document.querySelector('#graph-wrap'));
    const labels=[...document.querySelectorAll('#star-map text')].filter(e=>Number(e.style.opacity)>.01).map(rect),collisions=[];
    for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)if(intersect(labels[i],labels[j]))collisions.push([i,j]);
    const duplicateIds=[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,all)=>all.indexOf(id)!==i);
    return{title,controls,surface,graph,labels:labels.length,collisions,duplicateIds,headingCollision:controls.some(r=>intersect(title,r)),controlCollision:controls.some((r,i)=>controls.slice(i+1).some(b=>intersect(r,b))),pageOverflow:document.documentElement.scrollWidth>innerWidth,controlOverflow:controls.some(r=>r.right>surface.right+1),ribbonMissingNames:[...document.querySelectorAll('.workspace-ribbon button')].filter(e=>!e.getAttribute('aria-label')||!e.title).length};
  `);
  assert.equal(result.headingCollision,false,JSON.stringify(result));assert.equal(result.controlCollision,false);assert.equal(result.controlOverflow,false);assert.equal(result.pageOverflow,false);assert.deepEqual(result.collisions,[]);assert.deepEqual(result.duplicateIds,[]);assert.equal(result.ribbonMissingNames,0);assert.ok(result.graph.height>200);
  await fs.writeFile(path.join(output,name+'.json'),JSON.stringify(result,null,2));await capture(name);
}
async function main(){
  await fs.mkdir(output,{recursive:true});await fs.unlink(path.join(output,'ui-failure.json')).catch(()=>{});await fs.unlink(path.join(output,'failure.png')).catch(()=>{});await fs.mkdir(stage,{recursive:true});await fs.cp(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true});
  await fs.appendFile(path.join(stage,'dist','app.js'),'\nglobalThis.__testHooks={state,map,comparison,associationController,parameterFinder,applyParameterFilter,plotActiveParameter,render,resetFilters,closeModal,visiblePapers};\n');
  const methods={getPapers:()=>clone(data.papers),getSetting:key=>clone(data.settings[key]),setSetting:(key,value)=>{data.settings[key]=clone(value);return true;},info:()=>({path:'ISOLATED TEST LIBRARY',paperCount:data.papers.length}),saveText:async value=>{await fs.writeFile(path.join(output,path.basename(value.filename)),value.content);exportsSaved.push(value.filename);return{saved:true};},saveImage:async value=>{await fs.writeFile(path.join(output,path.basename(value.filename)),Buffer.from(value.bytes));exportsSaved.push(value.filename);return{saved:true};}};
  browser=await chromium.launch({headless:true,executablePath:process.env.MATERIA_CHROME||path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),args:['--disable-gpu','--allow-file-access-from-files']});
  const page=await browser.newPage({viewport:{width:1395,height:895},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.exposeFunction('__fixtureAPI',(method,args)=>methods[method](...args));
  await page.addInitScript(names=>{globalThis.materiaDesktop=Object.fromEntries(names.map(name=>[name,(...args)=>__fixtureAPI(name,name==='saveImage'?[{...args[0],bytes:Array.from(args[0].bytes)}]:args)]));},Object.keys(methods));
  win={webContents:{executeJavaScript:code=>page.evaluate(code),capturePage:async()=>{const image=await page.screenshot();return{toPNG:()=>image};}},setContentSize:(width,height)=>page.setViewportSize({width,height})};
  await page.goto(pathToFileURL(path.join(stage,'dist','index.html')).href);await waitFor('globalThis.__testHooks?.state.ready','app ready');
  await check('default paper-only graph has no edges',async()=>{const stats=await exec(`return{papers:__testHooks.map.network.nodes.filter(n=>n.type==='paper').length,edges:__testHooks.map.network.edges.length,helpers:__testHooks.map.network.nodes.filter(n=>n.type==='relation').length};`);assert.deepEqual(stats,{papers:7,edges:0,helpers:0});});
  await check('parameter click clears stale filters, includes singleton and invalid records',async()=>{
    await exec(`const h=__testHooks;h.state.query='impossible';h.state.nav='favorites';h.state.hiddenIds.add('ok');h.state.filters.minIF='999';h.state.compareIds=new Set(['other']);h.parameterFinder.open();`);
    await click('[data-parameter-name="strength"][data-parameter-unit="*"]');await waitFor('__testHooks.state.filters.parameterName==="strength"','parameter results');
    const state=await exec(`return{ids:__testHooks.visiblePapers().map(p=>p.id).sort(),selected:[...__testHooks.state.compareIds],records:document.querySelectorAll('.parameter-result-record').length,query:document.querySelector('#search').value};`);
    assert.deepEqual(state.ids,['approx','invalid','no-year','ok','unit']);assert.deepEqual(state.selected,[]);assert.equal(state.records,5);assert.equal(state.query,'');
    await capture('parameter-results');
    await exec(`await __testHooks.applyParameterFilter('Hc','*');`);assert.equal(await exec(`return __testHooks.visiblePapers().length;`),1);
    await exec(`await __testHooks.applyParameterFilter('Strength','*');`);
  });
  await check('title search, checkbox and select-all carry selected parameter into chart',async()=>{
    await exec(`const search=document.querySelector('#search');document.querySelector('#search-scope').value='title';document.querySelector('#search-scope').dispatchEvent(new Event('change',{bubbles:true}));search.value='Paper ok';search.dispatchEvent(new Event('input',{bubbles:true}));`);
    await waitFor('__testHooks.visiblePapers().length===1','title search');
    await click('[data-compare-id="ok"]');await waitFor('__testHooks.state.compareIds.size===1','checkbox selection');
    await exec(`const input=document.querySelector('#search');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));`);await waitFor('__testHooks.visiblePapers().length===5','clear title');
    await click('[data-action="select-parameter-results"]');await waitFor('__testHooks.state.compareIds.size===5','all matching selected');
    await click('[data-action="plot-parameter-results"]');await waitFor('document.querySelector("#figure-participation")?.textContent.includes("1 / 5")','chart audit');
    const audit=await exec(`return{y:document.querySelector('[data-chart-setting="y"]').value,rows:document.querySelectorAll('.figure-audit article').length,text:document.querySelector('#figure-participation').textContent};`);
    assert.ok(audit.y.startsWith('m:strength'));assert.equal(audit.rows,5);for(const text of ['其他单位','数值无效','缺少年份','约数'])assert.ok(audit.text.includes(text),audit.text);
    await capture('scientific-chart-audit');
  });
  await check('bar, PNG, SVG and exact chart CSV exports execute in renderer',async()=>{
    await setting('type','bar');await waitFor('document.querySelector("#chart-point-count")?.textContent.includes("2 篇")','bar missing-year inclusion');
    for(const action of ['export-figure-csv','export-audit','export-svg','export-png']){await click(`[data-comparison-action="${action}"]`);await pause(150);}
    await waitFor('!document.querySelector("[data-comparison-action=export-png]").disabled','PNG complete');
    for(const filename of ['materia-figure-data.csv','materia-figure-participation.csv','materia-performance-bar.svg','materia-performance-bar.png'])assert.ok(exportsSaved.includes(filename),exportsSaved.join(','));
    const png=await fs.readFile(path.join(output,'materia-performance-bar.png'));assert.equal(png.readUInt32BE(16),4800);assert.equal(png.readUInt32BE(20),3000);
    assert.match(await fs.readFile(path.join(output,'materia-performance-bar.svg'),'utf8'),/<svg/);await capture('scientific-bar');
  });
  await check('manual association controls add tag/year/institution/author, support zero matches and clear to zero',async()=>{
    await exec(`const h=__testHooks;h.closeModal();h.resetFilters(false);h.state.nav='all';h.state.view='graph';h.render();h.associationController.open();`);
    for(const [kind,value]of [['tag','Solo'],['year','2024'],['institution','Institute A'],['author','Ada']]){
      await click(`[data-association-kind="${kind}"]`);
      await exec(`const button=[...document.querySelectorAll('[data-add-association]')].find(e=>e.querySelector('span').textContent===${JSON.stringify(value)});button.click();`);
      await waitFor(`__testHooks.state.associations.some(rule=>rule.kind===${JSON.stringify(kind)}&&rule.value===${JSON.stringify(value)})`,'association added');
    }
    assert.equal(await exec(`return __testHooks.map.network.edges.length;`),9);
    await exec(`__testHooks.closeModal();__testHooks.map.paused=true;__testHooks.map.paint();`);await capture('manual-associations');
    const core='[data-association-id="relation:year:2024"] .node-core';
    const original=await exec(`const h=__testHooks;h.map.paused=false;const n=h.map.network.byId.get('relation:year:2024');return{x:n.x,y:n.y,paperX:h.map.network.byId.get('paper:ok').x};`);
    const bounds=await page.locator(core).boundingBox(),start={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+85,start.y+45,{steps:12});await pause(180);await page.mouse.up();
    const moved=await exec(`const h=__testHooks,n=h.map.network.byId.get('relation:year:2024');return{x:n.x,y:n.y,pinned:n.pinned,paperX:h.map.network.byId.get('paper:ok').x,edgeFollows:h.map.edgeNodes.some(e=>e.target.id===n.id&&e.path.getAttribute('d').includes(String(n.x)))};`);
    assert.equal(moved.pinned,true);assert.ok(Math.abs(moved.x-original.x)>20);assert.notEqual(moved.paperX,original.paperX);assert.equal(moved.edgeFollows,true);
    const after=await page.locator(core).boundingBox();await page.mouse.dblclick(after.x+after.width/2,after.y+after.height/2);assert.equal(await exec(`return __testHooks.map.network.byId.get('relation:year:2024').pinned;`),false);
    await page.emulateMedia({reducedMotion:'reduce'});await exec(`__testHooks.map.start(.8);`);const stopped=await exec(`return JSON.stringify(__testHooks.map.network.nodes.map(n=>[n.x,n.y]));`);await pause(100);assert.equal(await exec(`return JSON.stringify(__testHooks.map.network.nodes.map(n=>[n.x,n.y]));`),stopped);await page.emulateMedia({reducedMotion:'no-preference'});
    await exec(`const h=__testHooks;h.state.query='Paper unit';h.render();`);assert.equal(await exec(`return __testHooks.map.network.nodes.filter(n=>n.type==='relation'&&n.members.length===0).length;`),3);
    await exec(`__testHooks.associationController.open();`);await click('[data-association-clear]');await waitFor('__testHooks.map.network.edges.length===0&&__testHooks.state.associations.length===0','clear associations');
    await exec(`__testHooks.closeModal();__testHooks.resetFilters(false);__testHooks.render();`);
  });
  // Read-only real metadata snapshot for dense, realistic layout verification. No PDF access.
  const real=JSON.parse(await fs.readFile(path.join(root,'release','Materia-win32-x64','文献库','library.json'),'utf8'));
  data={papers:real.papers,settings:{...clone(real.settings),graphAssociations:[],comparisonSelection:[]}};
  await exec(`const h=__testHooks;h.state.papers=await materiaDesktop.getPapers();h.state.collections=await materiaDesktop.getSetting('collections')||[];h.state.notes=await materiaDesktop.getSetting('notes')||{};h.state.graphPreferences.localMode=false;h.state.associations=[];h.render();`);
  for(const [name,width,height,left,detail,selected,zoom]of [
    ['layout-1395-default',1395,895,false,true,0,1],
    ['layout-1395-expanded',1395,895,true,true,1,1],
    ['layout-1395-collapsed',1395,895,false,false,5,1.8],
    ['layout-1100-expanded',1100,760,true,true,5,1],
    ['layout-1100-collapsed',1100,760,false,false,0,.6],
    ['layout-1000-expanded',1000,760,true,true,1,1.8]
  ])await check(name,()=>layout(name,width,height,left,detail,selected,zoom));
  assert.deepEqual(errors,[],errors.join('\n'));
  await fs.writeFile(path.join(output,'ui-report.json'),JSON.stringify({passed:checks.length,checks,errors,exportsSaved,isolated:true,visibleWindow:false},null,2));
  await browser.close();
}
main().catch(async error=>{process.stderr.write(error.stack+'\n');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'ui-failure.json'),JSON.stringify({error:error.stack,checks,errors},null,2));if(win)await capture('failure').catch(()=>{});await browser?.close();process.exitCode=1;});
