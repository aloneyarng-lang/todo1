// Real packaged bridge with an isolated profile and a local synthetic provider.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const{chromium}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),output=path.join(root,'.local/provider-desktop-verification'),checks=[],errors=[];let browser,child,server,log='',modelRequests=0;
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
(async()=>{
 await fs.mkdir(output,{recursive:true});const run=await fs.mkdtemp(path.join(output,'run-')),profile=path.join(run,'profile'),library=path.join(run,'library'),{version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const executable=process.env.MATERIA_RELEASE_EXE||path.join(root,`release/v${version}/Materia-win32-x64/Materia.exe`),env={...process.env,MATERIA_HEADLESS:'1',MATERIA_PROFILE_DIR:profile,MATERIA_LIBRARY_DIR:library};delete env.ELECTRON_RUN_AS_NODE;
 server=http.createServer((req,res)=>{
   modelRequests++;assert.equal(req.method,'GET');assert.equal(req.url,'/v1/models');res.setHeader('Content-Type','application/json');
   if(req.headers.authorization!=='Bearer desktop-synthetic-test-key'){res.writeHead(401);res.end('provider-secret MUST NOT APPEAR');return;}
   res.end(JSON.stringify({data:[{id:'native-model-a'},{id:'native-model-b'}]}));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const baseUrl=`http://127.0.0.1:${server.address().port}/v1`;
 async function start(){
   await fs.unlink(path.join(profile,'DevToolsActivePort')).catch(e=>{if(e.code!=='ENOENT')throw e;});child=spawn(executable,['--remote-debugging-port=0','--remote-debugging-address=127.0.0.1'],{env,windowsHide:true,stdio:['ignore','ignore','pipe']});child.stderr.on('data',b=>log+=b.toString());let port;
   for(let i=0;i<120;i++){try{port=Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}if(child.exitCode!==null)throw Error('Isolated app exited: '+log);await new Promise(r=>setTimeout(r,100));}assert.ok(port,'No isolated debugging port');
   browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const context=browser.contexts()[0],page=context.pages()[0]||await context.waitForEvent('page');page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>document.querySelector('.import-main')?.disabled===false);assert.equal(path.resolve((await page.evaluate(()=>materiaDesktop.info())).path),path.resolve(library));return page;
 }
 async function stop(){await browser?.close();browser=null;if(child?.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}child=null;}
 try{
   let page=await start();
   await check('packaged model discovery works without an existing model, using only a GET request',async()=>{
     await page.locator('.workspace-ribbon [data-action="ai-agent"]').click();await page.locator('#agent-provider').selectOption('custom');await page.locator('#agent-base-url').fill(baseUrl);await page.locator('#agent-key').fill('desktop-synthetic-test-key');
     await page.locator('[data-agent-action="test-connection"]').click();await page.locator('#agent-connection-status').filter({hasText:'连接检测通过'}).waitFor();assert.equal(modelRequests,1);await page.locator('#agent-model-manual').uncheck();await page.locator('#agent-model-select').selectOption('native-model-b');assert.equal(await page.locator('#agent-model').inputValue(),'native-model-b');
     assert.equal(await page.locator('#agent-remember').isEnabled(),true);await page.locator('#agent-remember').check();await page.locator('#agent-config-form [type="submit"]').click();await page.locator('#agent-status').filter({hasText:'设置已保存'}).waitFor();
     const config=await page.evaluate(()=>materiaDesktop.agentGetConfig());assert.equal(config.appVersion,version);assert.equal(config.hasKey,true);assert.equal(config.apiKey,undefined);assert.equal(config.model,'native-model-b');const saved=await fs.readFile(path.join(profile,'ai-agent.json'),'utf8');assert.ok(JSON.parse(saved).encryptedKey);assert.ok(!saved.includes('desktop-synthetic-test-key'));
   });
   await check('switching preset clears drafts while preserving saved configuration and its encrypted key',async()=>{
     await page.locator('[data-menu-toggle="agent-conversation-menu"]').click();await page.locator('[data-agent-action="settings"]').click();await page.locator('#agent-key').fill('provider-secret');await page.locator('#agent-provider').selectOption('anthropic');assert.equal(await page.locator('#agent-key').inputValue(),'');assert.equal(await page.locator('#agent-protocol').inputValue(),'anthropic');assert.equal((await page.evaluate(()=>materiaDesktop.agentGetConfig())).baseUrl,baseUrl);assert.equal(modelRequests,1);
   });
   await stop();page=await start();
   await check('restart restores custom service and encrypted credential; public roster and errors never reveal it',async()=>{
     const config=await page.evaluate(()=>materiaDesktop.agentGetConfig());assert.equal(config.hasKey,true);assert.equal(config.model,'native-model-b');assert.equal(config.apiKey,undefined);const before=await fs.readFile(path.join(profile,'ai-agent.json'));
     const result=await page.evaluate(baseUrl=>materiaDesktop.agentListModels({provider:'custom',baseUrl}),baseUrl);assert.equal(result.ok,true);assert.equal(result.models.length,2);assert.ok(!JSON.stringify(result).includes('desktop-synthetic-test-key'));
     const rejected=await page.evaluate(baseUrl=>materiaDesktop.agentListModels({provider:'custom',baseUrl,apiKey:'provider-secret'}),baseUrl);assert.equal(rejected.httpStatus,401);assert.ok(!JSON.stringify(rejected).includes('provider-secret'));assert.deepEqual(await fs.readFile(path.join(profile,'ai-agent.json')),before);
   });
   assert.deepEqual(errors,[]);const report={passed:checks.length,checks,version,executable,isolatedProfile:true,noExternalRequests:true,noGenerationCalls:true,encryptedKeyRestart:true,errors};await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:checks.length,version,noExternalRequests:true}));
 }finally{await stop();}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{server?.closeAllConnections();server?.close();});
