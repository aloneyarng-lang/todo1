import { normalizeNotes } from './note-model.js';
import { normalizeAuthors, numericImpact, parseMetrics, mergeMetrics } from './catalog.js';
import { normalizePaperMaterials, materializePaper } from './materials.js';
import { takeRemoval, restoreRemoval } from './removal.js';
import { planBulkEdit } from './bulk-edit.js';
export const DB_NAME = 'materia-library-v1';
export const BACKUP_FORMAT = 'materia-backup';
let connection;
const native = globalThis.materiaDesktop;
let richNoteSupport;
async function assertRichNoteSupport(value){const notes=Object.values(value||{}).filter(Array.isArray).flat();if(native&&notes.some(note=>note.anchor||note.attachments?.length)){richNoteSupport ||= native.info();const info=await richNoteSupport;if(Number(info.readerNotesVersion)<1||!info.readerNotesVersion)throw new Error('请关闭并重新打开 Materia，再保存带标记或图片的笔记；当前桌面存储接口仍是旧版。');if(notes.some(note=>note.anchor&&(note.anchor.kind||note.anchor.label!==undefined))&&!info.readerAnnotationsVersion)throw new Error('请重新启动 Materia 以启用文字和箭头标注；当前标注仍保留在编辑区。');}}
async function nativePapers(papers) {
  papers = papers.map(normalizePaperMaterials);
  if (papers.length && !(Number((await native.info()).materialsVersion) >= 1)) throw new Error('请关闭并重新打开 Materia，以启用按材料保存性能参数；当前编辑内容仍保留。');
  const output = [];
  for (const paper of papers) {
    const { file, ...metadata } = paper;
    output.push({ ...metadata, ...(file && !file.desktop ? { fileBytes: await file.arrayBuffer() } : {}) });
  }
  return output;
}

export async function openDatabase() {
  if (connection) return connection;
  connection = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('papers', { keyPath: 'id' });
      request.result.createObjectStore('settings', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他 Materia 页面后重试。'));
  });
  connection.onversionchange = () => { connection.close(); connection = null; };
  return connection;
}

async function transaction(store, mode, run) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result;
    try { result = run(tx.objectStore(store)); } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存已取消。'));
  });
}

export const getPapers = async () => (await (native ? native.getPapers() : transaction('papers', 'readonly', store => store.getAll()))).map(materializePaper);
export const putPaper = async paper => native ? native.putPapers(await nativePapers([paper])) : transaction('papers', 'readwrite', store => store.put(normalizePaperMaterials(paper)));
export const putPapers = async papers => { const clean = papers.map(normalizePaperMaterials); return native ? native.putPapers(await nativePapers(clean)) : transaction('papers', 'readwrite', store => { for (const paper of clean) store.put(paper); }); };
export const deletePaper = id => native ? native.deletePaper(id) : transaction('papers', 'readwrite', store => store.delete(id));
export const getSetting = async key => native ? native.getSetting(key) : (await transaction('settings', 'readonly', store => store.get(key)))?.value;
export const setSetting = async (key, value) => { if(key==='notes'){value=normalizeNotes(value);await assertRichNoteSupport(value);}if(key==='readerDrafts')await assertRichNoteSupport({drafts:(value||[]).map(row=>row.note)});return native ? native.setSetting(key, value) : transaction('settings', 'readwrite', store => store.put({ key, value })); };

async function removalTransaction(batchId, run) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['papers', 'settings'], 'readwrite');
    const papers = tx.objectStore('papers'), settings = tx.objectStore('settings');
    const keys = ['notes', 'comparisonSelection', 'lastRemoval', 'collections'];
    const requests = [papers.getAll(), ...keys.map(key => settings.get(key)), ...(batchId ? [settings.get(`trash:${batchId}`)] : [])];
    let remaining = requests.length, result;
    for (const request of requests) request.onsuccess = () => {
      if (--remaining) return;
      try {
        const data = { papers: requests[0].result, settings: Object.fromEntries(keys.map((key, index) => [key, requests[index + 1].result?.value])) };
        result = run({ papers, settings }, data, batchId ? requests.at(-1).result?.value : null);
        for (const key of keys) settings.put({ key, value: data.settings[key] });
      } catch (error) { tx.abort(); reject(error); }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('移除操作已取消，原文献已保留。'));
  });
}

export const deletePapers = ids => {
  if (native) return native.deletePapers(ids);
  return removalTransaction('', ({ papers, settings }, data) => {
    const batch = takeRemoval(data, ids, `batch-${crypto.randomUUID()}`);
    if (!batch.papers.length) return { count: 0 };
    settings.put({ key: `trash:${batch.id}`, value: batch });
    for (const paper of batch.papers) papers.delete(paper.id);
    return data.settings.lastRemoval;
  });
};
export const restorePapers = id => {
  if (native) return native.restorePapers(id);
  return removalTransaction(id, ({ papers }, data, batch) => {
    if (batch?.id !== id) throw new Error('找不到这次移除的恢复记录。');
    const restored = restoreRemoval(data, batch);
    for (const paper of restored) papers.put(paper);
    return { count: restored.length };
  });
};
export const bulkEdit = (ids, options) => {
  if (native) return native.bulkEdit(ids, options);
  return removalTransaction('', ({ papers }, data) => {
    const plan = planBulkEdit(data.papers, data.settings.collections || [], ids, options, `folder-${crypto.randomUUID()}`);
    for (const paper of plan.updates) papers.put(paper);
    if (plan.collection) data.settings.collections = [...(data.settings.collections || []), plan.collection];
    return { count: plan.updates.length };
  });
};

