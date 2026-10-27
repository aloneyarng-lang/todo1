// Natural force-layout interaction in an isolated headless browser; no user library or window.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'.local/natural-graph-verification');await fs.mkdir(out,{recursive:true});
 const stage=await fs.mkdtemp(path.join(out,'stage-'));await fs.cp(path.join(root,'dist'),path.join(stage,'dist'),{recursive:true});await fs.appendFile(path.join(stage,'dist/app.js'),'\nglobalThis.__globalGraph=map;\n');
 const browser=await chromium.launch({headless:true,executablePath:path.join(process.env.ProgramFiles,'Google/Chrome/Application/chrome.exe'),args:['--allow-file-access-from-files']});
 try{
  const page=await browser.newPage({viewport:{width:1395,height:895}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const papers=Array.from({length:18},(_,i)=>({id:String(i),title:'Materials research '+i,tags:i===17?[]:i%4===0?['Alpha','Beta']:i%3===0?['Beta','Gamma']:i%2===0?['Gamma']:['Alpha'],measurements:[],favorite:false,addedAt:1}));
   const settings={notes:{},collections:[],journalMetrics:[],graphAssociations:['Alpha','Beta','Gamma'].map(value=>({kind:'tag',value})),themePreferences:{selected:'academic-purple'},graphPreferences:{elasticity:1}};
   globalThis.materiaDesktop={getPapers:async()=>papers,getSetting:async k=>settings[k],setSetting:async(k,v)=>settings[k]=v,info:async()=>({path:'ISOLATED NATURAL GRAPH TEST'})};
  });
  await page.goto(pathToFileURL(path.join(stage,'dist/index.html')).href);await page.waitForFunction(()=>document.querySelector('.import-main')?.disabled===false);
  const before=await page.evaluate(async()=>{
   const m=__globalGraph;if(!m.paused)m.toggleMotion();const {stepNetwork}=await import('./force-layout.js');
   for(const n of m.network.nodes){n.vx=0;n.vy=0;}for(let i=0;i<200;i++)stepNetwork(m.network,.3*Math.pow(.9772,i),m.preferences);
   m.network.byId.get('paper:16').pinned=true;m.paused=false;m.paint();m.fit();
   const source=m.network.nodes.find(n=>n.rule?.value==='Alpha');const rect=m.nodes.find(n=>n.node===source).core.getBoundingClientRect();
   return{nodes:m.network.nodes.map(n=>({id:n.id,x:n.x,y:n.y,pinned:n.pinned})),camera:[m.x,m.y,m.scale],source:source.id,edges:m.network.edges.length,point:{x:rect.x+rect.width/2,y:rect.y+rect.height/2},unit:m.scale*document.querySelector('#star-map').getScreenCTM().a};
  });
  await page.screenshot({path:path.join(out,'before.png')});await page.mouse.move(before.point.x,before.point.y);await page.mouse.down();await page.mouse.move(before.point.x+135*before.unit,before.point.y-70*before.unit,{steps:15});await page.waitForTimeout(400);
  const snapshot=()=>page.evaluate(()=>({nodes:__globalGraph.network.nodes.map(n=>({id:n.id,x:n.x,y:n.y,pinned:n.pinned})),camera:[__globalGraph.x,__globalGraph.y,__globalGraph.scale],heat:__globalGraph.heat}));
  const held=await snapshot();await page.screenshot({path:path.join(out,'held.png')});await page.waitForTimeout(1100);const stillHeld=await snapshot();
  const sourceBefore=before.nodes.find(n=>n.id===before.source),sourceHeld=held.nodes.find(n=>n.id===before.source);
  assert.ok(Math.abs(sourceHeld.x-sourceBefore.x-135)<.1&&Math.abs(sourceHeld.y-sourceBefore.y+70)<.1,'held point follows cursor exactly');
  const shifts=held.nodes.filter(n=>!n.pinned&&n.id!==before.source).map(n=>{const old=before.nodes.find(p=>p.id===n.id);return Math.hypot(n.x-old.x,n.y-old.y);});
  assert.ok(Math.max(...shifts)>20);assert.ok(Math.max(...shifts)-Math.min(...shifts)>10,'nodes respond to forces rather than moving as a sheet');
  assert.ok(stillHeld.nodes.some((n,i)=>!n.pinned&&n.id!==before.source&&Math.hypot(n.x-held.nodes[i].x,n.y-held.nodes[i].y)>1),'stationary hold must keep reorganizing');
  assert.equal(stillHeld.heat,.3);assert.deepEqual(held.camera,before.camera);assert.deepEqual(held.nodes.find(n=>n.pinned),before.nodes.find(n=>n.pinned));
  await page.mouse.up();await page.waitForFunction(()=>!__globalGraph.frame&&!__globalGraph.drag,{timeout:12000});const released=await snapshot();
  assert.equal(await page.evaluate(id=>__globalGraph.network.byId.get(id).pinned,before.source),false);assert.deepEqual(released.nodes.find(n=>n.pinned),before.nodes.find(n=>n.pinned));
  const newLayoutTravel=released.nodes.reduce((sum,n,i)=>sum+Math.hypot(n.x-before.nodes[i].x,n.y-before.nodes[i].y),0)/released.nodes.length;assert.ok(newLayoutTravel>12,'release settles in a new configuration');
  assert.equal(await page.evaluate(()=>__globalGraph.network.edges.length),before.edges);assert.equal(await page.evaluate(()=>Object.hasOwn(__globalGraph.network,'deformation')),false);
  assert.equal(await page.evaluate(()=>__globalGraph.preferences.inertia),.5);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'academic-purple');
  await page.screenshot({path:path.join(out,'released.png')});
  // Pause allows manual positioning without running the surrounding layout.
  await page.evaluate(()=>__globalGraph.toggleMotion());const paused=await snapshot();await page.waitForTimeout(150);assert.deepEqual((await snapshot()).nodes,paused.nodes);
  const testNode=await page.evaluate(()=>{const item=__globalGraph.nodes.find(n=>n.node.id==='paper:0'),r=item.core.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.move(testNode.x,testNode.y);await page.mouse.down();await page.mouse.move(testNode.x-25,testNode.y+20,{steps:5});await page.keyboard.down('Shift');await page.mouse.up();await page.keyboard.up('Shift');
  const manuallyMoved=await snapshot();assert.equal(manuallyMoved.nodes.find(n=>n.id==='paper:0').pinned,true);
  assert.deepEqual(manuallyMoved.nodes.filter(n=>n.id!=='paper:0'),paused.nodes.filter(n=>n.id!=='paper:0'));
  await page.evaluate(()=>{__globalGraph.cache['paper:hidden-test']={x:100,y:100,pinned:true};});
  await page.locator('#filter-button').click();await page.locator('.graph-setting-section > summary').filter({hasText:'力学布局'}).click();await page.locator('[data-action="graph-release-pins"]').click();
  assert.equal(await page.evaluate(()=>__globalGraph.network.nodes.some(n=>n.pinned)||Object.values(__globalGraph.cache).some(n=>n.pinned)),false);
  await page.waitForFunction(async()=>(await materiaDesktop.getSetting('graphLayout'))?.['paper:hidden-test']?.pinned===false);
  assert.equal(await page.evaluate(()=>Boolean(__globalGraph.frame)),false);
  assert.deepEqual(errors,[]);const report={passed:true,forceDrivenReorganization:true,stationaryHoldReheats:true,newEquilibrium:true,newLayoutTravel,pinsAndCameraPreserved:true,noSyntheticEdges:true,noDragStartAnchors:true,legacyReboundDisabled:true,pausedDragAndShiftPin:true,releaseAllPinsPersists:true,academicPurple:true,isolated:true,visibleWindow:false,before,held,released};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,before:undefined,held:undefined,released:undefined}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
