import { normalizeMeasurements } from './parameters.js';

const fieldNames = { '文件名':'filename', filename:'filename', file:'filename', '文献id':'id', id:'id', '标题':'title', title:'title', '期刊':'journal', journal:'journal', '发表年份':'year', year:'year', doi:'doi', '标签':'tags', tags:'tags', '影响因子':'impactFactor', impactfactor:'impactFactor', '指标年份':'impactYear', impactyear:'impactYear' };
const headerKey = v => v.replace(/[`*]/g, '').trim().toLocaleLowerCase().replace(/[ _-]/g, '');
function cells(line) {
  let text = line.trim(); if (text.startsWith('|')) text = text.slice(1); if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells = []; let value = '';
  for (let i = 0; i < text.length; i++) { if (text[i] === '\\' && text[i + 1] === '|') { value += '|'; i++; } else if (text[i] === '|') { cells.push(value.trim()); value = ''; } else value += text[i]; }
  cells.push(value.trim()); return cells;
}
function tables(lines) {
  const rows = lines.filter(l => l.trim().startsWith('|')).map(cells);
  if (!rows.length) return [];
  const headers = rows.shift().map(headerKey);
  return rows.filter(row => !row.every(cell => /^:?-{2,}:?$/.test(cell.replace(/\s/g,'')))).map(row => Object.fromEntries(headers.map((h,i)=>[h,row[i] || ''])));
}
export function parseMarkdown(text) {
  if (typeof text !== 'string' || text.length > 30 * 1024 * 1024) throw new Error('Markdown 文件过大或格式不正确。');
  const lines = text.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  const version=text.match(/格式版本\s*[:：]\s*(\d+)/);if(version&&version[1]!=='1')throw new Error('暂不支持该 Markdown 格式版本，请使用版本 1 模板。');
  const starts = lines.map((line, i) => /^##\s+(?:文献|paper)(?:\s|[:：]|$)/i.test(line) ? i : -1).filter(i=>i>=0);
  if (!starts.length) throw new Error('未找到「## 文献」区块，请使用下载的 Markdown 规范模板。');
  const papers = [];
  for (let bi = 0; bi < starts.length; bi++) {
    const block = lines.slice(starts[bi] + 1, starts[bi+1] ?? lines.length), paper = {}, sections = new Map();
    let section = 'fields', current = [];
    const flush = () => { if (!sections.has(section)) sections.set(section, []); sections.get(section).push(...current); current = []; };
    for (const line of block) { const match = line.match(/^###\s+(.+?)\s*$/); if (match) { flush(); section = match[1].trim(); } else current.push(line); } flush();
    for (const line of sections.get('fields') || []) {
      const match = line.match(/^\s*[-*]\s+([^:：]+)[:：]\s*(.*?)\s*$/); if (!match) continue;
      const field = fieldNames[headerKey(match[1])]; if (!field) continue;
      let value = match[2].replace(/^`(.*)`$/, '$1').trim();
      if (field === 'tags') { if(value)paper.tags = [...new Set(value.split(/[,，;；]/).map(v=>v.trim()).filter(Boolean))]; }
      else if (field === 'impactFactor') { if (value) paper.impactFactor = value; }
      else if (value) paper[field] = value;
    }
    if (!paper.filename && !paper.id && !paper.doi && !paper.title) throw new Error(`第 ${bi+1} 个文献区块缺少文件名或标题等匹配信息。`);
    for (const [name, lines] of sections) {
      if (/^(作者与机构|作者|authors)$/i.test(name)) {
        const authors=tables(lines).filter(r=>r.作者||r.name||r.author).map(r=>({ name:r.作者||r.name||r.author, affiliations:(r.机构||r.affiliations||r.institutions||'').split(/[;；]/).map(v=>v.trim()).filter(Boolean) }));
        if(authors.length)paper.authors=authors;
      } else if (/^(性能参数|性能数据|measurements|parameters)$/i.test(name)) {
        const rows = tables(lines);
        if (rows.some(r=>!('参数名称' in r || 'name' in r || 'parameter' in r) || !('数值' in r || 'value' in r))) throw new Error(`第 ${bi+1} 篇文献的性能表必须分开包含「参数名称」与「数值」列。`);
        if(rows.length)paper.measurements = normalizeMeasurements(rows.map(r=>({ id:r.记录id||r.id, sample:r.样品||r.sample, name:r.参数名称||r.name||r.parameter, value:r.数值??r.value, unit:r.单位||r.unit, conditions:r.测试条件||r.conditions, source:r.来源||r.source, qualifier:r.限定符||r.qualifier, uncertainty:r.误差??r.uncertainty })));
      } else if (/^(文献笔记|notes)$/i.test(name)) {
        paper.paperNotes = noteBlocks(lines, false);
      } else if (/^(标签笔记|tagnotes)$/i.test(name)) {
        paper.tagNotes = noteBlocks(lines, true);
      }
    }
    papers.push(paper);
  }
  return papers;
}
function noteBlocks(lines, tagged) {
  const result = []; let name = '', body = [];
  const flush = () => { const text = body.join('\n').trim(); if (text) { if (tagged && !name) throw new Error('标签笔记需要用「#### #标签名称」标记归属。'); result.push(tagged ? { tag:name.replace(/^#/, '').trim(), body:text } : { body:text }); } body=[]; };
  for (const line of lines) { const m = line.match(/^####\s+(.+)$/); if (m) { flush(); name=m[1].trim(); } else body.push(line); } flush();
  return result;
}
export function markdownTemplate(filenames = ['请替换为实际文件名.pdf']) {
  return '# Materia 文献批量元数据\n\n格式版本: 1\n\n每个「## 文献」区块对应一个 PDF。表格内容请替换为原文数据。性能表只接受独立数值，单位与测试条件分列填写。\n\n' + filenames.map((filename, i)=>`## 文献 ${i+1}\n\n- 文件名: ${filename}\n- 标题: \n- 发表年份: \n- 期刊: \n- DOI: \n- 标签: \n- 影响因子: \n- 指标年份: \n\n### 作者与机构\n\n| 作者 | 机构 |\n| --- | --- |\n\n### 性能参数\n\n| 样品 | 参数名称 | 数值 | 单位 | 测试条件 | 来源 | 限定符 | 误差 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n\n### 文献笔记\n\n#### 笔记 1\n\n### 标签笔记\n\n`).join('\n');
}
