import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LocalLibrary, resolveInside } from '../desktop/library.mjs';
import { normalizeAuthors, authorsText, numericImpact, impactOf, filterCatalog, parseMetrics, mergeMetrics, matchMetadata } from '../dist/catalog.js';
import { wikiLinks, resolveLink, backlinks, renameTitleLinks } from '../dist/note-links.js';

const pdf = Buffer.from('%PDF-1.4\n% Synthetic test file\n%%EOF');
const base = { id: 'paper-test', title: 'Test title', tags: ['二维材料'], authors: '', authorDetails: [{ name: 'A', affiliations: ['Institute A', 'Institute B'] }, { name: 'B', affiliations: ['Institute B'] }], journal: 'Journal A', year: '2025', filename: 'original.pdf', favorite: true, addedAt: 1000, impactFactor: null, fileBytes: pdf };
async function temporaryLibrary() { const parent = path.resolve('.local', 'tests'); await mkdir(parent, { recursive: true }); return new LocalLibrary(await mkdtemp(path.join(parent, 'library-'))).init(); }

test('disk library persists original PDF, complete authors and concurrent note/metric changes', async () => {
  const lib = await temporaryLibrary();
  await lib.putPapers([base]);
  await Promise.all([lib.setSetting('notes', { 'paper:paper-test': [{ id: 'note-1', body: 'First thought', createdAt: 10, updatedAt: 20 }, { id: 'note-2', body: 'Second thought [[#二维材料]]', createdAt: 15, updatedAt: 20 }], 'tag:二维材料': [{ id: 'tag-note', body: 'Linked [[Test title]]', createdAt: 10, updatedAt: 20 }] }), lib.setSetting('journalMetrics', [{ journal: 'Journal A', impactFactor: 8.2, year: '2025', source: 'Test data' }])]);
  const reopened = await new LocalLibrary(lib.root).init();
  assert.equal(reopened.getPapers().length, 1);
  assert.deepEqual(reopened.getPapers()[0].authorDetails, base.authorDetails);
  assert.deepEqual(Buffer.from(await reopened.readPdf(base.id)), pdf);
  assert.equal(reopened.getSetting('notes')['paper:paper-test'].length, 2);
  assert.equal(reopened.getSetting('journalMetrics')[0].impactFactor, 8.2);
  assert.ok((await readFile(path.join(lib.root, 'library.json'), 'utf8')).includes('Institute A'));
  assert.ok(await readFile(path.join(lib.root, 'backups', 'library.previous.json')));
});

test('editing a title maintains note links; replacing a PDF preserves the previous binary', async () => {
  const lib = await temporaryLibrary(); await lib.putPapers([base]);
  const originalPath = await lib.pdfPath(base.id);
  await lib.setSetting('notes', { 'tag:二维材料': [{ id: 'n', body: 'Read [[Test title]] and [[#二维材料]]', createdAt: 1, updatedAt: 1 }] });
  await lib.putPapers([{ ...base, title: 'Renamed title', fileBytes: Buffer.from('%PDF-1.4\nchanged\n%%EOF') }]);
  assert.match(lib.getSetting('notes')['tag:二维材料'][0].body, /\[\[Renamed title\]\]/);
  assert.deepEqual(await readFile(originalPath), pdf);
  assert.notEqual(await lib.pdfPath(base.id), originalPath);
});

test('invalid imports leave catalog intact, traversal and corrupt catalogs are rejected', async () => {
  const lib = await temporaryLibrary(); await lib.putPapers([base]);
  await assert.rejects(lib.putPapers([{ ...base, id: 'paper-other' }, { ...base, id: '../../bad' }]), /格式/);
  assert.equal(lib.getPapers().length, 1);
  assert.throws(() => resolveInside(lib.root, '../outside.pdf'), /超出/);
  await writeFile(path.join(lib.root, 'library.json'), '{ broken');
  await assert.rejects(new LocalLibrary(lib.root).init(), /原文件已保留/);
});

