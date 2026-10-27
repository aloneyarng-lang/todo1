import { parameterNameKey, parameterUnitKey } from './parameter-index.js';
export { chartDataset } from './chart-data.js';
export const parameterKey = (name, unit) => `${parameterNameKey(name)}\u241f${parameterUnitKey(unit)}`;
export function strictNumber(value, label = '数值') {
  const text = String(value ?? '').trim().replace(/^−/, '-');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) throw new Error(`${label}必须是独立数字，支持科学计数法；请将单位、范围或 ± 误差放入对应列。`);
  return Number(text);
}
export function normalizeMeasurements(input = []) {
  if (!Array.isArray(input) || input.length > 10000) throw new Error('性能参数需要是记录数组，每篇最多 10000 条。');
  const ids = new Set();
  return input.map((item, index) => {
    const name = String(item.name ?? item.parameter ?? '').trim(), unit = String(item.unit ?? '').trim();
    if (!name || name.length > 200) throw new Error(`第 ${index + 1} 条性能参数需要参数名称（最多 200 字）。`);
    const value = strictNumber(item.value, `「${name}」的数值`);
    let qualifier = String(item.qualifier || '').trim().replace('>=', '≥').replace('<=', '≤').replace('~', '≈');
    if (!['', '≈', '>', '<', '≥', '≤', '='].includes(qualifier)) throw new Error(`「${name}」的限定符只能是 ≈、>、<、≥、≤ 或空白。`);
    const uncertainty = item.uncertainty === '' || item.uncertainty === null || item.uncertainty === undefined ? null : strictNumber(item.uncertainty, `「${name}」的误差`);
    if (uncertainty !== null && uncertainty < 0) throw new Error('误差不能为负数。');
    const id = String(item.id || `m-${index + 1}`).slice(0, 120);
    if (ids.has(id)) throw new Error('同一篇文献中的性能记录 ID 不能重复。'); ids.add(id);
    return { id, name, value, unit: unit.slice(0, 120), sample: String(item.sample || '').trim().slice(0, 300), conditions: String(item.conditions || '').trim().slice(0, 3000), source: String(item.source || '').trim().slice(0, 2000), qualifier, uncertainty };
  });
}
export function parameterOptions(papers) {
  const map = new Map();
  for (const p of papers) for (const m of p.measurements || []) {
    const key = parameterKey(m.name, m.unit);
    if (!map.has(key)) map.set(key, { key, name: m.name, unit: m.unit || '', count: 0, paperIds: new Set() });
    map.get(key).count++;
    map.get(key).paperIds.add(p.id);
  }
  return [...map.values()].map(({paperIds,...item})=>({...item,paperCount:paperIds.size})).sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}
export function axisLabel(axis, options) {
  if (axis === 'year') return '发表年份'; if (axis === 'impactFactor') return '期刊影响因子 IF';
  const item = options.find(p => 'm:' + p.key === axis);
  return item ? `${item.name}${item.unit ? ` (${item.unit})` : '（单位未填）'}` : '请选择参数';
}
export function measurementsCSV(papers) {
  const quote = (value, numeric = false) => {
    let text = String(value ?? ''); if (!numeric && /^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [['文献标题','发表年份','样品','参数名称','数值','单位','测试条件','来源','限定符','误差']];
  for (const p of papers) for (const m of p.measurements || []) rows.push([p.title, p.year, m.sample, m.name, m.value, m.unit, m.conditions, m.source, m.qualifier, m.uncertainty]);
  return '\uFEFF' + rows.map((r, i) => r.map((v, col) => quote(v, i > 0 && [1,4,9].includes(col))).join(',')).join('\r\n');
}
