import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as echarts from 'echarts';
import { parameterInventory, parameterResults, parameterRecordPreview } from '../dist/parameter-index.js';
import { parameterKey } from '../dist/parameters.js';
import { chartDataset, figureDataCSV } from '../dist/chart-data.js';
import { buildFigure, FIGURE_DEFAULTS, validateFigureSettings } from '../dist/figure.js';
import { participationCSV } from '../dist/comparison-ui.js';
import { cleanAssociations, associationInventory, associationMatches, associationLocalPapers } from '../dist/associations.js';
import { createNetwork, stepNetwork } from '../dist/force-layout.js';
import { GRAPH_DEFAULTS, placeNodeLabels } from '../dist/graph-settings.js';
import { LocalLibrary } from '../desktop/library.mjs';

const esc=value=>String(value??'').replaceAll('<','&lt;').replaceAll('>','&gt;');
const metric=(value,extra={})=>({name:'Strength',unit:'MPa',value,sample:'S1',conditions:'RT',source:'Fig. 2',...extra});
const paper=(id,measurements,extra={})=>({id,title:`Paper ${id}`,year:'2024',tags:[],authorDetails:[],measurements,...extra});
const axis='m:'+parameterKey('Strength','MPa');
const settings={...FIGURE_DEFAULTS,y:axis};

test('whole-library parameter index includes singleton names, all units and invalid/missing numbers',()=>{
  const papers=[paper('a',[metric(10),metric(20)]),paper('b',[metric('',{name:'  STRENGTH ',unit:'GPa'})]),paper('c',[metric('not numeric',{name:'Hc',unit:'A/m'})]),paper('d',[metric(1,{name:'Bs',unit:'T'})])];
  const index=parameterInventory(papers);
  assert.equal(index.find(row=>row.key==='strength').paperCount,2);
  assert.equal(index.find(row=>row.key==='strength').records,3);
  assert.equal(index.find(row=>row.key==='hc').paperCount,1);
  assert.deepEqual(parameterResults(papers,'STRENGTH').map(p=>p.id),['a','b']);
  assert.deepEqual(parameterResults(papers,'strength','GPa').map(p=>p.id),['b']);
  assert.equal(index.length,3);
  const html=parameterRecordPreview(paper('e',[metric('<script>',{sample:'<bad>',conditions:'test',source:'Table 1'})]),'strength','*',esc);
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;bad&gt;'));assert.ok(html.includes('Table 1'));
});

test('per-paper audit retains all selected members and explains units, invalid, missing, condition and qualifier exclusions',()=>{
  const papers=[paper('ok',[metric(10)]),paper('unit',[metric(1,{unit:'GPa'})]),paper('invalid',[metric('')]),paper('year',[metric(9)],{year:''}),paper('condition',[metric(8,{conditions:'High T'})]),paper('approx',[metric(11,{qualifier:'≈'})]),paper('absent',[])];
  const data=chartDataset(papers,{...settings,condition:'RT'});
  assert.equal(data.summary.selectedPapers,7);assert.equal(data.summary.recordedPapers,6);assert.equal(data.summary.plottedPapers,1);
  assert.deepEqual(data.paperStatus.map(row=>Object.keys(row.reasons)[0]||'included'),['included','unit','invalid','missing','condition','qualified','parameter']);
  assert.equal(data.paperStatus.length,papers.length);
  assert.match(participationCSV(data),/同名参数使用其他单位/);
  assert.equal(chartDataset(papers,{...settings,includeQualified:true}).summary.plottedPapers,3);
});

test('log, range and sample exclusions are explicit; bars can compare papers without a year',()=>{
  const papers=[paper('zero',[metric(0)]),paper('negative',[metric(-1)]),paper('low',[metric(5)]),paper('high',[metric(50)]),paper('no-year',[metric(15)],{year:''})];
  const data=chartDataset(papers,{...settings,yScale:'log',yMin:'10',yMax:'20'});
  assert.equal(data.paperStatus[0].reasons.nonpositive,1);assert.equal(data.paperStatus[1].reasons.nonpositive,1);
  assert.equal(data.paperStatus[2].reasons.range,1);assert.equal(data.paperStatus[3].reasons.range,1);
  assert.equal(data.paperStatus[4].reasons.missing,1);
  const bars=chartDataset(papers,{...settings,type:'bar'});assert.equal(bars.summary.plottedPapers,5);
  const sample=chartDataset(papers,{...settings,sample:'missing'});assert.ok(sample.paperStatus.every(row=>row.reasons.sample===1));
});

