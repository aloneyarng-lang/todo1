import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BUILTIN_THEMES,resolveTheme,themePackage,parseThemePackage,importThemeFiles,cleanThemePreferences} from '../dist/theme-model.js';
import {validateThemeDesign} from '../scripts/validate-theme-design.mjs';
import {cleanGraphSettings} from '../dist/graph-settings.js';
test('all builtins and the new template satisfy both-mode contrast and glass requirements',async()=>{
  for(const theme of BUILTIN_THEMES)validateThemeDesign(themePackage(resolveTheme({selected:theme.id})));
  validateThemeDesign(await readFile('theme-template.mtheme.json','utf8'));
});
test('new-package validation rejects missing dark mode, low contrast and non-glass geometry',()=>{
  const pack=JSON.parse(themePackage(resolveTheme({selected:'buaa-blue'})));
  assert.throws(()=>validateThemeDesign({...pack,variants:undefined}),/light/);
  assert.throws(()=>validateThemeDesign({...pack,ui:{...pack.ui,style:'technical'}}),/glass/);
  assert.throws(()=>validateThemeDesign({...pack,variants:{...pack.variants,dark:{...pack.variants.dark,'--ink':pack.variants.dark['--paper']}}}),/对比度/);
  assert.throws(()=>parseThemePackage({...pack,variants:{...pack.variants,dark:{...pack.variants.dark,'--sans':'Injected font'}}}),/不支持字段/);
});
test('old theme and independent graph selections migrate without dropping fonts or graph artwork',()=>{
  const prefs=cleanThemePreferences({selected:'reimu-night',glass:false,fonts:{body:'yahei'},fontScale:125});assert.equal(prefs.selected,'reimu-day');assert.equal(prefs.mode,'dark');assert.equal(prefs.fontScale,125);assert.equal(prefs.fonts.body,'yahei');assert.equal(cleanGraphSettings({appearance:'theme:reimu-night'}).appearance,'theme:reimu-day');
  const imported=importThemeFiles({},[{name:'old.css',text:':root {--teal:#705095; --theme-mode:light;}'}],()=> 'custom-old');assert.equal(resolveTheme({...imported,mode:'dark'}).tokens['--theme-mode'],'dark');assert.equal(resolveTheme({...imported,glass:false}).ui.style,'glass');
});
