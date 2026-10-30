import test from 'node:test';
import assert from 'node:assert/strict';
import {readerPageGroups} from '../dist/reader-continuous.js';
import {cleanReaderState} from '../dist/note-model.js';

test('continuous tracks include every page once, including isolated covers and odd final spreads',()=>{
  for(const layout of ['single','spread','book'])for(const total of [1,2,3,24,101]){
    const groups=readerPageGroups(total,layout);
    assert.deepEqual(groups.flat(),Array.from({length:total},(_,i)=>i+1));
    assert.ok(groups.every(group=>group.length>0&&group.length<=(layout==='single'?1:2)));
    if(layout==='book')assert.deepEqual(groups[0],[1]);
  }
});
test('continuous direction survives saved reading settings while unknown values are discarded',()=>{
  for(const flow of ['vertical','horizontal','paged']){
    const settings={paper:{page:19,zoom:'page',layout:'spread',flow}};
    assert.deepEqual(cleanReaderState(settings),settings);
  }
  assert.deepEqual(cleanReaderState({paper:{page:1,zoom:'fit',flow:'invalid'}}),{paper:{page:1,zoom:'fit'}});
});
