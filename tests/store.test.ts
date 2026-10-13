import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGraphStore } from '../src/stores/graphStore';
import { createInitialGraph, validateGraph } from '../src/domain/graph';
import { loadUniverse } from '../src/storage/indexedDb';

const store = () => useGraphStore.getState();
const saved = () => vi.waitFor(() => expect(store().saveStatus).toBe('saved'));
const draft = () => ({ sourceId: store().graph.rootPersonId, position: { x: 4, y: 1, z: 0 } });
function createFriend() { store().setDraft(draft()); store().createConnection(' 林远 ', ' 朋友 '); return store().selectedId!; }
beforeEach(async () => {
  await store().initialize();
  store().replaceGraph(createInitialGraph());
  await saved();
});
describe('graph workflows with IndexedDB', () => {
  it('initialization is idempotent and the same root is stored', async () => {
    const root = store().graph.rootPersonId;
    await store().initialize(); await store().initialize();
    expect((await loadUniverse()).graph?.rootPersonId).toBe(root);
    expect(store().graph.people).toHaveLength(1);
  });
  it('cancelling a draft leaves no orphan people or relationships', async () => {
    const before = JSON.stringify(store().graph);
    store().setDraft(draft()); store().setDraft(null);
    expect(JSON.stringify(store().graph)).toBe(before);
    expect((await loadUniverse()).graph?.people).toHaveLength(1);
  });
  it('invalid form submission never writes partial data', async () => {
    store().setDraft(draft());
    expect(() => store().createConnection('   ', '朋友')).toThrow();
    expect(() => store().createConnection('林远', '   ')).toThrow();
    expect(store().graph.people).toHaveLength(1);
    expect((await loadUniverse()).graph?.relationships).toEqual([]);
  });
  it('creates a person and relation atomically with trimmed required fields', async () => {
    const id = createFriend(); await saved();
    const graph = (await loadUniverse()).graph!;
    expect(graph.people.find(p => p.id === id)?.name).toBe('林远');
    expect(graph.relationships[0].label).toBe('朋友');
    expect(graph.relationships[0].targetId).toBe(id);
    expect(store().draft).toBeNull();
  });
  it('connects an existing person without duplicating them; duplicate labels are rejected', async () => {
    const id = createFriend();
    store().setDraft({ ...draft(), targetId: id });
    expect(() => store().createConnection('', '朋友')).toThrow();
    store().createConnection('', '同学'); await saved();
    expect(store().graph.people).toHaveLength(2);
    expect((await loadUniverse()).graph?.relationships).toHaveLength(2);
  });
  it('retains the latest rapid edits, manually moved coordinates, and camera preferences', async () => {
    const id = createFriend();
    store().updatePerson(id, { notes: '第一个版本' });
    store().updatePerson(id, { notes: '最终版本', howWeMet: '大学摄影社' });
    store().movePerson(id, { x: -2, y: 3, z: 4 });
    store().setView({ camera: [2, 3, 15], target: [1, 0, 0], showLabels: false });
    await saved();
    const data = await loadUniverse();
    expect(data.graph?.people.find(p => p.id === id)).toMatchObject({ notes: '最终版本', howWeMet: '大学摄影社', position: { x: -2, y: 3, z: 4 }, positionLocked: true });
    expect(data.view).toMatchObject({ camera: [2, 3, 15], target: [1, 0, 0], showLabels: false });
  });
  it('edits and removes memories and relations independently of people', async () => {
    const id = createFriend();
    store().saveMemory({ id: 'memory', personId: id, title: '看海', date: '2025-06-12' });
    store().saveMemory({ id: 'memory', personId: id, title: '一起看海', date: '2025-06-12', description: '海边的日落' });
    expect(store().graph.memories).toHaveLength(1);
    store().updateRelationship(store().graph.relationships[0].id, '好友', '摄影社认识');
    await saved();
    expect((await loadUniverse()).graph?.memories[0].title).toBe('一起看海');
    store().deleteMemory('memory'); store().deleteRelationship(store().graph.relationships[0].id); await saved();
    expect(store().graph.people).toHaveLength(2);
    expect((await loadUniverse()).graph?.relationships).toEqual([]);
    expect((await loadUniverse()).graph?.memories).toEqual([]);
  });
  it('deletes associated data and can restore a validated exported backup', async () => {
    const id = createFriend();
    store().saveMemory({ id: 'memory', personId: id, title: '一起看海' });
    const backup = validateGraph(JSON.parse(JSON.stringify(store().graph)));
    store().deletePerson(id); await saved();
    expect((await loadUniverse()).graph?.people).toHaveLength(1);
    expect(store().graph.relationships).toEqual([]);
    expect(store().graph.memories).toEqual([]);
    store().replaceGraph(backup); await saved();
    expect((await loadUniverse()).graph?.people).toHaveLength(2);
    expect(store().graph.memories).toHaveLength(1);
  });
});
