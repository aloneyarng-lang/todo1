import { getPapers, putPaper, putPapers, deletePaper, deletePapers, restorePapers, bulkEdit, getSetting, setSetting, normalizeTags, bytesLabel, createBackup, readBackup, mergeBackup } from './storage.js';
import { PALETTE } from './palette.js';
import { createBatchImporter } from './batch-import.js';
import { createComparison } from './comparison.js';
import { createPerformanceEditor } from './performance-editor.js';
import { markdownTemplate } from './markdown.js';
import { mergeImportNotes } from './import-plan.js';
import { isOldExample, removeOldExampleNotes } from './example-migration.js';
import { StarMap, countLinks, tagGroups } from './graph.js';
import { eligibleTags } from './tags.js';
import { createBulkEditor } from './bulk-edit.js';
import { createParameterFinder, parameterInventory, parameterResults, parameterNameKey, parameterRecordPreview } from './parameter-index.js';
import { GRAPH_DEFAULTS, cleanGraphSettings } from './graph-settings.js';
import { createAssociationController, cleanAssociations, associationLocalPapers } from './associations.js';
import { BUNDLED_METRICS, JOURNAL_DATA_CHECKED, seedJournalMetrics } from './journal-data.js';
import { createNotesController } from './notes.js';
import { normalizeAuthors, authorsText, numericImpact, impactOf, filterCatalog, parseMetrics, mergeMetrics, matchMetadata } from './catalog.js';
const native = globalThis.materiaDesktop;

const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><path d="M9 3a10 10 0 0 1 8 17"/>',
  library: '<path d="M4 4h4v16H4zM11 4h4v16h-4zM17 4l4-1 4 16-4 1z" transform="translate(-1 0) scale(.95 1)"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder: '<path d="M3 7V5h6l2 2h10v12H3z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  settings: '<path d="m9 3-.6 2.1-2 .9-2-.5L2 9l1.6 1.6v2.8L2 15l2.4 3.5 2-.5 2 .9L9 21h5l.6-2.1 2-.9 2 .5L21 15l-1.6-1.6v-2.8L21 9l-2.4-3.5-2 .5-2-.9L14 3z"/><circle cx="11.5" cy="12" r="3"/>',
  home: '<path d="m3 10 9-7 9 7v10h-7v-6h-4v6H3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 8.5a2.6 2.6 0 1 1 4.1 2.1c-1.5.8-1.7 1.4-1.7 2.4M12 17h.01"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  files: '<path d="M7 3h8l4 4v14H7zM15 3v5h4M3 7v13M10 12h6M10 16h6"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
  network: '<circle cx="5" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><path d="m7 5 9 1M6 7l2 9m2 2h8M17 8l-7 8m9-8 1 8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  sliders: '<path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  'chevron-down': '<path d="m7 9 5 5 5-5"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M9 3H3v18h18v-6"/>',
  edit: '<path d="m15 4 5 5M3 21l5-1L21 7l-5-5L3 15z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
Object.assign(icons, {'panel-left':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>','panel-right':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',chart:'<path d="M4 3v17h17M7 15l4-5 4 2 5-7"/>',table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',ruler:'<path d="m3 16 13-13 5 5L8 21zM7 12l2 2m2-6 2 2m2-6 2 2"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>','eye-off':'<path d="m3 3 18 18M8 6a12 12 0 0 1 4-1c6 0 10 7 10 7a18 18 0 0 1-4 4M6 8a20 20 0 0 0-4 4s4 7 10 7a12 12 0 0 0 4-1"/>',overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',undo:'<path d="M4 10h10a6 6 0 1 1 0 12M4 10l5-5m-5 5 5 5"/>',local:'<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="20" cy="19" r="2"/><path d="m6 6 4 4m4 0 4-4m-4 8 4 4"/>'});
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.files}</svg>`;
const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
const emptyFilters = () => ({ tags: [], excludeTags: [], parameterName: '', parameterUnit: '*', tagMode: 'all', journal: '', author: '', institution: '', yearFrom: '', yearTo: '', minIF: '', maxIF: '', impactYear: '', hasNotes: false, onlyFavorites: false, onlyRelated: false });
const state = { papers: [], collections: [], notes: {}, compareIds: new Set(), hiddenIds: new Set(), hiddenTagNodes: new Set(), focusGraph: true, leftPanelOpen: false, detailOpen: true, graphPreferences: {...GRAPH_DEFAULTS}, associations: [], journalMetrics: [], desktopInfo: null, searchScope: 'all', filters: emptyFilters(), showEdges: true, showLabels: true, mode: 'own', nav: 'all', collection: '', query: '', tag: '', year: '', sort: 'newest', view: 'graph', selected: '', listLimit: 100, ready: false, pendingFiles: [], storageError: false };
let modalContext = '';
let batch, comparison, performanceEditor, bulkEditor, parameterFinder, associationController;
let layoutTimer, graphPreferenceTimer, switchingLibrary = false;
let pendingRemovalIds = [], removalBusy = false, lastRemoval = null;
let activeObjectURLs = new Set();
let searchTimer;

function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
function papers() { return state.papers; }
function collections() { return state.collections; }
function selectedPaper() { return papers().find(p => p.id === state.selected); }
function visiblePapers() {
  return filterCatalog(papers(), state, state.notes, state.journalMetrics);
}

const map = new StarMap($('#star-map'), {
  onRelation: id => associationController.inspect(id), onRemoveAssociation: id => associationController.remove(id).catch(error=>toast(error.message,true)),
  onHide: id => { state.hiddenIds.add(id); render(); },

  onStats: stats => { $('#network-stats').textContent = `${stats.papers} 篇文献 · ${stats.tags} 个关联节点 · ${stats.edges} 条连线${stats.omittedTags ? ` · 另有 ${stats.omittedTags} 个标签未展示` : ''}`; },
  onLayout: positions => { clearTimeout(layoutTimer); if (!state.ready || switchingLibrary) return; layoutTimer = setTimeout(() => { if (!switchingLibrary) setSetting('graphLayout', positions).catch(error => toast(`布局未保存：${error.message}`, true)); }, 400); },
  onSelect: id => selectPaper(id, true),
  onZoom: value => { $('#zoom-level').textContent = `${value}%`; },
  onHover: (paper, event) => {
    const tip = $('#graph-tooltip');
    if (!paper || map.drag) { tip.hidden = true; return; }
    tip.replaceChildren();
    const title = document.createElement('div'); title.textContent = paper.title;
    const meta = document.createElement('small'); meta.textContent = [paper.journal, paper.year].filter(Boolean).join(' · ') || '点击查看文献';
    tip.append(title, meta); tip.hidden = false;
    const bounds = $('#graph-wrap').getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(bounds.width - tip.offsetWidth - 8, event.clientX - bounds.left + 16))}px`;
    tip.style.top = `${Math.max(45, Math.min(bounds.height - tip.offsetHeight - 50, event.clientY - bounds.top + 16))}px`;
  },
});

const notes = createNotesController({
  escape, showModal, toast, getPapers: papers, getNotes: () => state.notes,
  canEdit: () => state.mode === 'own' && !state.storageError,
  persist: async value => { await setSetting('notes', value); state.notes = value; renderDetail(); hydrateIcons($('#detail-panel')); },
  jumpPaper: id => { closeModal(); state.nav = 'all'; resetFilters(false); state.selected = id; render(); selectPaper(id, true); },
  graphTag: tag => { if (!eligibleTags(papers()).has(tag)) { toast('标签关联至少 3 篇文献后，才能在星图中筛选。'); return; } closeModal(); state.nav = 'all'; resetFilters(false); state.tag = tag; state.view = 'graph'; map.fit(); render(); },
});

