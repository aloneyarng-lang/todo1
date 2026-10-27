import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {normalizeAnchor,normalizeNotes} from '../dist/note-model.js';
import {gestureAnnotation,transformAnnotation,annotationHTML} from '../dist/reader-annotations.js';
import {createBackup,readBackup} from '../dist/storage.js';
import {LocalLibrary} from '../desktop/library.mjs';
import {filterCatalog} from '../dist/catalog.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bytes=Buffer.from('%PDF-1.4\n% annotation fixture\n%%EOF'),paper={id:'a',title:'Paper A',tags:[],measurements:[],filename:'a.pdf'};
globalThis.FileReader=class{async readAsDataURL(blob){this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onload();}};
test('legacy rectangles remain byte-for-byte compatible while text labels and arrows retain their independent fields',()=>{
  const old={page:1,rect:{x:.1,y:.2,width:.3,height:.1},color:'yellow',fingerprint:''};assert.deepEqual(normalizeAnchor(old),old);
  const text={...gestureAnnotation('text',2,{x:.1,y:.1},{x:.1,y:.1}),label:'Page caption',fontSize:18};assert.equal(normalizeAnchor(text).label,'Page caption');assert.equal(normalizeAnchor(text).fontSize,18);
  assert.throws(()=>normalizeAnchor({...text,label:'x'.repeat(501)}),/500/);assert.throws(()=>normalizeAnchor({...text,fontSize:100}),/字号/);assert.throws(()=>normalizeAnchor({...text,kind:'unknown'}),/类型/);
});
test('arrows preserve every draw direction and reject invalid or identical endpoints',()=>{
  for(const end of [{x:.1,y:.1},{x:.9,y:.1},{x:.1,y:.9},{x:.9,y:.9},{x:.5,y:.1},{x:.9,y:.5}]){const anchor=gestureAnnotation('arrow',2,{x:.5,y:.5},end);assert.deepEqual(anchor.start,{x:.5,y:.5});assert.deepEqual(anchor.end,end);assert.equal(anchor.kind,'arrow');assert.ok(anchor.rect.width>0&&anchor.rect.height>0);}
  const base=gestureAnnotation('arrow',1,{x:.2,y:.2},{x:.5,y:.5});assert.throws(()=>normalizeAnchor({...base,end:base.start}),/端点/);assert.throws(()=>normalizeAnchor({...base,start:{x:NaN,y:0}}),/端点/);
  assert.doesNotThrow(()=>gestureAnnotation('arrow',1,{x:1,y:1},{x:1,y:1}));
});
test('moving an arrow tail leaves its target intact; whole-object moves and text resizing stay on the page',()=>{
  const arrow={...gestureAnnotation('arrow',2,{x:.2,y:.3},{x:.7,y:.5}),label:'Retained label'};
  const tail=transformAnnotation(arrow,.1,-.1,'start');assert.deepEqual(tail.end,arrow.end);assert.deepEqual(tail.start,{x:.3,y:.2});assert.equal(tail.label,arrow.label);
  const moved=transformAnnotation(arrow,2,2);assert.equal(moved.end.x,1);assert.ok(moved.start.x>=0&&moved.end.y<=1);
  const text=gestureAnnotation('text',1,{x:.85,y:.94},{x:.85,y:.94});const resized=transformAnnotation(text,2,2,'resize'),relocated=transformAnnotation(resized,-3,-3);assert.ok(resized.rect.x+resized.rect.width<=1);assert.ok(resized.rect.y+resized.rect.height<=1);assert.equal(relocated.rect.x,0);assert.equal(relocated.rect.y,0);
});
test('annotation SVG uses real page dimensions and escapes inline labels and identifiers',()=>{
  const arrow={...gestureAnnotation('arrow',1,{x:.1,y:.2},{x:.8,y:.7}),label:'<script>bad</script>'};const html=annotationHTML(arrow,'a"b',{escape:esc,selected:true,width:600,height:900});assert.match(html,/viewBox="0 0 600 900"/);assert.match(html,/M60 180L480 630/);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('data-annotation-handle="end"'));
});
test('caption text is searchable without placing it in the further comment body',()=>{
  const note={id:'n',body:'Further comment',anchor:{...gestureAnnotation('text',1,{x:.2,y:.2},{x:.2,y:.2}),label:'特殊界面机制'},createdAt:1,updatedAt:1};assert.equal(filterCatalog([paper],{searchScope:'notes',query:'特殊界面机制'},{'paper:a':[note]}).length,1);assert.equal(note.body,'Further comment');
});
test('full backup, disk reopen and bulk removal undo preserve text, arrows and their further comments',async()=>{
  const notes={'paper:a':[{id:'text',body:'Text discussion',anchor:{...gestureAnnotation('text',1,{x:.2,y:.2},{x:.2,y:.2}),label:'On-page text'},createdAt:1,updatedAt:1},{id:'arrow',body:'Arrow discussion',anchor:{...gestureAnnotation('arrow',2,{x:.2,y:.2},{x:.7,y:.6}),label:'Arrow caption'},createdAt:2,updatedAt:2}]};
  const encoded=await createBackup([{...paper,file:new Blob([bytes],{type:'application/pdf'})}],[],notes);assert.deepEqual(readBackup(JSON.parse(JSON.stringify(encoded))).notes,normalizeNotes(notes));
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'annotations-'))).init();await lib.putPapers([{...paper,fileBytes:bytes}]);await lib.setSetting('notes',notes);const removed=await lib.deletePapers(['a']);await lib.restorePapers(removed.id);const reopened=await new LocalLibrary(lib.root).init();assert.deepEqual(reopened.getSetting('notes'),notes);assert.deepEqual(Buffer.from(await reopened.readPdf('a')),bytes);
});
test('older desktop engines cannot silently strip new annotation fields from notes, drafts or restored backups',async()=>{
  let writes=0;globalThis.materiaDesktop={info:async()=>({readerNotesVersion:1}),setSetting:async()=>{writes++;},mergeBackup:async()=>{writes++;}};const note={id:'n',body:'Comment',anchor:gestureAnnotation('arrow',1,{x:.2,y:.2},{x:.5,y:.5}),createdAt:1,updatedAt:1};
  try{const storage=await import('../dist/storage.js?old-annotation-engine');await assert.rejects(storage.setSetting('notes',{'paper:a':[note]}),/重新启动/);await assert.rejects(storage.setSetting('readerDrafts',[{paperId:'a',note}]),/重新启动/);await assert.rejects(storage.mergeBackup({papers:[],notes:{'paper:a':[note]}}),/重新启动/);assert.equal(writes,0);}finally{delete globalThis.materiaDesktop;}
});
