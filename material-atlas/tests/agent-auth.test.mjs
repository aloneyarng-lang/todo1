import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanAgentKey,agentCredentialIssue,agentHTTPError} from '../dist/agent-auth.js';
import {completeWithProvider,AgentSettings,testAgentConnection,normalizeAgentConfig} from '../desktop/agent.mjs';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const config={baseUrl:'https://api.deepseek.com/v1',model:'test-model',protocol:'chat'};
test('missing keys are blocked for known authenticated services while anonymous compatible and local services remain supported',async()=>{
  let requests=0;const fetcher=async()=>{requests++;return new Response(JSON.stringify({choices:[{message:{content:'ok'},finish_reason:'stop'}]}));};
  for(const baseUrl of ['https://api.deepseek.com','https://api.openai.com/v1'])await assert.rejects(completeWithProvider({...config,baseUrl},{messages:[]},fetcher),/当前未提供 API 密钥/);
  assert.equal(requests,0);assert.equal(agentCredentialIssue({...config,hasKey:true}),'');assert.match(agentCredentialIssue({...config,hasKey:false}),/重启后/);assert.ok(agentCredentialIssue({...config,model:''}));
  for(const baseUrl of ['http://localhost:11434/v1','https://anonymous.example/v1'])assert.equal((await completeWithProvider({...config,baseUrl},{messages:[]},fetcher)).content,'ok');assert.equal(requests,2);
});
test('Bearer-prefixed pastes produce exactly one prefix and invalid headers never leak into errors',async()=>{
  assert.equal(cleanAgentKey('  Bearer synthetic-test-key  '),'synthetic-test-key');assert.equal(cleanAgentKey('provider-secret'),'provider-secret');assert.throws(()=>cleanAgentKey('Authorization: Bearer provider-secret'),error=>!error.message.includes('provider-secret'));
  let authorization;await completeWithProvider({...config,apiKey:['Bearer','synthetic-test-key'].join(' ')},{messages:[]},async(_url,options)=>{authorization=options.headers.Authorization;return new Response(JSON.stringify({choices:[{message:{content:'ok'},finish_reason:'stop'}]}));});assert.equal(authorization,'Bearer synthetic-test-key');
  for(const key of ['"provider-secret"','provider secret','sk-****','sk-隐藏'])assert.throws(()=>cleanAgentKey(key),error=>!error.message.includes(key));
});
test('connection diagnostics use GET models only, never include prompts or credentials in their result, and distinguish model availability',async()=>{
  let request;const fetcher=async(url,options)=>{request={url,options};return new Response(JSON.stringify({data:[{id:'test-model'},{id:'provider-secret'}]}));};
  const result=await testAgentConnection({...config,apiKey:'synthetic-test-key'},{},fetcher);assert.equal(request.url,'https://api.deepseek.com/v1/models');assert.equal(request.options.method,'GET');assert.equal(request.options.body,undefined);assert.equal(request.options.redirect,'error');assert.equal(request.options.headers.Authorization,'Bearer synthetic-test-key');assert.equal(result.ok,true);assert.equal(result.keyProvided,true);assert.equal(result.modelAvailable,true);assert.ok(!JSON.stringify(result).includes('synthetic-test-key'));assert.ok(!JSON.stringify(result).includes('provider-secret'));
  assert.equal((await testAgentConnection({...config,model:'other-model',apiKey:'synthetic-test-key'},{},fetcher)).modelAvailable,false);
});