function render() {
  document.body.classList.toggle('map-focus', state.focusGraph);
  document.body.classList.toggle('sidebar-collapsed',!state.leftPanelOpen);document.body.classList.toggle('detail-collapsed',!state.detailOpen);
  $('#toggle-sidebar').setAttribute('aria-expanded',String(state.leftPanelOpen));$('#toggle-detail').setAttribute('aria-expanded',String(state.detailOpen));$('#toggle-local').classList.toggle('active',state.graphPreferences.localMode);$('#local-scope-label').hidden=!state.graphPreferences.localMode;
  $('#graph-focus').hidden = false;
  $('#graph-focus').title=state.focusGraph?'展开统计概览':'收起统计概览';$('#graph-focus').setAttribute('aria-label',$('#graph-focus').title);
  const all = papers(), folders = collections(), eligible = eligibleTags(all);
  if (state.tag && !eligible.has(state.tag)) state.tag = '';
  state.filters.tags = state.filters.tags.filter(tag => eligible.has(tag));
  state.filters.excludeTags = state.filters.excludeTags.filter(tag => eligible.has(tag));
  const filtered = visiblePapers();
  if (!filtered.some(p => p.id === state.selected)) state.selected = filtered[0]?.id || '';
  const groups = tagGroups(all);
  $('#metric-total').innerHTML = `${all.length}<small>篇</small>`;
  $('#metric-tags').innerHTML = `${eligible.size}<small>个</small>`;
  $('#metric-tags').title = '至少关联 3 篇文献的标签';
  $('#metric-links').innerHTML = `${countLinks(all, eligible)}<small>条</small>`;
  $('#metric-collections').innerHTML = `${folders.length}<small>个</small>`;
  $('#all-count').textContent = all.length;
  $('#favorite-count').textContent = all.filter(p => p.favorite).length;
  $('#storage-usage').textContent = bytesLabel(state.papers.reduce((sum, p) => sum + (p.file?.size || p.size || 0), 0));
  $('.local-indicator').innerHTML = `<i></i>${state.storageError ? '存储不可用' : '已在本地保存'}`;
  if (native) { $('.storage-info > span:nth-child(2)').textContent = '文件夹文献库'; $('.storage-info').title = state.desktopInfo?.path || ''; }
  const navTitle = state.collection ? folders.find(c => c.id === state.collection)?.name || '收藏夹' : ({ all: '文献星图', library: '全部文献', favorites: '我的收藏', recent: '最近添加' }[state.nav]);
  $('#breadcrumb-current').textContent = navTitle;
  $('#page-title').innerHTML = `${escape(navTitle)}<span class="title-period">.</span>`;
  $('#page-description').textContent = state.collection ? '把同一个研究主题，收进有序的坐标。' : ({ all: '让独立的阅读，在这里彼此连接。', library: '每一篇文献，都有迹可循。', favorites: '留住那些让你停下思考的阅读。', recent: '新的阅读，新的研究坐标。' }[state.nav]);
  document.querySelectorAll('[data-nav]').forEach(button => { button.classList.toggle('active', !state.collection && button.dataset.nav === state.nav); button.setAttribute('aria-current', !state.collection && button.dataset.nav === state.nav ? 'page' : 'false'); });
  $('#collection-list').innerHTML = folders.length ? folders.map(c => `<button class="collection-item ${state.collection === c.id ? 'active' : ''}" data-collection="${escape(c.id)}"><i class="collection-dot" style="background:${/^#[\da-f]{6}$/i.test(c.color) ? c.color : PALETTE[0]}"></i><span>${escape(c.name)}</span><small>${all.filter(p => p.collection === c.id).length}</small></button>`).join('') : '<p class="empty-folders">建立你的第一个研究主题</p>';
  $('#library-location').title = state.desktopInfo?.path || '本地文献库';
  $('#graph-caption').textContent = state.tag ? `# ${state.tag}` : state.collection ? navTitle : '研究星图';
  $('#visible-count').textContent = `${filtered.length} 篇文献${state.view === 'graph' && filtered.length > 350 ? ' · 展示前 350 篇' : ''}`;
  const years = [...new Set(all.map(p => p.year).filter(Boolean))].sort().reverse();
  $('#year-filter').innerHTML = '<option value="">全部年份</option>' + years.map(year => `<option value="${escape(year)}">${escape(year)}</option>`).join('');
  $('#year-filter').value = state.year;
  $('#sort-order').value = state.sort;
  renderFilterOptions();
  renderParameterSummary(filtered);
  const filterCount = state.filters.excludeTags.length + Object.entries(state.filters).filter(([key, value]) => !['tags', 'excludeTags', 'tagMode', 'parameterName', 'parameterUnit'].includes(key) && Boolean(value)).length;
  $('#active-filter-count').textContent = filterCount;
  $('#active-filter-count').hidden = !filterCount;
  $('#advanced-result-count').textContent = `当前匹配 ${filtered.length} 篇文献`;
  $('#restore-hidden').hidden = !state.hiddenIds.size && !state.hiddenTagNodes.size;
  $('#restore-hidden').innerHTML=icon('eye');$('#restore-hidden').title=`恢复隐藏的 ${state.hiddenIds.size} 篇文献`;
  $('#hide-node').disabled = !state.selected;
  $('#legend').innerHTML = groups.slice(0, 6).map(g => `<button data-tag="${escape(g.name)}" class="${state.tag === g.name ? 'active' : ''}" title="按 ${escape(g.name)} 筛选"><i style="background:${g.color}"></i>${escape(g.name)}</button>`).join('') + (state.tag ? '<button data-action="clear-tag" class="tag-filter-clear">清除筛选 ×</button>' : '');
  $('#graph-wrap').hidden = state.view !== 'graph';
  $('#paper-list').hidden = state.view !== 'list';
  document.querySelectorAll('[data-view]').forEach(button => { const active = button.dataset.view === state.view; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  map.options = { showEdges: state.showEdges, showLabels: state.showLabels };
  const graphPapers=state.graphPreferences.localMode?associationLocalPapers(filtered,state.associations,state.selected,state.graphPreferences.localDepth):filtered;
  map.configure(state.graphPreferences,collections(),state.associations);map.setData(graphPapers,state.selected,groups);
  if(state.graphPreferences.localMode)$('#visible-count').textContent=`局部 ${graphPapers.length} / 筛选 ${filtered.length} 篇`;
  renderGraphPreferences();$('#ribbon-import').disabled=!state.ready||state.storageError;
  const empty = $('#graph-empty'); empty.hidden = filtered.length > 0;
  if (!filtered.length) {
    if (all.length > 0) empty.innerHTML = `<span data-icon="search"></span><h2>还没有找到这颗星</h2><p>尝试其他关键词，或清除筛选条件。</p><button class="outline-button" data-action="reset-filters">清除筛选</button>`;
    else empty.innerHTML = `<span data-icon="orbit"></span><h2>从第一篇文献开始</h2><p>导入 PDF，添加你的研究标签，<br>让文献在星图中找到位置。</p><button class="primary" data-action="import"><span data-icon="plus"></span>导入文献</button><button class="text-button" data-action="download-md-template">下载 Markdown 规范模板</button>`;
  }
  if (state.view === 'list') renderList(filtered);
  renderDetail();
  hydrateIcons();
  comparison?.refreshBar();
  $('#removal-undo').hidden = !lastRemoval?.count;
  $('#removal-undo-count').textContent = lastRemoval?.count || 0;
  $('#quick-undo').hidden = !lastRemoval?.count || state.view !== 'graph' || !state.focusGraph;
}

async function applyParameterFilter(name, unit = '*') {
  if (!ensureStorage()) return;
  closeModal(); $('#advanced-filter-dialog').close(); resetFilters(false);
  state.nav='library';state.view='list';state.filters.parameterName=parameterNameKey(name);state.filters.parameterUnit=unit;state.selected='';const matchingIds=new Set(parameterResults(papers(),name,unit).map(p=>p.id));await comparison.selectIds([...state.compareIds].filter(id=>matchingIds.has(id)));render();
}
async function plotActiveParameter(){const key=state.filters.parameterName;if(!key)return false;const rows=parameterResults(papers(),key,state.filters.parameterUnit).filter(p=>state.compareIds.has(p.id));if(!rows.length){toast('请先勾选相关文献，或点击全选匹配结果。');return true;}await comparison.selectIds(rows.map(p=>p.id));comparison.open('chart',{name:key,unit:state.filters.parameterUnit});return true;}
function renderParameterSummary(filtered) {
  const key=state.filters.parameterName, host=$('#parameter-filter-summary');host.hidden=!key;
  if(!key){host.innerHTML='';$('#quick-parameter-label').textContent='性能参数';return;}
  const item=parameterInventory(papers()).find(item=>item.key===key),unit=state.filters.parameterUnit;
  const all=parameterResults(papers(),key,unit),selectedCount=all.filter(p=>state.compareIds.has(p.id)).length,recordCount=all.reduce((count,p)=>count+(p.measurements||[]).filter(m=>parameterNameKey(m.name)===key&&(unit==='*'||String(m.unit||'').normalize('NFKC').trim()===unit)).length,0);
  $('#quick-parameter-label').textContent=item?.name || key;
  host.innerHTML=`<div><span>性能参数筛选</span><strong>${escape(item?.name||key)}${unit==='*'?' · 全部单位':' · '+escape(unit||'单位未填')}</strong><p>全库 ${all.length} 篇文献录入 · ${recordCount} 条记录；当前匹配 ${filtered.length} 篇，本参数已选 ${selectedCount} 篇。先选择文献，数值、单位及条件在绘图中单独核对。</p></div><button class="primary" data-action="plot-parameter-results" ${selectedCount?'':'disabled'}>用所选 ${selectedCount} 篇作图</button><button class="outline-button" data-action="select-parameter-results" ${filtered.length?'':'disabled'}>全选匹配 ${filtered.length} 篇</button><button class="text-button" data-action="parameter-index">切换参数</button><button class="icon-button" data-action="clear-parameter" title="清除性能参数筛选" aria-label="清除性能参数筛选">${icon('close')}</button>`;
}

function documentArt() { return '<div class="document-art" aria-hidden="true"><i></i><i></i><i></i><i></i><span>PDF</span></div>'; }
function renderList(filtered) {
  $('#paper-list').innerHTML = filtered.length ? `<div class="list-selection-toolbar"><button class="text-button" data-action="select-filtered">全选当前筛选结果（${filtered.length} 篇）</button><span>已选 <b data-selected-count>${state.compareIds.size}</b> 篇</span><button class="text-button" data-comparison-action="clear">清空选择</button><button class="outline-button" data-action="bulk-edit" ${state.compareIds.size?'':'disabled'}>批量标签 / 分组</button><button class="danger-button" data-action="batch-remove" ${state.compareIds.size?'':'disabled'}>批量移除</button></div>` + filtered.slice(0,state.listLimit).map(p=>{
    const metric=impactOf(p,state.journalMetrics,state.filters.impactYear);
    return `<article class="paper-row ${p.id===state.selected?'selected':''}" data-select="${escape(p.id)}" tabindex="0" role="button" aria-label="查看 ${escape(p.title)}"><label class="compare-checkbox" title="选择文献，用于性能对比或批量移除"><input type="checkbox" data-compare-id="${escape(p.id)}" ${state.compareIds.has(p.id)?'checked':''} aria-label="选择文献 ${escape(p.title)}"></label>${documentArt()}<div class="paper-row-content"><h3>${escape(p.title)}</h3><div class="list-paper-badges"><span class="impact-badge ${metric?'':'missing'}">${metric?`IF ${metric.value} · ${escape(metric.year || '年份未填')}`:'IF 未填写'}</span><span>${p.measurements?.length || 0} 条性能参数</span><span>${notes.count('paper',p.id)} 条笔记</span></div><p>${escape([p.journal,p.year,p.authors].filter(Boolean).join(' · ') || p.filename)}</p>${state.filters.parameterName?parameterRecordPreview(p,state.filters.parameterName,state.filters.parameterUnit,escape):''}<div class="tags">${p.tags.slice(0,4).map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div></div><button class="icon-button ${p.favorite?'favorite-on':''}" data-favorite="${escape(p.id)}" aria-label="${p.favorite?'取消收藏':'收藏'}"><span data-icon="star"></span></button></article>`;
  }).join('') + (filtered.length>state.listLimit?`<button class="outline-button list-load-more" data-action="more-list">显示更多（剩余 ${filtered.length-state.listLimit} 篇）</button>`:'') : papers().length ? '<div class="list-empty"><strong>没有匹配的文献</strong><p>可清除标题搜索、调整条件，或切换性能参数。</p><button class="outline-button" data-action="parameter-index">切换性能参数</button></div>' : '<div class="list-empty"><strong>从第一批文献开始</strong><button class="outline-button" data-action="import">批量导入 PDF + Markdown</button></div>';
}

function renderDetail() {
  const panel = $('#detail-panel'), p = selectedPaper();
  if (!p) { panel.classList.add('detail-empty'); panel.innerHTML = '<span data-icon="orbit"></span><h3>等待一颗新的坐标</h3><p>点击星图中的文献<br>查看详细信息与阅读笔记。</p>'; return; }
  panel.classList.remove('detail-empty');
  const folder = collections().find(c => c.id === p.collection);
  const authors = normalizeAuthors(p.authorDetails || []), metric = impactOf(p, state.journalMetrics, state.filters.impactYear);
  const eligible = eligibleTags(papers());
  const related = papers().filter(other => other.id !== p.id).map(other => ({ paper: other, tags: other.tags.filter(t => eligible.has(t) && p.tags.includes(t)) })).filter(item => item.tags.length).sort((a, b) => b.tags.length - a.tags.length || b.paper.addedAt - a.paper.addedAt);
  panel.innerHTML = `
    <div class="detail-top"><span>文献详情 / PAPER</span><div class="detail-actions"><button class="icon-button ${p.favorite ? 'favorite-on' : ''}" data-action="favorite" aria-label="${p.favorite ? '取消收藏' : '收藏文献'}"><span data-icon="star"></span></button><button class="icon-button" data-action="edit" aria-label="编辑文献信息"><span data-icon="edit"></span></button><button class="icon-button detail-close-button" data-action="toggle-detail" aria-label="收起文献详情" title="收起文献详情"><span data-icon="close"></span></button></div></div>
    ${documentArt()}
    <div class="paper-journal"><i class="journal-mark"></i><button data-journal="${escape(p.journal)}" title="按期刊筛选">${escape(p.journal || '未填写期刊')}</button><span>·</span>${escape(p.year || '年份待补充')}</div>
    <div class="impact-badge ${metric ? '' : 'missing'}" title="${escape(metric?.source || '可在编辑信息或期刊指标导入中填写')}">${metric ? `IF ${metric.value} <span>· ${escape(metric.year || '年份未填')}</span>` : 'IF 未填写'}</div>
    <h2 class="paper-title"><button data-action="paper-notes" title="打开这篇文献的全部笔记">${escape(p.title)}</button></h2>
    <p class="paper-authors">${escape(authors.length ? authors.map(a => a.name).join(', ') : p.authors || '作者待补充')}</p>
    <details class="author-details"><summary>全部作者与机构 <span>${authors.length ? authors.length + ' 位作者' : '待补全'}</span></summary>${authors.length ? `<ol>${authors.map(a => `<li><button data-author="${escape(a.name)}">${escape(a.name)}</button>${a.affiliations.length ? a.affiliations.map(institution => `<button class="affiliation" data-institution="${escape(institution)}">${escape(institution)}</button>`).join('') : '<small>机构待补充</small>'}</li>`).join('')}</ol>` : '<p>编辑信息或导入元数据，可逐位记录作者与所属机构。</p>'}</details>
    ${p.doi ? `<p class="doi-label">DOI ${escape(p.doi)}</p>` : ''}
    
    <div class="detail-divider"></div>
    <div class="detail-label"><span>研究标签 · 点击查看笔记</span><button class="text-button" data-action="edit">编辑</button></div>
    <div class="tags">${p.tags.length ? p.tags.map(tag => `<button class="tag" data-link-tag="${escape(tag)}">${escape(tag)}</button>`).join('') : '<span class="help-inline">添加标签，让文献彼此连接。</span>'}</div>
    <p class="detail-label">所在收藏夹</p><div class="collection-value"><span data-icon="folder"></span>${escape(folder?.name || '未归入收藏夹')}</div>
    <div class="detail-label"><span>性能参数 · ${p.measurements?.length || 0} 条</span><button class="text-button" data-action="performance-editor">管理 / 编辑 ↗</button></div>
    <div class="performance-preview">${(p.measurements || []).slice(0,4).map(m=>`<div><button class="performance-parameter-link" data-parameter-name="${escape(parameterNameKey(m.name))}" data-parameter-unit="*" title="查找全库录入此参数的文献">${escape(m.name)} ↗</button><strong>${escape(m.qualifier)}${m.value} <small>${escape(m.unit)}</small></strong><small>${escape([m.sample,m.conditions].filter(Boolean).join(' · '))}</small></div>`).join('') || '<p class="help-inline">导入 Markdown 的性能参数表，或点击管理添加。</p>'}</div>
    <button class="outline-button detail-compare-button" data-action="toggle-compare">${state.compareIds.has(p.id)?'✓ 已加入性能对比':'＋ 加入性能对比'}</button>
    <div class="detail-label"><span>文献笔记 · ${notes.count('paper', p.id)} 条</span><button class="text-button" data-action="paper-notes">管理 / 添加 ↗</button></div>
    ${notes.preview('paper', p.id) || '<p class="help-inline">每篇文献可以保留多条独立笔记。</p>'}
    <div class="detail-divider"></div><div class="related-header"><span>关联文献</span><small>${related.length} 篇 · 共享标签</small></div>
    <div class="related-list">${related.slice(0, 3).map(item => `<button class="related-paper" data-related="${escape(item.paper.id)}"><i class="related-dot"></i><span><strong>${escape(item.paper.title)}</strong><small>${escape(item.tags.join(' · '))}</small></span></button>`).join('') || '<p class="help-inline">共享标签的文献会在这里相遇。</p>'}</div>
    <div class="detail-bottom"><button class="primary open-pdf" data-action="open-pdf"><span data-icon="external"></span>打开 PDF 文献</button><p class="detail-file-note">${bytesLabel(p.file?.size || p.size || 0)} · ${escape(p.filename || 'PDF 文献')}</p><div class="detail-action-menu"><button class="text-button" data-action="download-pdf">另存 PDF</button><button class="text-button" data-action="delete">移除文献</button></div></div>`;
}

function selectPaper(id, showMobile = false) {
  if (!papers().some(p => p.id === id)) return;
  state.selected = id;state.detailOpen=true;document.body.classList.remove('detail-collapsed');if(state.graphPreferences.localMode){render();return;} map.select(id); renderDetail();
  if (state.view === 'list') { document.querySelectorAll('.paper-row').forEach(row => row.classList.toggle('selected', row.dataset.select === id)); }
  if (showMobile && matchMedia('(max-width: 850px)').matches) $('#detail-panel').classList.add('mobile-open');
  hydrateIcons($('#detail-panel'));
}

function toast(message, error = false) {
  const node = document.createElement('div'); node.className = `toast${error ? ' error' : ''}`;
  node.innerHTML = `<span data-icon="${error ? 'info' : 'check'}"></span><span>${escape(message)}</span>`;
  $('#toast-region').append(node); hydrateIcons(node);
  setTimeout(() => node.remove(), error ? 7000 : 4000);
}
function showModal(title, description, body, context = '') {
  comparison?.dispose();
  modalContext = context;
  $('#modal-content').innerHTML = `<div class="modal-heading"><div><h2>${title}</h2><p>${description}</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭弹窗"><span data-icon="close"></span></button></div><div class="modal-body">${body}</div>`;
  hydrateIcons($('#modal')); if (!$('#modal').open) $('#modal').showModal();
  $('#graph-tooltip').hidden = true;
}
function closeModal() { if (batch?.isBusy() || bulkEditor?.isBusy() || removalBusy) { toast('正在保存更改，请稍候。'); return; } comparison?.dispose(); $('#modal').close(); modalContext = ''; state.pendingFiles = []; pendingRemovalIds = []; }
function ensureStorage() { if (!state.storageError && state.ready) return true; if(!state.storageError){toast('正在打开文献库，请稍候…');return false;} toast(native ? '本地文献库不可用，请检查文件夹权限。' : '浏览器存储不可用，请使用普通浏览窗口重试。', true); return false; }
function folderOptions(selected = '') { return '<option value="">未归入收藏夹</option>' + state.collections.map(c => `<option value="${escape(c.id)}" ${selected === c.id ? 'selected' : ''}>${escape(c.name)}</option>`).join(''); }
function formValues(form) {
  const data = new FormData(form), authorDetails = normalizeAuthors(data.get('authorDetails'));
  const impactFactor = numericImpact(data.get('impactFactor')), impactYear = String(data.get('impactYear') || '').trim();
  if (impactFactor !== null && !/^\d{4}$/.test(impactYear)) throw new Error('填写影响因子时，请同时填写四位指标年份。');
  return { title: String(data.get('title') || '').trim(), authorDetails, authors: authorDetails.map(a => a.name).join(', '), journal: String(data.get('journal') || '').trim(), year: String(data.get('year') || '').trim(), doi: String(data.get('doi') || '').trim(), impactFactor, impactYear, tags: normalizeTags(data.get('tags')), collection: String(data.get('collection') || '') };
}
function bibliographyFields(p = {}) {
  return `<label class="form-field">作者与机构（每行一位作者）<textarea name="authorDetails" maxlength="200000" placeholder="张三 | 清华大学材料学院；某研究所\nJane Smith | Department of Materials, Example University">${escape(p.authorDetails?.length ? authorsText(p.authorDetails) : p.authors || '')}</textarea><small>格式：姓名 | 机构一；机构二。支持全部作者、多机构，也可通过元数据 JSON 批量导入。</small></label><div class="form-row"><label class="form-field">期刊 / 刊物标签<input name="journal" maxlength="300" value="${escape(p.journal || '')}" placeholder="例如 Advanced Materials"></label><label class="form-field">发表年份<input name="year" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${escape(p.year || '')}" placeholder="选填"></label></div><div class="form-row"><label class="form-field">影响因子 IF<input name="impactFactor" type="number" min="0" max="1000" step="any" value="${p.impactFactor ?? ''}" placeholder="未填写时使用导入的期刊指标"></label><label class="form-field">指标年份<input name="impactYear" pattern="[0-9]{4}" inputmode="numeric" maxlength="4" value="${escape(p.impactYear || '')}" placeholder="例如 2025"></label></div><label class="form-field">DOI<input name="doi" maxlength="1000" value="${escape(p.doi || '')}" placeholder="选填"></label>`;
}

function importModal(files = []) { if (ensureStorage()) batch.open(files); }
async function addFiles(files) { if (ensureStorage()) await batch.addFiles(files); }

function editModal() {
  const p = selectedPaper(); if (!p) return;
  if (!ensureStorage()) return;
  showModal('编辑文献信息', '完整记录作者、机构与期刊指标。', `<form id="edit-form" data-id="${escape(p.id)}"><label class="form-field">文献标题<input name="title" required maxlength="1000" value="${escape(p.title)}"></label>${bibliographyFields(p)}<label class="form-field">研究标签<input name="tags" maxlength="2500" value="${escape(p.tags.join('，'))}" placeholder="用逗号分隔标签"><small>标签关联至少 3 篇文献后参与常规筛选与颜色分组。星图只连接手动加入的关联节点，原始标签及笔记始终保留。</small></label><label class="form-field">收藏夹<select name="collection">${folderOptions(p.collection)}</select></label><div class="modal-footer"><button type="button" class="text-button" data-action="close-modal">取消</button><button type="submit" class="primary">保存修改</button></div></form>`, 'edit');
}

async function submitEdit(form) {
  const paper = state.papers.find(p => p.id === form.dataset.id); if (!paper) return;
  const values = formValues(form); if (!values.title) { toast('请填写文献标题。', true); return; }
  const updated = { ...paper, ...values }; await putPaper(updated);
  state.papers = state.papers.map(p => p.id === updated.id ? updated : p); if (native) state.notes = await getSetting('notes') || {}; closeModal(); render(); toast('文献信息已保存。');
}

async function favorite(id = state.selected) {
  const paper = papers().find(p => p.id === id); if (!paper) return;
  if (!ensureStorage()) return;
  const updated = { ...paper, favorite: !paper.favorite }; await putPaper(updated);
  state.papers = state.papers.map(p => p.id === id ? updated : p); render(); toast(updated.favorite ? '已加入我的收藏。' : '已取消收藏。');
}

function newCollectionModal() {
  if (!ensureStorage()) return;
  showModal('建立一个研究主题', '用收藏夹，为你的阅读建立清晰的秩序。', `<form id="collection-form"><label class="form-field">收藏夹名称<input name="name" required maxlength="80" placeholder="例如：我的二维材料研究" autofocus></label><label class="form-field">主题颜色</label><div class="collection-colors">${PALETTE.map((color, i) => `<button type="button" class="color-choice ${i === 0 ? 'active' : ''}" style="background:${color}" data-color="${color}" aria-label="颜色 ${i + 1}" aria-pressed="${i === 0}"></button>`).join('')}</div><input type="hidden" name="color" value="${PALETTE[0]}"><div class="modal-footer"><button type="button" class="text-button" data-action="close-modal">取消</button><button class="primary" type="submit">创建收藏夹</button></div></form>`, 'collection');
}

async function submitCollection(form) {
  const data = new FormData(form), name = String(data.get('name') || '').trim(); if (!name) return;
  if (state.collections.some(c => c.name === name)) { toast('已经有同名收藏夹了。', true); return; }
  const collection = { id: uid('folder'), name, color: String(data.get('color')) };
  const next = [...state.collections, collection]; await setSetting('collections', next);
  state.collections = next; state.mode = 'own'; state.collection = collection.id; state.nav = 'all'; state.query = ''; state.tag = ''; state.year = ''; $('#search').value = ''; await setSetting('mode', 'own');
  closeModal(); render(); toast(`已创建「${name}」。`);
}

async function openPDF(download = false) {
  const p = selectedPaper(); if (!p) return;
  if (native) { if (download) await native.savePdf(p.id); else await native.openPdf(p.id); return; }
  if (!p.file) { toast('这条文献尚未附上 PDF 文件。', true); return; }
  const url = URL.createObjectURL(p.file); activeObjectURLs.add(url);
  if (download) triggerDownload(url, p.filename || `${p.title}.pdf`);
  else { const win = window.open(url, '_blank'); if (!win) { URL.revokeObjectURL(url); activeObjectURLs.delete(url); toast('浏览器阻止了新窗口，请允许此网站打开 PDF。', true); return; } win.opener = null; }
  setTimeout(() => { URL.revokeObjectURL(url); activeObjectURLs.delete(url); }, 60000);
}
function triggerDownload(url, filename) { const a = document.createElement('a'); a.href = url; a.download = filename; ($('#modal').open ? $('#modal') : document.body).append(a); a.click(); a.remove(); }

function deleteModal(ids = [state.selected]) {
  if (!ensureStorage()) return;
  const selected = new Set(ids), removed = papers().filter(p => selected.has(p.id));
  if (!removed.length) { toast('请先在文献列表中勾选要移除的文献。'); return; }
  pendingRemovalIds = removed.map(p => p.id);
  const visible = new Set(visiblePapers().map(p => p.id)), hidden = removed.filter(p => !visible.has(p.id)).length;
  showModal(`移除选中的 ${removed.length} 篇文献？`, '确认下面的标题后移除，完成后可撤销上次移除。', `<div class="removal-summary"><strong>${removed.length}</strong><span>篇选中文献${hidden ? ` · 其中 ${hidden} 篇不在当前筛选结果中` : ''}</span></div><div class="removal-preview">${removed.map(p => `<div><strong>${escape(p.title)}</strong><small>${escape([p.journal,p.year,p.filename].filter(Boolean).join(' · '))}</small></div>`).join('')}</div><p class="help-inline">${native ? '原始 PDF 保留在本地文件夹，文献信息、性能参数与文献笔记会一同保存到恢复记录。' : '文献信息、PDF、性能参数与文献笔记会一同保存到本地恢复记录。'} 标签笔记和其他文献不受影响。</p><div class="modal-footer"><button class="text-button" data-action="close-modal">取消</button><button class="danger-button" data-action="confirm-removal">确认移除 ${removed.length} 篇</button></div>`, 'delete');
}

async function confirmRemoval() {
  if (modalContext !== 'delete' || !pendingRemovalIds.length || removalBusy) return;
  const ids = [...pendingRemovalIds], button = $('[data-action="confirm-removal"]');
  removalBusy = true; button.disabled = true; button.textContent = '正在移除…';
  try {
    const receipt = await deletePapers(ids);
    await reloadLibrary();
    removalBusy = false; closeModal(); render();
    toast(`已移除 ${receipt.count} 篇文献，可点击「撤销上次移除」恢复。`);
  } finally { removalBusy = false; if (button.isConnected) { button.disabled = false; button.textContent = `确认移除 ${ids.length} 篇`; } }
}

async function undoRemoval() {
  if (!lastRemoval?.id || removalBusy) return;
  removalBusy = true;
  const button = $('[data-action="undo-removal"]'); button.disabled = true;
  try {
    const result = await restorePapers(lastRemoval.id);
    await reloadLibrary(); render();
    toast(`已恢复 ${result.count} 篇文献及其笔记、性能参数。`);
  } finally { removalBusy = false; button.disabled = false; }
}

function settingsModal() {
  const size = state.papers.reduce((sum, p) => sum + (p.file?.size || p.size || 0), 0);
  showModal('文献库与备份', '文献、笔记与研究坐标，都由你掌握。', `
    ${native ? `<div class="settings-card folder-card"><div><strong>当前本地文献库</strong><p class="folder-path">${escape(state.desktopInfo?.path || '')}</p><p>原始 PDF、作者机构、标签、笔记和期刊指标均保存在这个文件夹。</p></div></div><div class="folder-actions"><button class="outline-button" data-action="choose-folder">选择 / 新建文献库</button><button class="outline-button" data-action="open-folder">打开文件夹</button></div>` : '<div class="info-box">当前是网页预览。桌面 EXE 使用本地文件夹保存数据；网页预览仍使用浏览器存储。</div>'}
    <div class="settings-card"><div><strong>导入文献元数据</strong><p>批量导入 Markdown：标题、作者机构、标签、性能参数和笔记。</p></div><button class="outline-button" data-action="import-metadata">导入</button></div>
    <div class="settings-card"><div><strong>期刊影响因子</strong><p>已收录 ${state.journalMetrics.length} 条年度指标，含出版方公开的 2025 年 JIF。</p></div><button class="outline-button" data-action="journal-catalog">查看数据 / 来源</button></div>
    <div class="settings-card"><div><strong>完整备份</strong><p>${state.papers.length} 篇 PDF、全部笔记、作者机构、收藏夹和期刊指标。</p></div><button class="outline-button" data-action="export">导出</button></div>
    <div class="settings-card"><div><strong>恢复完整备份</strong><p>合并文献、笔记与指标；相同 ID 的记录以备份为准。</p></div><button class="outline-button" data-action="restore">选择文件</button></div>
    <div class="info-box">${native ? '切换文献库会打开所选文件夹中的数据，原文件夹保留。可将整个文献库文件夹复制到其他设备。' : '网页数据不会自动迁入桌面程序，请先导出备份，再在 EXE 中恢复。'} 当前 PDF 总量 ${bytesLabel(size)}。</div><div class="modal-footer"><button class="primary" data-action="close-modal">完成</button></div>`, 'settings');
}

function journalCatalogModal() {
  const rows = [...state.journalMetrics].sort((a,b)=>Number(b.year)-Number(a.year)||a.journal.localeCompare(b.journal));
  showModal('期刊影响因子数据', `已收录 ${rows.length} 条年度指标 · 内置数据核验日期 ${JOURNAL_DATA_CHECKED}`, `<p class="help-inline">已载入 ${BUNDLED_METRICS.length} 本期刊的 2025 年两年期 JIF。未覆盖的期刊可继续导入 CSV / JSON；你已有的同刊同年指标优先保留。</p><div class="journal-catalog">${rows.map(row=>`<article><strong>${escape(row.journal)}</strong><b>IF ${row.impactFactor} <small>· ${escape(row.year)}</small></b><input readonly aria-label="${escape(row.journal)} 指标来源" value="${escape(row.source || '未填写来源')}" title="选择并复制来源"></article>`).join('')}</div><div class="modal-footer"><button class="text-button" data-action="import-metrics">继续导入指标</button><button class="outline-button" data-action="export-metrics">导出指标 CSV</button><button class="primary" data-action="close-modal">完成</button></div>`, 'journal-catalog');
}

function exportMetrics() {
  const quote = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  return saveText('\uFEFFjournal,impactFactor,year,source\r\n'+state.journalMetrics.map(row=>[row.journal,row.impactFactor,row.year,row.source].map(quote).join(',')).join('\r\n'), 'materia-journal-metrics.csv', 'csv');
}

async function exportLibrary() {
  if (!ensureStorage()) return;
  if (!state.papers.length && !state.collections.length && !state.journalMetrics.length && !Object.keys(state.notes).length) { toast('你的文献库还是空的，导入 PDF 后即可导出完整备份。'); return; }
  toast('正在打包 PDF 和文献信息，请稍候…');
  const backup = await createBackup(state.papers, state.collections, state.notes, state.journalMetrics);
  if (native) { const saved = await native.saveBackup(JSON.stringify(backup)); if (!saved.canceled) toast(`完整备份已保存到：${saved.path}`); return; }
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  triggerDownload(url, `materia-backup-${date}.json`); setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(`完整备份已导出，包含 ${state.papers.length} 篇文献。`);
}

async function restoreFile(file) {
  if (!ensureStorage() || !file) return;
  if (file.size > 512 * 1024 * 1024) { toast('备份超过 512 MB，请拆分后恢复。', true); return; }
  let backup;
  try { backup = readBackup(JSON.parse(await file.text())); }
  catch (error) { toast(error instanceof SyntaxError ? '文件不是有效的 JSON 备份。' : error.message, true); return; }
  showModal('恢复这份文献备份？', '备份将合并进我的文献库。', `<p class="confirm-copy">包含 ${backup.papers.length} 篇文献、${backup.collections.length} 个收藏夹。<br>同一 ID 的记录将被备份内容覆盖，其余文献保留。</p><div class="modal-footer"><button class="text-button" data-action="close-modal">取消</button><button class="primary" id="confirm-restore">确认恢复</button></div>`, 'restore-confirm');
  $('#confirm-restore').addEventListener('click', async event => {
    const confirmButton = event.currentTarget;
    confirmButton.disabled = true;
    try {
      await mergeBackup(backup);
      state.papers = await getPapers(); state.collections = (await getSetting('collections')) || []; state.notes = (await getSetting('notes')) || {}; state.journalMetrics = (await getSetting('journalMetrics')) || []; state.mode = 'own'; state.nav = 'all'; resetFilters(false);
      closeModal(); render(); toast(`已恢复 ${backup.papers.length} 篇文献。`);
    } catch (error) { confirmButton.disabled = false; toast(`恢复失败：${error.message || '本地空间不足。'}`, true); }
  });
}



function resetFilters(shouldRender = true) { state.query = ''; state.tag = ''; state.year = ''; state.collection = ''; state.sort = 'newest'; state.filters = emptyFilters(); state.hiddenIds.clear(); state.listLimit = 100; $('#search').value = ''; if (shouldRender) render(); }

function helpModal() {
  showModal('从阅读，到连接', '一个安静、专注的材料文献研究空间。', `<div class="guide-step"><span>1</span><div><strong>收录原始 PDF</strong><p>选择或拖入多份 PDF；相同文件自动去重。桌面版将文件保存至本地文献库文件夹，可在设置里更换位置。</p></div></div><div class="guide-step"><span>2</span><div><strong>补充完整信息</strong><p>编辑标题、全部作者与机构、期刊和标签，或导入其他 AI 整理的 JSON。年度影响因子可通过 CSV / JSON 导入。</p></div></div><div class="guide-step"><span>3</span><div><strong>让思考彼此连接</strong><p>点击标题或标签，分别添加多条笔记。使用 [[完整标题]] 和 [[#标签]] 互相跳转，目标处会显示反向链接。</p></div></div><div class="guide-step"><span>4</span><div><strong>搜索与探索</strong><p>搜索标题、标签、作者、机构和笔记。过滤支持多标签、期刊、年份与 IF 范围，星图和列表同步更新，IF 支持升降序排列。</p></div></div><div class="guide-step"><span>5</span><div><strong>把积累带走</strong><p>导出完整备份，包含 PDF、笔记、作者机构和期刊指标；可在其他设备恢复。桌面版也可直接复制整个文献库文件夹。</p></div></div><div class="info-box">所有文献信息由你填写或导入，程序不会解析或上传 PDF，也不会自动生成影响因子。</div><div class="modal-footer"><button class="primary" data-action="close-modal">开始探索</button></div>`, 'help');
}
function shortcutsModal() {
  showModal('留一点时间给思考', '让常用操作更快一步。', '<div class="shortcut-row"><span>搜索文献</span><kbd>/</kbd></div><div class="shortcut-row"><span>导入文献</span><kbd>N</kbd></div><div class="shortcut-row"><span>切换星图 / 列表</span><kbd>V</kbd></div><div class="shortcut-row"><span>重置星图视角</span><kbd>0</kbd></div><div class="shortcut-row"><span>关闭弹窗 / 详情</span><kbd>Esc</kbd></div><div class="shortcut-row"><span>快捷键说明</span><kbd>?</kbd></div><div class="modal-footer"><button class="primary" data-action="close-modal">记住了</button></div>', 'shortcuts');
}

function renderGraphPreferences(){document.querySelectorAll('[data-graph-setting]').forEach(input=>{const value=state.graphPreferences[input.dataset.graphSetting];if(input.type==='checkbox')input.checked=Boolean(value);else input.value=String(value);});document.querySelectorAll('[data-graph-output]').forEach(output=>{output.textContent=state.graphPreferences[output.dataset.graphOutput];});}
function saveGraphPreferences(){clearTimeout(graphPreferenceTimer);graphPreferenceTimer=setTimeout(()=>setSetting('graphPreferences',state.graphPreferences).catch(error=>toast(error.message,true)),400);}
document.addEventListener('input',event=>{const key=event.target.dataset.graphSetting;if(!key)return;state.graphPreferences=cleanGraphSettings({...state.graphPreferences,[key]:event.target.type==='checkbox'?event.target.checked:event.target.type==='range'?Number(event.target.value):event.target.value});render();saveGraphPreferences();});
document.addEventListener('change',event=>{if(event.target.matches('select[data-graph-setting]')){const key=event.target.dataset.graphSetting;state.graphPreferences=cleanGraphSettings({...state.graphPreferences,[key]:key==='localDepth'?Number(event.target.value):event.target.value});render();saveGraphPreferences();}});

function openAdvancedFilters() { if (!$('#advanced-filter-dialog').open) $('#advanced-filter-dialog').showModal(); $('#filter-button').setAttribute('aria-expanded','true'); }
$('#advanced-filter-dialog').addEventListener('close',()=>$('#filter-button').setAttribute('aria-expanded','false'));

const actions = {
  import: () => importModal(), 'choose-pdf': () => $('#pdf-input').click(),
  'download-md-template': () => saveText(markdownTemplate(), 'materia-metadata-template.md', 'md'),
  'performance-editor': () => performanceEditor.open(state.selected),
  'toggle-compare': async () => { await comparison.toggle(state.selected); comparison.refreshBar(); renderDetail(); hydrateIcons($('#detail-panel')); },
  'close-modal': closeModal, 'new-collection': newCollectionModal, edit: editModal, favorite: () => favorite(),
  'open-pdf': () => openPDF(), 'download-pdf': () => openPDF(true), delete: deleteModal,
  'select-filtered': () => comparison.selectFiltered(),
  'batch-remove': () => deleteModal([...state.compareIds]), 'bulk-edit': () => bulkEditor.open(),
  'confirm-removal': confirmRemoval, 'undo-removal': undoRemoval,
  settings: settingsModal, 'storage-info': settingsModal, export: exportLibrary, restore: () => $('#backup-input').click(),
  help: helpModal, shortcuts: shortcutsModal,
  'zoom-in': () => map.zoom(1.2), 'zoom-out': () => map.zoom(1 / 1.2), fit: () => map.fit(),
  'clear-tag': () => { state.tag = ''; render(); }, 'restore-hidden': () => { state.hiddenIds.clear(); state.hiddenTagNodes.clear(); render(); }, 'hide-node': () => { if (state.selected) { state.hiddenIds.add(state.selected); render(); } }, 'graph-motion': () => { $('#graph-motion').textContent = map.toggleMotion() ? '暂停布局' : '继续布局'; }, 'graph-relayout': () => { map.relayout(); map.fit(); },
  'reset-filters': () => resetFilters(),
  'toggle-sidebar': () => {state.leftPanelOpen=!state.leftPanelOpen;render();},'toggle-detail': () => {state.detailOpen=!state.detailOpen;render();},'toggle-local': () => {state.graphPreferences.localMode=!state.graphPreferences.localMode;render();saveGraphPreferences();},'associations':()=>associationController.open(),'reset-graph-settings':()=>{state.graphPreferences={...GRAPH_DEFAULTS};render();saveGraphPreferences();},
  'graph-focus': () => { state.focusGraph = !state.focusGraph; render(); window.scrollTo({top:0}); },
  'close-detail': () => $('#detail-panel').classList.remove('mobile-open'),
  'more-list': () => { state.listLimit += 100; renderList(visiblePapers()); hydrateIcons($('#paper-list')); },
  filters: openAdvancedFilters, 'close-filters': () => $('#advanced-filter-dialog').close(),
  menu: () => $('#sidebar').classList.toggle('mobile-open'),
  'parameter-index': () => parameterFinder.open(), 'clear-parameter': () => { state.filters.parameterName='';state.filters.parameterUnit='*';render(); }, 'plot-parameter-results': plotActiveParameter, 'select-parameter-results': async()=>{await comparison.selectIds(visiblePapers().map(p=>p.id));renderParameterSummary(visiblePapers());},
  'tag-index': () => notes.openIndex(),
  'paper-notes': () => { if (state.selected) notes.open('paper', state.selected); },
  'open-folder': () => native?.openFolder(),
  'choose-folder': async () => {
    switchingLibrary = true; clearTimeout(layoutTimer);
    let info;
    try { info = await native?.chooseFolder(); } finally { switchingLibrary = false; }
    if (!info) return;
    map.setLayout(await getSetting('graphLayout') || {});
    state.graphPreferences=cleanGraphSettings(await getSetting('graphPreferences')||{});state.associations=cleanAssociations(await getSetting('graphAssociations')||[]);
    lastRemoval = await getSetting('lastRemoval') || null; state.desktopInfo = info; state.papers = await getPapers(); state.collections = await getSetting('collections') || []; state.notes = await getSetting('notes') || {}; state.journalMetrics = await getSetting('journalMetrics') || []; state.compareIds = new Set((await getSetting('comparisonSelection') || []).filter(id=>state.papers.some(p=>p.id===id))); state.mode = 'own'; state.selected = ''; state.nav = 'all'; resetFilters(false); map.fit(); closeModal(); render(); toast(`已打开文献库：${info.path}`);
  },
  'import-metadata': () => dataImportModal('metadata'),
  'import-metrics': () => dataImportModal('metrics'),
  'journal-catalog': journalCatalogModal, 'export-metrics': exportMetrics,
  'data-file': () => $('#data-input').click(),
  'metadata-template': () => downloadTemplate('metadata'),
  'metrics-template': () => downloadTemplate('metrics'),
};

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (removalBusy || bulkEditor?.isBusy()) return;
  try {
    if (button?.matches('[data-association-kind],[data-add-association],[data-remove-association],[data-association-clear],[data-parameter-name],[data-link-paper],[data-link-tag],[data-note-action],[data-note-edit],[data-note-delete],[data-note-owner-type],[data-comparison-action],[data-comparison-tab],[data-comparison-remove],[data-bulk-action],[data-batch-action],[data-batch-remove],[data-batch-md-remove],[data-performance-add],[data-performance-remove]') || event.target.closest('.compare-checkbox')) return;
    if (button?.dataset.action && actions[button.dataset.action]) { await actions[button.dataset.action](); return; }
    if (button?.dataset.favorite) { await favorite(button.dataset.favorite); return; }
    if (button?.dataset.nav) {
      state.filters = emptyFilters();
      state.nav = button.dataset.nav; state.collection = ''; state.selected = ''; state.view = state.nav === 'all' ? 'graph' : 'list'; state.tag = ''; state.year = ''; state.query = ''; state.sort = 'newest'; $('#search').value = ''; state.listLimit = 100;
      $('#sidebar').classList.remove('mobile-open'); render(); return;
    }
    if (button?.dataset.collection) { state.filters = emptyFilters(); state.collection = button.dataset.collection; state.selected = ''; state.query = ''; state.tag = ''; state.year = ''; $('#search').value = ''; $('#sidebar').classList.remove('mobile-open'); render(); return; }
    if (button?.dataset.view) { state.view = button.dataset.view; render(); return; }
    if (button?.dataset.tag) { state.tag = state.tag === button.dataset.tag ? '' : button.dataset.tag; state.selected = ''; state.listLimit = 100; render(); return; }
    if (button?.dataset.journal) { state.filters.journal = button.dataset.journal; openAdvancedFilters(); render(); return; }
    if (button?.dataset.author) { state.filters.author = button.dataset.author; openAdvancedFilters(); render(); return; }
    if (button?.dataset.institution) { state.filters.institution = button.dataset.institution; openAdvancedFilters(); render(); return; }
    if (button?.dataset.removeExcludedTag) { state.filters.excludeTags = state.filters.excludeTags.filter(tag => tag !== button.dataset.removeExcludedTag); render(); return; }
    if (button?.dataset.removeFilterTag) { state.filters.tags = state.filters.tags.filter(t => t !== button.dataset.removeFilterTag); render(); return; }
    if (button?.dataset.related) { resetFilters(false); state.nav = 'all'; state.selected = button.dataset.related; render(); return; }
        if (button?.dataset.color) { $('#collection-form [name="color"]').value = button.dataset.color; document.querySelectorAll('.color-choice').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); }); return; }
    const row = event.target.closest('[data-select]'); if (row) { selectPaper(row.dataset.select, true); return; }
    if (matchMedia('(max-width: 650px)').matches && !event.target.closest('#sidebar')) $('#sidebar').classList.remove('mobile-open');
    if ($('#detail-panel').classList.contains('mobile-open') && !event.target.closest('#detail-panel')) $('#detail-panel').classList.remove('mobile-open');
  } catch (error) { toast(`操作未完成：${error.message || '请重试。'}`, true); if (button) button.disabled = false; }
});

