// A fresh browser library, synthetic PDF and local preview; no private data or AI service.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.MATERIA_PLAYWRIGHT||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),output=path.join(root,'.local','materials-verification');
let server,browser,page;const checks=[],errors=[];
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
const ready=()=>page.locator('.import-main:not([disabled])').waitFor({state:'attached'});
const close=()=>page.locator('#modal [data-action="close-modal"]').last().click();
const saved=()=>page.waitForFunction(()=>!document.querySelector('#modal').open);
const records=()=>page.evaluate(async()=>await(await import('/storage.js')).getPapers());
const capture=name=>page.screenshot({path:path.join(output,name+'.png')});
const materialField=(index,field)=>page.locator(`[data-material-index="${index}"][data-material-field="${field}"]`);
const parameterField=(index,row,field)=>page.locator(`[data-material-index="${index}"][data-performance-row="${row}"][data-performance-field="${field}"]`);
async function importMD(text){await page.locator('#ribbon-import').click();await page.locator('#md-input').setInputFiles({name:'materials.md',mimeType:'text/markdown',buffer:Buffer.from(text)});await page.locator('#batch-submit').click();await page.locator('#batch-submit').filter({hasText:'确认导入'}).waitFor();await page.locator('#batch-submit').click();await saved();}
async function main(){
  await fs.mkdir(output,{recursive:true});const {createPreviewServer}=await import(pathToFileURL(path.join(root,'server.mjs')));server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.MATERIA_CHROME||path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe')});page=await browser.newPage({viewport:{width:1395,height:960},acceptDownloads:true});page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();
  const {PDFDocument,StandardFonts}=require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdf-lib'));const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage([612,792]).drawText('Synthetic materials fixture',{x:40,y:700,size:16,font});const pdfBytes=Buffer.from(await pdf.save());
  const md=`# Materia 文献批量元数据\n格式版本: 2\n## 文献 1\n- 文件名: materials.pdf\n- 标题: 多材料研究（验证样本）\n- 发表年份: 2025\n### 材料\n`+['A','B'].map((name,index)=>`#### 材料 ${index+1}\n- 材料ID: alloy-${name.toLowerCase()}\n- 名称: 合金 ${name}\n- 成分 / 配方: Fe${index?'Co':'Ni'}\n##### 性能参数\n| 样品 | 参数名称 | 数值 | 单位 | 测试条件 | 来源 |\n| --- | --- | --- | --- | --- | --- |\n| S1 | X | ${index+1} | MPa | RT | Fig. 1 |\n| S1 | Y | ${(index+1)*10} | MPa | RT | Fig. 2 |\n`).join('\n');
  await check('real PDF and version 2 MD import create two materials and download the matching new template',async()=>{
    await page.locator('#ribbon-import').click();await page.locator('#pdf-input').setInputFiles({name:'materials.pdf',mimeType:'application/pdf',buffer:pdfBytes});
    const download=page.waitForEvent('download');await page.locator('[data-batch-action="template"]').click();const file=await download;await file.saveAs(path.join(output,'downloaded-template.md'));const template=await fs.readFile(path.join(output,'downloaded-template.md'),'utf8');assert.match(template,/格式版本: 2/);assert.match(template,/materials.pdf/);assert.match(template,/#### 材料 2/);
    await page.locator('#md-input').setInputFiles({name:'materials.md',mimeType:'text/markdown',buffer:Buffer.from(md)});await page.locator('#batch-submit').click();await page.locator('#batch-submit').filter({hasText:'确认导入'}).waitFor();assert.match(await page.locator('#batch-preview').textContent(),/2 个材料 · 4 条性能参数/);await page.locator('#batch-submit').click();await saved();
    assert.equal((await records())[0].materials.length,2);assert.equal(await page.locator('.material-preview').count(),2);await capture('material-detail');
  });
  await check('editing adds a material, keeps other material values and IDs, and persists across reload',async()=>{
    await page.locator('[data-action="performance-editor"]').click();await materialField(0,'name').fill('合金 A（退火态）');await page.locator('[data-material-add]').click();await materialField(2,'name').fill('复合材料 C');await materialField(2,'composition').fill('FeNi / C');await page.locator('[data-performance-add="2"]').click();await parameterField(2,0,'name').fill('电导率');await parameterField(2,0,'value').fill('1.2e-3');await parameterField(2,0,'unit').fill('S/cm');await capture('material-editor');
    await page.locator('#performance-editor-form [type="submit"]').click();await saved();await page.reload();await ready();const p=(await records())[0];assert.deepEqual(p.materials.map(m=>[m.id.startsWith('alloy-')?m.id:'new',m.name,m.measurements.length]),[['alloy-a','合金 A（退火态）',2],['alloy-b','合金 B',2],['new','复合材料 C',1]]);assert.equal(p.materials[2].measurements[0].value,.0012);assert.equal(p.measurements,undefined);
  });
  await check('UI comparison and plot keep materials distinct even with the same sample ID; CSV names ownership',async()=>{
    await page.locator('[data-view="list"]').click();await page.locator('[data-compare-id]').first().check();await page.locator('#selection-primary').click();assert.match(await page.locator('.comparison-table').textContent(),/合金 B/);assert.match(await page.locator('.comparison-table').textContent(),/合金 A（退火态）/);
    await page.locator('[data-comparison-tab="chart"]').click();await page.locator('[data-chart-setting="x"]').selectOption('m:x\u241fMPa');await page.locator('[data-chart-setting="y"]').selectOption('m:y\u241fMPa');await page.locator('[data-chart-setting="group"]').selectOption('material');await page.locator('#chart-point-count').filter({hasText:'2 个观测点'}).waitFor();await capture('materials-chart');
    await page.locator('[data-menu-toggle="figure-export-options"]').click();const download=page.waitForEvent('download');await page.locator('[data-comparison-action="export-figure-csv"]').click();const file=await download;await file.saveAs(path.join(output,'materials-plot.csv'));const csv=await fs.readFile(path.join(output,'materials-plot.csv'),'utf8');assert.match(csv,/材料名称/);assert.match(csv,/alloy-a/);assert.match(csv,/alloy-b/);await close();
  });
  await check('cancelling deletion keeps all materials; saving removes only the chosen material',async()=>{
    const before=(await records())[0].materials;await page.locator('[data-action="performance-editor"]').click();await page.locator('[data-material-remove="1"]').click();await close();assert.deepEqual((await records())[0].materials,before);
    await page.locator('[data-action="performance-editor"]').click();await page.locator('[data-material-remove="1"]').click();await page.locator('#performance-editor-form [type="submit"]').click();await saved();assert.deepEqual((await records())[0].materials.map(m=>m.id),[before[0].id,before[2].id]);
  });
  await check('invalid values and failed disk writes keep the editor and original data; retry saves a valid edit',async()=>{
    const before=(await records())[0].materials;await page.locator('[data-action="performance-editor"]').click();await parameterField(0,0,'value').fill('12 MPa');await page.locator('#performance-editor-form [type="submit"]').click();await page.locator('#performance-error').filter({hasText:'独立数字'}).waitFor();assert.deepEqual((await records())[0].materials,before);
    await parameterField(0,0,'value').fill('12.5');await page.evaluate(()=>{globalThis.__originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='papers')throw new DOMException('Synthetic write failure','QuotaExceededError');return globalThis.__originalPut.apply(this,args);};});await page.locator('#performance-editor-form [type="submit"]').click();await page.locator('#performance-error').filter({hasText:'Synthetic write failure'}).waitFor();assert.deepEqual((await records())[0].materials,before);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=globalThis.__originalPut;delete globalThis.__originalPut;});await page.locator('#performance-editor-form [type="submit"]').click();await saved();assert.equal((await records())[0].materials[0].measurements[0].value,12.5);
  });
  await check('an empty new template preserves materials, and a complete MD update replaces the material list',async()=>{
    const before=(await records())[0].materials;const {markdownTemplate}=await import(pathToFileURL(path.join(root,'dist/markdown.js')));await importMD(markdownTemplate(['materials.pdf']));assert.deepEqual((await records())[0].materials,before);
    await importMD(md);assert.deepEqual((await records())[0].materials.map(m=>m.name),['合金 A','合金 B']);assert.equal((await records())[0].materials[0].measurements[0].value,1);
  });
  await check('large fonts and a narrow window keep the material editor usable; PDF bytes stay unchanged',async()=>{
    await page.locator('[data-menu-toggle="workspace-menu"]').click();await page.locator('#ribbon-theme').click();await page.locator('[data-theme-font-scale]').evaluate(el=>{el.value='150';el.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForFunction(()=>!document.querySelector('[data-theme-font-scale]').disabled);await close();await page.setViewportSize({width:700,height:900});await page.locator('[data-action="performance-editor"]').click();await materialField(1,'name').scrollIntoViewIfNeeded();assert.equal(await page.locator('#modal').evaluate(el=>el.scrollWidth>el.clientWidth),false);assert.equal(await materialField(1,'name').isVisible(),true);await capture('materials-editor-150-narrow');await close();
    const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await(await(await import('/storage.js')).getPapers())[0].file.arrayBuffer())));assert.deepEqual(Buffer.from(bytes),pdfBytes);
  });
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({passed:checks.length,checks,errors,syntheticDataOnly:true},null,2));
}
main().catch(async error=>{console.error(error);if(page)await capture('failure').catch(()=>{});process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());});
