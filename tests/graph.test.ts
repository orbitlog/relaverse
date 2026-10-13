import { describe, expect, it } from 'vitest';
import { assertRelationship, createInitialGraph, removePerson, validateGraph } from '../src/domain/graph';
import { findOpenPosition, MIN_NODE_DISTANCE } from '../src/domain/layout';
import type { GraphData, Person } from '../src/types/graph';

function graphWithFriend(): GraphData {
  const g = createInitialGraph();
  g.people.push({ ...g.people[0], id: 'friend', name: '林远', position: { x: 4, y: 1, z: 0 } });
  g.relationships.push({ id: 'r1', sourceId: g.rootPersonId, targetId: 'friend', label: '朋友', createdAt: new Date().toISOString() });
  g.memories.push({ id: 'm1', personId: 'friend', title: '一起看海', date: '2025-06-12' });
  return g;
}
describe('graph integrity and backup validation', () => {
  it('starts with exactly one protected root', () => {
    const graph = createInitialGraph();
    expect(graph.people).toHaveLength(1);
    expect(graph.people[0].id).toBe(graph.rootPersonId);
    expect(() => removePerson(graph, graph.rootPersonId)).toThrow();
  });
  it('round-trips JSON without losing people, positions, relations or memories', () => {
    const graph = graphWithFriend();
    graph.people[1].positionLocked = true;
    graph.people[1].howWeMet = '在大学社团认识';
    const backup = validateGraph(JSON.parse(JSON.stringify(graph)));
    expect(backup.people[1]).toMatchObject(graph.people[1]);
    expect(backup.relationships[0]).toMatchObject(graph.relationships[0]);
    expect(backup.memories[0]).toMatchObject(graph.memories[0]);
  });
  it('cascades deletion while retaining unrelated entities and the root', () => {
    const graph = graphWithFriend();
    graph.memories.push({ id: 'm2', personId: graph.rootPersonId, title: '我的生日' });
    const deleted = removePerson(graph, 'friend');
    expect(deleted.people.map(p => p.id)).toEqual([graph.rootPersonId]);
    expect(deleted.relationships).toEqual([]);
    expect(deleted.memories.map(m => m.id)).toEqual(['m2']);
    expect(graph.people).toHaveLength(2);
  });
  it('rejects self-connections and duplicate undirected labels while allowing distinct labels', () => {
    const g = graphWithFriend();
    expect(() => assertRelationship(g, g.rootPersonId, g.rootPersonId, '朋友')).toThrow();
    expect(() => assertRelationship(g, 'friend', g.rootPersonId, ' 朋友 ')).toThrow();
    expect(() => assertRelationship(g, 'friend', g.rootPersonId, '同学')).not.toThrow();
    expect(() => assertRelationship(g, 'friend', g.rootPersonId, '朋友', 'r1')).not.toThrow();
  });
  it.each([
    (g: GraphData) => { g.schemaVersion = 2 as 1; },
    (g: GraphData) => { g.rootPersonId = 'missing'; },
    (g: GraphData) => { g.people[1].position.x = Infinity; },
    (g: GraphData) => { g.people[1].name = '  '; },
    (g: GraphData) => { g.people[1].id = g.people[0].id; },
    (g: GraphData) => { g.relationships[0].targetId = 'missing'; },
    (g: GraphData) => { g.relationships[0].targetId = g.rootPersonId; },
    (g: GraphData) => { g.relationships.push({ ...g.relationships[0], id: 'r2' }); },
    (g: GraphData) => { g.memories[0].personId = 'missing'; },
    (g: GraphData) => { g.memories[0].date = '2025-02-30'; },
    (g: GraphData) => { g.memories.push({ ...g.memories[0] }); },
  ])('rejects corrupt backups before any write (%#)', corrupt => {
    const graph = graphWithFriend(); corrupt(graph);
    expect(() => validateGraph(graph)).toThrow();
  });
  it('allows namesakes identified by different IDs', () => {
    const g = graphWithFriend(); g.people[1].name = '我';
    expect(validateGraph(g).people).toHaveLength(2);
  });
});
describe('directional growth', () => {
  it('retains direction and distance when the candidate is free', () => {
    const g = createInitialGraph();
    expect(findOpenPosition({ x: 5, y: 2, z: -1 }, g.people, g.people[0].position)).toEqual({ x: 5, y: 2, z: -1 });
  });
  it('avoids a crowded candidate without changing existing or locked nodes', () => {
    const g = createInitialGraph();
    const neighbors: Person[] = Array.from({ length: 20 }, (_, i) => ({ ...g.people[0], id: `p${i}`, position: { x: 5 + Math.cos(i) * 2, y: Math.sin(i) * 2, z: (i % 3) - 1 }, positionLocked: true }));
    const people = [...g.people, ...neighbors], before = JSON.stringify(people);
    const result = findOpenPosition({ x: 5, y: 0, z: 0 }, people, g.people[0].position);
    expect(people.every(p => Math.hypot(p.position.x - result.x, p.position.y - result.y, p.position.z - result.z) >= MIN_NODE_DISTANCE)).toBe(true);
    expect(JSON.stringify(people)).toBe(before);
  });
  it('handles zero-length candidate without NaN or overlap', () => {
    const g = createInitialGraph();
    const result = findOpenPosition({ x: 0, y: 0, z: 0 }, g.people);
    expect(Number.isFinite(result.x)).toBe(true);
    expect(Math.hypot(result.x, result.y, result.z)).toBeGreaterThanOrEqual(MIN_NODE_DISTANCE);
  });
});
