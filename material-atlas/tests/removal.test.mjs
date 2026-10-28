import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LocalLibrary } from '../desktop/library.mjs';
import { takeRemoval, restoreRemoval } from '../dist/removal.js';
import { eligibleTags } from '../dist/tags.js';

const pdf = Buffer.from('%PDF-1.4\n% Batch removal integration fixture\n%%EOF');
const papers = ['a', 'b', 'c'].map((id, index) => ({ id: `batch-${id}`, title: `Paper ${id}`, filename: `${id}.pdf`, tags: ['Shared tag'], journal: 'Journal A', year: '2025', favorite: true, authorDetails: [{ name: 'Author', affiliations: ['Institute'] }], measurements: [{ name: 'Capacity', value: index + 1.25, unit: 'mAh/g', sample: id }], fileBytes: pdf }));
const notes = { 'paper:batch-a': [{ id: 'a-note', body: 'Reading A', createdAt: 1, updatedAt: 1 }], 'paper:batch-b': [{ id: 'b-note', body: 'Reading B', createdAt: 1, updatedAt: 1 }], 'tag:Shared tag': [{ id: 'tag-note', body: 'Keep this shared note', createdAt: 1, updatedAt: 1 }] };
async function library() {
  const parent = path.resolve('.local/tests'); await mkdir(parent, { recursive: true });
  const lib = await new LocalLibrary(await mkdtemp(path.join(parent, 'removal-'))).init();
  await lib.putPapers(papers); await lib.setSetting('notes', notes);
  await lib.setSetting('comparisonSelection', papers.map(paper => paper.id));
  return lib;
}

test('one bulk removal preserves PDFs and restores papers, measurements, notes and selection after reopening', async () => {
  const lib = await library(), originals = lib.getPapers();
  const receipt = await lib.deletePapers(['batch-a', 'batch-b', 'batch-a', 'missing']);
  assert.equal(receipt.count, 2);
  assert.deepEqual(lib.getPapers().map(paper => paper.id), ['batch-c']);
  assert.equal(eligibleTags(lib.getPapers()).size, 0);
  assert.deepEqual(lib.getSetting('comparisonSelection'), ['batch-c']);
  assert.equal(lib.getSetting('notes')['paper:batch-a'], undefined);
  assert.deepEqual(lib.getSetting('notes')['tag:Shared tag'], notes['tag:Shared tag']);
  for (const paper of originals) assert.deepEqual(await readFile(path.join(lib.root, paper.pdfPath)), pdf);
  const reopened = await new LocalLibrary(lib.root).init();
  assert.equal(reopened.getSetting('lastRemoval').id, receipt.id);
  assert.equal((await reopened.restorePapers(receipt.id)).count, 2);
  assert.equal(reopened.getPapers().length, 3);
  assert.deepEqual(reopened.getPapers().find(paper => paper.id === 'batch-a').materials, originals[0].materials);
  assert.deepEqual(reopened.getPapers().find(paper => paper.id === 'batch-a').authorDetails, originals[0].authorDetails);
  assert.deepEqual(reopened.getSetting('notes'), notes);
  assert.deepEqual(new Set(reopened.getSetting('comparisonSelection')), new Set(papers.map(paper => paper.id)));
  assert.equal(eligibleTags(reopened.getPapers()).size, 1);
  assert.equal(reopened.getSetting('lastRemoval'), null);
  assert.equal((await reopened.restorePapers(receipt.id)).count, 0);
  assert.equal(reopened.getPapers().length, 3);
});

test('undo preserves a newly imported or edited paper with the same ID', async () => {
  const lib = await library(), receipt = await lib.deletePapers(['batch-a', 'batch-b']);
  await lib.putPapers([{ ...papers[0], title: 'Edited after removal', measurements: [{ name: 'New value', value: 99, unit: 'MPa' }] }]);
  await lib.setSetting('notes', { ...lib.getSetting('notes'), 'paper:batch-a': [{ id: 'new-note', body: 'Newest note', createdAt: 2, updatedAt: 2 }] });
  assert.equal((await lib.restorePapers(receipt.id)).count, 1);
  assert.equal(lib.getPapers().find(paper => paper.id === 'batch-a').title, 'Edited after removal');
  assert.equal(lib.getPapers().find(paper => paper.id === 'batch-a').materials[0].measurements[0].value, 99);
  assert.equal(lib.getSetting('notes')['paper:batch-a'][0].body, 'Newest note');
  assert.equal(lib.getSetting('notes')['paper:batch-b'][0].body, 'Reading B');
});

test('failed archive creation and invalid batch requests leave the whole catalog intact', async () => {
  const lib = await library(), previous = await readFile(path.join(lib.root, 'library.json'), 'utf8');
  await assert.rejects(lib.deletePapers(['batch-a', null]), /有效/);
  await writeFile(path.join(lib.root, '.trash'), 'Cannot create a directory here');
  await assert.rejects(lib.deletePapers(['batch-a', 'batch-b']));
  assert.equal(await readFile(path.join(lib.root, 'library.json'), 'utf8'), previous);
  assert.equal(lib.getPapers().length, 3);
  assert.deepEqual(lib.getSetting('notes'), notes);
  await lib.setSetting('mode', 'own');
});

test('missing PDF during undo cannot partly restore a batch; traversal is rejected', async () => {
  const lib = await library(), receipt = await lib.deletePapers(['batch-a', 'batch-b']);
  await assert.rejects(lib.restorePapers('../outside'), /无效/);
  const archivePath = path.join(lib.root, '.trash', `${receipt.id}.json`);
  const archive = JSON.parse(await readFile(archivePath, 'utf8'));
  archive.papers[1].pdfPath = 'papers/missing.pdf';
  await writeFile(archivePath, JSON.stringify(archive));
  await assert.rejects(lib.restorePapers(receipt.id));
  assert.deepEqual(lib.getPapers().map(paper => paper.id), ['batch-c']);
  assert.equal(lib.getSetting('lastRemoval').id, receipt.id);
});

test('browser removal record round trips Blob bytes and leaves shared tag notes intact', async () => {
  const file = new Blob([pdf], { type: 'application/pdf' });
  const data = { papers: [{ id: 'a', title: 'A', file }, { id: 'b', title: 'B', file }], settings: { notes: { 'paper:a': [{ id: 'n', body: 'Note A' }], 'tag:T': [{ id: 't', body: 'Tag note' }] }, comparisonSelection: ['a'] } };
  const batch = structuredClone(takeRemoval(data, ['a', 'a'], 'batch-test'));
  assert.equal(batch.papers.length, 1);
  assert.deepEqual(data.papers.map(paper => paper.id), ['b']);
  assert.equal(data.settings.notes['tag:T'][0].body, 'Tag note');
  const restored = restoreRemoval(data, batch);
  assert.deepEqual(Buffer.from(await restored[0].file.arrayBuffer()), pdf);
  assert.equal(data.settings.notes['paper:a'][0].body, 'Note A');
  assert.deepEqual(data.settings.comparisonSelection, ['a']);
});
