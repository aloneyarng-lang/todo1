import test from 'node:test';
import assert from 'node:assert/strict';
import {cosmicStars,cosmicNodeParts} from '../dist/graph-cosmos.js';
import {GRAPH_APPEARANCE_VERSION,graphTokens,graphFromTokens,nodeGeometry,graphAppearance} from '../dist/graph-appearance.js';
import {parseThemePackage,parseThemeCSS,themeCSS,themePackage,importThemeFiles,resolveTheme} from '../dist/theme-model.js';
import {LocalLibrary} from '../desktop/library.mjs';
import {mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';

const graph={nodeShape:'star',relationShape:'planet',background:'nebula',starDensity:1.4,starOpacity:.6,starColor:'#d1e6ff',nebulaIntensity:.75,nebulaColor:'#7654af',nebulaColorSecondary:'#257e99',orbitScale:1.9,orbitTilt:32,twinkle:'subtle',seed:214};
test('cosmic graph API round trips through real package and CSS import/export without a special theme name',()=>{
 const pack=parseThemePackage({format:'materia-theme',schemaVersion:2,name:'Any cosmic theme',graph});
 const prefs=importThemeFiles({},[{name:'cosmos.mtheme.json',text:themePackage(pack)}],()=> 'custom-cosmos');
 const theme=resolveTheme(prefs);for(const[key,value]of Object.entries(graph))assert.equal(theme.graph[key],value);
 assert.deepEqual(parseThemePackage(themePackage(theme)).graph,theme.graph);
 assert.deepEqual(graphFromTokens(parseThemeCSS(themeCSS('Cosmos',theme.tokens)).tokens),theme.graph);
 assert.equal(GRAPH_APPEARANCE_VERSION,4);
});
test('cosmic values are bounded, typed and rejected before changing saved preferences',()=>{
 const before={selected:'paper',themes:[]};
 for(const patch of [{starDensity:3},{starDensity:-1},{starOpacity:Infinity},{nebulaIntensity:'1'},{seed:.2},{seed:65536},{orbitTilt:181},{orbitScale:0},{twinkle:true},{starColor:'url(https://example.com)'},{nebulaColor:'var(--anything)'},{background:'javascript'}]){
  assert.throws(()=>importThemeFiles(before,[{name:'bad.mtheme.json',text:JSON.stringify({format:'materia-theme',schemaVersion:2,graph:{...graph,...patch}})}],()=> 'custom-bad'));
  assert.deepEqual(before,{selected:'paper',themes:[]});
 }
});
test('distant stars are deterministic, bounded and independent of graph node count',()=>{
 const stars=cosmicStars(1.4,214);assert.deepEqual(stars,cosmicStars(1.4,214));assert.notDeepEqual(stars,cosmicStars(1.4,215));
 assert.equal(cosmicStars(0).length,0);assert.equal(cosmicStars(99).length,520);
 for(const star of stars){assert.ok(star.x>=0&&star.x<=1000&&star.y>=0&&star.y<=700);assert.ok(star.r>0&&star.r<1.5);}
});
test('planet rings expand interaction and label bounds, star and classic geometries remain finite',()=>{
 const appearance=graphFromTokens(graphTokens(graph));
 for(const shape of ['circle','diamond','hexagon','square','star','planet']){
  const geometry=nodeGeometry(shape,12),parts=cosmicNodeParts(shape,12,appearance);
  assert.ok(!JSON.stringify({geometry,parts}).includes('NaN'));assert.ok(Number.isFinite(parts.radius));
  if(shape==='planet'){assert.ok(parts.radius>=12*graph.orbitScale);assert.ok(parts.front.some(p=>p.attrs.class==='cosmic-orbit-front'));}
  if(shape==='circle')assert.deepEqual(parts,{back:[],front:[],radius:12});
 }
 assert.equal(graphAppearance(graphTokens(graph),'classic').background,'plain');
 assert.equal(graphAppearance(graphTokens(graph),'cosmos').relationShape,'planet');
 assert.equal(parseThemePackage({format:'materia-theme',schemaVersion:2}).graph.nodeShape,'circle');
});
test('native library advertises graph API v2 and persists cosmic themes across reopening',async()=>{
 await mkdir('.local/tests',{recursive:true});const root=await mkdtemp(path.resolve('.local/tests/cosmos-'));
 const library=await new LocalLibrary(root).init();assert.equal((await library.info()).graphThemeVersion,GRAPH_APPEARANCE_VERSION);
 const preferences=importThemeFiles({},[{name:'cosmos.json',text:JSON.stringify({format:'materia-theme',schemaVersion:2,name:'Cosmos',graph})}],()=> 'custom-cosmos');
 await library.setSetting('themePreferences',preferences);const reopened=await new LocalLibrary(root).init();assert.deepEqual(reopened.getSetting('themePreferences'),preferences);assert.deepEqual(reopened.getPapers(),[]);
});
