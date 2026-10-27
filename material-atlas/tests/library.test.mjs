import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTags, readBackup, createBackup } from '../dist/storage.js';
import { buildLinks, countLinks, tagGroups } from '../dist/graph.js';
import { tagCounts, eligibleTags, primaryTag } from '../dist/tags.js';
import { filterCatalog } from '../dist/catalog.js';

// FileReader is supplied by browsers; this small adapter exercises the same
// backup encoder against actual Blob bytes in the dependency-free Node test.
globalThis.FileReader = class {
  async readAsDataURL(blob) {
    try { this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`; this.onload(); }
    catch (error) { this.error = error; this.onerror(); }
  }
};

test('pasted tags support Chinese punctuation, trim and deduplicate', () => {
  assert.deepEqual(normalizeTags(' 二维材料，界面工程,二维材料；电催化\n  '), ['二维材料', '界面工程', '电催化']);
  assert.deepEqual(normalizeTags([' A ', null, 'A', 15, 'B']), ['A', 'B']);
});

test('only tags on at least three papers create deduplicated connections', () => {
  const papers = [{ tags: ['A', 'B', 'A'] }, { tags: ['A', 'B'] }, { tags: ['C'] }, { tags: ['B'] }];
  const links = buildLinks(papers);
  assert.equal(links.length, 3);
  assert.deepEqual(links.find(link => link.source === 0 && link.target === 1).tags, ['B']);
  assert.equal(countLinks(papers), links.length);
  assert.equal(countLinks([]), 0);
  assert.equal(countLinks([{ tags: ['A'] }]), 0);
  for (let n = 1; n < 50; n++) assert.equal(countLinks(Array.from({ length: n }, () => ({ tags: ['A', 'B'] }))), n < 3 ? 0 : n * (n - 1) / 2);
  const overlapping = [{ tags: ['A', 'B'] }, { tags: ['A', 'B'] }, { tags: ['A'] }, { tags: ['B'] }];
  assert.equal(countLinks(overlapping), 5);
  assert.equal(buildLinks(overlapping).length, 5);
});

test('tag eligibility counts each paper once and reacts to reaching or losing the third paper', () => {
  const records = [{ tags: ['rare', 'A', 'A'] }, { tags: ['A', 'rare'] }, { tags: ['A'] }, { tags: [] }];
  assert.equal(tagCounts(records).get('A'), 3);
  assert.deepEqual([...eligibleTags(records)], ['A']);
  assert.deepEqual(tagGroups(records).map(g => [g.name, g.count]), [['A', 3]]);
  assert.equal(primaryTag(records[0], eligibleTags(records)), 'A');
  assert.equal(primaryTag({ tags: ['rare'] }, eligibleTags(records)), '');
  assert.equal(tagGroups(records.slice(0, 2)).length, 0);
  assert.equal(buildLinks(records.slice(0, 2)).length, 0);
  assert.equal(countLinks(records.slice(0, 2)), 0);
  assert.deepEqual([...eligibleTags([...records, { tags: ['rare'] }])], ['rare', 'A']);
  assert.deepEqual(records[0].tags, ['rare', 'A', 'A']);
});

test('filtered and capped graph subsets retain tag eligibility from the full library', () => {
  const library = [{ tags: ['A', 'rare'] }, { tags: ['A', 'rare'] }, { tags: ['A'] }];
  const visible = library.slice(0, 2), eligible = eligibleTags(library);
  assert.deepEqual(buildLinks(visible, eligible), [{ source: 0, target: 1, tags: ['A'] }]);
  assert.equal(countLinks(visible, eligible), 1);
  assert.deepEqual(tagGroups(library).map(g => g.name), ['A']);
  assert.equal(primaryTag(visible[0], eligible), 'A');
});

test('related-paper filter uses qualifying library tags even when query leaves two results', () => {
  const library = [{ id: '1', title: 'match one', tags: ['rare', 'A'] }, { id: '2', title: 'match two', tags: ['rare', 'A'] }, { id: '3', title: 'third', tags: ['A'] }, { id: '4', title: 'isolated', tags: ['B'] }];
  const state = { query: 'match', filters: { onlyRelated: true } };
  assert.deepEqual(filterCatalog(library, state).map(p => p.id), ['1', '2']);
  assert.equal(filterCatalog(library.slice(0, 2), state).length, 0);
});

test('complete backup round trips PDF bytes, tags, folders, notes and favorites', async () => {
  const pdf = new Blob(['%PDF-1.4\n% test fixture\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'], { type: 'application/pdf' });
  const paper = { id: 'test-1', title: '测试文献 & <标题>', authors: 'A', journal: 'Test', year: '2025', tags: ['二维材料', '界面工程'], collection: 'folder-1', notes: '研究记录\n第二行', favorite: true, addedAt: 123, filename: 'test.pdf', file: pdf, fingerprint: 'a'.repeat(64) };
  const folders = [{ id: 'folder-1', name: '测试收藏夹', color: '#397d78' }];
  const encoded = await createBackup([paper], folders);
  assert.equal(encoded.papers[0].file, undefined);
  const restored = readBackup(JSON.parse(JSON.stringify(encoded)));
  assert.deepEqual(restored.collections, folders);
  for (const key of ['id', 'title', 'authors', 'journal', 'year', 'tags', 'collection', 'notes', 'favorite', 'addedAt', 'filename', 'fingerprint']) assert.deepEqual(restored.papers[0][key], paper[key]);
  assert.equal(await restored.papers[0].file.text(), await pdf.text());
  assert.equal(restored.papers[0].size, pdf.size);
});

test('invalid backups and corrupted PDF data are rejected before storage changes', () => {
  assert.throws(() => readBackup({ papers: [] }), /备份/);
  const base = { format: 'materia-backup', version: 1, collections: [], papers: [{ id: 'x', title: 'T', tags: [], fileBase64: 'invalid !' }] };
  assert.throws(() => readBackup(base), /损坏/);
  base.papers[0].fileBase64 = btoa('not a PDF');
  assert.throws(() => readBackup(base), /无效/);
  base.papers[0].fileBase64 = null;
  base.papers.push({ ...base.papers[0] });
  assert.throws(() => readBackup(base), /格式/);
});