document.addEventListener('submit', async event => {
  if (!['edit-form', 'collection-form', 'data-import-form'].includes(event.target.id)) return;
  event.preventDefault();
  try { if (event.target.id === 'edit-form') await submitEdit(event.target); else if (event.target.id === 'data-import-form') await previewDataImport(); else await submitCollection(event.target); }
  catch (error) { toast(`保存失败：${error.message || '请重试。'}`, true); }
});

$('#search').addEventListener('input', event => { state.query = event.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.listLimit = 100; render(); }, 140); });
$('#search-scope').addEventListener('change', event => { state.searchScope = event.target.value; state.listLimit = 100; render(); });
$('#year-filter').addEventListener('change', event => { state.year = event.target.value; state.listLimit = 100; render(); });
$('#sort-order').addEventListener('change', event => { state.sort = event.target.value; render(); });
$('#pdf-input').addEventListener('change', async event => { try { await addFiles([...event.target.files]); } catch (error) { toast(error.message, true); } event.target.value = ''; });
$('#backup-input').addEventListener('change', async event => { try { await restoreFile(event.target.files[0]); } catch (error) { toast(error.message, true); } event.target.value = ''; });
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) { const bounds = $('#modal').getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeModal(); } });
$('#modal').addEventListener('close', () => { comparison?.dispose(); modalContext = ''; state.pendingFiles = []; pendingRemovalIds = []; });
$('#modal').addEventListener('cancel', event => { if (batch?.isBusy() || bulkEditor?.isBusy() || removalBusy) { event.preventDefault(); toast('正在保存更改，请稍候。'); } });

