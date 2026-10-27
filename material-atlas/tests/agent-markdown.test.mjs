import test from 'node:test';
import assert from 'node:assert/strict';
import { renderChatMarkdown } from '../dist/agent-markdown.js';

test('chat Markdown renders headings, emphasis, nested lists, tables, quotes and fenced code',()=>{
  const html=renderChatMarkdown(['## 研究结论','','**证据**与*推断*、~~旧结论~~','','1. 已核验','   - 子项目','','> 保留测试条件','','| 样品 | 强度 |','| --- | ---: |','| A | 1000 MPa |','','```js','const sample = "<A>";','```'].join('\n'));
  for(const pattern of [/<h2>研究结论<\/h2>/,/<strong>证据<\/strong>/,/<em>推断<\/em>/,/<s>旧结论<\/s>/,/<ol>/,/<ul>/,/<blockquote>/,/agent-table-scroll/,/<table>/,/<code class="language-js">/,/&lt;A&gt;/])assert.match(html,pattern);
});
test('source references remain clickable outside code and ordinary Markdown links retain their destination',()=>{
  const sources=[{id:'p1',title:'文献 A'},{id:'p2',title:'文献 B'}];
  const html=renderChatMarkdown(['**来源 [p1][p2]** 与 [unknown]','`[p1]`','','```text','[p2]','```','','[p1](https://example.com/paper)'].join('\n'),sources);
  assert.equal((html.match(/class="agent-citation"/g)||[]).length,2);
  assert.match(html,/<code>\[p1\]<\/code>/);assert.match(html,/>\[p2\]\n<\/code>/);assert.match(html,/\[unknown\]/);
  assert.match(html,/<a href="https:\/\/example.com\/paper" target="_blank" rel="noopener noreferrer">p1<\/a>/);
});
test('untrusted Markdown cannot emit HTML, executable links, remote images or source attributes',()=>{
  const html=renderChatMarkdown('<img src=x onerror=alert(1)>\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n[x](data:text/html,evil)\n[x](file:///C:/private)\n![external](https://example.com/track)\n[p1]',[{id:'p1',title:'<img src=x onerror="evil">'}]);
  assert.ok(!/<(?:img|script|iframe|svg)\b/i.test(html));assert.ok(!/<a\b[^>]*href="(?:javascript|data|file):/i.test(html));
  assert.match(html,/&lt;script&gt;/);assert.match(html,/\[图片：external\]/);assert.match(html,/&lt;img src=x onerror=&quot;evil&quot;&gt;/);
});
