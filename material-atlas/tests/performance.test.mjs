import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, markdownTemplate } from '../dist/markdown.js';
import { normalizeMeasurements, parameterOptions, parameterKey, chartDataset, measurementsCSV } from '../dist/parameters.js';
import { parseMetadata, matchRecords, mergeImportNotes, planBatch } from '../dist/import-plan.js';
import { LocalLibrary } from '../desktop/library.mjs';
import { readBackup, createBackup } from '../dist/storage.js';
import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import { isOldExample, removeOldExampleNotes } from '../dist/example-migration.js';

const md=`# Materia 文献批量元数据
格式版本: 1
## 文献 1
- 文件名: a.pdf
- 标题: A full title
- 发表年份: 2024
- 期刊: Journal A
- 标签: 二维材料，界面
### 作者与机构
| 作者 | 机构 |
| --- | --- |
| Author A | Institute A；Institute B |
### 性能参数
| 样品 | 参数名称 | 数值 | 单位 | 测试条件 | 来源 | 限定符 | 误差 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | 比容量 | 182.5 | mAh/g | 0.1 C; 25 °C | Fig. 2 | | 2.1 |
| S1 | 电导率 | 1.2e-3 | S/cm | 0.1 C; 25 °C | Table 1 | | |
### 文献笔记
#### 笔记一
观察 [[#二维材料]]。
### 标签笔记
#### #二维材料
参考 [[A full title]]。
## 文献 2
- 文件名: b.pdf
- 标题: B full title
- 发表年份: 2025
- 标签: 二维材料
### 性能参数
| 样品 | 参数名称 | 数值 | 单位 | 测试条件 | 来源 |
| --- | --- | --- | --- | --- | --- |
| S2 | 比容量 | 210 | mAh/g | 0.1 C; 25 °C | Fig. 3 |
`;
const base=(id,filename)=>({id,filename,title:filename,tags:[],measurements:[],favorite:false,addedAt:1,file:new Blob(['%PDF-1.4\n']),year:''});
const record=parseMarkdown(md);