test('XY points pair by sample and condition, preserve both errors and never merge same-title papers',()=>{
  const p=paper('a',[metric(10,{uncertainty:2}),metric(4,{name:'Density',unit:'g/cm3',uncertainty:.1})]);
  const data=chartDataset([p],{...settings,x:'m:'+parameterKey('Density','g/cm3')});
  assert.equal(data.points[0].x,4);assert.equal(data.points[0].y,10);assert.equal(data.points[0].xUncertainty,.1);assert.equal(data.points[0].yUncertainty,2);
  assert.match(figureDataCSV(data,'Density','Strength'),/X误差/);
  const result=buildFigure([p,{...p,id:'b'}],{...settings,group:'paper'});
  assert.equal(result.option.series.filter(s=>s.type==='line').length,2);
  assert.equal(result.option.xAxis.min,2023);assert.equal(result.option.xAxis.max,2025);assert.equal(result.option.xAxis.axisLabel.formatter(2024),'2024');
  const ambiguous=chartDataset([paper('a',[...p.measurements,metric(5,{name:'Density',unit:'g/cm3'})])],{...settings,x:'m:'+parameterKey('Density','g/cm3')});
  assert.equal(ambiguous.paperStatus[0].reasons.ambiguous,1);
});

test('axis bounds reject mixed units, blank coercion, reversed intervals and nonpositive log references',()=>{
  assert.throws(()=>validateFigureSettings({...settings,yMin:'10 MPa'}),/独立数字/);
  assert.throws(()=>validateFigureSettings({...settings,yMin:' '}),/独立数字/);
  assert.throws(()=>validateFigureSettings({...settings,yMin:'20',yMax:'10'}),/小于/);
  assert.throws(()=>validateFigureSettings({...settings,yScale:'log',referenceY:'0'}),/大于/);
  assert.throws(()=>validateFigureSettings({...settings,referenceY:'0x10'}),/独立数字/);
  assert.doesNotThrow(()=>validateFigureSettings({...settings,yMin:'1e-4',yMax:'10'}));
});

test('manual association directory uses actual metadata, includes one-paper tags, deduplicates and supports zero visible matches',()=>{
  const papers=[paper('a',[],{tags:['Solo','Shared'],authorDetails:[{name:'Ada',affiliations:['Institute A']}]}),paper('b',[],{tags:['Shared'],year:'2023',authors:'Unstructured name',authorDetails:[]})];
  assert.equal(associationInventory(papers,'tag').find(row=>row.value==='Solo').count,1);
  assert.deepEqual(associationInventory(papers,'institution').map(row=>row.value),['Institute A']);
  assert.deepEqual(associationInventory(papers,'author').map(row=>row.value),['Ada']);
  const rules=cleanAssociations([{kind:'tag',value:'Solo'},{kind:'tag',value:' solo '},{kind:'year',value:'2023'},{kind:'institution',value:'Institute A'},{kind:'author',value:'Ada'},{kind:'invalid',value:'x'}]);
  assert.equal(rules.length,4);assert.ok(associationMatches(papers[0],rules[0]));
  const initial=createNetwork(papers,[]);assert.equal(initial.edges.length,0);assert.equal(initial.nodes.length,2);
  const active=createNetwork(papers,[],{},rules);assert.equal(active.edges.length,4);
  const filtered=createNetwork([papers[1]],[],{},rules);assert.equal(filtered.nodes.filter(n=>n.type==='relation').length,4);assert.equal(filtered.edges.length,1);
  const cleared=createNetwork(papers,[],{},[]);assert.equal(cleared.edges.length,0);assert.equal(cleared.nodes.length,2);
});

