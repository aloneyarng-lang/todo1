import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {paperActionTargets} from '../dist/paper-actions.js';
import {LocalLibrary} from '../desktop/library.mjs';

test('context targets only the clicked unselected paper, but the whole checked set when right-clicking one of multiple checked papers',()=>{
  const papers=['a','b','c'].map(id=>({id})),selection=new Set(['a','b','missing']);
  assert.deepEqual(paperActionTargets(papers,selection,'a'),['a','b']);
  assert.deepEqual(paperActionTargets(papers,selection,'c'),['c']);
  assert.deepEqual(paperActionTargets(papers,new Set(['a']),'b'),['b']);
  assert.deepEqual(paperActionTargets(papers,selection,'missing'),[]);
  const captured=paperActionTargets(papers,selection,'a');selection.clear();assert.deepEqual(captured,['a','b']);
});

test('single and bulk folder moves, create-and-join and detaching persist independently from stars, PDFs, notes and metadata',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(path.join(parent,'paper-folders-'));
  let lib=await new LocalLibrary(root).init();
  const bytes=Buffer.from('%PDF-1.4\n% folders fixture\n%%EOF');
  await lib.putPapers(['a','b'].map(id=>({id,title:`Paper ${id}`,favorite:id==='a',tags:['Original'],authorDetails:[{name:'Ada',affiliations:['Institute']}],measurements:[{name:'Strength',value:10,unit:'MPa'}],fileBytes:bytes})));
  const notes={'paper:a':[{id:'n',body:'Preserved comment',createdAt:1,updatedAt:1}]};await lib.setSetting('notes',notes);
  await lib.setSetting('collections',[{id:'first',name:'Existing folder',color:'#397d78'}]);
  const original=lib.getPapers();
  await lib.bulkEdit(['a'],{groupMode:'set',collection:'first'});assert.equal(lib.getPapers()[0].collection,'first');assert.equal(lib.getPapers()[1].collection,'');
  await lib.bulkEdit(['a','b'],{groupMode:'new',groupName:'New theme'});const theme=lib.getSetting('collections').find(c=>c.name==='New theme');assert.ok(theme);assert.ok(lib.getPapers().every(p=>p.collection===theme.id));
  await lib.bulkEdit(['a'],{groupMode:'new',groupName:'New theme'});assert.equal(lib.getSetting('collections').length,2);
  await lib.bulkEdit(['a','b'],{groupMode:'set',collection:''});
  lib=await new LocalLibrary(root).init();assert.equal(lib.getPapers().length,2);assert.deepEqual(lib.getPapers(),original);assert.deepEqual(lib.getSetting('notes'),notes);assert.deepEqual(Buffer.from(await lib.readPdf('a')),bytes);assert.equal(lib.getSetting('collections').length,2);
  await assert.rejects(lib.bulkEdit(['a','missing'],{groupMode:'new',groupName:'Must not appear'}));assert.equal(lib.getSetting('collections').length,2);assert.deepEqual(lib.getPapers(),original);
});