test('Gemini diagnostics accept resource-prefixed model IDs and send canonical IDs only to the official compatibility endpoint',async()=>{
  const google={baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-test-flash',protocol:'chat',apiKey:'AQ.synthetic-test-key'};
  let request;const fetcher=async(url,options)=>{request={url,options};return new Response(JSON.stringify({data:[{id:'models/gemini-test-flash'},{id:'gemini-other-flash'}]}));};
  const result=await testAgentConnection(google,{},fetcher);assert.equal(result.modelAvailable,true);assert.deepEqual(result.availableModels,['gemini-test-flash','gemini-other-flash']);assert.equal(request.options.method,'GET');assert.equal(request.options.body,undefined);assert.ok(!JSON.stringify(result).includes(google.apiKey));
  assert.equal((await testAgentConnection({...google,model:'models/gemini-test-flash'},{},fetcher)).modelAvailable,true);
  assert.equal(normalizeAgentConfig({...google,baseUrl:google.baseUrl+'/chat/completions/',model:'models/gemini-test-flash'}).model,'gemini-test-flash');
  assert.equal(normalizeAgentConfig({...google,baseUrl:'https://other.example/v1',model:'models/gemini-test-flash'}).model,'models/gemini-test-flash');
  assert.equal(normalizeAgentConfig({...google,baseUrl:'https://generativelanguage.googleapis.com.evil.example/v1beta/openai',model:'models/gemini-test-flash'}).model,'models/gemini-test-flash');
  await completeWithProvider({...google,model:'models/gemini-test-flash'},{messages:[]},async(_url,options)=>{assert.equal(JSON.parse(options.body).model,'gemini-test-flash');return new Response(JSON.stringify({choices:[{message:{content:'ok'},finish_reason:'stop'}]}));});
});

test('missing Gemini models produce bounded usable suggestions without rendering response content or exposing reflected credentials',async()=>{
  const google={baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-not-listed',protocol:'chat',apiKey:'gemini-synthetic-secret'};
  const data=[{id:google.apiKey},{id:'models/'+google.apiKey},{id:'<script>alert(1)</script>'},{id:'gemini-name with spaces'},null,{},...Array.from({length:80},(_,i)=>({id:'models/gemini-listed-'+i}))];
  const result=await testAgentConnection(google,{},async()=>new Response(JSON.stringify({data})));assert.equal(result.ok,true);assert.equal(result.modelAvailable,false);assert.equal(result.availableModels.length,40);assert.equal(result.modelListTruncated,true);assert.match(result.message,/gemini-listed-0/);assert.ok(!JSON.stringify(result).includes(google.apiKey));assert.ok(!JSON.stringify(result).includes('<script>'));assert.equal(result.availableModels[0],'gemini-listed-0');
});

test('Gemini rejects missing credentials, native endpoint confusion and Responses before sending requests',async()=>{
  const google={baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-test',protocol:'chat',apiKey:'AQ.synthetic-test-key'};let calls=0;const fetcher=async()=>{calls++;throw Error('must not request');};
  for(const patch of [{apiKey:''},{protocol:'responses'},{baseUrl:'https://generativelanguage.googleapis.com/v1beta'}]){const result=await testAgentConnection({...google,...patch},{},fetcher);assert.equal(result.stage,'configuration');assert.equal(result.ok,false);}
  assert.match((await testAgentConnection({...google,protocol:'responses'},{},fetcher)).message,/Chat Completions/);
  await assert.rejects(completeWithProvider({...google,protocol:'responses'},{messages:[]},fetcher),/Chat Completions/);assert.equal(calls,0);
});
test('diagnostics identify omitted versus rejected credentials and hide provider error and malformed response bodies',async()=>{
  let calls=0;const missing=await testAgentConnection(config,{},async()=>{calls++;});assert.equal(missing.keyProvided,false);assert.equal(missing.stage,'configuration');assert.equal(calls,0);
  const rejected=await testAgentConnection({...config,apiKey:'provider-secret'},{},async()=>new Response('Invalid key: provider-secret',{status:401}));assert.equal(rejected.httpStatus,401);assert.equal(rejected.keyProvided,true);assert.ok(!JSON.stringify(rejected).includes('provider-secret'));
  for(const response of [new Response('provider-secret'),new Response(JSON.stringify({error:'provider-secret'})),new Response('x'.repeat(1024*1024+1))]){const result=await testAgentConnection({...config,apiKey:'provider-secret'},{},async()=>response);assert.equal(result.stage,'response');assert.ok(!JSON.stringify(result).includes('provider-secret'));}
});
test('diagnostic draft resolution reuses keys only for the same normalized endpoint and does not mutate or persist settings',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'materia-connection-')),settings=new AgentSettings(folder,{isEncryptionAvailable:()=>false});await settings.load();await settings.save({...config,apiKey:'synthetic-test-key'});const before=await readFile(settings.file);
  assert.equal(settings.resolve({...config,baseUrl:config.baseUrl+'/chat/completions',apiKey:''}).apiKey,'synthetic-test-key');assert.equal(settings.resolve({...config,baseUrl:'https://other.example/v1',apiKey:''}).apiKey,'');assert.equal(settings.resolve({...config,apiKey:'',clearKey:true}).apiKey,'');assert.equal(settings.config.apiKey,'synthetic-test-key');assert.deepEqual(await readFile(settings.file),before);
});
test('401 distinguishes a rejected credential from an omitted one without echoing provider response bodies',async()=>{
  assert.match(agentHTTPError(401,false),/未提供/);assert.match(agentHTTPError(401,true),/未接受/);assert.match(agentHTTPError(403,true),/访问权限/);assert.match(agentHTTPError(402,true),/余额不足/);
  await assert.rejects(completeWithProvider({...config,apiKey:'provider-secret'},{messages:[]},async()=>new Response('wrong key: provider-secret',{status:401})),error=>error.message.includes('401')&&error.message.includes('未接受')&&!error.message.includes('provider-secret'));
});
test('session-only credentials become an explicit missing-key state after restart without being written to disk',async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),'materia-auth-')),settings=new AgentSettings(folder,{isEncryptionAvailable:()=>false});await settings.load();await settings.save({...config,apiKey:'synthetic-test-key'});assert.equal(agentCredentialIssue(settings.publicConfig()),'');const reopened=new AgentSettings(folder,{isEncryptionAvailable:()=>false});const state=await reopened.load();assert.match(agentCredentialIssue(state),/重新填写/);assert.equal(state.hasKey,false);assert.ok(!(await readFile(settings.file,'utf8')).includes('synthetic-test-key'));
});

