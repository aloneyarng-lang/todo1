export const GRAPH_DEFAULTS = {center:.35,repulsion:2.2,linkStrength:.65,linkDistance:145,nodeSize:1,linkWidth:.8,labelThreshold:1.3,showRelations:true,colorBy:'tag',localMode:false,localDepth:1};
export function cleanGraphSettings(value = {}) {
  const output={...GRAPH_DEFAULTS},limits={center:[0,2],repulsion:[.25,4],linkStrength:[.1,2],linkDistance:[40,250],nodeSize:[.6,2],linkWidth:[.3,2.5],labelThreshold:[.5,2.5],localDepth:[0,2]};
  for(const [key,[min,max]]of Object.entries(limits))if(Number.isFinite(Number(value[key])))output[key]=Math.max(min,Math.min(max,Number(value[key])));
  output.localDepth=Math.round(output.localDepth);
  for(const key of ['showRelations','localMode'])if(typeof value[key]==='boolean')output[key]=value[key];
  if(['tag','journal','collection'].includes(value.colorBy))output.colorBy=value.colorBy;
  return output;
}

export function localPapers(papers,groups,id,depth=1) {
  if(!id||!papers.some(p=>p.id===id))return papers;
  const allowed=new Set(groups.map(group=>group.name)),selected=new Set([id]);
  for(let layer=0;layer<depth;layer++){
    const tags=new Set(papers.filter(p=>selected.has(p.id)).flatMap(p=>p.tags).filter(tag=>allowed.has(tag)));
    for(const paper of papers)if(paper.tags.some(tag=>tags.has(tag)))selected.add(paper.id);
  }
  return papers.filter(paper=>selected.has(paper.id));
}

const intersects=(a,b,padding=4)=>a.x<b.x+b.width+padding&&a.x+a.width+padding>b.x&&a.y<b.y+b.height+padding&&a.y+a.height+padding>b.y;
const widthOf=(text,font)=>[...text].reduce((sum,char)=>sum+font*(char.charCodeAt(0)>255?.96:.54),0);
export function placeNodeLabels(nodes,options={}) {
  const {scale=1,viewportScale=1,panX=0,panY=0,activeId='',relatedIds=new Set(),showLabels=true,threshold=1.3,measureText=widthOf}=options;
  const boxes=[{x:0,y:585,width:380,height:35},{x:800,y:575,width:200,height:45}],placed=new Map(),fontFor=node=>(node.id===activeId?11:10.5*Math.min(1.2,Math.pow(scale,.25)))/(scale*Math.max(.1,viewportScale));
  const candidates=nodes.filter(node=>node.id===activeId || node.type==='relation'&&scale>=.72 || showLabels&&node.type==='paper'&&scale>=threshold).sort((a,b)=>Number(b.id===activeId)-Number(a.id===activeId)||Number(relatedIds.has(b.id))-Number(relatedIds.has(a.id))||Number(b.type==='relation')-Number(a.type==='relation')||(b.members?.length||0)-(a.members?.length||0));
  for(const node of candidates){
    const active=node.id===activeId,font=fontFor(node),raw=node.type==='relation'?node.label:node.paper.title;
    const limit=node.type==='relation'?23:active?72:42,text=raw.length>limit?raw.slice(0,limit-1)+'…':raw;
    const lines=active&&node.type==='paper'&&text.length>35?[text.slice(0,35),text.slice(35)]:[text];
    const width=Math.max(...lines.map(line=>measureText(line,font)))+font*.2,height=lines.length*font*1.35,radius=node.radius+7;
    const choices=[{x:radius,y:-font*.8,anchor:'start'},{x:-radius-width,y:-font*.8,anchor:'start'},{x:-width/2,y:radius+3,anchor:'start'},{x:-width/2,y:-radius-height,anchor:'start'}];
    for(const choice of choices){
      const box={x:(node.x+choice.x)*scale+panX,y:(node.y+choice.y)*scale+panY,width:width*scale,height:height*scale};
      if(box.x<10||box.y<10||box.x+box.width>990||box.y+box.height>610||boxes.some(previous=>intersects(box,previous)))continue;
      if(!active && nodes.some(other=>other.id!==node.id && intersects(box,{x:other.x*scale+panX-other.radius*scale-2,y:other.y*scale+panY-other.radius*scale-2,width:(other.radius*2+4)*scale,height:(other.radius*2+4)*scale},1)))continue;
      boxes.push(box);placed.set(node.id,{x:choice.x,y:choice.y+font,font,lines,box,opacity:active?1:relatedIds.has(node.id)?.9:.72});break;
    }
  }
  return placed;
}
