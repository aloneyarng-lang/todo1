import test from 'node:test';
import assert from 'node:assert/strict';
import {relatedPaperGroups,relatedPaperSections} from '../dist/related-papers.js';

const paper=(id,extra={})=>({id,title:id,tags:[],authorDetails:[],addedAt:0,...extra});
const author=(name,affiliations=[])=>({name,affiliations});

test('Tag recommendations use all shared tags, count each once and rank overlap before recency',()=>{
  const current=paper('current',{tags:['A','B','Rare','A']}),records=[current,paper('recent',{tags:['A'],addedAt:99}),paper('most',{tags:['A','B','A','B'],addedAt:1}),paper('rare',{tags:['Rare'],addedAt:2}),paper('none',{tags:['Other']})];
  const before=structuredClone(records),groups=relatedPaperGroups(records,current);
  assert.deepEqual(groups.tags.map(item=>[item.paper.id,item.tags.length]),[['most',2],['recent',1],['rare',1]]);
  assert.deepEqual(groups.tags[0].tags,['A','B']);assert.equal(groups.people.length,0);assert.deepEqual(records,before);
});

test('author and institution links stay distinct from Tags, normalize names and retain both reasons',()=>{
  const current=paper('current',{authorDetails:[author('Alice Smith',['Lab X','Lab X'])],tags:['A']});
  const records=[current,paper('institution',{authorDetails:[author('Other',[' lab   x '])],addedAt:99}),paper('author',{authorDetails:[author('ＡＬＩＣＥ  Smith')]}),paper('both',{authorDetails:[author('alice smith',['LAB X'])],tags:['A']}),paper('empty',{authorDetails:[author(' ',[' '])]})];
  const groups=relatedPaperGroups(records,current);
  assert.deepEqual(groups.people.map(item=>item.paper.id),['both','author','institution']);assert.deepEqual(groups.people[0].authors,['Alice Smith']);assert.deepEqual(groups.people[0].institutions,['Lab X']);
  assert.deepEqual(groups.tags.map(item=>item.paper.id),['both']);assert.equal(groups.people[2].authors.length,0);
});

test('legacy author lists are supported, structured names take precedence and empty metadata never links',()=>{
  const current=paper('current',{authors:'Ada, Bo; Carol'}),records=[current,paper('legacy',{authors:'BO；Someone'}),paper('structured',{authors:'Ada',authorDetails:[author('Unrelated')]}),paper('empty')];
  assert.deepEqual(relatedPaperGroups(records,current).people.map(item=>item.paper.id),['legacy']);
  assert.deepEqual(relatedPaperGroups([paper('a'),paper('b')],paper('a')),{people:[],tags:[]});assert.deepEqual(relatedPaperGroups(records,null),{people:[],tags:[]});
  const ties=[paper('z',{tags:['T'],title:'Z'}),paper('a',{tags:['T'],title:'A'})];assert.deepEqual(relatedPaperGroups(ties,paper('other',{tags:['T']})).tags.map(item=>item.paper.id),['a','z']);
});

test('grouped recommendations show reasons, safely escape metadata and allow remaining ranked results to expand',()=>{
  const current=paper('current',{tags:['<Tag>'],authorDetails:[author('<Author>',['<Lab>'])]}),records=Array.from({length:5},(_,index)=>paper('p'+index,{title:'<img onerror=bad>',tags:['<Tag>'],authorDetails:[author('<Author>',['<Lab>'])]}));
  const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const html=relatedPaperSections(relatedPaperGroups(records,current),esc);
  assert.match(html,/作者 \/ 机构关联/);assert.match(html,/Tag 关联/);assert.match(html,/重合 1 个 Tag/);assert.match(html,/共同作者：&lt;Author&gt;/);assert.match(html,/共同机构：&lt;Lab&gt;/);
  assert.match(html,/展开其余 2 篇/);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<Tag>'));assert.equal((html.match(/data-related=/g)||[]).length,10);
});
