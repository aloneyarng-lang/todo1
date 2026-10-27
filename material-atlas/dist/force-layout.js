import { primaryTag } from './tags.js';
import { GRAPH_DEFAULTS } from './graph-settings.js';
import { cleanAssociations, associationMatches } from './associations.js';

const hash = text => [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function cleanLayout(value = {}) {
  return Object.fromEntries(Object.entries(value || {}).slice(-10000).filter(([key, point]) => /^(paper|tag|relation):/.test(key) && key.length < 1500 && point && Number.isFinite(point.x) && Number.isFinite(point.y)).map(([key, point]) => [key, { x: clamp(point.x, -3000, 4000), y: clamp(point.y, -3000, 4000), pinned: Boolean(point.pinned) }]));
}

export function createNetwork(papers, groups, saved = {}, suppliedAssociations = []) {
  const allowed=new Set(groups.map(group=>group.name)),colors=new Map(groups.map(group=>[group.name,group.color]));
  const nodes=papers.map((paper,index)=>{
    const angle=index*2.399963+(hash(paper.id)%100)/900,distance=papers.length===1?0:110+Math.sqrt(index/Math.max(1,papers.length-1))*265;
    const previous=saved['paper:'+paper.id];
    return{id:'paper:'+paper.id,type:'paper',paper,color:colors.get(primaryTag(paper,allowed))||'#829487',radius:5.8,x:previous?.x??500+Math.cos(angle)*distance*1.12,y:previous?.y??305+Math.sin(angle)*distance*.68,pinned:Boolean(previous?.pinned)};
  });
  const relationColors={tag:'#477e74',year:'#a18452',institution:'#6d7caa',author:'#98788e'};
  const rules=cleanAssociations(suppliedAssociations);
  for(const rule of rules){
    const members=nodes.filter(node=>node.type==='paper'&&associationMatches(node.paper,rule)),seed=hash(rule.id),angle=seed/4294967295*Math.PI*2;
    const x=members.length?members.reduce((sum,node)=>sum+node.x,0)/members.length:500,y=members.length?members.reduce((sum,node)=>sum+node.y,0)/members.length:305;
    const previous=saved[rule.id];
    nodes.push({id:rule.id,type:'relation',kind:rule.kind,rule,tag:rule.label,label:rule.label,members:members.map(node=>node.paper.id),color:relationColors[rule.kind],radius:Math.min(13,7.5+Math.sqrt(members.length)),x:previous?.x??x+Math.cos(angle)*55,y:previous?.y??y+Math.sin(angle)*55,pinned:Boolean(previous?.pinned)});
  }
  const byId=new Map(nodes.map(node=>[node.id,node])),edges=[];
  for(const node of nodes){node.vx=0;node.vy=0;node.homeX=node.x;node.homeY=node.y;node.degree=0;}
  for(const node of nodes.filter(node=>node.type==='relation'))for(const id of node.members){const source=byId.get('paper:'+id);edges.push({source,target:node,tag:node.id,associationId:node.id});source.degree++;node.degree++;}
  return{nodes,edges,byId,omittedTags:0};
}

export function stepNetwork(network, alpha = 1, preferences = GRAPH_DEFAULTS) {
  const { nodes, edges } = network;
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    let dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) + Math.abs(dy) < .01) { dx = .1; dy = .07; }
    const bothTags = a.type === 'relation' && b.type === 'relation';
    const distance = Math.max(1, Math.hypot(dx, dy)), spacing = a.radius + b.radius + (bothTags ? 64 : a.type === 'relation' || b.type === 'relation' ? 27 : 17);
    const force = Math.min(12, (bothTags ? 3000 : 1600) * preferences.repulsion / (distance * distance) + Math.max(0, spacing - distance) * .15) * alpha;
    a.vx -= dx / distance * force; a.vy -= dy / distance * force;
    b.vx += dx / distance * force; b.vy += dy / distance * force;
  }
  for (const edge of edges) {
    const a = edge.source, b = edge.target, dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
    const force = (distance - preferences.linkDistance) * .022 * preferences.linkStrength * alpha;
    a.vx += dx / distance * force/Math.sqrt(Math.max(1,a.degree)); a.vy += dy / distance * force/Math.sqrt(Math.max(1,a.degree));
    b.vx -= dx / distance * force/Math.sqrt(Math.max(1,b.degree)); b.vy -= dy / distance * force/Math.sqrt(Math.max(1,b.degree));
  }
  let movement = 0;
  for (const node of nodes) {
    if (node.pinned || node.dragging) { node.vx = 0; node.vy = 0; continue; }
    node.vx = (node.vx + (500 - node.x) * .002 * preferences.center * alpha) * .78;
    node.vy = (node.vy + (300 - node.y) * .003 * preferences.center * alpha) * .78;
    node.x = clamp(node.x + clamp(node.vx, -7, 7), 35, 965);
    node.y = clamp(node.y + clamp(node.vy, -7, 7), 45, 565);
    movement += Math.abs(node.vx) + Math.abs(node.vy);
  }
  return movement;
}

export const networkSnapshot = network => Object.fromEntries(network.nodes.map(node => [node.id, { x: node.x, y: node.y, pinned: Boolean(node.pinned) }]));
