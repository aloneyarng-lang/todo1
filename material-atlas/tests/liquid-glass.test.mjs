import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {parseThemePackage,importThemeFiles,resolveTheme,themePackage} from '../dist/theme-model.js';
import {LocalLibrary} from '../desktop/library.mjs';
const files=['01-澄璃-浅色.mtheme.json','02-澄璃-深色.mtheme.json'];
const packs=await Promise.all(files.map(name=>readFile(new URL('../theme-examples/liquid-glass/'+name,import.meta.url),'utf8')));

test('glass is a portable imported material independent of package name, with preserved icons and graph geometry',()=>{
  for(const [i,text] of packs.entries()){
    const pack=parseThemePackage(text);pack.name='Independent glass '+i;
    const theme=resolveTheme(importThemeFiles({},[{name:files[i],text:JSON.stringify(pack)}],()=> 'custom-glass'));
    const restored=resolveTheme(importThemeFiles({},[{name:'copy.mtheme.json',text:themePackage(theme)}],()=> 'custom-copy'));
    assert.equal(restored.ui.style,'glass');assert.equal(restored.tokens['--theme-mode'],i?'dark':'light');
    assert.deepEqual(restored.ui,theme.ui);assert.deepEqual(restored.icons,theme.icons);assert.deepEqual(restored.graph,theme.graph);
    assert.ok(Object.keys(restored.icons.overrides).length>=10);assert.equal(restored.assets.fonts.length,0);
    assert.equal(restored.graph.edgeStyle,'curve');assert.equal(restored.graph.nodeFill,'hollow');
  }
});

test('native storage retains glass packages and selection across reopen',async()=>{
  await mkdir('.local/tests',{recursive:true});const root=await mkdtemp(path.resolve('.local/tests/glass-'));
  const lib=await new LocalLibrary(root).init();
  const preferences=importThemeFiles({fontScale:110},packs.map((text,i)=>({name:files[i],text})),(()=>{let i=0;return()=> 'custom-glass-'+(++i);})());
  await lib.setSetting('themePreferences',preferences);
  const restored=(await new LocalLibrary(root).init()).getSetting('themePreferences');
  assert.deepEqual(restored,preferences);assert.equal(resolveTheme(restored).ui.style,'glass');assert.equal(restored.fontScale,110);
});
