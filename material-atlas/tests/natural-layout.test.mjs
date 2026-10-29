import test from 'node:test';
import assert from 'node:assert/strict';
import {solveNaturalLayout,evaluateNaturalLayout} from '../dist/natural-layout.js';
const fixture=(count=45)=>({height:620,activeId:'paper:0',nodes:Array.from({length:count},(_,i)=>({id:'paper:'+i,type:'paper',title:'Materials structure '+i+' · 材料研究',group:'folder-'+Math.floor(i/15),radius:7,x:500,y:310,pinned:false})),edges:[]});
test('one click separates piled nodes, improves label visibility and is deterministic under input reordering',async()=>{
  const source=fixture(),before=structuredClone(source),result=await solveNaturalLayout(source),again=await solveNaturalLayout({...source,nodes:[...source.nodes].reverse()});
  assert.deepEqual(source,before);assert.deepEqual(result.points,again.points);assert.equal(result.points.length,45);assert.ok(result.after.score<result.before.score*.3);assert.equal(result.after.overlaps,0);assert.ok(result.after.labels>result.before.labels+10);
  for(const point of result.points){assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.equal(point.pinned,false);}
});
test('real linked clusters stay together, artificial relationships never enter the input or result',async()=>{
  const input=fixture(30);for(let group=0;group<3;group++){
    const id='relation:'+group;input.nodes.push({id,type:'relation',title:'Tag '+group,radius:10,x:500,y:310});for(let i=group*10;i<(group+1)*10;i++)input.edges.push({source:'paper:'+i,target:id});
  }
  const edges=structuredClone(input.edges),result=await solveNaturalLayout(input),byId=new Map(result.points.map(p=>[p.id,p]));
  assert.deepEqual(input.edges,edges);assert.ok(!('edges' in result));assert.equal(result.after.overlaps,0);
  const average=(a,b)=>{let total=0;for(const i of a)for(const j of b)total+=Math.hypot(byId.get('paper:'+i).x-byId.get('paper:'+j).x,byId.get('paper:'+i).y-byId.get('paper:'+j).y);return total/(a.length*b.length);};
  assert.ok(average([0,1,2],[3,4,5])<average([0,1,2],[20,21,22]));
});
test('pins remain exact unless explicitly released and empty/single/all-fixed layouts are finite',async()=>{
  const source=fixture(20);Object.assign(source.nodes[0],{x:170,y:120,pinned:true});Object.assign(source.nodes[1],{x:850,y:490,pinned:true});
  const fixed=await solveNaturalLayout(source);for(const node of source.nodes.filter(n=>n.pinned))assert.deepEqual(fixed.points.find(p=>p.id===node.id),{id:node.id,x:node.x,y:node.y,pinned:true});
  const released=await solveNaturalLayout(source,{releasePins:true});assert.ok(released.points.every(p=>!p.pinned));assert.equal(source.nodes[0].pinned,true);
  for(const input of [fixture(0),fixture(1),{...source,nodes:source.nodes.map(n=>({...n,pinned:true}))}]){const result=await solveNaturalLayout(input);assert.equal(result.points.length,input.nodes.length);assert.ok(Number.isFinite(result.camera.scale));}
});
test('dense and tall viewports fit the graph and abort is observed between batches',async()=>{
  const input=fixture(180);input.height=1000;const result=await solveNaturalLayout(input);
  for(const p of result.points){const x=p.x*result.camera.scale+result.camera.x,y=p.y*result.camera.scale+result.camera.y;assert.ok(x>=0&&x<=1000);assert.ok(y>=0&&y<=1000);}
  assert.equal(result.after.overlaps,0);const controller=new AbortController();let batches=0;
  await assert.rejects(solveNaturalLayout(fixture(),{}, {signal:controller.signal,yieldTask:async()=>{if(++batches===2)controller.abort();}}),{name:'AbortError'});assert.equal(batches,2);
});
