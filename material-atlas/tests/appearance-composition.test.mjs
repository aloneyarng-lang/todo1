import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanThemePreferences,resolveTheme,BUILTIN_THEMES,themePackage,parseThemePackage,importThemeFiles} from '../dist/theme-model.js';
import {setGraphThemeOptions,graphAppearance} from '../dist/graph-appearance.js';
import {getGraphSymbols,setGraphSymbols} from '../dist/graph-symbols.js';
import {cleanGraphSettings} from '../dist/graph-settings.js';
test('explicit glass on/off persists through theme changes and imports without changing exported package design',()=>{
 for(const glass of [true,false]){
  const prefs=cleanThemePreferences({selected:'reimu-day',glass});assert.equal(cleanThemePreferences({...prefs,selected:'graphite'}).glass,glass);
  const pack=themePackage(resolveTheme({selected:'reimu-night'}));const imported=importThemeFiles(prefs,[{name:'reimu.json',text:pack}],()=> 'custom-shape');assert.equal(imported.glass,glass);assert.ok(!('glass' in parseThemePackage(pack)));
 }
});
test('independent theme geometry brings its symbol artwork and survives settings normalization',()=>{
 const source=resolveTheme({selected:'reimu-night'});setGraphSymbols({});setGraphThemeOptions([...BUILTIN_THEMES,{...source,id:'custom-original',name:'Imported original'}]);
 const preset='theme:custom-original';assert.equal(cleanGraphSettings({appearance:preset}).appearance,preset);
 assert.equal(graphAppearance(resolveTheme({selected:'paper'}).tokens,preset).nodeShape,'symbol');assert.deepEqual(getGraphSymbols(preset),source.assets.graphSymbols);
 assert.equal(graphAppearance({},'classic').nodeShape,'circle');assert.equal(graphAppearance({},'theme:removed').nodeShape,'circle');
});
