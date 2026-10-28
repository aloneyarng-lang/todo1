import {cleanStudy,cleanVocabulary,cleanTranslationCache,cleanTranslationPreferences,applyStudyOperation,mergeVocabulary,saveTranslationCache} from '../dist/study-model.js';
import { normalizeNotes, cleanReaderState, cleanReaderDrafts } from '../dist/note-model.js';
import { mkdir, readFile, writeFile, rename, copyFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { normalizeAuthors, numericImpact, mergeMetrics, parseMetrics } from '../dist/catalog.js';
import { renameTitleLinks } from '../dist/note-links.js';
import { normalizePaperMaterials, materializePaper } from '../dist/materials.js';
import { isOldExample, removeOldExampleNotes } from '../dist/example-migration.js';
import { takeRemoval, restoreRemoval } from '../dist/removal.js';
import { planBulkEdit } from '../dist/bulk-edit.js';
import { cleanLayout } from '../dist/force-layout.js';
import { cleanFigureSettings } from '../dist/figure.js';
import { cleanGraphSettings } from '../dist/graph-settings.js';
import { cleanAssociations } from '../dist/associations.js';
import { seedJournalMetrics } from '../dist/journal-data.js';
import { cleanThemePreferences } from '../dist/themes.js';

export function resolveInside(root, relative) {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('文件路径超出当前文献库。');
  return resolved;
}
export function cleanTags(value) {
  return [...new Set((Array.isArray(value) ? value : []).filter(t => typeof t === 'string').map(t => t.trim().slice(0, 80)).filter(Boolean))].slice(0, 30);
}
export const cleanNotes = normalizeNotes;

export class LocalLibrary {
  constructor(root) { this.root = path.resolve(root); this.queue = Promise.resolve(); }
  async init() {
    await mkdir(path.join(this.root, 'papers'), { recursive: true });
    await mkdir(path.join(this.root, 'backups'), { recursive: true });
    const file = path.join(this.root, 'library.json');
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8'));
      if (parsed.format !== 'materia-library' || ![1,2,3].includes(parsed.version) || !Array.isArray(parsed.papers)) throw new Error('文献库格式不受支持。');
      for (const paper of parsed.papers) if (paper.pdfPath) resolveInside(this.root, paper.pdfPath);
      this.data = parsed; this.data.settings ||= {};
      this.data.settings.mode = 'own';
      const examples = this.data.papers.filter(isOldExample);
      if (examples.length) {
        this.data.papers = this.data.papers.filter(p=>!isOldExample(p));
        this.data.settings.notes = removeOldExampleNotes(this.data.settings.notes || {}, new Set(examples.map(p=>p.id)));
        await this.save(this.data);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`无法读取文献库，原文件已保留：${error.message}`);
      this.data = { format: 'materia-library', version: 1, papers: [], settings: { collections: [], notes: {}, mode: 'own' } };
      await this.save(this.data);
    }
    const metrics = seedJournalMetrics(this.data.settings.journalMetrics || []);
    if (JSON.stringify(metrics) !== JSON.stringify(this.data.settings.journalMetrics)) { this.data.settings.journalMetrics = metrics; await this.save(this.data); }
    if(this.data.settings.translationPreferences?.instant===true){this.data.settings.translationPreferences=cleanTranslationPreferences(this.data.settings.translationPreferences);await this.save(this.data);}
    return this;
  }
  async save(data) {
    const studyVersion=data.version===3||data.settings.vocabulary?.length||data.settings.translationCache?.length;
    if (data.papers.some(paper => paper.materials !== undefined)) data.version = 2;
    if(studyVersion)data.version=3;
    const target = path.join(this.root, 'library.json');
    const temp = path.join(this.root, `.library-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'wx' });
    try { await copyFile(target, path.join(this.root, 'backups', 'library.previous.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await rename(temp, target);
    this.data = data;
  }
  mutate(fn) {
    const operation = this.queue.then(async () => { const next = structuredClone(this.data); const result = await fn(next); await this.save(next); return result; });
    this.queue = operation.catch(() => {}); return operation;
  }
  getPapers() { return this.data.papers.map(p => materializePaper({ ...p, file: p.pdfPath ? { desktop: true, size: p.size } : null })); }
  getSetting(key) { return this.data.settings[key]; }
  async setSetting(key, value) {
    if (!['collections', 'notes', 'mode', 'journalMetrics', 'comparisonSelection', 'graphLayout', 'chartPreferences', 'graphPreferences', 'graphAssociations', 'themePreferences', 'readerState', 'readerDrafts','vocabulary','translationCache','translationPreferences'].includes(key)) throw new Error('不支持的文献库设置。');
    if(key==='vocabulary')value=cleanVocabulary(value);
    if(key==='translationCache')value=cleanTranslationCache(value);
    if(key==='translationPreferences')value=cleanTranslationPreferences(value);
    if(key==='readerDrafts')value=cleanReaderDrafts(value);
    if(key==='readerState')value=cleanReaderState(value);
    if(key==='themePreferences')value=cleanThemePreferences(value);
    if(key==='graphPreferences')value=cleanGraphSettings(value);
    if(key==='graphAssociations')value=cleanAssociations(value);
    if (key === 'chartPreferences') value = cleanFigureSettings(value);
    if (key === 'graphLayout') value = cleanLayout(value);
    if (key === 'notes') value = cleanNotes(value);
    if (key === 'journalMetrics') value = Array.isArray(value) && value.length ? parseMetrics(JSON.stringify(value)) : [];
    return this.mutate(data => { data.settings[key] = value; });
  }
  async preparePaper(input, existing) {
    if (!input || typeof input.id !== 'string' || !/^[a-z\d_-]{1,120}$/i.test(input.id) || typeof input.title !== 'string' || !input.title.trim()) throw new Error('文献信息格式不正确。');
    const paper = {
      id: input.id, title: input.title.trim().slice(0, 1000), authors: String(input.authors || '').slice(0, 1000), journal: String(input.journal || '').slice(0, 300), year: /^\d{4}$/.test(String(input.year)) ? String(input.year) : '',
      tags: cleanTags(input.tags), notes: String(input.notes || '').slice(0, 20000), collection: String(input.collection || '').slice(0, 120), favorite: Boolean(input.favorite), addedAt: Number(input.addedAt) || Date.now(),
      filename: path.basename(String(input.filename || existing?.filename || 'document.pdf')), size: existing?.size || 0, pdfPath: existing?.pdfPath || '', fingerprint: existing?.fingerprint || '',
      authorDetails: normalizeAuthors(input.authorDetails || existing?.authorDetails || []), doi: String(input.doi || '').slice(0, 1000), impactFactor: numericImpact(input.impactFactor), impactYear: /^\d{4}$/.test(String(input.impactYear)) ? String(input.impactYear) : '',
      materials: normalizePaperMaterials(input.materials !== undefined || input.measurements !== undefined ? input : existing || {}).materials,
    };
    if (input.fileBytes) {
      const bytes = Buffer.from(input.fileBytes);
      if (!bytes.subarray(0, 1024).toString('latin1').includes('%PDF-')) throw new Error('文件不是有效的 PDF。');
      paper.size = bytes.length; paper.fingerprint = createHash('sha256').update(bytes).digest('hex'); paper.pdfPath = `papers/${paper.fingerprint}.pdf`;
      const destination = resolveInside(this.root, paper.pdfPath);
      const temp = destination + `.${randomUUID()}.tmp`;
      await writeFile(temp, bytes, { flag: 'wx' }); await rename(temp, destination);
    }
    if (!paper.pdfPath) throw new Error('文献缺少 PDF 文件。');
    return paper;
  }
  async putPapers(inputs) {
    if (!Array.isArray(inputs) || inputs.length > 10000) throw new Error('导入数量不正确。');
    return this.mutate(async data => {
      const byId = new Map(data.papers.map(p => [p.id, p]));
      for (const input of inputs) {
        const previous = byId.get(input.id), paper = await this.preparePaper(input, previous);
        if (previous && previous.title !== paper.title) data.settings.notes = renameTitleLinks(data.settings.notes || {}, previous.title, paper.title);
        byId.set(paper.id, paper);
      }
      data.papers = [...byId.values()];
    });
  }
  async deletePaper(id) {
    return this.mutate(async data => {
      const p = data.papers.find(p => p.id === id); if (!p) return;
      // Preserve removed PDFs on disk; restore information is kept beside them.
      const trash = path.join(this.root, '.trash'); await mkdir(trash, { recursive: true });
      await writeFile(path.join(trash, `${Date.now()}-${randomUUID()}.json`), JSON.stringify({ paper: p, notes: data.settings.notes?.[`paper:${id}`] || [] }, null, 2));
      data.papers = data.papers.filter(p => p.id !== id);
    });
  }
  async bulkEdit(ids, options) {
    return this.mutate(data => {
      const plan = planBulkEdit(data.papers, data.settings.collections || [], ids, options, `folder-${randomUUID()}`);
      const updates = new Map(plan.updates.map(paper => [paper.id, paper]));
      data.papers = data.papers.map(paper => updates.get(paper.id) || paper);
      if (plan.collection) data.settings.collections = [...(data.settings.collections || []), plan.collection];
      return { count: plan.updates.length };
    });
  }
  async deletePapers(ids) {
    return this.mutate(async data => {
      const batch = takeRemoval(data, ids, `batch-${randomUUID()}`);
      if (!batch.papers.length) return { count: 0 };
      const trash = path.join(this.root, '.trash');
      await mkdir(trash, { recursive: true });
      await writeFile(path.join(trash, `${batch.id}.json`), JSON.stringify(batch, null, 2), { encoding: 'utf8', flag: 'wx' });
      return data.settings.lastRemoval;
    });
  }
  async restorePapers(id) {
    if (typeof id !== 'string' || !/^batch-[a-f\d-]{36}$/i.test(id)) throw new Error('移除记录标识无效。');
    return this.mutate(async data => {
      const batch = JSON.parse(await readFile(resolveInside(this.root, `.trash/${id}.json`), 'utf8'));
      if (batch.id !== id || batch.format !== 'materia-removal' || !Array.isArray(batch.papers) || batch.papers.length > 10000) throw new Error('移除记录无法读取。');
      const existing = new Set(data.papers.map(paper => paper.id));
      for (const paper of batch.papers) if (!existing.has(paper.id)) {
        await access(resolveInside(this.root, paper.pdfPath));
        const prepared = await this.preparePaper(paper, paper); delete paper.measurements; Object.assign(paper, prepared);
      }
      return { count: restoreRemoval(data, batch).length };
    });
  }
  async pdfPath(id) { const paper = this.data.papers.find(p => p.id === id); if (!paper?.pdfPath) throw new Error('找不到 PDF 文件。'); const file = resolveInside(this.root, paper.pdfPath); await access(file); return file; }
  async readPdf(id) { return new Uint8Array(await readFile(await this.pdfPath(id))); }
  getStudy(){return cleanStudy({vocabulary:this.data.settings.vocabulary,cache:this.data.settings.translationCache,preferences:this.data.settings.translationPreferences});}
  updateStudy(operation){return this.mutate(data=>applyStudyOperation(data.settings,operation));}
  async mergeBackup(backup) {
    const study=backup.study?cleanStudy(backup.study):null;
    return this.mutate(async data => {
      const byId = new Map(data.papers.map(p => [p.id, p]));
      for (const input of backup.papers) { const paper = await this.preparePaper(input, byId.get(input.id)); byId.set(paper.id, paper); }
      data.papers = [...byId.values()];
      const folders = new Map((data.settings.collections || []).map(c => [c.id, c]));
      for (const c of backup.collections) folders.set(c.id, c);
      data.settings.collections = [...folders.values()];
      const incomingNotes = cleanNotes(backup.notes || {}), currentNotes = data.settings.notes || {};
      for (const [key, notes] of Object.entries(incomingNotes)) currentNotes[key] = [...new Map([...(currentNotes[key] || []), ...notes].map(n => [n.id, n])).values()];
      data.settings.notes = currentNotes; data.settings.mode = 'own';
      data.settings.journalMetrics = mergeMetrics(data.settings.journalMetrics || [], backup.journalMetrics || []);
      if(study){data.settings.vocabulary=mergeVocabulary(data.settings.vocabulary,study.vocabulary);let cache=data.settings.translationCache||[];for(const row of study.cache)cache=saveTranslationCache(cache,row);data.settings.translationCache=cache;data.settings.translationPreferences=study.preferences;}
    });
  }
  async info() {
    let bytes = 0; for (const paper of this.data.papers) { try { bytes += (await stat(await this.pdfPath(paper.id))).size; } catch {} }
    return { path: this.root, papers: this.data.papers.length, bytes, studyVersion:1, materialsVersion: 1, readerNotesVersion: 1, readerAnnotationsVersion: 1, readerDraftsVersion: 1, themeSchemaVersion: 2 };
  }
}
