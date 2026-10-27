import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import {visibleReaderPages,turnReaderPage,fitReaderScale,sameReaderNote} from '../dist/reader-layout.js';
import {cleanReaderState,cleanReaderDrafts} from '../dist/note-model.js';
import {LocalLibrary} from '../desktop/library.mjs';

test('spread pagination handles even/odd final pages, active right pages and a separate cover',()=>{
  assert.deepEqual(visibleReaderPages(2,5,'spread'),[1,2]);assert.deepEqual(visibleReaderPages(4,5,'spread'),[3,4]);assert.deepEqual(visibleReaderPages(5,5,'spread'),[5]);
  assert.deepEqual(visibleReaderPages(1,5,'book'),[1]);assert.deepEqual(visibleReaderPages(2,5,'book'),[2,3]);assert.deepEqual(visibleReaderPages(5,5,'book'),[4,5]);assert.deepEqual(visibleReaderPages(4,4,'book'),[4]);
  assert.deepEqual(visibleReaderPages(100,5,'spread'),[5]);assert.deepEqual(visibleReaderPages(-2,1,'book'),[1]);
});
test('navigation visits every page exactly once in groups and cannot pass document ends',()=>{
  for(const layout of ['single','spread','book'])for(let total=1;total<=12;total++){
    let page=1,visited=[];for(let step=0;step<20;step++){const pages=visibleReaderPages(page,total,layout);visited.push(...pages);const next=turnReaderPage(page,total,layout,1);if(pages.includes(next))break;page=next;}
    assert.deepEqual(visited,Array.from({length:total},(_,i)=>i+1));
    assert.equal(turnReaderPage(1,total,layout,-1),1);
    let previous=total;for(let step=0;step<20;step++){const next=turnReaderPage(previous,total,layout,-1);assert.ok(next>=1&&next<=total);if(next===1)break;assert.ok(next<previous);previous=next;}
  }
});
test('fitting a mixed portrait/landscape pair accounts for both widths, gutter and tallest page',()=>{
  const sizes=[{width:612,height:792},{width:792,height:612}];
  assert.equal(fitReaderScale(sizes,1422,800,'fit'),1);assert.equal(fitReaderScale(sizes,1422,396,'page'),.5);
  assert.equal(fitReaderScale([{width:600,height:800}],600,400,'page'),.5);
});
test('saved reading preferences keep layout, sidebar width and wheel behavior, while older records keep their shape',()=>{
  assert.deepEqual(cleanReaderState({a:{page:2,zoom:'fit'}}),{a:{page:2,zoom:'fit'}});
  assert.deepEqual(cleanReaderState({a:{page:4,zoom:'page',layout:'book',sidebarOpen:false,sidebarWidth:800,wheelTurn:true}}),{a:{page:4,zoom:'page',layout:'book',sidebarOpen:false,sidebarWidth:520,wheelTurn:true}});
  assert.equal(cleanReaderState({a:{page:1,zoom:1,layout:'unknown'}}).a.layout,undefined);
});
test('drafts preserve blank edits, images/anchors through shared validation and deduplicate by paper and note',()=>{
  const note={id:'n',body:'',createdAt:1,updatedAt:1,anchor:{page:2,rect:{x:.1,y:.2,width:.3,height:.1},color:'blue',fingerprint:''}};
  const row={paperId:'a',note,baseUpdatedAt:12,savedAt:13};const clean=cleanReaderDrafts([row,{...row,savedAt:14},{paperId:'../outside',note}]);assert.equal(clean.length,1);assert.equal(clean[0].savedAt,14);assert.deepEqual(clean[0].note,note);
  assert.throws(()=>cleanReaderDrafts([{paperId:'a',note:{...note,anchor:{page:0}}}]),/位置/);assert.throws(()=>cleanReaderDrafts(Array(201).fill(row)),/200/);
});
test('content equality ignores save timestamps but detects actual annotation or picture changes',()=>{
  const note={body:'text',anchor:null,attachments:[]};assert.equal(sameReaderNote(note,{body:'text',updatedAt:99}),true);assert.equal(sameReaderNote(note,{body:'new text'}),false);assert.equal(sameReaderNote(note,{...note,anchor:{page:2}}),false);
});
test('desktop stores drafts and reading layout independently from committed notes; invalid drafts leave disk intact',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'reader-ux-'))).init();
  const committed={'paper:a':[{id:'n',body:'Committed',createdAt:1,updatedAt:2}]};await lib.setSetting('notes',committed);
  const drafts=[{paperId:'a',note:{id:'n',body:'Unsaved work',createdAt:1,updatedAt:2},baseUpdatedAt:2,savedAt:3}];await lib.setSetting('readerDrafts',drafts);await lib.setSetting('readerState',{a:{page:2,zoom:'page',layout:'spread',sidebarOpen:false,sidebarWidth:400,wheelTurn:true}});
  const reopened=await new LocalLibrary(lib.root).init();assert.deepEqual(reopened.getSetting('notes'),committed);assert.deepEqual(reopened.getSetting('readerDrafts'),drafts);assert.equal(reopened.getSetting('readerState').a.layout,'spread');
  const before=await readFile(path.join(lib.root,'library.json'),'utf8');await assert.rejects(reopened.setSetting('readerDrafts',[{...drafts[0],note:{...drafts[0].note,anchor:{page:0}}}]));assert.equal(await readFile(path.join(lib.root,'library.json'),'utf8'),before);
});
