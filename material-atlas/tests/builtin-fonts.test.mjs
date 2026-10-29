import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {BUILTIN_THEMES,FONT_OPTIONS,resolveTheme,cleanThemePreferences} from '../dist/theme-model.js';
import {LocalLibrary} from '../desktop/library.mjs';

test('glass appearances and actual bundled font choices work without custom theme files',()=>{
  for(const id of ['liquid-glass','liquid-glass-dark']){
    const theme=resolveTheme({selected:id});assert.equal(theme.custom,false);assert.equal(theme.ui.style,'glass');
    assert.ok(theme.tokens['--sans'].includes('Materia SF Pro'));assert.ok(theme.tokens['--mono'].includes('Materia SF Mono'));
    assert.equal(cleanThemePreferences({selected:id}).selected,'liquid-glass');assert.equal(theme.tokens['--theme-mode'],id.endsWith('dark')?'dark':'light');
    assert.equal(theme.assets.fonts.length,0);assert.ok(BUILTIN_THEMES.some(row=>row.id===theme.id));
  }
  for(const id of ['apple-sf-pro','apple-sf-mono','apple-new-york','inter-bundled','source-han-bundled','source-code-bundled'])assert.ok(FONT_OPTIONS.some(row=>row.id===id));
});

test('native settings retain builtin selection and font roles without storing font bytes in the literature library',async()=>{
  await mkdir('.local/tests',{recursive:true});const root=await mkdtemp(path.resolve('.local/tests/builtin-fonts-'));
  const lib=await new LocalLibrary(root).init();
  const value=cleanThemePreferences({selected:'liquid-glass',themes:[],fonts:{body:'apple-sf-pro',heading:'apple-new-york',numeric:'inter-bundled',mono:'apple-sf-mono'}});
  await lib.setSetting('themePreferences',value);const restored=(await new LocalLibrary(root).init()).getSetting('themePreferences');
  assert.deepEqual(restored,value);assert.deepEqual(restored.themes,[]);assert.ok(JSON.stringify(restored).length<600);
  assert.ok(resolveTheme(restored).tokens['--serif'].includes('Materia New York'));
});

test('bundled open font resources include real font signatures and original license files',async()=>{
  for(const [file,magic] of [['InterVariable.woff2','wOF2'],['SourceHanSansCN-VF.otf.woff2','wOF2'],['SourceCodePro-Regular.ttf','\x00\x01\x00\x00']]){
    const bytes=await readFile(new URL('../dist/fonts/'+file,import.meta.url));assert.equal(bytes.subarray(0,4).toString('latin1'),magic);assert.ok(bytes.length>10000);
  }
  for(const file of ['Inter-LICENSE.txt','SourceHanSans-LICENSE.txt','SourceCodePro-LICENSE.md'])assert.match(await readFile(new URL('../dist/fonts/'+file,import.meta.url),'utf8'),/OPEN FONT LICENSE/i);
});

test('private Apple build resources retain actual font bytes and original RTF licenses',async t=>{
  let present;try{present=await readFile(new URL('../dist/fonts/apple/SF-Pro.ttf',import.meta.url));}catch(error){if(error.code==='ENOENT'){t.skip('Apple binaries are private local resources, excluded from Git');return;}throw error;}
  assert.equal(present.subarray(0,4).toString('latin1'),'\x00\x01\x00\x00');
  for(const [file,magic] of [['NewYork.ttf','\x00\x01\x00\x00'],['SFMono-Regular.otf','OTTO'],['SFMono-Semibold.otf','OTTO']]){
    const bytes=await readFile(new URL('../dist/fonts/apple/'+file,import.meta.url));assert.equal(bytes.subarray(0,4).toString('latin1'),magic);
  }
  for(const file of ['SF-Pro-LICENSE.rtf','SF-Mono-LICENSE.rtf','New-York-LICENSE.rtf']){
    const bytes=await readFile(new URL('../dist/fonts/apple/'+file,import.meta.url));assert.ok(bytes.length<65536);assert.ok(bytes.toString().startsWith('{\\rtf'));
  }
});
