import test from 'node:test';
import assert from 'node:assert/strict';
import {completedChatContext,retryQuestion,chatMarkdown} from '../dist/agent-chat-utils.js';

test('follow-up context keeps completed exchanges and excludes failed, interrupted and repeated questions',()=>{
  const entries=[{role:'user',content:'已完成问题'},{role:'assistant',content:'回答'},{role:'user',content:'失败问题'},{role:'error',content:'HTTP 401'},{role:'user',content:'重试问题'},{role:'error',content:'停止'},{role:'user',content:'尚未回答'}];
  assert.deepEqual(completedChatContext(entries),entries.slice(0,2));assert.equal(retryQuestion(entries,3),'失败问题');assert.equal(retryQuestion(entries,5),'重试问题');assert.equal(retryQuestion(entries,1),'');
});
test('Markdown export preserves raw content and deduplicates sources without including configuration secrets',()=>{
  const chat={title:'合金 **对比**',scopeIds:['p1'],apiKey:'synthetic-test-key',entries:[{role:'user',content:'比较强度'},{role:'assistant',content:'## 结论\n\n**原始数据** [p1]\n\n```text\n1000 MPa\n```',sources:[{id:'p1',title:'合金 A',year:'2024',doi:'10.1234/test'},{id:'p2',title:'合金 B',doi:'javascript:bad'}]},{role:'assistant',content:'后续回答',sources:[{id:'p1',title:'合金 A',doi:'10.1234/test'}]}]};
  const output=chatMarkdown(chat);assert.match(output,/## 结论/);assert.match(output,/```text\n1000 MPa/);assert.equal((output.match(/\*\*p1\*\*/g)||[]).length,1);assert.match(output,/https:\/\/doi.org\/10.1234\/test/);assert.ok(!output.includes('synthetic-test-key'));assert.ok(!output.includes('javascript:bad'));
});
