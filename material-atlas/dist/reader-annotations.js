import {MARK_COLORS,normalizeAnchor,rectFromPoints} from './note-model.js';
export const annotationName=anchor=>({text:'文字标注',arrow:'箭头标注',region:'区域标记'}[anchor?.kind]||'区域标记');
const clamp=value=>Math.min(1,Math.max(0,value));
export function gestureAnnotation(tool,page,start,end,color='teal',fingerprint=''){
  start={x:clamp(start.x),y:clamp(start.y)};end={x:clamp(end.x),y:clamp(end.y)};
  if(tool==='arrow'){
    if(Math.hypot(start.x-end.x,start.y-end.y)<.008)end={x:clamp(start.x+.12),y:clamp(start.y+.06)};
    if(Math.hypot(start.x-end.x,start.y-end.y)<.008)end={x:clamp(start.x-.12),y:clamp(start.y-.06)};
    return normalizeAnchor({kind:'arrow',page,start,end,color,fingerprint,label:'',fontSize:14});
  }
  let rect=rectFromPoints(start,end);
  if(tool==='text'){
    if(Math.abs(start.x-end.x)<.025&&Math.abs(start.y-end.y)<.025)rect={x:Math.min(start.x,.72),y:Math.min(start.y,.91),width:.28,height:.09};
    else rect={...rect,width:Math.max(.12,rect.width),height:Math.max(.05,rect.height)};
    rect.x=Math.min(rect.x,1-rect.width);rect.y=Math.min(rect.y,1-rect.height);
  }
  return normalizeAnchor({kind:tool==='text'?'text':'region',page,rect,color,fingerprint,...(tool==='text'?{label:'',fontSize:14}:{})});
}
export function transformAnnotation(anchor,dx,dy,handle='move'){
  const next=structuredClone(anchor);
  if(next.kind==='arrow'){
    if(handle==='start'||handle==='end'){next[handle]={x:clamp(next[handle].x+dx),y:clamp(next[handle].y+dy)};if(Math.hypot(next.start.x-next.end.x,next.start.y-next.end.y)<.002)return anchor;}
    else{dx=Math.max(-Math.min(next.start.x,next.end.x),Math.min(1-Math.max(next.start.x,next.end.x),dx));dy=Math.max(-Math.min(next.start.y,next.end.y),Math.min(1-Math.max(next.start.y,next.end.y),dy));for(const key of ['start','end']){next[key].x+=dx;next[key].y+=dy;}}
  }else if(handle==='resize'){
    next.rect.width=Math.max(.04,Math.min(1-next.rect.x,next.rect.width+dx));next.rect.height=Math.max(.025,Math.min(1-next.rect.y,next.rect.height+dy));
  }else{next.rect.x=Math.max(0,Math.min(1-next.rect.width,next.rect.x+dx));next.rect.y=Math.max(0,Math.min(1-next.rect.height,next.rect.y+dy));}
  return normalizeAnchor(next);
}
export function annotationHTML(anchor,id,{escape:esc,selected=false,draft=false,width=1000,height=1000}={}){
  const r=anchor.rect,kind=anchor.kind||'region',color=MARK_COLORS[anchor.color]||MARK_COLORS.yellow,attrs=`data-reader-mark="${esc(id)}"`,state=`${selected?' selected':''}${draft?' draft':''}`,title=esc(anchor.label||annotationName(anchor)+' · 点击添加详细批注'),font=Math.max(11,Math.min(28,(anchor.fontSize||14)*width/612));
  if(kind==='arrow'){
    const a={x:anchor.start.x*width,y:anchor.start.y*height},b={x:anchor.end.x*width,y:anchor.end.y*height},angle=Math.atan2(b.y-a.y,b.x-a.x),head=10;
    const wing1={x:b.x-head*Math.cos(angle-.42),y:b.y-head*Math.sin(angle-.42)},wing2={x:b.x-head*Math.cos(angle+.42),y:b.y-head*Math.sin(angle+.42)};
    const path=`M${a.x} ${a.y}L${b.x} ${b.y}`,labelWidth=Math.min(width*.29,260),left=Math.max(2,Math.min(width-labelWidth-2,a.x)),top=Math.max(2,a.y-48);
    return `<svg class="reader-arrow${state}" viewBox="0 0 ${width} ${height}" style="--mark-color:${color}" aria-hidden="true"><path class="reader-arrow-hit" ${attrs} data-annotation-drag="move" d="${path}"/><path class="reader-arrow-line" d="${path}"/><path class="reader-arrow-head" d="M${wing1.x} ${wing1.y}L${b.x} ${b.y}L${wing2.x} ${wing2.y}"/><circle class="reader-arrow-tail" cx="${a.x}" cy="${a.y}" r="3"/></svg>${anchor.label?`<button class="reader-arrow-caption${state}" ${attrs} data-annotation-drag="start" style="left:${left}px;top:${top}px;width:${labelWidth}px;--mark-color:${color};font-size:${font}px" title="${title}">${esc(anchor.label)}</button>`:''}${selected?['start','end'].map(key=>`<button class="reader-annotation-handle" ${attrs} data-annotation-handle="${key}" style="left:${anchor[key].x*100}%;top:${anchor[key].y*100}%;--mark-color:${color}" aria-label="拖动箭头${key==='start'?'起点':'终点'}"></button>`).join(''):''}`;
  }
  const geometry=`left:${r.x*100}%;top:${r.y*100}%;width:${r.width*100}%;height:${r.height*100}%;--mark-color:${color};font-size:${font}px`;
  return `<button class="reader-mark reader-${kind}-annotation${state}" ${attrs} data-annotation-drag="move" style="${geometry}" title="${title}" aria-label="${title}">${kind==='text'?`<span class="reader-callout-text">${esc(anchor.label||'双击输入标注文字')}</span>`:anchor.label?`<span class="reader-region-caption">${esc(anchor.label)}</span>`:'<span class="reader-region-badge" aria-hidden="true">✎</span>'}</button>${selected?`<button class="reader-annotation-handle reader-resize-handle" ${attrs} data-annotation-handle="resize" style="left:${(r.x+r.width)*100}%;top:${(r.y+r.height)*100}%;--mark-color:${color}" aria-label="拖动调整标注尺寸"></button>`:''}`;
}