let dragDepth = 0;
document.addEventListener('dragenter', event => { if (![...event.dataTransfer.types].includes('Files')) return; event.preventDefault(); dragDepth++; if (!$('#modal').open) $('#drop-overlay').hidden = false; else if (modalContext === 'import') $('.upload-zone')?.classList.add('dragging'); });
document.addEventListener('dragover', event => { if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('dragleave', event => { if (!event.dataTransfer || ![...event.dataTransfer.types].includes('Files')) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) { $('#drop-overlay').hidden = true; $('.upload-zone')?.classList.remove('dragging'); } });
document.addEventListener('drop', async event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; $('.upload-zone')?.classList.remove('dragging'); if ($('#modal').open && modalContext !== 'import') { toast('请先关闭当前弹窗，再拖入 PDF。'); return; } try { await addFiles([...event.dataTransfer.files]); } catch (error) { toast(error.message, true); } });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { $('#detail-panel').classList.remove('mobile-open'); $('#sidebar').classList.remove('mobile-open'); return; }
  if (event.target.matches('input,textarea,select') || event.target.isContentEditable || event.metaKey || event.ctrlKey || event.altKey || $('#modal').open) return;
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-select]')) { event.preventDefault(); selectPaper(event.target.dataset.select, true); return; }
  if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  if (event.key.toLowerCase() === 'n') { event.preventDefault(); importModal(); }
  if (event.key.toLowerCase() === 'v') { state.view = state.view === 'graph' ? 'list' : 'graph'; render(); }
  if (event.key === '0') map.fit();
  if (event.key === '?') { event.preventDefault(); shortcutsModal(); }
});
window.addEventListener('pagehide', () => { for (const url of activeObjectURLs) URL.revokeObjectURL(url); });

