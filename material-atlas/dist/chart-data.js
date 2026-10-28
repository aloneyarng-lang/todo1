import { paperMeasurements } from './materials.js';
import { impactOf } from './catalog.js';
import { parameterKey, strictNumber } from './parameters.js';
import { parameterNameKey } from './parameter-index.js';

export const PLOT_REASONS = {
  parameter: '未录入所选参数', unit: '同名参数使用其他单位', condition: '测试条件不匹配', sample: '样品筛选不匹配',
  missing: '缺少年份、IF 或配对参数', invalid: '坐标数值无效', ambiguous: '同样品配对参数存在多值歧义',
  qualified: '约数或界限值未开启', nonpositive: '对数坐标要求数值大于 0', range: '超出自定义坐标范围',
};
const number = value => { try { return strictNumber(value); } catch { return null; } };
const errorOf = measurement => { const value = measurement?.uncertainty; return value === '' || value == null ? null : number(value); };

export function chartDataset(papers, config, metrics = []) {
  const points = [], paperStatus = [], skipped = { missing: 0, ambiguous: 0, qualified: 0, invalid: 0, condition: 0, sample: 0, nonpositive: 0, range: 0 };
  const xMetric = config.type !== 'bar' && config.x?.startsWith('m:') ? config.x.slice(2) : '', yMetric = config.y?.startsWith('m:') ? config.y.slice(2) : '', anchorKey = yMetric || xMetric;
  const chosenName = anchorKey.split('\u241f')[0];
  for (const paper of papers) {
    const measurements = paperMeasurements(paper), sameName = anchorKey ? measurements.filter(m => parameterNameKey(m.name) === chosenName) : [];
    const initial = anchorKey ? measurements.filter(m => parameterKey(m.name,m.unit) === anchorKey) : [null];
    const status = { paperId: paper.id, title: paper.title, recordedRecords: anchorKey ? sameName.length : 1, matchingRecords: initial.length, plottedPoints: 0, reasons: {} };
    paperStatus.push(status);
    const reject = (reason, count = 1) => { status.reasons[reason] = (status.reasons[reason] || 0) + count; skipped[['parameter','unit'].includes(reason) ? 'missing' : reason]++; };
    if (!initial.length) { reject(sameName.length ? 'unit' : 'parameter'); continue; }
    let anchors = initial;
    if (config.condition != null && config.condition !== '*') anchors = anchors.filter(m => m && (m.conditions || '') === config.condition);
    if (!anchors.length) { reject('condition', initial.length); continue; }
    const beforeSample = anchors.length;
    if (config.sample) anchors = anchors.filter(m => [m?.materialName,m?.sample].filter(Boolean).join(' ').toLocaleLowerCase().includes(config.sample.toLocaleLowerCase()));
    if (!anchors.length) { reject('sample', beforeSample); continue; }
    if (anchors.length < initial.length) {
      if (beforeSample < initial.length) status.reasons.condition = initial.length - beforeSample;
      if (anchors.length < beforeSample) status.reasons.sample = beforeSample - anchors.length;
    }
    for (const anchor of anchors) {
      let ambiguous = false, hasQualifier = false, invalid = false;
      const axisValue = axis => {
        if (axis === 'year') return { value: /^\d{4}$/.test(String(paper.year)) ? Number(paper.year) : null };
        if (axis === 'impactFactor') return { value: impactOf(paper,metrics,config.impactYear)?.value ?? null };
        const key = String(axis || '').slice(2);
        let candidates = anchor && parameterKey(anchor.name,anchor.unit) === key ? [anchor] : measurements.filter(m => parameterKey(m.name,m.unit) === key && m.materialId === anchor?.materialId && (m.sample || '') === (anchor?.sample || ''));
        if (candidates.length > 1) { const exact = candidates.filter(m => (m.conditions || '') === (anchor?.conditions || '')); if (exact.length) candidates = exact; }
        if (!candidates.length) return { value: null };
        const numeric = candidates.map(m => number(m.value));
        if (numeric.some(value => value === null)) { invalid = true; return { value: null }; }
        const signatures = new Set(candidates.map((m,i)=>`${numeric[i]}|${errorOf(m)}|${m.qualifier || ''}`));
        if (signatures.size > 1) { ambiguous = true; return { value: null }; }
        const measurement = candidates[0];
        hasQualifier ||= Boolean(measurement.qualifier && measurement.qualifier !== '=');
        return { value: numeric[0], measurement, error: errorOf(measurement) };
      };
      const xAxis = config.type === 'bar' ? {value:paperStatus.length} : axisValue(config.x), yAxis = axisValue(config.y), x = xAxis.value, y = yAxis.value;
      if (ambiguous) { reject('ambiguous'); continue; }
      if (invalid) { reject('invalid'); continue; }
      if (hasQualifier && !config.includeQualified) { reject('qualified'); continue; }
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) { reject('missing'); continue; }
      if ((config.xScale === 'log' && x <= 0 && config.type !== 'bar') || (config.yScale === 'log' && y <= 0)) { reject('nonpositive'); continue; }
      const outside = (axis,value) => ['Min','Max'].some(bound => { const limit = config[axis+bound]; if (limit == null || limit === '') return false; const parsed = number(limit); return parsed !== null && (bound === 'Min' ? value < parsed : value > parsed); });
      if ((config.type !== 'bar' && outside('x',x)) || outside('y',y)) { reject('range'); continue; }
      const group = config.group === 'paper' ? paper.title : config.group === 'material' ? anchor?.materialName || '未命名材料' : config.group === 'journal' ? paper.journal || '期刊未填' : config.group === 'sample' ? anchor?.sample || '样品未命名' : config.group === 'condition' ? anchor?.conditions || '条件未填' : config.group === 'all' ? '全部选中数据' : paper.tags?.[0] || '未分类';
      points.push({ x, y, group, groupKey: config.group === 'paper' ? `paper:${paper.id}` : config.group === 'material' ? `material:${paper.id}:${anchor?.materialId || ''}` : group, paperId: paper.id, title: paper.title, year: paper.year, materialId: anchor?.materialId || '', materialName: anchor?.materialName || '', materialComposition: anchor?.materialComposition || '', sample: anchor?.sample || '', conditions: anchor?.conditions || '', source: [xAxis.measurement?.source,yAxis.measurement?.source].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join('；'), qualifier: yAxis.measurement?.qualifier || '', xQualifier: xAxis.measurement?.qualifier || '', uncertainty: yAxis.error ?? null, xUncertainty: xAxis.error ?? null, yUncertainty: yAxis.error ?? null });
      status.plottedPoints++;
    }
  }
  const warnings = [];
  for (const [reason,label] of Object.entries(PLOT_REASONS)) {
    const affected = paperStatus.filter(status=>status.reasons[reason]);
    if (affected.length) warnings.push(`${affected.length} 篇文献：${label}（${affected.reduce((sum,status)=>sum+status.reasons[reason],0)} 条）`);
  }
  points.sort((a,b)=>a.x-b.x||a.title.localeCompare(b.title)||a.sample.localeCompare(b.sample));
  return { points, warnings, skipped, paperStatus, summary: { selectedPapers: papers.length, recordedPapers: paperStatus.filter(status=>status.recordedRecords>0).length, unitMatchedPapers: paperStatus.filter(status=>status.matchingRecords>0).length, plottedPapers: paperStatus.filter(status=>status.plottedPoints>0).length, excludedPapers: paperStatus.filter(status=>!status.plottedPoints).length, plottedPoints: points.length } };
}

export function figureDataCSV(data, xLabel, yLabel) {
  const quote = (value, numeric = false) => { let text=String(value ?? '');if(!numeric && /^[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'; };
  const rows = [['文献标题','文献ID','发表年份','材料ID','材料名称','成分 / 配方','样品',xLabel,yLabel,'X误差','Y误差','X限定符','Y限定符','测试条件','来源','分组']];
  for (const point of data.points) rows.push([point.title,point.paperId,point.year,point.materialId,point.materialName,point.materialComposition,point.sample,point.category ?? point.x,point.y,point.xUncertainty,point.yUncertainty,point.xQualifier,point.qualifier,point.conditions,point.source,point.group]);
  return '\uFEFF'+rows.map((row,index)=>row.map((value,column)=>quote(value,index>0&&[2,7,8,9,10].includes(column)&&typeof value==='number')).join(',')).join('\r\n');
}
