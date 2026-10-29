import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AGENT_PROVIDERS,providerForConfig} from '../dist/agent-providers.js';
import {AgentSettings,normalizeAgentConfig,listAgentModels,completeWithProvider} from '../desktop/agent.mjs';
import {runResearchAgent} from '../dist/ai-agent-core.js';
import {handleAgentRequest} from '../desktop/agent-http.mjs';
const key='synthetic-test-key',json=value=>new Response(JSON.stringify(value));

test('all provider presets query official endpoints without a model, prompts, redirects or secret output',async()=>{
  assert.ok(AGENT_PROVIDERS.length>=12);
  for(const preset of AGENT_PROVIDERS){
    const input={provider:preset.id,apiKey:key};let request;
    const result=await listAgentModels(input,{},async(url,options)=>{request={url,options};return json({data:[{id:'chat-model',display_name:'Chat model'},{id:key}]});});
    assert.equal(result.ok,true,preset.id);assert.deepEqual(result.models,[{id:'chat-model',name:'Chat model'}]);
    assert.equal(new URL(request.url).hostname,new URL(preset.baseUrl).hostname);assert.equal(request.options.method,'GET');assert.equal(request.options.body,undefined);assert.equal(request.options.redirect,'error');
    let authHeader='Authorization';if(preset.protocol==='anthropic')authHeader='x-api-key';
    assert.equal(request.options.headers[authHeader],preset.protocol==='anthropic'?key:'Bearer '+key);
    assert.ok(!JSON.stringify(result).includes(key));assert.throws(()=>normalizeAgentConfig(input),/模型/);
  }
});
test('legacy settings retain their model and protocol; custom endpoints and native Claude protocol remain supported',()=>{
  const legacy={baseUrl:'https://api.openai.com/v1/chat/completions/',model:'existing-model',protocol:'chat'};
  const normalized=normalizeAgentConfig(legacy);assert.equal(normalized.provider,'openai');assert.equal(normalized.protocol,'chat');assert.equal(normalized.model,legacy.model);
  assert.equal(providerForConfig({baseUrl:'https://private.example/v1'}),'custom');
  assert.equal(normalizeAgentConfig({provider:'custom',baseUrl:'http://localhost:1234/v1/messages',protocol:'anthropic',model:'local'}).protocol,'anthropic');
  assert.throws(()=>normalizeAgentConfig({...legacy,provider:'deepseek'}),/不一致/);
});
test('provider changes do not reuse stored keys, and discovery does not overwrite saved settings or serialize credentials',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'materia-providers-')),settings=new AgentSettings(dir,{isEncryptionAvailable:()=>false});await settings.load();
  await settings.save({provider:'deepseek',model:'original-model',apiKey:key});const before=await readFile(settings.file);
  const same=settings.resolve({provider:'deepseek'},{requireModel:false}),other=settings.resolve({provider:'openai'},{requireModel:false});
  assert.equal(same.apiKey,key);assert.equal(other.apiKey,'');assert.equal(settings.config.model,'original-model');
  await listAgentModels(same,{},async()=>json({data:[{id:'new-model'}]}));assert.deepEqual(await readFile(settings.file),before);assert.ok(!before.toString().includes(key));
  assert.equal((await listAgentModels(other)).stage,'configuration');
});
test('discovery filters explicit non-text APIs, deduplicates and never treats an empty catalog as success',async()=>{
  const result=await listAgentModels({provider:'gemini',apiKey:key},{},async()=>json({data:[{id:'models/gemini-text'},{id:'models/gemini-text'},{id:'image-only',output_modalities:['image']},{id:'text-embedding-3-small'},{id:'old-model',lifecycle:'retired'},{id:'custom-chat'},{id:'<script>'}]}));
  assert.deepEqual(result.models.map(m=>m.id),['gemini-text','custom-chat']);
  assert.equal((await listAgentModels({provider:'openai',apiKey:key},{},async()=>json({data:[]}))).stage,'empty');
});
test('Claude catalog follows bounded same-host cursor pagination and rejects malformed repeating cursors',async()=>{
  const urls=[];const result=await listAgentModels({provider:'anthropic',apiKey:key},{},async url=>{urls.push(url);return json(urls.length===1?{data:[{id:'claude-a'}],has_more:true,last_id:'claude-a'}:{data:[{id:'claude-b'}],has_more:false});});
  assert.deepEqual(result.models.map(m=>m.id),['claude-a','claude-b']);assert.equal(new URL(urls[1]).searchParams.get('after_id'),'claude-a');assert.ok(urls.every(u=>new URL(u).origin==='https://api.anthropic.com'));
  assert.equal((await listAgentModels({provider:'anthropic',apiKey:key},{},async()=>json({data:[{id:'same'}],has_more:true,last_id:'same'}))).ok,false);
});
test('Model Studio catalogs read numbered pages and omit explicit image-only model metadata',async()=>{
  const urls=[];const result=await listAgentModels({provider:'qwen-intl',apiKey:key},{},async url=>{urls.push(url);return json({output:{total:2,models:urls.length===1?[{model:'qwen-text',inference_metadata:{response_modality:['Text']}}]:[{model:'qwen-image',inference_metadata:{response_modality:['Image']}}]}});});
  assert.equal(new URL(urls[1]).searchParams.get('page_no'),'2');assert.deepEqual(result.models.map(m=>m.id),['qwen-text']);
});
test('catalog failures are actionable and never show untrusted provider bodies or credentials',async()=>{
  for(const code of [401,403,404,405,500]){
    const result=await listAgentModels({provider:'deepseek',apiKey:key},{},async()=>new Response(key,{status:code}));assert.equal(result.ok,false);assert.equal(result.httpStatus,code);assert.ok(!JSON.stringify(result).includes(key));
  }
  for(const data of [key,JSON.stringify({error:key}),'x'.repeat(4*1024*1024+1)])assert.equal((await listAgentModels({provider:'deepseek',apiKey:key},{},async()=>new Response(data))).stage,'response');
});
test('Claude native tool rounds preserve content blocks, combine parallel results and support plain translation',async()=>{
  const bodies=[];let round=0;
  const fetcher=async(url,options)=>{
    assert.ok(url.endsWith('/messages'));assert.equal(options.headers['x-api-key'],key);assert.equal(options.headers.Authorization,undefined);const body=JSON.parse(options.body);bodies.push(body);
    assert.equal(body.max_tokens,8192);assert.ok(body.system);assert.ok(body.tools[0].input_schema);
    return json(round++===0?{content:[{type:'text',text:'正在检索'},{type:'tool_use',id:'a',name:'library_overview',input:{}},{type:'tool_use',id:'b',name:'search_library',input:{query:'合金'}}],stop_reason:'tool_use'}:{content:[{type:'text',text:'研究结果'}],stop_reason:'end_turn'});
  };
  const cfg={provider:'anthropic',model:'claude-test',apiKey:key};
  const result=await runResearchAgent({question:'查询合金',context:{papers:[],notes:{}},complete:input=>completeWithProvider(cfg,input,fetcher)});
  assert.equal(result.answer,'研究结果');assert.equal(bodies[1].messages.at(-1).content.filter(c=>c.type==='tool_result').length,2);assert.equal(bodies[1].messages.at(-2).content[1].id,'a');
  const translated=await completeWithProvider(cfg,{messages:[{role:'system',content:'Translate'},{role:'user',content:'strength'}],tools:[]},async(_url,options)=>{assert.equal(JSON.parse(options.body).tools,undefined);return json({content:[{type:'text',text:'强度'}],stop_reason:'end_turn'});});assert.equal(translated.content,'强度');
});
test('compatible reasoning and Gemini tool signatures survive tool rounds without changing the assistant role',async()=>{
  let round=0;const requests=[],signature={google:{thought_signature:'synthetic-signature'}};
  const result=await runResearchAgent({question:'研究',context:{papers:[],notes:{}},complete:input=>completeWithProvider({provider:'deepseek',model:'reasoner',apiKey:key},input,async(_url,options)=>{
    requests.push(JSON.parse(options.body));
    return json({choices:[{finish_reason:round++===0?'tool_calls':'stop',message:round===1?{role:'system',content:null,reasoning_content:'synthetic-reasoning',tool_calls:[{id:'t1',type:'function',function:{name:'library_overview',arguments:'{}'},extra_content:signature}]}:{content:'结果'}}]});
  })});
  assert.equal(result.answer,'结果');const assistant=requests[1].messages.find(m=>m.role==='assistant');assert.equal(assistant.reasoning_content,'synthetic-reasoning');assert.deepEqual(assistant.tool_calls[0].extra_content,signature);assert.ok(!requests[1].messages.some(m=>m.role==='system'&&m.reasoning_content));
});
test('loopback preview exposes model discovery only to its own page and performs no completion calls',async t=>{
  let calls=0;const upstream=http.createServer((req,res)=>{calls++;assert.equal(req.method,'GET');assert.equal(req.url,'/v1/models');res.end(JSON.stringify({data:[{id:'local-model'}]}));});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
  const proxy=http.createServer(async(req,res)=>{if(!await handleAgentRequest(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
  t.after(()=>{upstream.closeAllConnections();upstream.close();proxy.closeAllConnections();proxy.close();});const base=`http://127.0.0.1:${proxy.address().port}`,body=JSON.stringify({config:{provider:'custom',baseUrl:`http://127.0.0.1:${upstream.address().port}/v1`,apiKey:key}});
  const headers={'Content-Type':'application/json','X-Materia-Agent':'1',Origin:'https://foreign.example'};
  assert.equal((await fetch(base+'/api/ai-agent/models',{method:'POST',headers,body})).status,403);assert.equal(calls,0);
  const response=await fetch(base+'/api/ai-agent/models',{method:'POST',headers:{...headers,Origin:base},body});assert.equal(response.status,200);assert.equal((await response.json()).models[0].id,'local-model');assert.equal(calls,1);
});