function renderFilterOptions() {
  const all = papers(), select = (id, items, initial, current) => {
    $(id).innerHTML = `<option value="">${initial}</option>` + [...new Set(items.filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b))).map(value => `<option value="${escape(value)}">${escape(value)}</option>`).join('');
    $(id).value = current || '';
  };
  select('#tag-filter-add', [...eligibleTags(all)].filter(t => !state.filters.tags.includes(t)), '全部有效标签（至少 3 篇）', '');
  select('#graph-tag-hide', [...eligibleTags(all)].filter(tag => !state.hiddenTagNodes.has(tag)), '选择要隐藏的标签节点…', '');
  select('#excluded-tag-add', [...eligibleTags(all)].filter(tag => !state.filters.excludeTags.includes(tag)), '隐藏包含此标签的文献…', '');
  $('#excluded-filter-tags').innerHTML = state.filters.excludeTags.map(tag => `<button class="tag excluded-tag" data-remove-excluded-tag="${escape(tag)}">排除 ${escape(tag)} ×</button>`).join('');
  select('#journal-filter', all.map(p => p.journal), '全部期刊', state.filters.journal);
  select('#impact-year-filter', [...state.journalMetrics.map(m => m.year), ...all.map(p => p.impactYear)], '各刊最新 / 文献指定', state.filters.impactYear);
  $('#folder-filter').innerHTML = '<option value="">全部收藏夹</option>' + collections().map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
  $('#folder-filter').value = state.collection;
  $('#selected-filter-tags').innerHTML = state.filters.tags.map(t => `<button class="tag" data-remove-filter-tag="${escape(t)}">${escape(t)} ×</button>`).join('');
  document.querySelectorAll('[data-filter]').forEach(input => { if (input.type === 'checkbox') input.checked = Boolean(state.filters[input.dataset.filter]); else if (input.value !== String(state.filters[input.dataset.filter] ?? '')) input.value = state.filters[input.dataset.filter] ?? ''; });
  $('#show-edges').checked = state.showEdges; $('#show-labels').checked = state.showLabels;
  $('#filter-panel').classList.toggle('has-conflict', Boolean(state.filters.minIF !== '' && state.filters.maxIF !== '' && Number(state.filters.minIF) > Number(state.filters.maxIF)) || Boolean(state.filters.yearFrom && state.filters.yearTo && Number(state.filters.yearFrom) > Number(state.filters.yearTo)));
}
document.querySelectorAll('[data-filter]').forEach(input => input.addEventListener(input.tagName === 'INPUT' && input.type !== 'checkbox' ? 'input' : 'change', event => {
  state.filters[input.dataset.filter] = input.type === 'checkbox' ? input.checked : input.value;
  state.listLimit = 100;
  if (event.type === 'input') { clearTimeout(searchTimer); searchTimer = setTimeout(render, 160); } else render();
}));
$('#graph-tag-hide').addEventListener('change',event=>{if(event.target.value)state.hiddenTagNodes.add(event.target.value);render();});
$('#excluded-tag-add').addEventListener('change',event=>{if(event.target.value)state.filters.excludeTags.push(event.target.value);render();});
$('#tag-filter-add').addEventListener('change', event => { if (event.target.value) state.filters.tags.push(event.target.value); render(); });
$('#folder-filter').addEventListener('change', event => { state.collection = event.target.value; render(); });
$('#show-edges').addEventListener('change', event => { state.showEdges = event.target.checked; render(); });
$('#show-labels').addEventListener('change', event => { state.showLabels = event.target.checked; render(); });

