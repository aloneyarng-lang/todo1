import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import {normalizeNotes,normalizeAnchor,normalizeAttachments,rectFromPoints,anchorMatchesPaper,cleanReaderState} from '../dist/note-model.js';
import {createBackup,readBackup} from '../dist/storage.js';
import {LocalLibrary} from '../desktop/library.mjs';
import {renameTitleLinks,backlinks} from '../dist/note-links.js';
import {mergeImportNotes} from '../dist/import-plan.js';
import {filterCatalog} from '../dist/catalog.js';
const fingerprint='a'.repeat(64),bytes=Buffer.from('%PDF-1.4\n% reader fixture\n%%EOF');
const image={id:'img-test',name:'micrograph.png',dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=',width:1,height:1};
const anchor={page:2,rect:{x:.1,y:.2,width:.3,height:.1},color:'yellow',fingerprint};
const legacy={id:'plain',body:'Whole-paper note [[#Alloy]]',createdAt:1,updatedAt:2};
const annotated={id:'marked',body:'Area annotation [[Title B]]',anchor,attachments:[image],createdAt:3,updatedAt:4};
const notes={'paper:a':[legacy,annotated],'tag:Alloy':[{id:'tag-note',body:'Tag note',createdAt:1,updatedAt:2}]};
globalThis.FileReader=class{async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onload();}};
const paper={id:'a',title:'Title A',tags:['Alloy'],measurements:[],filename:'a.pdf'};
test('legacy notes keep their shape; annotations and image-only notes share the same note collection',()=>{
  const result=normalizeNotes(notes);assert.deepEqual(result,notes);assert.deepEqual(result['paper:a'][0],legacy);
  const onlyImage=normalizeNotes({'paper:a':[{id:'i',body:'',attachments:[image],createdAt:1,updatedAt:1}]});assert.equal(onlyImage['paper:a'][0].attachments.length,1);assert.equal(onlyImage['paper:a'][0].anchor,undefined);
});
test('drawing works in every direction, clips outside points and creates a bounded position marker for a click',()=>{
  assert.deepEqual(rectFromPoints({x:.4,y:.3},{x:.1,y:.1}),{x:.1,y:.1,width:.30000000000000004,height:.19999999999999998});
  for(const[start,end]of [[{x:1,y:1},{x:1,y:1}],[{x:-2,y:-2},{x:3,y:3}],[{x:0,y:0},{x:.1,y:0}]]){const rect=rectFromPoints(start,end);assert.doesNotThrow(()=>normalizeAnchor({page:1,rect}));assert.ok(rect.x+rect.width<=1);assert.ok(rect.y+rect.height<=1);}
  assert.throws(()=>normalizeAnchor({...anchor,rect:{...anchor.rect,x:2}}),/位置/);assert.throws(()=>normalizeAnchor({...anchor,page:0}),/位置/);assert.throws(()=>normalizeAnchor({...anchor,rect:{...anchor.rect,y:NaN}}),/位置/);
});
test('document fingerprints keep marks off replacement PDFs without discarding their contents',()=>{
  assert.equal(anchorMatchesPaper(anchor,{fingerprint}),true);assert.equal(anchorMatchesPaper(anchor,{fingerprint:'b'.repeat(64)}),false);assert.equal(anchorMatchesPaper({...anchor,fingerprint:''},{fingerprint}),true);
  assert.deepEqual(normalizeNotes(notes)['paper:a'][1],annotated);
});
test('invalid image formats, duplicate IDs, oversized images and malformed attachment arrays are rejected',()=>{
  for(const value of [[{...image,dataUrl:'data:image/svg+xml;base64,PHN2Zy8+'}],[{...image,dataUrl:'data:image/png;base64,YmFk'}],[image,image],Array(7).fill(image),[{...image,dataUrl:'data:image/png;base64,'+'A'.repeat(1400001)}]])assert.throws(()=>normalizeAttachments(value));
  assert.throws(()=>normalizeNotes({'paper:a':[{...legacy,attachments:{}}]}),/图片/);assert.throws(()=>normalizeNotes({'paper:a':[{...legacy,anchor:{}}]}),/位置/);
});
test('notes remain searchable, wiki-linked and compatible with metadata updates while retaining mark and picture fields',()=>{
  assert.equal(filterCatalog([paper],{searchScope:'notes',query:'Area annotation'},notes).length,1);assert.equal(filterCatalog([paper],{searchScope:'notes',query:'micrograph.png'},notes).length,1);
  const renamed=renameTitleLinks(notes,'Title B','New B');assert.match(renamed['paper:a'][1].body,/\[\[New B\]\]/);assert.deepEqual(renamed['paper:a'][1].attachments,[image]);assert.deepEqual(renamed['paper:a'][1].anchor,anchor);
  assert.equal(backlinks(notes,'paper','b',[paper,{id:'b',title:'Title B'}]).length,1);
  const merged=mergeImportNotes(notes,[{owner:'paper:a',body:'MD note'}]);assert.equal(merged['paper:a'].length,3);assert.deepEqual(merged['paper:a'][1],annotated);
});
test('complete backup restores image bytes, page coordinates and old notes together',async()=>{
  const backed=await createBackup([{...paper,file:new Blob([bytes],{type:'application/pdf'})}],[],notes,[]),restored=readBackup(JSON.parse(JSON.stringify(backed)));assert.deepEqual(restored.notes,notes);assert.equal(await restored.papers[0].file.text(),bytes.toString());
  const corrupt=structuredClone(backed);corrupt.notes['paper:a'][1].attachments[0].dataUrl='data:image/jpeg;base64,YmFk';assert.throws(()=>readBackup(corrupt),/不一致/);
});
test('disk reopen, bulk remove/undo and backup merge preserve every mark/image without changing PDF bytes',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'reader-'))).init();await lib.putPapers([{...paper,fileBytes:bytes}]);await lib.setSetting('notes',notes);await lib.setSetting('readerState',{'a':{page:2,zoom:'fit'}});
  const before=await readFile(path.join(lib.root,'library.json'),'utf8');await assert.rejects(lib.setSetting('notes',{'paper:a':[{...annotated,attachments:[{...image,dataUrl:'invalid'}]}]}));assert.equal(await readFile(path.join(lib.root,'library.json'),'utf8'),before);
  const removed=await lib.deletePapers(['a']);await lib.restorePapers(removed.id);const reopened=await new LocalLibrary(lib.root).init();assert.deepEqual(reopened.getSetting('notes'),notes);assert.deepEqual(Buffer.from(await reopened.readPdf('a')),bytes);assert.deepEqual(reopened.getSetting('readerState'),{a:{page:2,zoom:'fit'}});
  const target=await new LocalLibrary(await mkdtemp(path.join(parent,'reader-restore-'))).init();await target.mergeBackup({papers:[{...paper,fileBytes:bytes}],collections:[],notes,journalMetrics:[]});assert.deepEqual(target.getSetting('notes'),notes);
});
test('reader state sanitizes scale and preserves valid per-paper pages',()=>{assert.deepEqual(cleanReaderState({a:{page:5,zoom:'fit'},b:{page:2,zoom:10},bad:{page:-1},'../wrong':{page:1}}),{a:{page:5,zoom:'fit'},b:{page:2,zoom:3}});});
test('hot-refreshing against an old desktop backend blocks rich note writes and restores before it can strip fields',async()=>{
  let writes=0;globalThis.materiaDesktop={info:async()=>({}),setSetting:async()=>{writes++;},mergeBackup:async()=>{writes++;}};
  try{const old=await import('../dist/storage.js?legacy-reader-test');await assert.rejects(old.setSetting('notes',notes),/重新打开/);await assert.rejects(old.mergeBackup({papers:[],notes}),/重新打开/);assert.equal(writes,0);await old.setSetting('notes',{'paper:a':[legacy]});assert.equal(writes,1);
    globalThis.materiaDesktop={info:async()=>({readerNotesVersion:1}),setSetting:async()=>{writes++;}};const current=await import('../dist/storage.js?current-reader-test');await current.setSetting('notes',notes);assert.equal(writes,2);
  }finally{delete globalThis.materiaDesktop;}
});
