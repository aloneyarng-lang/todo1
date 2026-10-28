import test from 'node:test';
import assert from 'node:assert/strict';
import {parseThemeCSS,parseThemePackage,themeCSS,themePackage,resolveTheme,importThemeFiles} from '../dist/theme-model.js';
import {GRAPH_THEME_TOKENS,graphTokens,graphFromTokens,graphAppearance,nodeGeometry,edgeGeometry} from '../dist/graph-appearance.js';
import {cleanGraphSettings} from '../dist/graph-settings.js';
import {createNetwork,networkSnapshot} from '../dist/force-layout.js';
test('CSS and JSON graph declarations use the same canonical tokens and survive complete and CSS export',()=>{
 const graph={nodeShape:'hexagon',relationShape:'diamond',nodeFill:'hollow',edgeStyle:'curve',edgeDash:'dashed',background:'grid',nodeScale:1.4,edgeOpacity:.35,labelScale:1.2,glow:2,edgeColor:'#005bac'};
 const pack=parseThemePackage({format:'materia-theme',schemaVersion:2,name:'Graph',graph});const prefs=importThemeFiles({},[{name:'graph.json',text:themePackage(pack)}],()=> 'custom-graph'),resolved=resolveTheme(prefs);
 for(const[key,value]of Object.entries(graph))assert.equal(resolved.graph[key],value);
 const css=parseThemeCSS(themeCSS('Graph',resolved.tokens));assert.deepEqual(graphFromTokens(css.tokens),resolved.graph);
 assert.deepEqual(parseThemePackage(JSON.parse(themePackage(resolved))).graph,resolved.graph);
 assert.equal(graphFromTokens(parseThemeCSS(':root{--graph-node-shape:square;--graph-glow:3px;}').tokens).nodeShape,'square');
});
test('unknown, malformed and out of bounds graph values are rejected atomically, old themes keep classic defaults',()=>{
 for(const graph of [{nodeShape:'script'},{glow:100},{edgeOpacity:NaN},{nodeScale:'1.2'},{edgeColor:'url(x)'},{unknown:1},null])assert.throws(()=>parseThemePackage({format:'materia-theme',schemaVersion:2,graph}));
 for(const css of [':root{--graph-edge-opacity:2;}',':root{--graph-glow:2;}',':root{--graph-node-shape:polygon(x);}',':root{--graph-background:url(x);}'])assert.throws(()=>parseThemeCSS(css));
 assert.deepEqual(parseThemePackage({format:'materia-theme',schemaVersion:2}).graph,graphFromTokens(GRAPH_THEME_TOKENS));assert.equal(resolveTheme({selected:'academic-purple'}).graph.edgeStyle,'straight');
});
test('manual graph appearance overrides theme geometry, can return to follow theme and recovers invalid saved settings',()=>{
 const tokens=graphTokens({nodeShape:'square',background:'grid'});assert.equal(graphAppearance(tokens,'theme').nodeShape,'square');assert.equal(graphAppearance(tokens,'classic').nodeShape,'circle');assert.equal(graphAppearance(tokens,'orbital').nodeFill,'hollow');assert.equal(graphAppearance(tokens,'crystal').nodeShape,'hexagon');assert.equal(graphAppearance(tokens,'theme').background,'grid');assert.equal(cleanGraphSettings({appearance:'wrong'}).appearance,'theme');assert.equal(cleanGraphSettings({appearance:'crystal'}).appearance,'crystal');
});
test('shape and curved-edge generation produces finite geometry and does not change relation membership or node positions',()=>{
 const network=createNetwork([{id:'p',title:'Test',tags:['A']}],[],{},[{kind:'tag',value:'A'}]),before=networkSnapshot(network),edge=network.edges[0];assert.ok(edge);
 for(const shape of ['circle','diamond','hexagon','square']){const geometry=nodeGeometry(shape,8);assert.ok(['circle','path','rect'].includes(geometry.tag));assert.ok(!JSON.stringify(geometry).includes('NaN'));}
 assert.match(edgeGeometry(edge.source,edge.target,'straight'),/ L/);assert.match(edgeGeometry(edge.source,edge.target,'curve'),/ Q/);assert.ok(!edgeGeometry({x:0,y:0,radius:4},{x:0,y:0,radius:5},'curve').includes('NaN'));assert.deepEqual(networkSnapshot(network),before);assert.equal(network.edges.length,1);
});
test('BUAA package round trips its own orbital appearance without requiring an exact built-in ID',()=>{
 const blue=resolveTheme({selected:'buaa-blue'});assert.equal(blue.graph.colorMode,'accent');assert.equal(blue.graph.edgeStyle,'curve');assert.equal(blue.graph.relationShape,'diamond');const copy=resolveTheme(importThemeFiles({},[{name:'buaa.json',text:themePackage(blue)}],()=> 'custom-buaa'));assert.deepEqual(copy.graph,blue.graph);assert.deepEqual(copy.ui,blue.ui);assert.equal(copy.tokens['--teal'],'#005bac');
});
