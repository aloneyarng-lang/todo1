// Runs the actual desktop entry and preload against an isolated library, with no visible window.
import { app, safeStorage } from 'electron';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { LocalLibrary } from '../desktop/library.mjs';
import { AgentHistoryFile } from '../desktop/agent-history.mjs';

const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'.local','agent-desktop-verification');
await mkdir(output,{recursive:true});
const isolated=await mkdtemp(path.join(output,'run-'));
process.env.MATERIA_PROFILE_DIR=path.join(isolated,'profile');process.env.MATERIA_LIBRARY_DIR=path.join(isolated,'library');process.env.MATERIA_HEADLESS='1';
app.setName('MateriaAgentVerification');
const lib=await new LocalLibrary(process.env.MATERIA_LIBRARY_DIR).init();
const fixturePdf=Buffer.from('%PDF-1.4\n% Synthetic desktop agent fixture\n%%EOF');
await lib.putPapers([{id:'p1',title:'桌面 Agent 合成文献 A',tags:[],authors:'Ada',authorDetails:[],filename:'a.pdf',year:'2024',measurements:[],fileBytes:fixturePdf},{id:'p2',title:'不在本次范围的文献 B',tags:[],authors:'Bo',authorDetails:[],filename:'b.pdf',year:'2025',measurements:[],fileBytes:fixturePdf}]);
await lib.setSetting('notes',{'paper:p1':[{id:'n1',body:'桌面通信验证笔记',createdAt:1,updatedAt:1}]});
const checks=[],requests=[];let win;
const mock=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks));requests.push(body);
  if(body.messages.at(-1)?.content==='慢请求')return;
  const tools=body.messages.filter(m=>m.role==='tool');let message;
  if(!tools.length)message={tool_calls:[{id:'s1',type:'function',function:{name:'search_library',arguments:'{"query":""}'}}]};
  else if(tools.length===1)message={tool_calls:[{id:'r1',type:'function',function:{name:'read_papers',arguments:'{"ids":["p1"]}'}}]};
  else message={content:'已读取桌面文献笔记 [p1]'};
  res.end(JSON.stringify({choices:[{finish_reason:message.tool_calls?'tool_calls':'stop',message}]}));
});
await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
const baseUrl=`http://127.0.0.1:${mock.address().port}/v1`;
const timeout=setTimeout(()=>finish(new Error('Desktop verification timed out.')),45000);
const exec=body=>win.webContents.executeJavaScript(`(async()=>{${body}})()`);
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
async function finish(error){
  clearTimeout(timeout);mock.closeAllConnections();mock.close();
  if(error){console.error(error);await writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,checks},null,2));}
  else await writeFile(path.join(output,'report.json'),JSON.stringify({passed:checks.length,checks,providerRequests:requests.length,systemEncryption:await safeStorage.isAsyncEncryptionAvailable(),isolated:true,visibleWindow:false},null,2));
  app.exit(error?1:0);
}
app.on('browser-window-created',(_event,window)=>{
  win=window;
  window.webContents.once('did-finish-load',async()=>{
    try {
      for(let attempt=0;attempt<100;attempt++){if(await exec('return !document.querySelector(".import-main").disabled;'))break;await new Promise(r=>setTimeout(r,30));}
      await check('real desktop starts hidden with the sandboxed preload and isolated literature',async()=>{
        assert.equal(win.isVisible(),false);assert.equal(await exec('return typeof require;'),'undefined');assert.equal((await exec('return await materiaDesktop.getPapers();')).length,2);
      });
      await check('real safeStorage retains keys outside literature and never returns keys through the bridge',async()=>{
        const value={baseUrl,model:'mock-model',apiKey:'desktop-synthetic-test-key',protocol:'chat',rememberKey:await safeStorage.isAsyncEncryptionAvailable()};
        const config=await exec(`return await materiaDesktop.agentSaveConfig(${JSON.stringify(value)});`);assert.equal(config.hasKey,true);assert.equal(config.apiKey,undefined);
        assert.ok(!(await readFile(path.join(process.env.MATERIA_PROFILE_DIR,'ai-agent.json'),'utf8')).includes(value.apiKey));
        assert.ok(!(await readFile(path.join(process.env.MATERIA_LIBRARY_DIR,'library.json'),'utf8')).includes(value.apiKey));
      });
      await check('actual desktop IPC executes the agent loop in main and emits progress with source IDs',async()=>{
        await exec('globalThis.desktopAgentProgress=[];globalThis.unsubscribeAgent=materiaDesktop.onAgentProgress(p=>desktopAgentProgress.push(p));');
        const answer=await exec('return await materiaDesktop.agentRun({id:"desktop-test",question:"总结选中文献",history:[],scopeIds:["p1"]});');
        assert.equal(answer.answer,'已读取桌面文献笔记 [p1]');assert.deepEqual(answer.sources.map(p=>p.id),['p1']);
        assert.equal(JSON.parse(requests[1].messages.at(-1).content).total,1);assert.ok(JSON.stringify(requests[2]).includes('桌面通信验证笔记'));
        assert.ok((await exec('return desktopAgentProgress;')).some(p=>p.stage==='tool'&&p.id==='desktop-test'));
      });
      await check('desktop sidebar uses the real bridge to submit questions and navigate citations',async()=>{
        await exec('document.querySelector(".workspace-ribbon [data-action=ai-agent]").click();');
        for(let attempt=0;attempt<100;attempt++){if(await exec('return document.querySelector("#agent-model").value==="mock-model";'))break;await new Promise(r=>setTimeout(r,20));}
        await exec('document.querySelector("#agent-question").value="通过桌面侧栏总结文献";document.querySelector("#agent-question-form").requestSubmit();');
        for(let attempt=0;attempt<100;attempt++){if(await exec('return Boolean(document.querySelector(".agent-assistant"));'))break;await new Promise(r=>setTimeout(r,30));}
        assert.equal(await exec('return document.querySelectorAll(".agent-citation").length;'),1);
        await exec('document.querySelector(".agent-citation").click();');assert.equal(await exec('return document.querySelector("#ai-agent-panel").hidden;'),true);
        assert.ok((await exec('return document.querySelector("#detail-panel").textContent;')).includes('桌面 Agent 合成文献 A'));
      });
      await check('real desktop history saves Markdown and references to the current library and resumes after reload',async()=>{
        const before=await exec('return await materiaDesktop.agentGetHistory();');assert.equal(before.state.conversations.length,1);assert.equal(before.state.conversations[0].entries.length,2);assert.equal(before.state.conversations[0].entries[1].sources[0].id,'p1');
        const disk=await new AgentHistoryFile(process.env.MATERIA_LIBRARY_DIR).load();assert.deepEqual(disk,before.state);assert.ok(!(await readFile(path.join(process.env.MATERIA_LIBRARY_DIR,'ai-chats.json'),'utf8')).includes('desktop-synthetic-test-key'));
        const loaded=new Promise(resolve=>win.webContents.once('did-finish-load',resolve));win.webContents.reload();await loaded;
        for(let attempt=0;attempt<100;attempt++){if(await exec('return !document.querySelector(".import-main").disabled;'))break;await new Promise(r=>setTimeout(r,30));}
        await exec('document.querySelector(".workspace-ribbon [data-action=ai-agent]").click();');
        for(let attempt=0;attempt<100;attempt++){if(await exec('return Boolean(document.querySelector(".agent-assistant"));'))break;await new Promise(r=>setTimeout(r,20));}
        assert.equal(await exec('return document.querySelectorAll(".agent-citation").length;'),1);
        const mismatch=await exec(`return await materiaDesktop.agentSaveHistory({libraryKey:"other-library",state:${JSON.stringify(before.state)}}).then(()=>false,()=>true);`);assert.equal(mismatch,true);assert.deepEqual((await exec('return await materiaDesktop.agentGetHistory();')).state,before.state);
      });
      await check('confirmed desktop history deletion persists without affecting literature',async()=>{
        await exec('document.querySelector("[data-agent-action=history]").click();document.querySelector("[data-history-delete]").click();document.querySelector("[data-history-delete]").click();');
        for(let attempt=0;attempt<100;attempt++){if(await exec('return document.querySelector("#agent-status").textContent.includes("已删除");'))break;await new Promise(r=>setTimeout(r,20));}
        const disk=await new AgentHistoryFile(process.env.MATERIA_LIBRARY_DIR).load();assert.deepEqual(disk.conversations,[]);assert.equal(disk.activeId,'');assert.equal((await exec('return await materiaDesktop.getPapers();')).length,2);
      });
      await check('actual desktop cancellation aborts the pending provider request',async()=>{
        await exec('globalThis.pendingDesktopAgent=materiaDesktop.agentRun({id:"desktop-stop",question:"慢请求",history:[],scopeIds:["p1"]}).then(value=>value.canceled?"cancelled":"unexpected success",()=>"unexpected rejection");');
        for(let attempt=0;attempt<100&&!requests.some(r=>r.messages.at(-1)?.content==='慢请求');attempt++)await new Promise(r=>setTimeout(r,20));
        await exec('await materiaDesktop.agentCancel("desktop-stop");');assert.equal(await exec('return await pendingDesktopAgent;'),'cancelled');
      });
      await check('desktop key clearing removes saved ciphertext and leaves literature unchanged',async()=>{
        await exec(`await materiaDesktop.agentSaveConfig(${JSON.stringify({baseUrl,model:'mock-model',protocol:'chat',apiKey:'',clearKey:true,rememberKey:false})});globalThis.unsubscribeAgent?.();`);
        const current=await exec('return await materiaDesktop.agentGetConfig();');assert.equal(current.hasKey,false);
        assert.ok(!(await readFile(path.join(process.env.MATERIA_PROFILE_DIR,'ai-agent.json'),'utf8')).includes('encryptedKey'));
        const papers=await exec('return await materiaDesktop.getPapers();');assert.equal(papers.length,2);assert.equal(papers[0].title,'桌面 Agent 合成文献 A');
      });
      await finish();
    } catch(error){await finish(error);}
  });
});
await import('../desktop/main.mjs');