test('one Markdown imports multiple papers with separate numeric names, units, conditions and notes',()=>{
  assert.equal(record.length,2);assert.equal(record[0].measurements[0].name,'比容量');assert.equal(record[0].measurements[0].value,182.5);assert.equal(record[0].measurements[1].value,.0012);assert.equal(record[0].measurements[0].uncertainty,2.1);
  const result=matchRecords(record,[base('p1','a.pdf'),base('p2','b.pdf')]);
  assert.equal(result.updates.length,2);assert.deepEqual(result.updates[0].authorDetails[0].affiliations,['Institute A','Institute B']);assert.equal(result.notes.length,2);
  const notes=mergeImportNotes({},result.notes);assert.equal(mergeImportNotes(notes,result.notes)['paper:p1'].length,1);
});
test('empty template does not erase existing metadata, invalid combined values fail before import',()=>{
  const existing={...base('p1','a.pdf'),tags:['keep'],measurements:record[0].measurements};
  const result=matchRecords(parseMarkdown(markdownTemplate(['a.pdf'])),[existing]);assert.deepEqual(result.updates[0].tags,['keep']);assert.equal(result.updates[0].measurements.length,2);
  assert.throws(()=>parseMarkdown(md.replace('182.5','182.5 mAh/g')),/独立数字/);
  assert.throws(()=>parseMarkdown(md.replace('格式版本: 1','格式版本: 2')),/版本/);
  assert.throws(()=>normalizeMeasurements([{name:'X',value:'182 ± 2'}]),/独立数字/);
});
test('batch plan deduplicates files, matches case-insensitive filenames and supports metadata-only updates',async()=>{
  const file=name=>Object.assign(new Blob(['%PDF-1.4\n']),{name,lastModified:1});
  const planned=await planBatch([file('A.PDF'),file('b.pdf'),file('copy.pdf')],record,[],{fingerprint:async f=>f.name==='b.pdf'?'hash-b':'hash-a'});
  assert.equal(planned.added,2);assert.equal(planned.duplicates,1);assert.equal(planned.updates[0].measurements[0].value,182.5);assert.equal(planned.notes.length,2);
  const existing=planned.updates.map(p=>({...p,file:null}));
  const only=await planBatch([],record,existing);assert.equal(only.added,0);assert.equal(only.updated,2);
  assert.equal(parseMetadata('\uFEFF'+JSON.stringify({papers:record})).length,2);
  assert.equal(parseMetadata('```markdown\n'+md+'\n```').length,2);
});
test('example cleanup only targets explicit bundled identifiers or exact synthetic bytes',()=>{
  assert.equal(isOldExample({id:'real-1',title:'测试文献与示范材料',tags:['示例']}),false);
  assert.equal(isOldExample({id:'demo-0-0',demo:true}),true);
  assert.equal(isOldExample({id:'x',fingerprint:'5e5800d0792c93c2ea1f2db5745847770fdde5836b877c9c564feeb1fe29bf66'}),true);
  const clean=removeOldExampleNotes({'paper:old':[{id:'n1',body:'test'}],'paper:real':[{id:'n2',body:'keep'}]},new Set(['old']));
  assert.deepEqual(Object.keys(clean),['paper:real']);
});
test('same-name different-unit data stay separate; year charts retain all observations',()=>{
  const papers=record.map((r,i)=>({...r,id:'p'+i,measurements:r.measurements,tags:['A']}));papers[1].measurements.push({id:'other',name:'比容量',value:.21,unit:'Ah/g',sample:'S2',conditions:''});
  const options=parameterOptions(papers);assert.equal(options.filter(o=>o.name==='比容量').length,2);
  const result=chartDataset(papers,{x:'year',y:'m:'+parameterKey('比容量','mAh/g'),group:'all',condition:'*'});assert.deepEqual(result.points.map(p=>[p.x,p.y]),[[2024,182.5],[2025,210]]);
  papers[1].year='2024';assert.equal(chartDataset(papers,{x:'year',y:'m:'+parameterKey('比容量','mAh/g'),group:'all'}).points.length,2);
});
test('parameter X/Y pairs by sample and skips ambiguous data without inventing averages',()=>{
  const p={...record[0],id:'p',tags:record[0].tags};const c={x:'m:'+parameterKey('电导率','S/cm'),y:'m:'+parameterKey('比容量','mAh/g'),group:'all'};
  assert.equal(chartDataset([p],c).points[0].x,.0012);
  const ambiguous={...p,measurements:[...p.measurements,{...p.measurements[1],id:'dup',value:.003}]};assert.equal(chartDataset([ambiguous],c).points.length,0);assert.equal(chartDataset([ambiguous],c).skipped.ambiguous,1);
  const qualified={...p,measurements:[{...p.measurements[0],qualifier:'≥'}]};assert.equal(chartDataset([qualified],{x:'year',y:'m:'+parameterKey('比容量','mAh/g')}).skipped.qualified,1);
});
test('performance values survive disk reopen and complete backup; CSV keeps separate columns',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'performance-'))).init();
  const input={...base('p1','a.pdf'),...record[0],id:'p1',fileBytes:Buffer.from('%PDF-1.4\nperformance test\n%%EOF')};delete input.file;
  await lib.putPapers([input]);const reopened=await new LocalLibrary(lib.root).init();assert.equal(reopened.getPapers()[0].measurements[0].value,182.5);
  const backup={format:'materia-backup',version:1,collections:[],papers:[{...input,fileBase64:Buffer.from('%PDF-1.4\n').toString('base64')}]};const restored=readBackup(backup);assert.equal(restored.papers[0].measurements[1].unit,'S/cm');
  const csv=measurementsCSV(restored.papers);assert.match(csv,/"参数名称","数值","单位"/);assert.match(csv,/"比容量","182.5","mAh\/g"/);
});