let dataImportKind = 'metadata';
function dataImportModal(kind) {
  if (!ensureStorage()) return;
  if (kind === 'metadata') { batch.open(); return; }
  dataImportKind = kind;
  showModal(kind === 'metrics' ? '导入期刊影响因子' : '导入文献元数据', kind === 'metrics' ? 'CSV / JSON · 按期刊名称与指标年份匹配' : '粘贴其他 AI 整理的 JSON，匹配已有 PDF。', `<form id="data-import-form"><div class="data-import-actions"><button type="button" class="outline-button" data-action="data-file">选择 ${kind === 'metrics' ? 'CSV / JSON' : 'JSON'} 文件</button><button type="button" class="text-button" data-action="${kind === 'metrics' ? 'metrics-template' : 'metadata-template'}">下载格式模板</button></div><label class="form-field">${kind === 'metrics' ? '期刊指标数据' : '文献元数据 JSON'}<textarea id="data-import-text" spellcheck="false" placeholder="${kind === 'metrics' ? 'journal,impactFactor,year,source' : '粘贴 JSON 数组，或包含 papers 数组的对象'}" required></textarea></label><div class="info-box">${kind === 'metrics' ? '必填：journal（期刊）、impactFactor（数值）、year（指标年份）。可填 source（来源）。同名期刊、同年份的指标将更新，其他年份保留；默认使用各刊最新导入年份。' : '通过 id、filename、doi、title 依次匹配；存在重名歧义时跳过。authors 支持 [{name, affiliations: [...]}]，可完整保存全部作者及机构。未提供的字段保留原值。'}</div><div class="modal-footer"><button type="button" class="text-button" data-action="close-modal">取消</button><button class="primary" type="submit">预览导入</button></div></form>`, 'data-import');
}
$('#data-input').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = ''; if (!file) return;
  if (file.size > 30 * 1024 * 1024) { toast('元数据文件超过 30 MB，请拆分后导入。', true); return; }
  try { const text = await file.text(); if ($('#data-import-text')) $('#data-import-text').value = text; } catch (error) { toast(error.message, true); }
});
async function previewDataImport() {
  const kind = dataImportKind, text = $('#data-import-text').value;
  const incoming = kind === 'metrics' ? parseMetrics(text) : matchMetadata(text, state.papers);
  if (kind === 'metadata' && !incoming.updates.length) { toast('没有唯一匹配的文献。请核对 PDF 文件名或文献标题。', true); return; }
  const message = kind === 'metrics' ? `${incoming.length} 条期刊年度指标将导入。` : `${incoming.updates.length} 篇文献将更新；${incoming.unmatched.length} 条未匹配或存在歧义，将跳过。`;
  showModal('确认导入这些信息', message, `<div class="import-preview-list">${kind === 'metrics' ? incoming.slice(0, 12).map(m => `<p><strong>${escape(m.journal)}</strong><span>IF ${m.impactFactor} · ${escape(m.year)}</span></p>`).join('') : incoming.updates.slice(0, 12).map(p => `<p><strong>${escape(p.title)}</strong><span>${p.authorDetails?.length || 0} 位作者 · ${p.tags.length} 个标签</span></p>`).join('')}${kind === 'metadata' && incoming.unmatched.length ? `<small>未匹配：${escape(incoming.unmatched.slice(0, 8).join('；'))}</small>` : ''}</div><div class="modal-footer"><button class="text-button" data-action="close-modal">取消</button><button class="primary" id="confirm-data-import">确认导入</button></div>`, 'data-confirm');
  $('#confirm-data-import').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try {
      if (kind === 'metrics') { const merged = mergeMetrics(state.journalMetrics, incoming); await setSetting('journalMetrics', merged); state.journalMetrics = merged; }
      else { await putPapers(incoming.updates); state.papers = await getPapers(); state.notes = await getSetting('notes') || {}; }
      state.mode = 'own'; await setSetting('mode', 'own'); resetFilters(false); closeModal(); render(); toast(message);
    } catch (error) { button.disabled = false; toast(`导入失败：${error.message}`, true); }
  });
}
async function downloadTemplate(kind) {
  if (kind === 'metadata') { await saveText(markdownTemplate(state.papers.length ? state.papers.map(p=>p.filename) : undefined), 'materia-metadata-template.md', 'md'); return; }
  const title = state.papers[0]?.title || '请替换为实际论文标题';
  const content = kind === 'metrics' ? '\uFEFFjournal,impactFactor,year,source\r\n期刊完整名称,0.0,2025,请填写指标来源\r\n' : JSON.stringify({ papers: [{ filename: state.papers[0]?.filename || 'your-paper.pdf', title, authors: [{ name: '作者一', affiliations: ['机构一', '机构二'] }, { name: '作者二', affiliations: ['机构二'] }], journal: '期刊完整名称', year: '2025', tags: ['材料体系', '工艺'], doi: '', impactFactor: null, impactYear: '' }] }, null, 2);
  const filename = kind === 'metrics' ? 'materia-journal-metrics-template.csv' : 'materia-metadata-template.json';
  if (native) { await native.saveText({ filename, content, type: kind === 'metrics' ? 'csv' : 'json' }); return; }
  const url = URL.createObjectURL(new Blob([content], { type: kind === 'metrics' ? 'text/csv;charset=utf-8' : 'application/json' })); triggerDownload(url, filename); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function saveText(content,filename,type) {
  if (native) return native.saveText({content,filename,type});
  const url=URL.createObjectURL(new Blob([content],{type:type==='svg'?'image/svg+xml;charset=utf-8':type==='md'?'text/markdown;charset=utf-8':'text/plain;charset=utf-8'}));triggerDownload(url,filename);setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function reloadLibrary() {
  state.papers=await getPapers();state.notes=await getSetting('notes') || {};state.collections=await getSetting('collections') || [];state.journalMetrics=await getSetting('journalMetrics') || [];
  state.compareIds=new Set((await getSetting('comparisonSelection') || []).filter(id=>state.papers.some(p=>p.id===id)));
  lastRemoval = await getSetting('lastRemoval') || null;
}
associationController=createAssociationController({escape,showModal,toast,getPapers:papers,getVisible:visiblePapers,getRules:()=>state.associations,save:async rules=>{const clean=cleanAssociations(rules);await setSetting('graphAssociations',clean);state.associations=clean;},changed:render});
parameterFinder=createParameterFinder({escape,showModal,toast,getPapers:papers,apply:applyParameterFilter});
comparison=createComparison({escape,showModal,toast,getPapers:papers,getFiltered:visiblePapers,getMetrics:()=>state.journalMetrics,findParameter:applyParameterFilter,openParameterFinder:()=>parameterFinder.open(),plotActiveParameter,savePreferences:value=>setSetting('chartPreferences',value),getSelection:()=>state.compareIds,setSelection:async ids=>{const previous=state.compareIds;state.compareIds=ids;const refresh=()=>{comparison.refreshBar();renderDetail();hydrateIcons($('#detail-panel'));renderParameterSummary(visiblePapers());};refresh();try{await setSetting('comparisonSelection',[...ids]);}catch(error){if(state.compareIds===ids)state.compareIds=previous;refresh();throw error;}},pickList:()=>{closeModal();state.view='list';render();},saveText,saveDataURL:async(url,filename,type)=>{
  const comma=url.indexOf(','),head=url.slice(0,comma),body=url.slice(comma+1);
  if(type==='svg')return saveText(head.includes(';base64')?new TextDecoder().decode(Uint8Array.from(atob(body),c=>c.charCodeAt(0))):decodeURIComponent(body),filename,'svg');
  if(native){const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));return native.saveImage({filename,bytes,type});}
  const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0)),blobUrl=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));triggerDownload(blobUrl,filename);setTimeout(()=>URL.revokeObjectURL(blobUrl),30000);
}});
batch=createBatchImporter({escape,showModal,toast,bytesLabel,normalizeTags,folderOptions,getPapers:papers,isOpen:()=>modalContext==='import',putPapers,saveText,persistNotes:async incoming=>{const next=mergeImportNotes(await getSetting('notes') || {},incoming);await setSetting('notes',next);},reload:reloadLibrary,onDone:id=>{closeModal();state.nav='all';state.mode='own';state.selected=id || '';resetFilters(false);map.fit();render();}});
bulkEditor=createBulkEditor({escape,showModal,toast,normalizeTags,getPapers:papers,getCollections:collections,getSelection:()=>state.compareIds,save:bulkEdit,reload:reloadLibrary,done:()=>{closeModal();render();}});
performanceEditor=createPerformanceEditor({escape,showModal,toast,getPapers:papers,close:closeModal,save:async(id,measurements)=>{const p=state.papers.find(p=>p.id===id);if(!p)throw new Error('找不到文献');await putPaper({...p,measurements});await reloadLibrary();render();}});

