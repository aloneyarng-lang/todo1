import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rename,access} from 'node:fs/promises';
import path from 'node:path';
import {LocalLibrary} from '../desktop/library.mjs';
import {READING_STATUSES,readingStatusOf,planReadingStatus,readingStatusCounts,preserveReadingStatus} from '../dist/reading-status.js';
import {filterCatalog} from '../dist/catalog.js';
import {createBackup,readBackup} from '../dist/storage.js';
const base=path.resolve('.local/tests');await mkdir(base,{recursive:true});
const fresh=async()=>new LocalLibrary(await mkdtemp(path.join(base,'reading-status-'))).init();
const pdf=name=>Buffer.from('%PDF-1.4\n% '+name+'\n%%EOF');
const withoutStatus=p=>{const {readingStatus,...rest}=p;return rest;};
globalThis.FileReader=class{async readAsDataURL(blob){try{this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onload();}catch(error){this.error=error;this.onerror();}}};

test('legacy papers default to unread and status filters combine independently with folder and tag filters',()=>{
  const papers=[{id:'a',title:'A',tags:['T'],collection:'folder-a'},{id:'b',title:'B',tags:['T'],collection:'folder-a',readingStatus:'reading'},{id:'c',title:'C',tags:['T'],collection:'folder-b',readingStatus:'reading'},{id:'d',title:'D',tags:[],collection:'folder-b',readingStatus:'studied'},{id:'e',title:'E',tags:[],collection:'folder-a',readingStatus:'archived'}],before=structuredClone(papers);
  assert.equal(readingStatusOf(papers[0]),'unread');assert.deepEqual(readingStatusCounts(papers),{unread:1,reading:2,studied:1,archived:1});
  assert.deepEqual(filterCatalog(papers,{collection:'folder-a',readingStatus:'reading'}).map(p=>p.id),['b']);assert.deepEqual(filterCatalog(papers,{readingStatus:'archived'}).map(p=>p.id),['e']);assert.deepEqual(filterCatalog(papers,{readingStatus:'reading',filters:{tags:['T']}}).map(p=>p.id),['b','c']);assert.deepEqual(papers,before);
  assert.deepEqual(filterCatalog([...papers].reverse(),{sort:'reading-status'}).map(p=>readingStatusOf(p)),['unread','reading','reading','studied','archived']);
  assert.throws(()=>planReadingStatus(papers,['a','missing'],'studied'),/不存在/);assert.throws(()=>planReadingStatus(papers,['a'],'unknown'),/无效/);assert.equal(planReadingStatus(papers,['a','a'],'reading').count,1);assert.equal(planReadingStatus(papers,['a'],'unread').count,0);
});
test('all four statuses persist across reopen while keeping PDF locations, groups, notes, metadata and import activity unchanged',async()=>{
  const lib=await fresh();await lib.setSetting('collections',[{id:'folder-a',name:'物理分组',color:'#005bac'}]);await lib.putPapers([{id:'paper-a',title:'Original paper',filename:'original.pdf',collection:'folder-a',tags:['Original'],addedAt:12345,fileBytes:pdf('one')}]);await lib.setSetting('notes',{'paper:paper-a':[{id:'note',body:'Original note',createdAt:1,updatedAt:1}]});
  const original=structuredClone(lib.data.papers[0]),notes=structuredClone(lib.getSetting('notes')),groups=structuredClone(lib.getSetting('collections')),activity=structuredClone(lib.getSetting('importActivity')),bytes=await lib.readPdf('paper-a');
  for(const status of READING_STATUSES){await lib.setReadingStatus(['paper-a'],status.id);const reopened=await new LocalLibrary(lib.root).init(),paper=reopened.data.papers[0];assert.equal(readingStatusOf(paper),status.id);assert.deepEqual(withoutStatus(paper),withoutStatus(original));assert.deepEqual(reopened.getSetting('notes'),notes);assert.deepEqual(reopened.getSetting('collections'),groups);assert.deepEqual(reopened.getSetting('importActivity'),activity);assert.deepEqual(await reopened.readPdf('paper-a'),bytes);}
});
test('folder moves and stale metadata updates preserve reading state, and bulk status changes are atomic',async()=>{
  const lib=await fresh();await lib.setSetting('collections',[{id:'folder-a',name:'A',color:'#005bac'},{id:'folder-b',name:'B',color:'#705095'}]);await lib.putPapers([{id:'a',title:'A',filename:'a.pdf',collection:'folder-a',fileBytes:pdf('a')},{id:'b',title:'B',filename:'b.pdf',collection:'folder-b',fileBytes:pdf('b')}]);await lib.setReadingStatus(['a','b'],'studied');
  const before=structuredClone(lib.data.papers);await assert.rejects(lib.setReadingStatus(['a','missing'],'archived'),/不存在/);assert.deepEqual(lib.data.papers,before);
  await rename(path.join(lib.root,lib.data.papers[0].pdfPath),path.join(lib.root,'papers/B/a.pdf'));await lib.syncFolders();assert.equal(lib.data.papers[0].collection,'folder-b');assert.equal(lib.data.papers[0].readingStatus,'studied');
  const stale=withoutStatus(lib.getPapers()[0]);await lib.putPapers([{...stale,title:'Updated metadata'}]);assert.equal(lib.data.papers[0].readingStatus,'studied');
  await lib.bulkEdit(['a'],{groupMode:'set',collection:'folder-a'});assert.equal(lib.data.papers[0].readingStatus,'studied');assert.equal(lib.data.papers[0].collection,'folder-a');await lib.setReadingStatus(['a'],'archived');await access(path.join(lib.root,'papers/A/a.pdf'));assert.equal(lib.data.papers[0].collection,'folder-a');
});
test('reading states survive removal, restore and complete backups; older backups preserve an existing status',async()=>{
  const lib=await fresh();await lib.putPapers([{id:'a',title:'A',filename:'a.pdf',fileBytes:pdf('a')}]);await lib.setReadingStatus(['a'],'reading');const receipt=await lib.deletePapers(['a']);await lib.restorePapers(receipt.id);assert.equal(lib.data.papers[0].readingStatus,'reading');
  const papers=await Promise.all(lib.getPapers().map(async p=>({...p,file:new Blob([await lib.readPdf(p.id)],{type:'application/pdf'})}))),backup=await createBackup(papers,lib.getSetting('collections'),lib.getSetting('notes'));
  const clean=readBackup(JSON.parse(JSON.stringify(backup)));assert.equal(clean.papers[0].readingStatus,'reading');const restored=await fresh();await restored.mergeBackup({...clean,papers:await Promise.all(clean.papers.map(async p=>({...p,fileBytes:await p.file.arrayBuffer()})))});assert.equal(restored.data.papers[0].readingStatus,'reading');
  delete clean.papers[0].readingStatus;await restored.setReadingStatus(['a'],'archived');await restored.mergeBackup({...clean,papers:await Promise.all(clean.papers.map(async p=>({...p,fileBytes:await p.file.arrayBuffer()})))});assert.equal(restored.data.papers[0].readingStatus,'archived');assert.equal(preserveReadingStatus({id:'a'},{readingStatus:'reading'}).readingStatus,'reading');
});
