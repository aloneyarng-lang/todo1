import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {THEME_TOKENS,BUILTIN_THEMES,FONT_OPTIONS,parseThemeCSS,themeCSS,resolveTheme,cleanThemePreferences,cleanFontScale,importThemeFiles,removeTheme} from '../dist/themes.js';
import {LocalLibrary} from '../desktop/library.mjs';

test('built-in palettes resolve every token and invalid or missing saved selections recover to paper',()=>{
  for(const theme of BUILTIN_THEMES){const resolved=resolveTheme({selected:theme.id});assert.deepEqual(Object.keys(resolved.tokens),Object.keys(THEME_TOKENS));assert.equal(resolved.custom,false);}
  assert.equal(resolveTheme({selected:'graphite'}).tokens['--theme-mode'],'dark');
  assert.equal(resolveTheme({selected:'missing'}).id,'paper');assert.deepEqual(cleanThemePreferences(null),{selected:'paper',themes:[]});
});
test('CSS template round trips names, colors, font stacks and corners; partial themes inherit remaining tokens',()=>{
  const css=themeCSS('中文学术主题',THEME_TOKENS),parsed=parseThemeCSS(css);
  assert.equal(parsed.name,'中文学术主题');assert.deepEqual(parsed.tokens,THEME_TOKENS);
  const custom=importThemeFiles({},[{name:'Ocean.css',text:'\uFEFF/* @name: 我的海蓝 */\n:root { --teal: rgb(20, 70, 120); --radius: 12px; }'}],()=> 'custom-a');
  const resolved=resolveTheme(custom);assert.equal(resolved.name,'我的海蓝');assert.equal(resolved.tokens['--radius'],'16px');assert.equal(resolved.tokens['--ink'],THEME_TOKENS['--ink']);
});
test('theme format rejects arbitrary layout rules, imports, URLs, unknown tokens, oversized and malformed files',()=>{
  for(const css of ['body { display: none; }',':root { --teal: url(https://example.com/x); }','@import "x.css"; :root { --teal: #fff; }',':root { --unknown: #fff; }',':root { --radius: 100px; }',':root { --sans: "broken; }',':root { --theme-mode: auto; }',':root { --teal: red !important; }',':root {}',':root { --ink: #fff; } body {display:none}', ' '.repeat(32769)])assert.throws(()=>parseThemeCSS(css),Error);
});
test('batch imports validate atomically, update matching names and retain other themes',()=>{
  let next=importThemeFiles({},[{name:'Blue.css',text:':root {--teal:#123456;}'},{name:'Green.css',text:':root {--teal:#234567;}'}],(()=>{let i=0;return()=>`custom-${++i}`;})());
  const before=structuredClone(next);next=importThemeFiles(next,[{name:'BLUE.css',text:':root {--teal:#345678;}'}],()=>{throw Error('Must update');});
  assert.equal(next.themes.length,2);assert.equal(next.selected,'custom-1');assert.equal(resolveTheme(next).tokens['--teal'],'#345678');
  assert.throws(()=>importThemeFiles(before,[{name:'Good.css',text:':root {--ink:#123456;}'},{name:'Bad.css',text:'body{}'}],()=> 'custom-3'),/Bad.css/);assert.equal(before.themes.length,2);
});
test('corrupt saved themes are dropped; removing the active theme recovers without deleting other themes',()=>{
  const good={id:'custom-a',name:'A',css:':root {--teal:#123456;}'};
  const prefs=cleanThemePreferences({selected:'custom-b',themes:[good,{id:'custom-b',name:'Bad',css:'body{}'},good,{id:'paper',css:good.css}]});
  assert.equal(prefs.themes.length,1);assert.equal(prefs.selected,'paper');
  const removed=removeTheme({...prefs,selected:'custom-a'},'custom-a');assert.deepEqual(removed,{selected:'paper',themes:[]});
  assert.throws(()=>importThemeFiles({themes:Array.from({length:20},(_,i)=>({...good,id:'custom-'+i,name:String(i)}))},[{name:'new.css',text:good.css}],()=> 'custom-new'),/20/);
});
test('desktop persists chosen CSS theme across reopen while preserving papers, notes and all other preferences',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'themes-'))).init();
  const bytes=Buffer.from('%PDF-1.4\n% theme test\n%%EOF');await lib.putPapers([{id:'paper-a',title:'Preserved title',tags:['Tag'],measurements:[],fileBytes:bytes}]);await lib.setSetting('notes',{'paper:paper-a':[{id:'n',body:'Unchanged note',createdAt:1,updatedAt:1}]});
  const before=structuredClone(lib.getPapers()),notes=structuredClone(lib.getSetting('notes'));
  const preferences=importThemeFiles({fontScale:125,fonts:{body:'yahei',heading:'times'}},[{name:'Night.css',text:themeCSS('My Night',resolveTheme({selected:'graphite'}).tokens)}],()=> 'custom-night');await lib.setSetting('themePreferences',preferences);
  const reopened=await new LocalLibrary(lib.root).init();assert.deepEqual(reopened.getSetting('themePreferences'),preferences);assert.deepEqual(reopened.getPapers(),before);assert.deepEqual(reopened.getSetting('notes'),notes);assert.deepEqual(Buffer.from(await reopened.readPdf('paper-a')),bytes);
});