async function init() {
  hydrateIcons();
  try {
    state.papers = await getPapers();
    state.collections = await getSetting('collections') || [];
    state.notes = await getSetting('notes') || {};
    state.journalMetrics = await getSetting('journalMetrics') || [];
    state.graphPreferences=cleanGraphSettings(await getSetting('graphPreferences')||{});state.associations=cleanAssociations(await getSetting('graphAssociations')||[]);
    const seededMetrics = seedJournalMetrics(state.journalMetrics);
    if (JSON.stringify(seededMetrics) !== JSON.stringify(state.journalMetrics)) { await setSetting('journalMetrics', seededMetrics); state.journalMetrics = seededMetrics; }
    map.setLayout(await getSetting('graphLayout') || {});
    if (native) state.desktopInfo = await native.info();
    if (location.protocol === 'file:' && !native) throw new Error('桌面文件存储接口没有正常加载。');
    let migrated = false;
    for (const p of state.papers) if (p.notes && !state.notes[`paper:${p.id}`]) { state.notes[`paper:${p.id}`] = [{ id: `legacy-${p.id}`, body: p.notes, createdAt: p.addedAt, updatedAt: p.addedAt }]; migrated = true; }
    if (migrated) await setSetting('notes', state.notes);
    state.mode = 'own';
    const oldExamples = state.papers.filter(isOldExample);
    for (const p of oldExamples) await deletePaper(p.id);
    if (oldExamples.length) { state.papers = state.papers.filter(p=>!isOldExample(p)); state.notes = removeOldExampleNotes(state.notes, new Set(oldExamples.map(p=>p.id))); await setSetting('notes',state.notes); }
    state.compareIds = new Set((await getSetting('comparisonSelection') || []).filter(id=>state.papers.some(p=>p.id===id)));
    lastRemoval = await getSetting('lastRemoval') || null;
    await setSetting('mode','own');
    comparison.loadPreferences(await getSetting('chartPreferences') || {});
    state.ready = true;
  } catch (error) {
    state.storageError = true;
    const banner = document.createElement('div'); banner.className = 'storage-error'; banner.textContent = `文献库无法读取，原数据已保留：${error.message}`; $('main').prepend(banner);
  }
  render();
  $('.import-main').disabled = !state.ready || state.storageError;
}
init();
