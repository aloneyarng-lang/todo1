import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {LocalLibrary} from '../desktop/library.mjs';
import {materialInventory, cleanMaterialSelection} from '../dist/material-selection.js';
import {materialReference, materialListEntries, filterMaterialList, assignMaterialGroup, cleanMaterialGroups, mergeMaterialGroups} from '../dist/material-list-model.js';
import {createBackup, readBackup} from '../dist/storage.js';

const papers = () => [{id: 'p1', title: 'Source One', materials: [{id: 'a', name: 'Alloy', composition: 'FeCo', measurements: [{id: 'm1', name: 'Strength', value: 100, unit: 'MPa', sample: 'S1', conditions: 'RT'}, {id: 'm2', name: 'Strength', value: 130, unit: 'MPa', sample: 'S2', conditions: 'HT'}]}, {id: 'empty', name: 'Unmeasured alloy', measurements: []}]}, {id: 'p2', title: 'Source Two', materials: [{id: 'a', name: 'Alloy', measurements: [{id: 'm3', name: 'Strength', value: 150, unit: 'MPa', sample: 'S1', conditions: 'RT'}]}]}];
const groups = () => [{id: 'g1', name: 'High strength', members: [materialReference('p1', 'a')]}, {id: 'g2', name: 'Other', members: []}];

test('material list has one row per recorded material, keeps sources distinct and exposes every cohort', () => {
  const input = papers(), before = structuredClone(input), entries = materialListEntries(materialInventory(input));
  assert.equal(entries.length, 3); assert.equal(entries[0].cohorts.length, 2);
  assert.notEqual(entries[0].ref, entries[2].ref); assert.equal(entries[1].cohorts[0].measurements.length, 0);
  assert.deepEqual(input, before);
});

test('material groups filter by stable identity and moves preserve all siblings, sources and sample conditions', () => {
  const input = papers(), entries = materialListEntries(materialInventory(input)), original = groups();
  assert.equal(filterMaterialList(entries, {group: 'g1'}, original).length, 1);
  assert.equal(filterMaterialList(entries, {group: 'ungrouped'}, original).length, 2);
  assert.equal(filterMaterialList(entries, {query: 'Source One Strength HT'}, original).length, 1);
  const moved = assignMaterialGroup(original, [entries[0].ref, entries[2].ref], 'g2');
  assert.equal(moved[0].members.length, 0); assert.equal(moved[1].members.length, 2); assert.equal(original[0].members.length, 1);
  input[0].materials[0].name = 'Renamed'; input[0].materials[0].measurements[0].conditions = 'Updated';
  assert.equal(filterMaterialList(materialListEntries(materialInventory(input)), {group: 'g2'}, moved).length, 2);
  assert.equal(assignMaterialGroup(moved, [entries[0].ref])[1].members.length, 1);
});

test('partially selected material appears in selected-only results without selecting its other cohorts', () => {
  const entries = materialListEntries(materialInventory(papers())), keys = [entries[0].cohorts[1].key];
  const result = filterMaterialList(entries, {onlySelected: true}, groups(), keys);
  assert.deepEqual(result.map(entry => entry.ref), [entries[0].ref]); assert.equal(keys.length, 1);
});

test('malformed groups, duplicate names, overlapping assignments and nonexistent targets fail before saving', () => {
  for (const input of [[{id: 'g', name: 'A', members: ['broken']}], [{id: 'g', name: ' ', members: []}], [{id: 'g', name: 'A', members: []}, {id: 'h', name: 'a', members: []}], [{id: 'g', name: 'A', members: [materialReference('p1', 'a')]}, {id: 'h', name: 'B', members: [materialReference('p1', 'a')]}]]) assert.throws(() => cleanMaterialGroups(input));
  assert.throws(() => assignMaterialGroup(groups(), [materialReference('p1', 'a')], 'missing'));
});

test('groups and both comparison selections survive disk reopen without changing materials or notes', async () => {
  await mkdir('.local/tests', {recursive: true}); const lib = await new LocalLibrary(await mkdtemp(path.resolve('.local/tests/material-list-'))).init();
  await lib.putPapers(papers().map(paper => ({...paper, fileBytes: Buffer.from('%PDF-1.4\n% material list fixture\n%%EOF')}))); await lib.setSetting('comparisonSelection', ['p2']);
  await lib.setSetting('notes', {'paper:p1': [{id: 'n1', body: 'Preserved', createdAt: 1, updatedAt: 1}]});
  const before = structuredClone(lib.getPapers()), notes = structuredClone(lib.getSetting('notes'));
  const state = cleanMaterialSelection({version: 1, mode: 'material', keys: [materialInventory(before)[0].key], groups: groups()});
  await lib.setSetting('comparisonState', state);
  const reopened = await new LocalLibrary(lib.root).init();
  assert.deepEqual(reopened.getSetting('comparisonState'), state); assert.deepEqual(reopened.getSetting('comparisonSelection'), ['p2']);
  assert.deepEqual(reopened.getPapers(), before); assert.deepEqual(reopened.getSetting('notes'), notes);
});

test('complete backup includes material groups and restores them together with materials, preserving other local groups', async () => {
  const backup = readBackup(await createBackup(papers(), [], {}, [], undefined, groups()));
  assert.deepEqual(backup.materialGroups, groups());
  await mkdir('.local/tests', {recursive: true}); const lib = await new LocalLibrary(await mkdtemp(path.resolve('.local/tests/material-list-backup-'))).init();
  await lib.setSetting('comparisonState', cleanMaterialSelection({version: 1, mode: 'paper', keys: [], groups: [{id: 'local', name: 'Local', members: [materialReference('other', 'kept')]}]}));
  await lib.mergeBackup({...backup, papers: backup.papers.map(paper => ({...paper, fileBytes: Buffer.from('%PDF-1.4\n% backup fixture\n%%EOF')}))});
  assert.equal(lib.getSetting('comparisonState').groups.length, 3); assert.equal(lib.getPapers().length, 2);
  assert.deepEqual(lib.getSetting('comparisonState').groups.find(folder => folder.id === 'g1').members, groups()[0].members);
  const sameName = mergeMaterialGroups(groups(), [{id: 'external', name: 'High strength', members: [materialReference('p2', 'a')]}]);
  assert.equal(sameName.length, 2); assert.equal(sameName[0].members.length, 2);
});
