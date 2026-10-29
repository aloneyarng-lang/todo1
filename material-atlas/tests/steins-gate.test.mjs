import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveTheme,themePackage,parseThemePackage,importThemeFiles,BUILTIN_THEMES} from '../dist/theme-model.js';
import {validateThemeDesign} from '../scripts/validate-theme-design.mjs';
import {cosmicNodeParts} from '../dist/graph-cosmos.js';
import {graphTokens,graphFromTokens,nodeGeometry} from '../dist/graph-appearance.js';
test('Steins Gate uses official offline artwork and orange/cyan nova nodes in both glass modes',()=>{
  assert.ok(BUILTIN_THEMES.some(t=>t.id==='steins-gate'));
  for(const mode of ['light','dark']){
    const theme=resolveTheme({selected:'steins-gate',mode});assert.equal(theme.tokens['--theme-mode'],mode);assert.equal(theme.ui.style,'glass');assert.ok(theme.tokens['--numeric'].includes('Materia SF Mono'));assert.equal(theme.graph.nodeShape,'nova');assert.equal(theme.graph.relationShape,'nova');assert.equal(theme.graph.background,'plain');assert.equal(theme.assets.graphSymbols.node,undefined);assert.equal(theme.assets.fonts.length,0);validateThemeDesign(themePackage(theme));
    assert.notEqual(theme.graph.nodeColor,theme.graph.relationColor);
    for(const asset of Object.values(theme.assets.artwork)){assert.match(asset.source,/^https:\/\/steinsgate.jp\/reboot\//);assert.match(asset.credit,/MAGES/);assert.equal(Buffer.from(asset.data,'base64').subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
    const restored=resolveTheme(importThemeFiles({mode},[{name:'portable.mtheme.json',text:themePackage(theme)}],()=> 'custom-worldline'));
    assert.deepEqual(restored.variants,theme.variants);assert.deepEqual(restored.assets,theme.assets);assert.deepEqual(restored.icons,theme.icons);assert.equal(restored.tokens['--numeric'],theme.tokens['--numeric']);
  }
});
test('the standalone package matches the builtin and carries both modes without copying font binaries',async()=>{
  const pack=validateThemeDesign(await readFile('theme-examples/steins-gate/命运石之门-世界线.mtheme.json','utf8')),builtin=parseThemePackage(themePackage(resolveTheme({selected:'steins-gate'})));
  assert.deepEqual(pack,builtin);assert.equal(pack.assets.fonts.length,0);assert.ok(JSON.stringify(pack).length<300000);
});

test('nova geometry and independent node colors survive package/CSS tokens without altering graph data',()=>{
  const appearance=graphFromTokens(graphTokens({nodeShape:'nova',relationShape:'nova',nodeColor:'#52dae0',relationColor:'#ffab55'}));
  assert.equal(appearance.nodeColor,'#52dae0');assert.equal(nodeGeometry('nova',8).tag,'circle');
  const parts=cosmicNodeParts('nova',8,appearance);assert.ok(parts.back.some(p=>p.attrs.class==='nova-ray'));assert.ok(parts.back.some(p=>p.attrs.class==='nova-orbit'));assert.ok(parts.front.some(p=>p.attrs.class==='nova-white-core'));assert.ok(Number.isFinite(parts.radius));assert.ok(!JSON.stringify(parts).includes('NaN'));
  for(const graph of [{nodeColor:'url(https://example.com)'},{relationColor:'expression(x)'}])assert.throws(()=>parseThemePackage({format:'materia-theme',schemaVersion:2,graph}));
});

test('theme artwork rejects active/remote content, malformed bytes and missing attribution',()=>{
  const art=resolveTheme({selected:'steins-gate'}).assets.artwork,base={format:'materia-theme',schemaVersion:2};
  for(const artwork of [null,[],{background:art.logo},{logo:{...art.logo,mime:'image/svg+xml'}},{logo:{...art.logo,data:'https://example.com/x.png'}},{logo:{...art.logo,data:Buffer.from('invalid image bytes'.repeat(5)).toString('base64')}},{logo:{...art.logo,credit:''}},{logo:{...art.logo,source:'javascript:alert(1)'}},{logo:{...art.logo,onload:'alert(1)'}}])assert.throws(()=>parseThemePackage({...base,assets:{artwork}}));
});