export function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : String(value || '').split(/[,，;；\n]+/);
  return [...new Set(tags.filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0, 80)).filter(Boolean))].slice(0, 30);
}

export function bytesLabel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function createBackup(papers, collections, notes = {}, journalMetrics = []) {
  const records = [];
  for (const paper of papers) {
    const { file, ...metadata } = normalizePaperMaterials(paper);
    const blob = file?.desktop ? new Blob([await native.readPdf(paper.id)], { type: 'application/pdf' }) : file;
    records.push({ ...metadata, fileBase64: blob ? await blobToBase64(blob) : null });
  }
  return { format: BACKUP_FORMAT, version: 2, exportedAt: new Date().toISOString(), collections, papers: records, notes, journalMetrics };
}

export function readBackup(value) {
  if (!value || value.format !== BACKUP_FORMAT || ![1,2].includes(value.version) || !Array.isArray(value.papers) || !Array.isArray(value.collections)) throw new Error('这不是受支持的 Materia 完整备份。');
  if (value.papers.length > 10000 || value.collections.length > 500) throw new Error('备份中的记录过多，无法导入。');
  const collectionIds = new Set();
  const collections = value.collections.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim() || collectionIds.has(item.id)) throw new Error('备份的收藏夹格式不正确。');
    collectionIds.add(item.id);
    return { id: item.id.slice(0, 120), name: item.name.slice(0, 80), color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : '#527e78' };
  });
  const ids = new Set();
  const papers = value.papers.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || typeof item.title !== 'string' || !item.title.trim() || ids.has(item.id)) throw new Error('备份的文献格式不正确。');
    ids.add(item.id);
    let file = null;
    if (item.fileBase64) {
      if (typeof item.fileBase64 !== 'string') throw new Error('备份中的 PDF 数据不正确。');
      let binary;
      try { binary = atob(item.fileBase64); } catch { throw new Error('备份中的 PDF 数据已损坏。'); }
      if (!binary.slice(0, 1024).includes('%PDF-')) throw new Error('备份中存在无效的 PDF 文件。');
      file = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: 'application/pdf' });
    }
    return {
      id: item.id.slice(0, 120), title: item.title.slice(0, 1000),
      authors: typeof item.authors === 'string' ? item.authors.slice(0, 1000) : '',
      authorDetails: normalizeAuthors(item.authorDetails || []),
      materials: normalizePaperMaterials(item).materials,
      doi: String(item.doi || '').slice(0, 1000),
      impactFactor: numericImpact(item.impactFactor), impactYear: /^\d{4}$/.test(String(item.impactYear || '')) ? String(item.impactYear) : '',
      journal: typeof item.journal === 'string' ? item.journal.slice(0, 300) : '',
      year: /^\d{4}$/.test(String(item.year || '')) ? String(item.year) : '',
      tags: normalizeTags(item.tags), notes: typeof item.notes === 'string' ? item.notes.slice(0, 20000) : '',
      collection: collectionIds.has(item.collection) ? item.collection : '',
      favorite: Boolean(item.favorite), addedAt: Number.isFinite(item.addedAt) ? item.addedAt : Date.now(),
      filename: typeof item.filename === 'string' ? item.filename.slice(0, 1000) : '',
      fingerprint: typeof item.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(item.fingerprint) ? item.fingerprint : '',
      file, size: file?.size || 0,
    };
  });
  const notes = normalizeNotes(value.notes || {});
  const journalMetrics = Array.isArray(value.journalMetrics) && value.journalMetrics.length ? parseMetrics(JSON.stringify(value.journalMetrics)) : [];
  return { collections, papers, notes, journalMetrics };
}

export async function mergeBackup(backup) {
  await assertRichNoteSupport(backup.notes);
  if (native) return native.mergeBackup({ ...backup, papers: await nativePapers(backup.papers) });
  const db = await openDatabase();
  // A single transaction makes restored files and folders succeed or fail together.
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['papers', 'settings'], 'readwrite');
    const settings = tx.objectStore('settings');
    const request = settings.get('collections');
    request.onsuccess = () => {
      const merged = new Map((request.result?.value || []).map(item => [item.id, item]));
      for (const item of backup.collections) merged.set(item.id, item);
      settings.put({ key: 'collections', value: [...merged.values()] });
      settings.put({ key: 'mode', value: 'own' });
      for (const paper of backup.papers) tx.objectStore('papers').put(paper);
    };
    const noteRequest = settings.get('notes');
    noteRequest.onsuccess = () => {
      const current = noteRequest.result?.value || {};
      for (const [key, list] of Object.entries(backup.notes || {})) current[key] = [...new Map([...(current[key] || []), ...list].map(n => [n.id, n])).values()];
      settings.put({ key: 'notes', value: current });
    };
    const metricRequest = settings.get('journalMetrics');
    metricRequest.onsuccess = () => settings.put({ key: 'journalMetrics', value: mergeMetrics(metricRequest.result?.value || [], backup.journalMetrics || []) });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('备份恢复失败。'));
  });
}
