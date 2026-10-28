// Isolated real-renderer journeys for the public cosmic theme API.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),output=path.join(root,'.local/cosmos-verification'),checks=[],errors=[],saved=[];let browser,page,backendVersion=2;
const tags=['界面工程','晶体结构','光电性能','多尺度材料'];
const titles=['二维界面的载流子迁移','晶界结构与合金强韧化','纳米孔隙的能量吸收','有序薄膜的光学响应','缺陷钝化与寿命调控','多尺度晶格的断裂机制','应变调控电子结构','复合材料的热输运','低维结构的离子迁移','层状材料的应变工程','非晶合金的短程有序','晶体织构与各向异性','柔性界面的循环稳定性','多孔骨架中的扩散行为','梯度结构的力学响应','纳米晶的界面重构'];
const papers=titles.map((title,i)=>({id:'cosmos-'+i,title,tags:[tags[i%4],...(i%3===0?[tags[(i+1)%4]]:[])],authors:'合成预览研究组',authorDetails:[],journal:'Materials · Synthetic Preview',year:String(2022+i%5),filename:'demo-'+i+'.pdf',file:{desktop:true,size:12000},addedAt:i+1,measurements:[],favorite:i%4===0}));
const settings={notes:{},collections:[{id:'cosmos-group',name:'宇宙星图预览',color:'#c8e1ff'}],graphAssociations:tags.map(value=>({kind:'tag',value})),graphPreferences:{appearance:'theme',showRelations:true,labelThreshold:.65},themePreferences:{selected:'paper'},comparisonSelection:[]};
const pristine=JSON.stringify(papers),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function themes(){await page.locator('[data-menu-toggle="workspace-menu"]').click();await page.locator('#ribbon-theme').click();}
async function importPack(pack){await page.locator('#theme-input').setInputFiles({name:'cosmos.mtheme.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});await page.locator('[data-theme-action="apply-import"]').waitFor();await page.evaluate(()=>__cosmos.themeController.ready());}
async function close(){await page.locator('[data-action="close-modal"]').last().click();}
async function check(label,run){await run();checks.push(label);console.log('PASS '+label);}
(async()=>{
 await fs.mkdir(output,{recursive:true});const stage=await fs.mkdtemp(path.join(output,'stage-'));await fs.cp(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true});await fs.appendFile(path.join(stage,'dist/app.js'),'\nglobalThis.__cosmos={state,map,themeController,render};\n');
 const pack=process.env.MATERIA_COSMOS_THEME?JSON.parse(await fs.readFile(process.env.MATERIA_COSMOS_THEME,'utf8')):{format:'materia-theme',schemaVersion:2,name:'Cosmic renderer journey',tokens:{'--canvas':'#060b19','--teal':'#c8e1ff','--warning':'#efc98d'},graph:{nodeShape:'star',relationShape:'planet',background:'nebula',starDensity:1.35,twinkle:'subtle'}};
 browser=await chromium.launch({headless:true,executablePath:process.env.MATERIA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--allow-file-access-from-files']});page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('__cosmosAPI',(method,...args)=>{if(method==='getPapers')return papers;if(method==='getSetting')return settings[args[0]];if(method==='setSetting'){settings[args[0]]=args[1];return true;}if(method==='info')return{path:'隔离宇宙主题预览',materialsVersion:1,themeSchemaVersion:2,graphThemeVersion:backendVersion,readerNotesVersion:1,readerAnnotationsVersion:1,readerDraftsVersion:1};if(method==='saveText'){saved.push(args[0]);return{saved:true};}throw Error('Unexpected API '+method);});
 await page.addInitScript(()=>{globalThis.materiaDesktop=Object.fromEntries(['getPapers','getSetting','setSetting','info','saveText'].map(name=>[name,(...args)=>__cosmosAPI(name,...args)]));});await page.goto(pathToFileURL(path.join(stage,'dist/index.html')).href);await page.waitForFunction(()=>__cosmos.state.ready);
 await page.evaluate(()=>{const{map}=__cosmos;if(!map.paused)map.toggleMotion();map.nodes[0].node.pinned=true;globalThis.__before={network:map.network,points:map.nodes.map(n=>[n.node.x,n.node.y,n.node.pinned]),scale:map.scale};});
 await check('cosmic import previews, cancels and preserves the current simulation, coordinates and pins',async()=>{
  await themes();await importPack(pack);await page.waitForFunction(()=>document.querySelector('.paper-node .node-core')?.dataset.shape==='star');assert.equal(settings.themePreferences.selected,'paper');
  assert.ok(await page.evaluate(()=>__cosmos.map.network===__before.network&&JSON.stringify(__cosmos.map.nodes.map(n=>[n.node.x,n.node.y,n.node.pinned]))===JSON.stringify(__before.points)&&__cosmos.map.scale===__before.scale));
  await page.locator('[data-theme-action="cancel-preview"]').click();await page.waitForFunction(()=>!document.querySelector('.cosmic-backdrop'));assert.equal(await page.locator('.paper-node .node-core').first().getAttribute('data-shape'),'circle');
 });
 await check('saved theme renders actual stars, shaded ringed planets and exactly one procedural nebula/starfield',async()=>{
  await importPack(pack);await page.locator('[data-theme-action="apply-import"]').click();await page.waitForFunction(()=>!document.querySelector('[data-theme-action="apply-import"]'));await close();await page.locator('#toggle-sidebar').click();await page.locator('[data-menu-toggle="graph-view-menu"]').click();await page.locator('#toggle-detail').click();
  await page.evaluate(()=>{const{map}=__cosmos;map.fit();map.select('');});await page.mouse.move(0,0);await pause(100);
  assert.equal(await page.locator('.paper-node .node-core[data-shape="star"]').count(),16);assert.equal(await page.locator('.relation-node .node-core[data-shape="planet"]').count(),4);assert.equal(await page.locator('.cosmic-orbit-front').count(),4);assert.equal(await page.locator('.cosmic-planet-shade').count(),4);assert.equal(await page.locator('.cosmic-distant-star').count(),351);assert.equal(await page.locator('.cosmic-backdrop').count(),1);assert.equal(await page.locator('.cosmic-nebula').count(),1);
  assert.ok(await page.evaluate(()=>{const{map}=__cosmos,scene=map.cosmos.node;for(let i=0;i<5;i++)map.applyAppearance();return map.cosmos.node===scene&&getComputedStyle(scene).pointerEvents==='none';}));
 });
 await page.waitForFunction(()=>!document.querySelector('#toast-region').textContent.trim());await page.screenshot({path:path.join(output,'cosmos-graph.png')});
 await check('pause and reduced motion stop decorative twinkling; resize reuses its scenery',async()=>{
  assert.equal(await page.locator('.cosmic-twinkle').first().evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.cosmic-twinkle').first().evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>globalThis.__scene=__cosmos.map.cosmos.node);await page.setViewportSize({width:1000,height:800});await pause(100);assert.equal(await page.evaluate(()=>__cosmos.map.cosmos.node===__scene),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.setViewportSize({width:1600,height:1000});
 });
 await check('star nodes still drag, Shift fixes them, and decoration never creates graph relations',async()=>{
   await pause(150);
   const before=await page.locator('.network-edges path').count();
   const nodeInfo=await page.evaluate(()=>{
     const n=__cosmos.map.nodes.filter(n=>n.node.type==='paper')[2];
     const r=n.group.querySelector('.node-hit-area').getBoundingClientRect();
     return {id:n.node.id, x:r.x+r.width/2, y:r.y+r.height/2};
   });
   await page.mouse.move(nodeInfo.x, nodeInfo.y);
   await page.mouse.down();
   await page.mouse.move(nodeInfo.x+60, nodeInfo.y+35, {steps:8});
   await page.keyboard.down('Shift');
   await page.mouse.up();
   await page.keyboard.up('Shift');
   const pinned=await page.evaluate(id=>__cosmos.map.network.byId.get(id)?.pinned, nodeInfo.id);
   assert.equal(pinned, true);
   assert.equal(await page.locator('.network-edges path').count(), before);
   assert.equal(JSON.stringify(papers), pristine);
  });
 await check('full export includes every cosmic parameter and can be imported again',async()=>{
  await themes();await page.locator('[data-menu-toggle="theme-file-menu"]').click();await page.locator('[data-theme-action="export"]').click();const exported=JSON.parse(saved.at(-1).content);for(const[key,value]of Object.entries(pack.graph))assert.equal(exported.graph[key],value);await importPack(exported);await page.locator('[data-theme-action="apply-import"]').click();await page.waitForFunction(()=>!document.querySelector('[data-theme-action="apply-import"]'));await close();
 });
 await check('returning to an ordinary theme removes all cosmic effects and manual cosmic mode remains available',async()=>{
  const committed=await page.evaluate(()=>__cosmos.themeController.getPreferences());await page.evaluate(()=>__cosmos.themeController.load({selected:'paper'}));assert.equal(await page.locator('.cosmic-backdrop').count(),0);assert.equal(await page.locator('.cosmic-corona').count(),0);
  await page.locator('#filter-button').click();await page.locator('[data-graph-setting="appearance"]').selectOption('cosmos');await page.waitForFunction(()=>document.querySelector('.node-core')?.dataset.shape==='star');await page.locator('[data-graph-setting="appearance"]').selectOption('theme');await page.locator('[data-action="close-filters"]').last().click();await page.evaluate(value=>__cosmos.themeController.load(value),committed);
 });
 await check('older live desktop storage cannot silently discard v2 graph fields',async()=>{
  const before=JSON.stringify(settings.themePreferences);backendVersion=1;await page.reload();await page.waitForFunction(()=>__cosmos.state.ready);await themes();await importPack({...pack,name:'Uncommitted cosmic package'});await page.locator('[data-theme-action="apply-import"]').click();await page.waitForFunction(()=>document.querySelector('#toast-region').textContent.includes('新版星图主题'));assert.equal(JSON.stringify(settings.themePreferences),before);backendVersion=2;
 });
 await page.reload();await page.waitForFunction(()=>__cosmos.state.ready&&document.querySelector('.cosmic-backdrop'));assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({passed:checks.length,checks,errors,isolated:true},null,2));console.log(JSON.stringify({passed:checks.length,output}));await browser.close();
})().catch(async error=>{console.error(error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});await browser?.close();process.exitCode=1;});
