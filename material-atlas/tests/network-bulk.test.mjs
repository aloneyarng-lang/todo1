import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createNetwork, stepNetwork, networkSnapshot, cleanLayout } from '../dist/force-layout.js';
import { tagGroups } from '../dist/graph.js';
import { filterCatalog, impactOf, parseMetrics } from '../dist/catalog.js';
import { planBulkEdit } from '../dist/bulk-edit.js';
import { LocalLibrary } from '../desktop/library.mjs';
import { BUNDLED_METRICS, seedJournalMetrics } from '../dist/journal-data.js';
import { cleanAssociations } from '../dist/associations.js';

const records = ['a','b','c','d'].map((id,index)=>({id,title:`Paper ${id}`,tags:index<3?['Shared',...(index<2?['Rare']:[])]:[],collection:'',year:String(2020+index),measurements:[{name:'Strength',value:100+index,unit:'MPa'}]}));

test('default graph has only papers; manually added nodes alone create explicit links including rare tags',()=>{
  const groups=tagGroups(records), graph=createNetwork(records,groups);
  assert.equal(graph.nodes.length,4);
  assert.equal(graph.edges.length,0);
  const rules=cleanAssociations([{kind:'tag',value:'Shared'},{kind:'tag',value:'Rare'}]);
  const linked=createNetwork(records,groups,{},rules);
  assert.deepEqual(linked.nodes.filter(node=>node.type==='relation').map(node=>node.tag),['Shared','Rare']);
  assert.equal(linked.edges.length,5);
  assert.equal(linked.edges.some(edge=>edge.source.paper.id==='d'),false);
  const subset=createNetwork(records.slice(0,1),groups,{},rules.slice(0,1));
  assert.equal(subset.edges.length,1);
  assert.equal(subset.edges[0].target.tag,'Shared');
  assert.equal(createNetwork(records.slice(0,2),tagGroups(records.slice(0,2))).edges.length,0);
  const hiddenTags = createNetwork(records, []);
  assert.equal(hiddenTags.nodes.filter(node=>node.type==='paper').length,4);
  assert.equal(hiddenTags.edges.length,0);
});

test('force layout remains finite, preserves dragged pins and reloads coordinates for filtered nodes',()=>{
  const groups=tagGroups(records), graph=createNetwork(records,groups,{'paper:a':{x:300,y:220,pinned:true}});
  const original=graph.byId.get('paper:b').x;
  for(let frame=0;frame<180;frame++)stepNetwork(graph,.7);
  assert.equal(graph.byId.get('paper:a').x,300);
  assert.equal(graph.byId.get('paper:a').y,220);
  assert.notEqual(graph.byId.get('paper:b').x,original);
  assert.ok(graph.nodes.every(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)));
  const snapshot=networkSnapshot(graph), subset=createNetwork([records[0]],groups,snapshot);
  assert.equal(subset.byId.get('paper:a').pinned,true);
  assert.equal(subset.byId.get('paper:a').x,300);
  assert.deepEqual(cleanLayout({'bad':{x:1,y:2},'paper:x':{x:NaN,y:1},'tag:ok':{x:1,y:2,pinned:true}}),{'tag:ok':{x:1,y:2,pinned:true}});
});

test('hidden nodes and excluded tags are removed from results without changing source data',()=>{
  assert.deepEqual(filterCatalog(records,{hiddenIds:new Set(['a']),filters:{tags:['Shared']}}).map(row=>row.id),['b','c']);
  assert.deepEqual(filterCatalog(records,{filters:{excludeTags:['Rare']}}).map(row=>row.id),['c','d']);
  assert.equal(records.length,4);
  assert.ok(records[0].tags.includes('Rare'));
});

test('bulk tag operations and grouping touch only selected fields and validate the whole plan',()=>{
  const add=planBulkEdit(records,[],['a','b'],{tagMode:'append',tags:['New','New'],groupMode:'new',groupName:'Group A'},'folder-new');
  assert.equal(add.updates.length,2);
  assert.deepEqual(add.updates[0].tags,['Shared','Rare','New']);
  assert.equal(add.collection.name,'Group A');
  assert.equal(add.updates[0].collection,'folder-new');
  assert.deepEqual(add.updates[0].measurements,records[0].measurements);
  assert.deepEqual(records[0].tags,['Shared','Rare']);
  assert.deepEqual(planBulkEdit(records,[],['a'],{tagMode:'remove',tags:['Rare']},'x').updates[0].tags,['Shared']);
  assert.deepEqual(planBulkEdit(records,[],['a'],{tagMode:'replace',tags:[]},'x').updates[0].tags,[]);
  assert.throws(()=>planBulkEdit(records,[],['a','missing'],{tagMode:'replace',tags:['New']},'x'),/不存在/);
  assert.throws(()=>planBulkEdit(records,[],['a'],{groupMode:'set',collection:'missing'},'x'),/不存在/);
  assert.throws(()=>planBulkEdit(records,[],['a'],{tagMode:'append',tags:Array.from({length:30},(_,i)=>'T'+i)},'x'),/超过 30/);
});

test('desktop bulk edit atomically persists a new group and keeps PDF, notes and measurement data',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});
  const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'bulk-'))).init();
  const bytes=Buffer.from('%PDF-1.4\n% Bulk metadata fixture\n%%EOF');
  await lib.putPapers(records.map(record=>({...record,fileBytes:bytes})));
  await lib.setSetting('notes',{'paper:a':[{id:'n',body:'Preserved',createdAt:1,updatedAt:1}]});
  assert.equal((await lib.bulkEdit(['a','b'],{tagMode:'append',tags:['New'],groupMode:'new',groupName:'Group A'})).count,2);
  const current=await new LocalLibrary(lib.root).init();
  const group=current.getSetting('collections')[0];
  assert.equal(current.getPapers().find(row=>row.id==='a').collection,group.id);
  assert.equal(current.getPapers().find(row=>row.id==='c').collection,'');
  assert.equal(current.getSetting('notes')['paper:a'][0].body,'Preserved');
  assert.equal(current.getPapers().find(row=>row.id==='a').materials[0].measurements[0].value,100);
  assert.deepEqual(Buffer.from(await current.readPdf('a')),bytes);
  const before=await readFile(path.join(lib.root,'library.json'),'utf8');
  await assert.rejects(current.bulkEdit(['a','missing'],{tagMode:'replace',tags:['Bad']}));
  assert.equal(await readFile(path.join(lib.root,'library.json'),'utf8'),before);
});

test('verified journal bundle has metric years and sources, preserves user records and supports IF matching',()=>{
  assert.equal(parseMetrics(JSON.stringify(BUNDLED_METRICS)).length,17);
  assert.ok(BUNDLED_METRICS.every(row=>row.year==='2025'&&row.source.startsWith('https://')));
  const manual={journal:'Nature Communications',impactFactor:99,year:'2025',source:'User input'};
  const merged=seedJournalMetrics([manual]);
  assert.equal(merged.length,17);
  assert.equal(merged[0].impactFactor,99);
  assert.equal(impactOf({journal:'Journal of Materials Science & Technology'},merged).value,16.8);
  assert.equal(impactOf({journal:'Unknown'},merged),null);
  assert.deepEqual(seedJournalMetrics(merged),merged);
});
