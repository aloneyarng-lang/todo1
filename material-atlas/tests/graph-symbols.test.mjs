import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {BUILTIN_THEMES,resolveTheme,themePackage,parseThemePackage,importThemeFiles,themeCSS,parseThemeCSS} from '../dist/theme-model.js';
import {LocalLibrary} from '../desktop/library.mjs';
import {GRAPH_APPEARANCE_VERSION} from '../dist/graph-appearance.js';

test('Reimu is available offline with two modes and exports its actual artwork',()=>{
 for(const id of ['reimu-day','reimu-night']){
  const theme=resolveTheme({selected:id});assert.ok(BUILTIN_THEMES.find(t=>t.id===theme.id));assert.equal(theme.tokens['--theme-mode'],id==='reimu-night'?'dark':'light');
  assert.equal(theme.graph.nodeShape,'symbol');assert.equal(theme.graph.relationShape,'symbol');assert.equal(theme.graph.background,'symbol');
  const imported=resolveTheme(importThemeFiles({},[{name:'portable.json',text:themePackage(theme)}],()=> 'custom-portable'));
  assert.deepEqual(imported.assets.graphSymbols,theme.assets.graphSymbols);assert.deepEqual(imported.graph,theme.graph);
  assert.equal(parseThemeCSS(themeCSS(theme.name,theme.tokens)).tokens['--graph-node-shape'],'square');
 }
});
test('arbitrary names and original safe vectors import without a built-in id, while executable and external content is rejected',()=>{
 const sample={format:'materia-theme',schemaVersion:2,name:'Future custom artwork',graph:{nodeShape:'symbol'},assets:{graphSymbols:{node:[{tag:'path',attrs:{d:'M0 0L24 24',stroke:'theme-accent',fill:'none'}}]}}};
 assert.equal(parseThemePackage(sample).assets.graphSymbols.node[0].attrs.stroke,'theme-accent');
 for(const patch of [{tag:'script',attrs:{}},{tag:'image',attrs:{href:'https://example.com'}},{tag:'path',attrs:{d:'M0 0',onclick:'alert(1)'}},{tag:'path',attrs:{d:'M0 0',fill:'url(https://example.com)'}},{tag:'path',attrs:{d:'M0 0',fill:'var(--unsafe)'}}]){
  assert.throws(()=>parseThemePackage({...sample,assets:{graphSymbols:{node:[patch]}}}));
 }
 assert.throws(()=>parseThemePackage({...sample,assets:{}}),/graphSymbols.node/);
 assert.throws(()=>parseThemeCSS(':root{--graph-node-shape:symbol;}'),/完整/);
});
test('old complete packages and CSS still import alongside new symbols, and native storage preserves every shape',async()=>{
 const files=['blueprint.mtheme.json','deepfield.mtheme.json'];const rows=await Promise.all(files.map(async name=>({name,text:await readFile(new URL('../theme-examples/'+name,import.meta.url),'utf8')})));
 rows.push({name:'old.css',text:':root{--teal:#b52f40;--graph-node-shape:diamond;}'});
 rows.push({name:'new.json',text:themePackage(resolveTheme({selected:'reimu-night'}))});
 let n=0;const prefs=importThemeFiles({},rows,()=>`custom-compat-${n++}`);assert.equal(prefs.themes.length,4);
 await mkdir('.local/tests',{recursive:true});const dir=await mkdtemp(path.resolve('.local/tests/graph-symbols-')),lib=await new LocalLibrary(dir).init();
 await lib.setSetting('themePreferences',prefs);const restored=await new LocalLibrary(dir).init();assert.deepEqual(restored.getSetting('themePreferences'),prefs);assert.equal((await restored.info()).graphThemeVersion,GRAPH_APPEARANCE_VERSION);
});
