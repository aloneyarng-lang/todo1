import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rename,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {LocalLibrary} from '../desktop/library.mjs';
import {resolveLibraryRoot} from '../desktop/library-location.mjs';
test('library location preserves valid custom choices but recovers a portable folder after its parent is renamed',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const root=await mkdtemp(path.join(parent,'relocation-')),old=path.join(root,'todo1'),next=path.join(root,'materia');
  const libraryPath=path.join(old,'文献库'),bytes=Buffer.from('%PDF-1.4\n% relocation fixture\n%%EOF'),lib=await new LocalLibrary(libraryPath).init();await lib.putPapers([{id:'a',title:'Preserved paper',tags:['Tag'],fileBytes:bytes}]);await lib.setSetting('themePreferences',{selected:'wikipedia',fonts:{body:'yahei',heading:'times'}});await writeFile(path.join(libraryPath,'ai-chats.json'),'saved conversation');
  await rename(old,next);const newPath=path.join(next,'文献库'),resolved=resolveLibraryRoot({configuredRoot:libraryPath,defaultRoot:newPath});assert.equal(resolved,newPath);const reopened=await new LocalLibrary(resolved).init();assert.equal(reopened.getPapers()[0].title,'Preserved paper');assert.equal(reopened.getSetting('themePreferences').selected,'wikipedia');assert.deepEqual(Buffer.from(await reopened.readPdf('a')),bytes);assert.equal(await readFile(path.join(newPath,'ai-chats.json'),'utf8'),'saved conversation');assert.equal(resolveLibraryRoot({configuredRoot:newPath,defaultRoot:'unused'}),newPath);
});
test('explicit test/environment locations win; missing old preferences use the existing legacy release library before a blank default',()=>{
  const exists=file=>file===path.join('legacy','library.json');assert.equal(resolveLibraryRoot({envRoot:'isolated',configuredRoot:'old',previousRoot:'legacy',defaultRoot:'default'},exists),'isolated');assert.equal(resolveLibraryRoot({configuredRoot:'old',previousRoot:'legacy',defaultRoot:'default'},exists),'legacy');
});
