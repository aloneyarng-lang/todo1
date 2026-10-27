import { createNetwork, stepNetwork, networkSnapshot, cleanLayout } from './force-layout.js';
import { GRAPH_DEFAULTS, cleanGraphSettings, placeNodeLabels } from './graph-settings.js';
import { PALETTE } from './palette.js';
import { ASSOCIATION_KINDS } from './associations.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};

export class StarMap {
  constructor(svg, callbacks) {
    Object.assign(this, callbacks);
    this.svg = svg; this.scale = 1; this.x = 0; this.y = 0;
    this.cache = {}; this.nodes = []; this.selected = ''; this.paused = false; this.preferences={...GRAPH_DEFAULTS};this.collections=[];
    this.bindInput();
    this.labelCanvas=document.createElement('canvas').getContext('2d');this.labelWidths=new Map();
    this.resizeObserver=new ResizeObserver(()=>this.placeLabels());this.resizeObserver.observe(svg);
  }
  configure(value,collections=[],associations=[]){this.preferences=cleanGraphSettings(value);this.collections=collections;this.associations=associations;}
  setLayout(value) { cancelAnimationFrame(this.frame); this.network = null; const normalized=cleanLayout(value),legacy=Object.keys(normalized).some(key=>key.startsWith('tag:'));this.cache=Object.fromEntries(Object.entries(normalized).filter(([key,point])=>key.startsWith('relation:')||key.startsWith('paper:')&&(!legacy||point.pinned))); }
  setData(papers, selected, allGroups = []) {
    cancelAnimationFrame(this.frame);
    if (this.network) Object.assign(this.cache, networkSnapshot(this.network));
    this.papers = papers.slice(0, 350); this.selected = selected; this.groups = allGroups;
    this.network = createNetwork(this.papers, this.groups, this.cache,this.preferences.showRelations?this.associations:[]);
    const colorNames=[...new Set(this.papers.map(p=>this.preferences.colorBy==='journal'?p.journal||'期刊未填':this.collections.find(c=>c.id===p.collection)?.name||'未分组'))].sort();
    for(const node of this.network.nodes){node.radius*=this.preferences.nodeSize;if(node.type==='paper'&&this.preferences.colorBy!=='tag'){const name=this.preferences.colorBy==='journal'?node.paper.journal||'期刊未填':this.collections.find(c=>c.id===node.paper.collection)?.name||'未分组';node.color=PALETTE[colorNames.indexOf(name)%PALETTE.length];}if(node.type==='relation'&&this.preferences.colorBy!=='tag')node.color=node.color;}
    this.svg.replaceChildren();
    this.viewport = el('g'); this.svg.append(this.viewport);
    this.edgeLayer = el('g', { 'aria-hidden': true, class: 'network-edges' });
    this.edgeLayer.style.display = this.options?.showEdges === false ? 'none' : '';
    this.viewport.append(this.edgeLayer);
    this.edgeNodes = this.network.edges.map(edge => {
      const path = el('path', { fill: 'none', stroke: edge.target.color, 'stroke-width': .8, opacity: .18, 'vector-effect': 'non-scaling-stroke' });
      this.edgeLayer.append(path); return { ...edge, path };
    });
    this.nodeLayer = el('g'); this.viewport.append(this.nodeLayer);
    this.nodes = this.network.nodes.map(node => {
      const isTag = node.type === 'relation', name = isTag ? node.tag : node.paper.title;
      const group = el('g', { class: `graph-node ${isTag ? 'relation-node relation-'+node.kind : 'paper-node'}`, tabindex: 0, role: 'button', 'aria-label': isTag ? `${ASSOCIATION_KINDS[node.kind]}关联 ${name}` : name, 'data-node-id': node.id, ...(isTag ? { 'data-association-id': node.id } : { 'data-paper-id': node.paper.id }) });
      group.append(el('title', {}, `${name}\n拖动后固定位置，双击释放${isTag ? '；点击查看匹配，右键移除此关联节点' : '；右键隐藏此文献'}`));
      group.append(el('circle',{r:Math.max(14,node.radius+5),fill:'transparent',class:'node-hit-area'}));
      const halo = el('circle', { r: node.radius + 13, fill: node.color, opacity: .015, 'pointer-events': 'none' });
      const ring = el('circle', { r: node.radius + 5, fill: 'none', stroke: node.color, 'stroke-width': .8, opacity: .3, class: 'node-ring' });
      const coreShape = isTag&&node.kind==='year'?'path':isTag&&node.kind==='institution'?'rect':'circle';
      const geometry=coreShape==='path'?{d:`M0 ${-node.radius}L${node.radius} 0L0 ${node.radius}L${-node.radius} 0Z`}:coreShape==='rect'?{x:-node.radius,y:-node.radius,width:node.radius*2,height:node.radius*2,rx:3}:{r:node.radius};
      const core = el(coreShape, { ...geometry, fill: isTag ? '#fcfdf9' : node.color, stroke: isTag ? node.color : '#fff', 'stroke-width': isTag ? 1.6 : 1.8, class: 'node-core' });
      group.append(halo, ring, core);
      if (isTag) group.append(el('circle', { r: 2.5, fill: node.color }));
      const label = el('text', { x: 0, y: node.radius + 20, 'text-anchor': 'middle', class: isTag ? 'tag-node-label' : 'node-label' }, name.length > (isTag ? 22 : 40) ? name.slice(0, isTag ? 21 : 38) + '…' : name);
      group.append(label);

      const pin = el('circle', { cx: node.radius + 4, cy: -node.radius - 3, r: 2.4, fill: '#ad8d58', class: 'node-pin' }); group.append(pin);
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); isTag ? this.onRelation?.(node.id) : this.onSelect(node.paper.id); }
        if (event.key === 'Delete') { event.preventDefault(); isTag ? this.onRemoveAssociation?.(node.id) : this.onHide?.(node.paper.id); }
        if (event.key.toLowerCase() === 'p') { node.pinned = !node.pinned; this.paint(); this.saveLayout(); if (!node.pinned) this.start(.4); }
      });
      group.addEventListener('dblclick', event => { event.stopPropagation(); clearTimeout(this.clickTimer); node.pinned = false; this.start(.6); this.saveLayout(); });
      group.addEventListener('contextmenu', event => { event.preventDefault(); isTag ? this.onRemoveAssociation?.(node.id) : this.onHide?.(node.paper.id); });
      group.addEventListener('pointerenter', event => {
        if (this.drag) return;
        this.highlightNode(node.id);
        this.onHover(isTag ? { title: `${ASSOCIATION_KINDS[node.kind]} · ${node.tag}`, journal: `${node.members.length} 篇可见匹配文献 · 拖动牵引，点击查看` } : node.paper, event);
      });
      group.addEventListener('pointerleave', () => { this.highlight(this.selected); this.onHover(null); });
      this.nodeLayer.append(group);
      return { ...node, node, paper: node.paper, group, halo, ring, core, label, pin };
    });
    if (!Object.keys(this.cache).length) for (let i = 0; i < 55; i++) stepNetwork(this.network, .8,this.preferences);
    this.paint(); this.highlight(selected); this.transform(); this.start(.65);
    this.onStats?.({ papers: this.papers.length, tags: this.network.nodes.filter(node => node.type === 'relation').length, edges: this.network.edges.length, omittedTags: this.network.omittedTags });
  }
  paint() {
    for (const [index, item] of this.nodes.entries()) {
      const node = item.node;
      item.group.setAttribute('transform', `translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`);
      item.group.classList.toggle('pinned', Boolean(node.pinned)); item.pin.style.display = node.pinned ? '' : 'none';
      node.fog?.setAttribute('cx', node.x); node.fog?.setAttribute('cy', node.y);
    }
    this.placeLabels();
    for (const edge of this.edgeNodes) {
      const a = edge.source, b = edge.target;
      edge.path.setAttribute('d', `M${a.x},${a.y} Q${(a.x + b.x) / 2 + (a.y - b.y) * .04},${(a.y + b.y) / 2} ${b.x},${b.y}`);
    }
  }
  start(alpha = .5) {
    cancelAnimationFrame(this.frame);
    if (this.paused || !this.network || !this.network.nodes.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.paint(); this.saveLayout(); return; }
    let heat = alpha, count = 0;
    const tick = () => {
      if (this.paused) return;
      stepNetwork(this.network, heat,this.preferences); this.paint(); heat *= .96;
      if ((heat > .018 || this.drag?.node) && ++count < 220) this.frame = requestAnimationFrame(tick);
      else this.saveLayout();
    };
    this.frame = requestAnimationFrame(tick);
  }
  saveLayout() {
    if (!this.network) return;
    Object.assign(this.cache, networkSnapshot(this.network)); this.onLayout?.(cleanLayout(this.cache));
  }
  toggleMotion() { this.paused = !this.paused; if (this.paused) { cancelAnimationFrame(this.frame); this.saveLayout(); } else this.start(.6); return !this.paused; }
  relayout() { this.cache = {}; this.network = null; this.setData(this.papers, this.selected, this.groups); this.saveLayout(); }
  select(id) { this.selected = id; this.highlight(id); }
  highlight(id) { this.highlightNode(id?'paper:'+id:''); }
  highlightNode(key) {
    this.activeId=key;const active=this.network?.byId.get(key),tagIds=new Set();this.relatedIds=new Set(key?[key]:[]);
    if(active?.type==='relation')tagIds.add(active.id);
    else if(active)for(const edge of this.network.edges)if(edge.source.id===active.id)tagIds.add(edge.target.id);
    for(const edge of this.network?.edges||[])if(tagIds.has(edge.target.id)){this.relatedIds.add(edge.target.id);this.relatedIds.add(edge.source.id);}
    for(const item of this.nodes){const chosen=item.node.id===key;item.group.setAttribute('opacity',!key||chosen||!tagIds.size?1:this.relatedIds.has(item.node.id)?.82:.23);item.group.setAttribute('aria-pressed',String(item.node.type==='paper'&&item.node.paper.id===this.selected));item.ring.setAttribute('opacity',chosen?.8:item.node.pinned?.4:.12);item.halo.setAttribute('opacity',chosen?.065:.008);}
    for(const edge of this.edgeNodes){const adjacent=edge.source.id===key||edge.target.id===key;edge.path.setAttribute('opacity',!key||!tagIds.size?.18:adjacent?.62:tagIds.has(edge.target.id)?.12:.035);edge.path.setAttribute('stroke-width',(adjacent?1.5:.8)*this.preferences.linkWidth);}
    this.placeLabels();
  }
  placeLabels(){
    if(!this.network)return;
    const bounds=this.svg.getBoundingClientRect(),viewportScale=Math.min(bounds.width/1000,bounds.height/620)||1;
    const family=getComputedStyle(this.svg).fontFamily,measureText=(text,font)=>{const key=font.toFixed(4)+'|'+text;if(!this.labelWidths.has(key)){this.labelCanvas.font=`${font}px ${family}`;this.labelWidths.set(key,this.labelCanvas.measureText(text).width);}return this.labelWidths.get(key);};
    if(this.labelWidths.size>10000)this.labelWidths.clear();
    const positions=placeNodeLabels(this.network.nodes,{scale:this.scale,viewportScale,measureText,panX:this.x,panY:this.y,activeId:this.activeId,relatedIds:this.relatedIds,showLabels:this.options?.showLabels!==false,threshold:this.preferences.labelThreshold});
    for(const item of this.nodes)item.group.querySelector('.node-hit-area').setAttribute('r',Math.max(item.node.radius+5,11/(this.scale*viewportScale)));
    for(const item of this.nodes){const placed=positions.get(item.node.id);item.label.style.opacity=placed?String(placed.opacity):'0';item.label.setAttribute('aria-hidden',String(!placed));if(!placed)continue;item.label.setAttribute('x',placed.x);item.label.setAttribute('y',placed.y);item.label.setAttribute('text-anchor','start');item.label.style.fontSize=placed.font+'px';const text=placed.lines.join('|');if(item.label.dataset.lines!==text){item.label.replaceChildren(...placed.lines.map((line,index)=>el('tspan',{x:placed.x,dy:index?placed.font*1.35:0},line)));item.label.dataset.lines=text;}else for(const [index,span]of [...item.label.children].entries()){span.setAttribute('x',placed.x);span.setAttribute('dy',index?placed.font*1.35:0);}}
  }
  point(event) { const matrix = this.svg.getScreenCTM(); return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 500, y: 300 }; }
  scenePoint(event) { const p = this.point(event); return { x: (p.x - this.x) / this.scale, y: (p.y - this.y) / this.scale }; }
  bindInput() {
    this.svg.addEventListener('wheel', event => { event.preventDefault(); this.zoom(event.deltaY > 0 ? 1 / 1.12 : 1.12, this.point(event)); this.onHover(null); }, { passive: false });
    this.svg.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      clearTimeout(this.clickTimer);
      const key = event.target.closest('[data-node-id]')?.dataset.nodeId, node = this.network?.byId.get(key);
      const capture=event.target.closest('[data-node-id]')||this.svg;
      this.drag = { pointer: event.pointerId, capture, origin: this.point(event), scene: this.scenePoint(event), node, x: node?.x ?? this.x, y: node?.y ?? this.y, moved: false };
      if (node) { node.dragging = true; this.start(.6); }
      capture.setPointerCapture(event.pointerId); this.svg.classList.add('dragging'); this.onHover(null);
    });
    this.svg.addEventListener('pointermove', event => {
      const drag = this.drag; if (!drag || drag.pointer !== event.pointerId) return;
      const point = this.point(event), dx = point.x - drag.origin.x, dy = point.y - drag.origin.y;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      if (drag.node) { drag.node.x = drag.x + dx / this.scale; drag.node.y = drag.y + dy / this.scale; drag.node.vx = 0; drag.node.vy = 0; this.paint(); }
      else { this.x = drag.x + dx; this.y = drag.y + dy; this.transform(); }
    });
    const finish = (event, cancel = false) => {
      const drag = this.drag; if (!drag || event.pointerId !== drag.pointer) return;
      this.drag = null; this.svg.classList.remove('dragging');
      if (drag.capture.hasPointerCapture(event.pointerId)) drag.capture.releasePointerCapture(event.pointerId);
      if (drag.node) {
        drag.node.dragging = false;
        if (drag.moved) { drag.node.pinned = true; this.paint(); this.saveLayout(); this.start(.3); }
        else if (!cancel) this.clickTimer = setTimeout(() => drag.node.type === 'relation' ? this.onRelation?.(drag.node.id) : this.onSelect(drag.node.paper.id), 260);
      }
    };
    this.svg.addEventListener('pointerup', event => finish(event));
    this.svg.addEventListener('pointercancel', event => finish(event, true));
  }
  zoom(factor, point = { x: 500, y: 310 }) {
    const next = Math.max(.35, Math.min(3.5, this.scale * factor)), ratio = next / this.scale;
    this.x = point.x - (point.x - this.x) * ratio; this.y = point.y - (point.y - this.y) * ratio; this.scale = next; this.transform();
  }
  fit() { this.scale = 1; this.x = 0; this.y = 0; this.transform(); }
  transform() { this.viewport?.setAttribute('transform', `translate(${this.x} ${this.y}) scale(${this.scale})`); this.onZoom?.(Math.round(this.scale * 100)); this.placeLabels(); }
}