test('explicit association springs respond to dragging, respect pins and local depth uses only active rules',()=>{
  const papers=[paper('a',[],{tags:['A']}),paper('b',[],{tags:['A','B']}),paper('c',[],{tags:['B']}),paper('d',[],{tags:['C']})],rules=cleanAssociations([{kind:'tag',value:'A'},{kind:'tag',value:'B'}]);
  assert.deepEqual(associationLocalPapers(papers,rules,'a',0).map(p=>p.id),['a']);
  assert.deepEqual(associationLocalPapers(papers,rules,'a',1).map(p=>p.id),['a','b']);
  assert.deepEqual(associationLocalPapers(papers,rules,'a',2).map(p=>p.id),['a','b','c']);
  assert.deepEqual(associationLocalPapers(papers,[],'a',2).map(p=>p.id),['a']);
  const graph=createNetwork(papers,[],{},rules),helper=graph.nodes.find(n=>n.type==='relation');
  helper.x=900;helper.y=520;helper.dragging=true;
  const member=graph.byId.get('paper:a'),before={x:member.x,y:member.y};
  for(let i=0;i<30;i++)stepNetwork(graph,.8,{...GRAPH_DEFAULTS,repulsion:.25,center:0,linkStrength:2});
  assert.equal(helper.x,900);assert.equal(helper.y,520);assert.notEqual(member.x,before.x);
  helper.dragging=false;helper.pinned=true;stepNetwork(graph,.8);assert.equal(helper.x,900);
  helper.pinned=false;stepNetwork(graph,.8);assert.notEqual(helper.x,900);
});

test('zoom label placement handles relation types and keeps visible label rectangles apart',()=>{
  const papers=Array.from({length:34},(_,i)=>paper(String(i),[],{title:'材料测试与结构性能研究 '+i,tags:['Shared']}));
  const graph=createNetwork(papers,[],{},cleanAssociations([{kind:'tag',value:'Shared'},{kind:'year',value:'2024'}]));
  for(let i=0;i<100;i++)stepNetwork(graph,.7);
  const low=placeNodeLabels(graph.nodes,{scale:.6,activeId:'paper:0'}),high=placeNodeLabels(graph.nodes,{scale:1.8,panX:-400,panY:-248,activeId:'paper:0'});
  assert.ok(low.size<=1);assert.ok(high.size>low.size);
  const boxes=[...high.values()].map(item=>item.box);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
});

test('view settings persist across disk reopen without altering paper data',async()=>{
  const parent=path.resolve('.local/tests');await mkdir(parent,{recursive:true});const lib=await new LocalLibrary(await mkdtemp(path.join(parent,'views-'))).init();
  await lib.putPapers([{...paper('a',[metric(10)]),fileBytes:Buffer.from('%PDF-1.4\n% view preference fixture\n%%EOF')}]);const before=lib.getPapers();
  await lib.setSetting('graphAssociations',cleanAssociations([{kind:'year',value:'2024'}]));
  await lib.setSetting('graphPreferences',{repulsion:3,localDepth:2});await lib.setSetting('chartPreferences',{...settings,type:'bar',errorBars:true});
  const reopened=await new LocalLibrary(lib.root).init();assert.deepEqual(reopened.getPapers(),before);
  assert.equal(reopened.getSetting('graphAssociations').length,1);assert.equal(reopened.getSetting('graphPreferences').repulsion,3);assert.equal(reopened.getSetting('chartPreferences').type,'bar');
});

test('ECharts renders standalone scientific SVG for line/scatter/bar with errors, log scales and reference lines',async()=>{
  const folder=path.resolve('.local/verification');await mkdir(folder,{recursive:true});
  const papers=[paper('a',[metric(10,{uncertainty:1})]),paper('b',[metric(20,{uncertainty:2})],{year:'2025'})];
  for(const type of ['line','scatter','bar']){
    const figure=buildFigure(papers,{...settings,type,yScale:'log',referenceY:'15',pointLabels:true},{},{width:1600,height:1000});
    const chart=echarts.init(null,null,{renderer:'svg',ssr:true,width:1600,height:1000});
    try{chart.setOption(figure.option);const svg=chart.renderToSVGString();assert.match(svg,/<svg[^>]+width="1600"/);assert.match(svg,/Strength/);assert.ok(!svg.includes('NaN'));assert.ok(figure.option.series.some(s=>s.type==='custom'));await writeFile(path.join(folder,`scientific-${type}.svg`),svg);}finally{chart.dispose();}
  }
});