test('all authors retain affiliation mapping through text and structured metadata', () => {
  assert.deepEqual(normalizeAuthors('A | Institute A；Institute B\nB | Institute B'), base.authorDetails);
  assert.deepEqual(normalizeAuthors(authorsText(base.authorDetails)), base.authorDetails);
  const updated = matchMetadata(JSON.stringify([{ filename: 'original.pdf', authors: base.authorDetails, tags: ['T'] }]), [base]).updates[0];
  assert.deepEqual(updated.authorDetails, base.authorDetails);
  assert.equal(updated.title, base.title);
  assert.equal(matchMetadata(JSON.stringify([{ title: 'Test title' }]), [base, { ...base, id: 'other' }]).unmatched.length, 1);
});

test('journal metrics import quoted CSV, keep years and sort unknown IF last in both directions', () => {
  const metrics = parseMetrics('\uFEFFjournal,impactFactor,year,source\r\n"Journal A",8.2,2024,Test\r\n"Journal A",9.1,2025,Test\r\n"Journal, B",2.0,2025,Test');
  assert.equal(impactOf(base, metrics).value, 9.1);
  assert.equal(impactOf(base, metrics, '2024').value, 8.2);
  assert.equal(mergeMetrics(metrics, [{ journal: 'journal a', impactFactor: 9.3, year: '2025' }]).length, 3);
  const rows = [base, { ...base, id: 'missing', journal: 'Unknown' }, { ...base, id: 'low', journal: 'Journal, B' }];
  assert.deepEqual(filterCatalog(rows, { sort: 'if-desc' }, {}, metrics).map(p => p.id), ['paper-test', 'low', 'missing']);
  assert.deepEqual(filterCatalog(rows, { sort: 'if-asc' }, {}, metrics).map(p => p.id), ['low', 'paper-test', 'missing']);
  assert.equal(numericImpact(''), null); assert.equal(numericImpact(0), 0);
  assert.throws(() => parseMetrics('journal,impactFactor,year\nJ,unknown,2025'), /有效/);
});

test('search includes paper notes, tag notes, complete authors and institutions; graph filters combine', () => {
  const rows = [base, { ...base, id: 'second', title: 'Second', tags: ['电催化'], journal: 'Journal B', favorite: false }];
  const notes = { 'paper:paper-test': [{ body: 'oxygen vacancy marker' }], 'tag:电催化': [{ body: 'reaction kinetics' }] };
  assert.equal(filterCatalog(rows, { query: 'oxygen vacancy', searchScope: 'notes' }, notes)[0].id, base.id);
  assert.equal(filterCatalog(rows, { query: 'reaction', searchScope: 'all' }, notes)[0].id, 'second');
  assert.equal(filterCatalog(rows, { query: 'Institute A' }, notes).length, 2);
  assert.equal(filterCatalog(rows, { query: '#二维材料' }, notes).length, 1);
  assert.equal(filterCatalog(rows, { filters: { tags: ['二维材料', '电催化'], tagMode: 'all' } }, notes).length, 0);
  assert.equal(filterCatalog(rows, { filters: { tags: ['二维材料', '电催化'], tagMode: 'any', onlyFavorites: true, hasNotes: true, institution: 'Institute A', yearFrom: '2024', yearTo: '2026' } }, notes).length, 1);
  assert.equal(filterCatalog(rows, { filters: { minIF: '5', maxIF: '10' } }, notes, [{ journal: 'Journal A', impactFactor: 8, year: '2025' }]).length, 1);
});

test('title/tag note links resolve both ways and keep unresolved references readable', () => {
  const notes = { 'tag:二维材料': [{ body: 'Read [[Test title]]' }], 'paper:paper-test': [{ body: 'See [[#二维材料]] and [[unknown]]' }] };
  assert.equal(backlinks(notes, 'paper', base.id, [base]).length, 1);
  assert.equal(backlinks(notes, 'tag', '二维材料', [base]).length, 1);
  assert.equal(resolveLink(wikiLinks('[[unknown]]')[0], [base]), null);
  assert.match(renameTitleLinks(notes, base.title, 'New title')['tag:二维材料'][0].body, /New title/);
});
