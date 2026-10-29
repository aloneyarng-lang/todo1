import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveTheme,themePackage,parseThemePackage,importThemeFiles,BUILTIN_THEMES} from '../dist/theme-model.js';
import {validateThemeDesign} from '../scripts/validate-theme-design.mjs';
test('Steins Gate is built in with two complete glass modes, original SVG artwork and bundled font references',()=>{
  assert.ok(BUILTIN_THEMES.some(t=>t.id==='steins-gate'));
  for(const mode of ['light','dark']){
    const theme=resolveTheme({selected:'steins-gate',mode});assert.equal(theme.tokens['--theme-mode'],mode);assert.equal(theme.ui.style,'glass');assert.ok(theme.tokens['--numeric'].includes('Materia SF Mono'));assert.equal(theme.graph.nodeShape,'symbol');assert.equal(theme.graph.background,'plain');assert.ok(theme.assets.graphSymbols.node.length>2);assert.equal(theme.assets.fonts.length,0);validateThemeDesign(themePackage(theme));
    const restored=resolveTheme(importThemeFiles({mode},[{name:'portable.mtheme.json',text:themePackage(theme)}],()=> 'custom-worldline'));
    assert.deepEqual(restored.variants,theme.variants);assert.deepEqual(restored.assets,theme.assets);assert.deepEqual(restored.icons,theme.icons);assert.equal(restored.tokens['--numeric'],theme.tokens['--numeric']);
  }
});
test('the standalone package matches the builtin and carries both modes without copying font binaries',async()=>{
  const pack=validateThemeDesign(await readFile('theme-examples/steins-gate/命运石之门-世界线.mtheme.json','utf8')),builtin=parseThemePackage(themePackage(resolveTheme({selected:'steins-gate'})));
  assert.deepEqual(pack,builtin);assert.equal(pack.assets.fonts.length,0);assert.ok(JSON.stringify(pack).length<30000);
});
