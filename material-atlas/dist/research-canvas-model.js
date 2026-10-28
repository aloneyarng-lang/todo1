// Data-only research canvas format. Shared by browser, native storage and exports.
export const CANVAS_FORMAT='materia-canvas',CANVAS_VERSION=1;
export const CANVAS_LIMITS={boards:50,nodes:300,edges:700,assets:24,documentBytes:12582912,storeBytes:41943040,code:250000};
export const CANVAS_SHAPES=['roundrect','rect','ellipse','diamond','hexagon'];
export const CANVAS_COLORS=['accent','blue','purple','gold','green','red','gray'];
const identifier=/^[a-zA-Z_][\w-]{0,99}$/;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>{throw Error(message);};
const text=(v,max,label,required=false)=>{if(typeof v!=='string'||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)||v.length>max||required&&!v.trim())fail(label+'格式不正确或过长。');return v;};
const coord=(v,fallback=0)=>v===undefined?fallback:typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=50000?v:fail('节点坐标需在 ±50000 范围内。');
const viewCoord=v=>v===undefined?0:typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=200000?v:fail('视图位置超出范围。');
const color=v=>CANVAS_COLORS.includes(v)||/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(v)?v:fail('颜色需为预设名称或十六进制颜色。');
export function newCanvas(id,name='未命名画布',now=Date.now()){
 return{id,name,layout:'mindmap',direction:'both',nodes:[{id:'root',text:'研究主题',x:0,y:0,shape:'roundrect',color:'accent',note:'',paperId:'',tag:'',image:'',group:''}],edges:[],assets:{},codeDraft:'',hasCodeDraft:false,createdAt:now,updatedAt:now,camera:{x:0,y:0,scale:1}};
}
export function cleanCanvas(input){
 if(!object(input))fail('画布需要是对象。');
 const id=text(input.id,120,'画布 ID',true),name=text(input.name,100,'画布名称',true);
 if(!['mindmap','free'].includes(input.layout)||!['both','right','left','down'].includes(input.direction))fail('画布布局或方向不正确。');
 if(!Array.isArray(input.nodes)||input.nodes.length>300||!Array.isArray(input.edges)||input.edges.length>700)fail('每张画布最多 300 个节点、700 条连线。');
 const ids=new Set(),nodes=input.nodes.map(row=>{
  if(!object(row)||!identifier.test(row.id)||ids.has(row.id))fail('节点 ID 必须唯一，使用字母、数字、下划线或短横线，以字母或下划线开头。');ids.add(row.id);
  if(!CANVAS_SHAPES.includes(row.shape||'roundrect'))fail('不支持的节点形状。');
  return{id:row.id,text:text(row.text,400,'节点文字',true),x:coord(row.x),y:coord(row.y),shape:row.shape||'roundrect',color:color(row.color||'accent'),note:text(row.note??'',10000,'节点说明'),paperId:text(row.paperId??'',200,'文献链接'),tag:text(row.tag??'',80,'标签链接'),image:text(row.image??'',100,'图片 ID'),group:text(row.group??'',80,'分组')};
 });
 const edgeIds=new Set(),pairs=new Set(),edges=input.edges.map(row=>{
  if(!object(row)||!identifier.test(row.id)||edgeIds.has(row.id)||!ids.has(row.source)||!ids.has(row.target)||row.source===row.target)fail('连线 ID 需唯一，两端必须是不同的已有节点。');const pair=row.source+'\0'+row.target;if(pairs.has(pair))fail('同一方向的节点之间只保留一条连线。');edgeIds.add(row.id);pairs.add(pair);
  return{id:row.id,source:row.source,target:row.target,label:text(row.label??'',160,'连线文字'),dashed:row.dashed===true,arrow:row.arrow!==false};
 });
 const assets={};let bytes=0;if(input.assets!==undefined&&!object(input.assets))fail('图片资源格式不正确。');
 const rows=Object.entries(input.assets||{});if(rows.length>24)fail('每张画布最多 24 张图片。');
 for(const[key,row]of rows){
  if(['__proto__','prototype','constructor'].includes(key)||!identifier.test(key)||!object(row)||typeof row.data!=='string'||row.data.length>2800000)fail('图片资源 ID 或大小不正确。');
  const m=row.data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z\d+/]+={0,2})$/);if(!m||m[2].length%4)fail('图片仅支持内嵌 PNG、JPEG、WebP。');
  let header;try{header=atob(m[2].slice(0,48));}catch{fail('图片数据已损坏。');}
  if(m[1]==='png'&&!header.startsWith('\x89PNG\r\n\x1a\n')||m[1]==='jpeg'&&!header.startsWith('\xff\xd8\xff')||m[1]==='webp'&&!(header.startsWith('RIFF')&&header.slice(8,12)==='WEBP'))fail('图片格式与文件内容不一致。');
  bytes+=row.data.length;if(bytes>10485760)fail('单张画布图片合计不超过 10 MB。');assets[key]={name:text(row.name||'图片',200,'图片名称'),data:row.data};
 }
 for(const node of nodes)if(node.image&&!Object.hasOwn(assets,node.image))fail('图片资源不存在：'+node.image);
 const camera=input.camera||{},scale=Number(camera.scale),result={id,name,layout:input.layout,direction:input.direction,nodes,edges,assets,codeDraft:text(input.codeDraft??'',250000,'规则草稿'),hasCodeDraft:input.hasCodeDraft===true||Boolean(input.codeDraft),createdAt:Number.isFinite(input.createdAt)?input.createdAt:Date.now(),updatedAt:Number.isFinite(input.updatedAt)?input.updatedAt:Date.now(),camera:{x:viewCoord(camera.x),y:viewCoord(camera.y),scale:Number.isFinite(scale)?Math.max(.1,Math.min(3,scale)):1}};
 if(JSON.stringify(result).length>CANVAS_LIMITS.documentBytes)fail('单张画布文件超过 12 MB。');return result;
}
export function cleanCanvasStore(value){
 if(value==null)return{version:1,selected:'',boards:[]};if(!object(value)||value.version!==1||!Array.isArray(value.boards)||value.boards.length>50)fail('画布库格式不正确或超过 50 张画布。');
 const boards=value.boards.map(cleanCanvas),ids=new Set();for(const b of boards){if(ids.has(b.id))fail('画布 ID 重复。');ids.add(b.id);}const result={version:1,selected:ids.has(value.selected)?value.selected:boards[0]?.id||'',boards};if(JSON.stringify(result).length>CANVAS_LIMITS.storeBytes)fail('画布库超过 40 MB，请先导出归档部分画布。');return result;
}
export function wrapCanvasText(input,width=184,maxLines=6){
 const lines=[];let line='',size=0;for(const char of input){const w=char.charCodeAt(0)>255?16:8;if(char==='\n'||size+w>width){lines.push(line);line='';size=0;if(lines.length>=maxLines){lines[maxLines-1]=lines[maxLines-1].slice(0,-1)+'…';return lines;}}if(char!=='\n'){line+=char;size+=w;}}if(line||!lines.length)lines.push(line);return lines;
}
export function canvasNodeSize(node){const width=node.shape==='diamond'?260:node.shape==='ellipse'?240:216,lines=wrapCanvasText(node.text,width-(node.shape==='diamond'?100:node.shape==='ellipse'?70:32)),height=Math.max(node.shape==='diamond'?116:72,lines.length*22+34+(node.image?126:0)+(node.paperId||node.tag||node.note?20:0));return{width,height,lines};}
export function canvasBounds(board){if(!board.nodes.length)return{x:-200,y:-120,width:400,height:240};const boxes=board.nodes.map(n=>{const s=canvasNodeSize(n);return{x:n.x-s.width/2,y:n.y-s.height/2,right:n.x+s.width/2,bottom:n.y+s.height/2};});const x=Math.min(...boxes.map(b=>b.x))-70,y=Math.min(...boxes.map(b=>b.y))-70;return{x,y,width:Math.max(...boxes.map(b=>b.right))+70-x,height:Math.max(...boxes.map(b=>b.bottom))+70-y};}
export function findCanvasPosition(nodes,node){
 const size=canvasNodeSize(node),dx=size.width+90,dy=size.height+50,free=(x,y)=>Math.abs(x)<49000&&Math.abs(y)<49000&&nodes.every(other=>{const s=canvasNodeSize(other);return Math.abs(other.x-x)>(s.width+size.width)/2+24||Math.abs(other.y-y)>(s.height+size.height)/2+30;});
 for(let i=0;i<220;i++){const points=i?[[node.x,node.y+dy*i],[node.x,node.y-dy*i],[node.x+dx*i,node.y],[node.x-dx*i,node.y]]:[[node.x,node.y]];for(const[x,y]of points)if(free(x,y))return{x,y};}throw Error('节点附近过于拥挤，请移动视图后添加。');
}
export function arrangeCanvas(board){
 const result={...board,nodes:board.nodes.map(n=>({...n}))},nodes=result.nodes;if(!nodes.length)return result;
 if(board.layout==='free'){const cols=Math.max(2,Math.ceil(Math.sqrt(nodes.length)));nodes.forEach((n,i)=>{n.x=(i%cols)*320;n.y=Math.floor(i/cols)*280;});return result;}
 const byId=new Map(nodes.map(n=>[n.id,n])),children=new Map(nodes.map(n=>[n.id,[]])),parent=new Map(),cycle=(from,to)=>{for(let cur=from;cur;cur=parent.get(cur))if(cur===to)return true;return false;};
 for(const e of board.edges)if(byId.has(e.source)&&byId.has(e.target)&&!parent.has(e.target)&&!cycle(e.source,e.target)){children.get(e.source).push(e.target);parent.set(e.target,e.source);}
 const roots=nodes.filter(n=>!parent.has(n.id)),size=new Map();
 const measure=id=>{const n=byId.get(id),span=Math.max(canvasNodeSize(n).height+60,children.get(id).reduce((s,c)=>s+measure(c),0));size.set(id,span);return span;};for(const root of roots)measure(root.id);
 const place=(id,depth,center,sign)=>{const n=byId.get(id);n.x=depth*350*sign;n.y=center;let top=center-size.get(id)/2;for(const c of children.get(id)){place(c,depth+1,top+size.get(c)/2,sign);top+=size.get(c);}};
 let forestY=0;for(const root of roots){const list=children.get(root.id);if(board.direction==='both'&&list.length>1){root.x=0;root.y=forestY;const sides=[[],[]],heights=[0,0];for(const c of list){const side=heights[0]<=heights[1]?0:1;sides[side].push(c);heights[side]+=size.get(c);}for(let side=0;side<2;side++){let top=forestY-heights[side]/2;for(const c of sides[side]){place(c,1,top+size.get(c)/2,side?-1:1);top+=size.get(c);}}forestY+=Math.max(...heights,canvasNodeSize(root).height)+160;}else{place(root.id,0,forestY,board.direction==='left'?-1:1);forestY+=size.get(root.id)+160;}}
 if(board.direction==='down')for(const n of nodes){const x=n.x;n.x=n.y*1.6;n.y=x*.9;}return result;
}
export function exportCanvasDocument(board){return JSON.stringify({format:CANVAS_FORMAT,version:1,board:cleanCanvas(board)},null,2)+'\n';}
export function importCanvasDocument(input){if(typeof input==='string'){if(input.length>CANVAS_LIMITS.documentBytes+10000)fail('画布文件超过 12 MB。');try{input=JSON.parse(input);}catch{fail('画布文件不是有效 JSON。');}}if(!object(input)||input.format!==CANVAS_FORMAT||input.version!==1)fail('请选择版本 1 的 Materia 画布文件。');return cleanCanvas(input.board);}
const Q='("(?:[^"\\\\]|\\\\.)*")',ID='([a-zA-Z_][\\w-]{0,99})';
const match=(line,pattern)=>line.match(new RegExp('^'+pattern+'$'));
const quoted=value=>{try{return JSON.parse(value);}catch{fail('请使用 JSON 双引号字符串和转义。');}};
function attrs(value,allowed){const result={};for(const part of value.trim().split(/\s+/).filter(Boolean)){const m=part.match(/^([a-z]+)=([^\s=]+)$/);if(!m||!allowed.includes(m[1])||Object.hasOwn(result,m[1]))fail('不支持或重复的属性：'+part);result[m[1]]=m[2];}return result;}
export function parseCanvasRules(source,previous=newCanvas('canvas-preview')){
 if(typeof source!=='string'||source.length>250000)fail('规则文本不超过 250 KB。');
 const reservedEdges=new Set(previous.edges.map(e=>e.id));
 const fenced=source.trim().match(/^```(?:materia-canvas|mcanvas|text)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/);if(fenced)source='\n'+fenced[1]+'\n';
 const board={...previous,layout:'mindmap',direction:'both',nodes:[],edges:[],assets:{...previous.assets},codeDraft:'',hasCodeDraft:false},commands=[],nodeIds=new Set(),pairs=new Set();let header=false;
 for(const[index,raw]of source.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||line.startsWith('//')||line.startsWith('#'))continue;
  try{let m;
   if(m=match(line,'canvas\\s+'+Q)){if(header)fail('canvas 名称只能定义一次。');board.name=text(quoted(m[1]),100,'画布名称',true);header=true;}
   else if(m=match(line,'layout\\s+(mindmap|free)'))board.layout=m[1];
   else if(m=match(line,'direction\\s+(both|right|left|down)'))board.direction=m[1];
   else if(m=match(line,'node\\s+'+ID+'\\s+'+Q)){if(nodeIds.has(m[1]))fail('节点 ID 重复：'+m[1]);nodeIds.add(m[1]);board.nodes.push({id:m[1],text:text(quoted(m[2]),400,'节点文字',true),x:0,y:0,shape:'roundrect',color:'accent',note:'',paperId:'',tag:'',image:'',group:''});}
   else if(m=match(line,ID+'\\s*->\\s*'+ID+'(?:\\s*:\\s*'+Q+')?')){const pair=m[1]+'\0'+m[2];if(pairs.has(pair))fail('重复连线。');pairs.add(pair);const old=previous.edges.find(e=>e.source===m[1]&&e.target===m[2]);let edgeId=old?.id;if(!edgeId){const hash=[...pair].reduce((v,c)=>(Math.imul(v,31)+c.charCodeAt(0))>>>0,7),base='edge_'+hash.toString(36);edgeId=base;let suffix=1;while(reservedEdges.has(edgeId))edgeId=base+'_'+suffix++;reservedEdges.add(edgeId);}board.edges.push({id:edgeId,source:m[1],target:m[2],label:m[3]?quoted(m[3]):'',dashed:false,arrow:true,line:index+1});}
   else if(m=match(line,'group\\s+'+Q+'\\s*\\[([^\\]]*)\\]'))commands.push({kind:'group',name:quoted(m[1]),ids:m[2].split(/[\s,]+/).filter(Boolean),line:index+1});
   else if(m=match(line,'(note|image)\\s+'+ID+'\\s+'+Q))commands.push({kind:m[1],id:m[2],value:quoted(m[3]),line:index+1});
   else if(m=match(line,'link\\s+'+ID+'\\s+(paper|tag)='+Q))commands.push({kind:m[2],id:m[1],value:quoted(m[3]),line:index+1});
   else if(m=match(line,'style\\s+'+ID+'\\s+(.+)'))commands.push({kind:'style',id:m[1],attrs:attrs(m[2],['shape','color']),line:index+1});
   else if(m=match(line,'position\\s+'+ID+'\\s+(-?\\d+(?:\\.\\d+)?)\\s+(-?\\d+(?:\\.\\d+)?)'))commands.push({kind:'position',id:m[1],x:Number(m[2]),y:Number(m[3]),line:index+1});
   else if(m=match(line,'edge-style\\s+'+ID+'\\s+'+ID+'\\s+(.+)'))commands.push({kind:'edge-style',source:m[1],target:m[2],attrs:attrs(m[3],['dashed','arrow']),line:index+1});
   else fail('无法识别这条规则，请查看规则说明。');
  }catch(error){throw Error(`第 ${index+1} 行：${error.message}`);}
 }
 if(!board.nodes.length)fail('至少需要一条 node 规则。');
 const byId=new Map(board.nodes.map(n=>[n.id,n])),explicit=new Map();
 for(const e of board.edges)if(!byId.has(e.source)||!byId.has(e.target)||e.source===e.target)fail(`第 ${e.line} 行：连线两端必须是不同的已有节点。`);
 for(const c of commands)try{
  if(c.kind==='group'){for(const id of c.ids){if(!byId.has(id))fail('节点不存在：'+id);byId.get(id).group=c.name;}continue;}
  if(c.kind==='edge-style'){const edge=board.edges.find(e=>e.source===c.source&&e.target===c.target);if(!edge)fail('对应连线不存在。');for(const[k,v]of Object.entries(c.attrs)){if(!['true','false'].includes(v))fail(k+' 只能为 true 或 false。');edge[k]=v==='true';}continue;}
  const n=byId.get(c.id);if(!n)fail('节点不存在：'+c.id);
  if(c.kind==='style'){if(c.attrs.shape&&!CANVAS_SHAPES.includes(c.attrs.shape))fail('不支持的节点形状。');if(c.attrs.color)color(c.attrs.color);Object.assign(n,c.attrs);}else if(c.kind==='position')explicit.set(c.id,{x:coord(c.x),y:coord(c.y)});else if(c.kind==='paper')n.paperId=c.value;else if(c.kind==='tag')n.tag=c.value;else {const value=c.kind==='image'?c.value.replace(/^asset:/,''):c.value;if(c.kind==='image'&&!Object.hasOwn(board.assets,value))fail('图片资源不存在：'+value);n[c.kind]=value;}
 }catch(error){fail(`第 ${c.line} 行：${error.message}`);}
 const arranged=arrangeCanvas(board),old=new Map(previous.nodes.map(n=>[n.id,n]));for(const n of arranged.nodes){const p=explicit.get(n.id)||old.get(n.id);if(p){n.x=p.x;n.y=p.y;}}
 const parked=arranged.nodes.filter(n=>old.has(n.id)||explicit.has(n.id));for(const n of arranged.nodes)if(!old.has(n.id)&&!explicit.has(n.id)){Object.assign(n,findCanvasPosition(parked,n));parked.push(n);}
 const used=new Set(arranged.nodes.map(n=>n.image).filter(Boolean));arranged.assets=Object.fromEntries(Object.entries(arranged.assets).filter(([id])=>used.has(id)));return cleanCanvas(arranged);
}
export function serializeCanvasRules(board){
 const q=JSON.stringify,lines=[`canvas ${q(board.name)}`,`layout ${board.layout}`,`direction ${board.direction}`,''];
 for(const n of board.nodes)lines.push(`node ${n.id} ${q(n.text)}`);lines.push('');for(const e of board.edges){lines.push(`${e.source} -> ${e.target}${e.label?' : '+q(e.label):''}`);if(e.dashed||!e.arrow)lines.push(`edge-style ${e.source} ${e.target} dashed=${e.dashed} arrow=${e.arrow}`);}lines.push('');
 for(const n of board.nodes){if(n.shape!=='roundrect'||n.color!=='accent')lines.push(`style ${n.id} shape=${n.shape} color=${n.color}`);if(n.note)lines.push(`note ${n.id} ${q(n.note)}`);if(n.paperId)lines.push(`link ${n.id} paper=${q(n.paperId)}`);if(n.tag)lines.push(`link ${n.id} tag=${q(n.tag)}`);if(n.image)lines.push(`image ${n.id} ${q('asset:'+n.image)}`);}
 for(const group of new Set(board.nodes.map(n=>n.group).filter(Boolean)))lines.push(`group ${q(group)} [${board.nodes.filter(n=>n.group===group).map(n=>n.id).join(', ')}]`);
 lines.push('','// 坐标可省略；保留 ID 可延续手工布局。');for(const n of board.nodes)lines.push(`position ${n.id} ${Math.round(n.x*10)/10} ${Math.round(n.y*10)/10}`);return lines.join('\n')+'\n';
}
export const CANVAS_EXAMPLE=`canvas "成分—工艺—结构—性能"\nlayout mindmap\ndirection right\n\nnode root "材料设计"\nnode composition "成分设计"\nnode process "制备与热处理"\nnode structure "微观结构"\nnode performance "力学性能"\n\nroot -> composition\nroot -> process\nprocess -> structure : "调控"\nstructure -> performance : "影响"\n\nstyle structure shape=hexagon color=purple\nstyle performance shape=roundrect color=gold\nnote structure "补充证据、实验条件与待验证的问题。"\ngroup "实验变量" [composition, process]\n`;
