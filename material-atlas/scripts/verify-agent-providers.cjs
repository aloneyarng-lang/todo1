// All provider responses are intercepted synthetic fixtures; no external API or real key.
const {chromium}=require(require('node:path').join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.local/provider-verification'),checks=[],requests=[],errors=[];
let browser,page,server,reply='success';
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
async function settings(){if(!await page.locator('#agent-settings').evaluate(e=>e.open)){await page.locator('[data-menu-toggle="agent-conversation-menu"]').click();await page.locator('[data-agent-action="settings"]').click();}}
(async()=>{
 await fs.mkdir(output,{recursive:true});const{createPreviewServer}=await import(pathToFileURL(path.join(root,'server.mjs')).href);server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.MATERIA_CHROME||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});page=await browser.newPage({viewport:{width:1395,height:960}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ai-agent/models',async route=>{
   const request=route.request(),config=request.postDataJSON().config,mode=reply;requests.push({provider:config.provider,method:request.method(),model:config.model,bodyKeys:Object.keys(request.postDataJSON())});
   if(mode==='slow')await new Promise(r=>setTimeout(r,1400));
   const body=mode==='failure'?{ok:false,httpStatus:401,message:'认证失败，请重新填写密钥。'}:mode==='unsupported'?{ok:false,httpStatus:404,message:'该服务未开放兼容的模型列表接口，可手动填写。'}:{ok:true,keyProvided:true,models:[{id:config.provider+'-alpha',name:'合成模型 A'},{id:config.provider+'-beta',name:'合成模型 B'}],message:'已获取 2 个文本模型。'};
   await route.fulfill({json:body}).catch(()=>{});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('.import-main:not([disabled])').waitFor({state:'attached'});await page.locator('.workspace-ribbon [data-action="ai-agent"]').click();
 await check('provider picker hides endpoint details and retrieves live choices after key input without prompts',async()=>{
   assert.ok(await page.locator('#agent-provider option').count()>=13);await page.locator('#agent-provider').selectOption('deepseek');assert.equal(await page.locator('#agent-custom-settings').isHidden(),true);
   await page.locator('#agent-key').fill('synthetic-test-key');await page.waitForFunction(()=>document.querySelector('#agent-model-select').value==='deepseek-alpha');assert.equal(await page.locator('#agent-model').isHidden(),true);assert.equal(await page.locator('#agent-remember').isDisabled(),true);
   await page.locator('#agent-model-select').selectOption('deepseek-beta');await page.locator('#agent-config-form [type="submit"]').click();await page.locator('#agent-status').filter({hasText:'设置已保存'}).waitFor();
   const prefs=await page.evaluate(async()=>(await import('/storage.js')).getSetting('agentPreferences'));assert.equal(prefs.provider,'deepseek');assert.equal(prefs.model,'deepseek-beta');assert.ok(!JSON.stringify(prefs).includes('synthetic-test-key'));
 });
 await check('switching provider clears typed keys and old models; protocol follows the chosen provider',async()=>{
   await settings();await page.locator('#agent-key').fill('provider-secret');await page.locator('#agent-provider').selectOption('openai');assert.equal(await page.locator('#agent-key').inputValue(),'');assert.equal(await page.locator('#agent-model-select').inputValue(),'');assert.equal(await page.locator('#agent-protocol').inputValue(),'responses');
   await page.locator('#agent-provider').selectOption('anthropic');assert.equal(await page.locator('#agent-protocol').inputValue(),'anthropic');
 });
 await check('a delayed previous-provider response cannot populate the newly selected service',async()=>{
   reply='slow';await page.locator('#agent-key').fill('synthetic-test-key');await page.waitForFunction(()=>document.querySelector('[data-agent-action="test-connection"]').textContent==='正在获取…');
   await page.waitForTimeout(50);await page.locator('#agent-provider').selectOption('gemini');reply='success';await page.locator('#agent-key').fill('synthetic-test-key');await page.waitForFunction(()=>document.querySelector('#agent-model-select').value==='gemini-alpha');await page.waitForTimeout(1600);assert.equal(await page.locator('#agent-model-select').inputValue(),'gemini-alpha');
 });
 await check('401 and unsupported catalogs leave a working manual-model path and never save a draft',async()=>{
   reply='failure';await page.locator('[data-agent-action="test-connection"]').click();await page.locator('#agent-connection-status').filter({hasText:'HTTP 401'}).waitFor();
   await page.locator('#agent-model-manual').check();await page.locator('#agent-model').fill('manual-model-id');reply='unsupported';await page.locator('[data-agent-action="test-connection"]').click();await page.locator('#agent-connection-status').filter({hasText:'HTTP 404'}).waitFor();assert.equal(await page.locator('#agent-model').inputValue(),'manual-model-id');
   assert.ok(!(await page.locator('#agent-connection-status').innerText()).includes('synthetic-test-key'));const prefs=await page.evaluate(async()=>(await import('/storage.js')).getSetting('agentPreferences'));assert.equal(prefs.provider,'deepseek');
 });
 await check('custom endpoints, explicit protocol and manual model IDs remain editable and survive reload',async()=>{
   await page.locator('#agent-provider').selectOption('custom');assert.equal(await page.locator('#agent-custom-settings').isVisible(),true);await page.locator('#agent-base-url').fill('http://localhost:11434/v1');await page.locator('#agent-model').fill('local-model');await page.locator('#agent-protocol').selectOption('chat');await page.locator('#agent-config-form [type="submit"]').click();await page.locator('#agent-status').filter({hasText:'设置已保存'}).waitFor();
   await page.reload();await page.locator('.import-main:not([disabled])').waitFor({state:'attached'});await page.locator('.workspace-ribbon [data-action="ai-agent"]').click();await settings();assert.equal(await page.locator('#agent-provider').inputValue(),'custom');assert.equal(await page.locator('#agent-model').inputValue(),'local-model');assert.equal(await page.locator('#agent-base-url').inputValue(),'http://localhost:11434/v1');assert.equal(await page.locator('#agent-key').inputValue(),'');
 });
 await page.setViewportSize({width:1000,height:850});assert.equal(await page.locator('#agent-config-form [type=submit]').evaluate(el=>{const r=el.getBoundingClientRect(),s=el.closest('details').getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom&&r.bottom<=innerHeight;}),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(output,'custom-settings.png')});assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='POST'&&JSON.stringify(r.bodyKeys)==='["config"]'));
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({passed:checks.length,checks,noExternalRequests:true,noGenerationCalls:true,errors},null,2));console.log(JSON.stringify({passed:checks.length,noExternalRequests:true,noGenerationCalls:true}));
})().catch(async error=>{console.error(error);if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();server?.closeAllConnections();server?.close();});