test('font overrides survive palette changes, CSS import and deletion while follow-theme restores each original font stack',()=>{
  const prefs={selected:'wikipedia',themes:[],fonts:{body:'yahei',heading:'times'}},resolved=resolveTheme(prefs);
  assert.equal(resolved.tokens['--sans'],FONT_OPTIONS.find(f=>f.id==='yahei').stack);assert.equal(resolved.tokens['--serif'],FONT_OPTIONS.find(f=>f.id==='times').stack);
  assert.equal(resolveTheme({...prefs,selected:'graphite'}).tokens['--sans'],resolved.tokens['--sans']);
  const imported=importThemeFiles(prefs,[{name:'Own.css',text:':root{--sans:Custom Sans, sans-serif;--serif:Custom Serif, serif;}'}],()=> 'custom-font');
  assert.deepEqual(imported.fonts,prefs.fonts);assert.equal(resolveTheme(imported).tokens['--serif'],resolved.tokens['--serif']);
  assert.deepEqual(removeTheme(imported,'custom-font').fonts,prefs.fonts);
  assert.equal(resolveTheme({...imported,fonts:{body:'theme',heading:'theme'}}).tokens['--sans'],'Custom Sans, sans-serif');
  const css=themeCSS(resolved.name,resolved.tokens);assert.equal(parseThemeCSS(css).tokens['--serif'],resolved.tokens['--serif']);
  assert.deepEqual(cleanThemePreferences({fonts:{body:'unknown',heading:'<script>'}}),{selected:'paper',themes:[]});
  assert.equal(resolveTheme({selected:'wikipedia'}).id,'paper');
});

test('academic purple uses a complete light palette and preserves independent typography choices',()=>{const theme=resolveTheme({selected:'academic-purple',fonts:{body:'yahei',heading:'times'}});assert.equal(theme.name,'学术紫');assert.equal(theme.tokens['--teal'],'#705095');assert.equal(theme.tokens['--theme-mode'],'light');assert.ok(theme.tokens['--sans'].includes('Microsoft YaHei'));assert.ok(theme.tokens['--serif'].includes('Times New Roman'));assert.equal(cleanThemePreferences({selected:'academic-purple'}).selected,'academic-purple');});

test('UI font scale recovers old or corrupt settings and bounds finite percentages',()=>{
  for(const value of [undefined,null,'125','150;display:none',NaN,Infinity,{},true])assert.equal(cleanFontScale(value),100);
  assert.equal(cleanFontScale(40),85);assert.equal(cleanFontScale(999),150);assert.equal(cleanFontScale(123),125);
  assert.deepEqual(cleanThemePreferences({fontScale:100}),{selected:'paper',themes:[]});
});

test('UI font scale survives palette changes, theme import and deletion independently of CSS fonts',()=>{
  const prefs=cleanThemePreferences({selected:'graphite',fontScale:130,fonts:{body:'yahei',heading:'times'}});
  const imported=importThemeFiles(prefs,[{name:'New.css',text:':root{--ink:#123456;}'}],()=> 'custom-scale');
  assert.equal(imported.fontScale,130);assert.equal(removeTheme(imported,'custom-scale').fontScale,130);
  assert.equal(cleanThemePreferences({...prefs,selected:'paper'}).fontScale,130);
  assert.equal(cleanThemePreferences({...prefs,fonts:{body:'theme',heading:'theme'}}).fontScale,130);
  assert.deepEqual(resolveTheme({...prefs,fontScale:150}).tokens,resolveTheme({...prefs,fontScale:85}).tokens);
});
