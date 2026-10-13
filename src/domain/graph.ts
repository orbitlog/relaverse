import type { GraphData, Person, Relationship, SharedMemory } from '../types/graph';

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function createInitialGraph(): GraphData {
  const id = uid();
  return {
    schemaVersion: 1,
    rootPersonId: id,
    people: [{ id, name: '我', description: '每一个相遇，都让我的宇宙更辽阔。', position: { x: 0, y: 0, z: 0 }, createdAt: now(), updatedAt: now() }],
    relationships: [], memories: [],
  };
}
export function samePair(a: Relationship, sourceId: string, targetId: string) {
  return (a.sourceId === sourceId && a.targetId === targetId) || (a.sourceId === targetId && a.targetId === sourceId);
}
export function assertRelationship(graph: GraphData, sourceId: string, targetId: string, label: string, ignoreId?: string) {
  if (!label.trim()) throw new Error('请填写关系名称。');
  if (sourceId === targetId) throw new Error('不能与自己建立关系。');
  if (![sourceId, targetId].every(id => graph.people.some(p => p.id === id))) throw new Error('关联的人物不存在。');
  if (graph.relationships.some(r => r.id !== ignoreId && samePair(r, sourceId, targetId) && r.label === label.trim())) throw new Error('这两个人之间已经有同名关系。');
}
export function removePerson(graph: GraphData, personId: string): GraphData {
  if (personId === graph.rootPersonId) throw new Error('「我」是宇宙的起点，无法删除。');
  return { ...graph, people: graph.people.filter(p => p.id !== personId), relationships: graph.relationships.filter(r => r.sourceId !== personId && r.targetId !== personId), memories: graph.memories.filter(m => m.personId !== personId) };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('备份中存在无效的数据对象。');
  return value as Record<string, unknown>;
}
function str(value: unknown, field: string, required = false): string {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || value.length > 20000 || (required && !value.trim())) throw new Error(`备份字段「${field}」无效。`);
  return required ? value.trim() : value;
}
function date(value: unknown): string {
  const s = str(value, '日期');
  if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)) throw new Error('备份中的日期格式无效。');
  return s;
}
function timestamp(value: unknown): string {
  const s = str(value, '创建或修改时间', true);
  if (!Number.isFinite(Date.parse(s))) throw new Error('备份中的时间格式无效。');
  return s;
}
function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length > 10000) throw new Error(`备份中的「${field}」无效或数量过多。`);
  return value;
}
function uniqueIds(items: { id: string }[]) {
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('备份中存在重复 ID。');
}
export function validateGraph(input: unknown): GraphData {
  const raw = record(input);
  if (raw.schemaVersion !== 1) throw new Error('不支持的备份版本，需要 schemaVersion: 1。');
  const rootPersonId = str(raw.rootPersonId, '根人物 ID', true);
  const people: Person[] = list(raw.people, '人物').map(item => {
    const p = record(item), pos = record(p.position);
    if (![pos.x, pos.y, pos.z].every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000)) throw new Error('人物的三维坐标无效。');
    if (p.positionLocked !== undefined && typeof p.positionLocked !== 'boolean') throw new Error('位置锁定字段无效。');
    return { id: str(p.id, '人物 ID', true), name: str(p.name, '姓名', true), description: str(p.description, '简介'), howWeMet: str(p.howWeMet, '如何认识'), metAt: date(p.metAt), metPlace: str(p.metPlace, '认识地点'), city: str(p.city, '所在城市'), notes: str(p.notes, '备注'), position: { x: pos.x as number, y: pos.y as number, z: pos.z as number }, positionLocked: p.positionLocked as boolean | undefined, createdAt: timestamp(p.createdAt), updatedAt: timestamp(p.updatedAt) };
  });
  uniqueIds(people);
  if (!people.some(p => p.id === rootPersonId)) throw new Error('备份缺少根人物。');
  const relationships: Relationship[] = list(raw.relationships, '关系').map(item => {
    const r = record(item);
    return { id: str(r.id, '关系 ID', true), sourceId: str(r.sourceId, '来源 ID', true), targetId: str(r.targetId, '目标 ID', true), label: str(r.label, '关系名称', true), description: str(r.description, '关系说明'), createdAt: timestamp(r.createdAt) };
  });
  uniqueIds(relationships);
  const memories: SharedMemory[] = list(raw.memories, '共同经历').map(item => {
    const m = record(item);
    const personId = str(m.personId, '经历人物 ID', true);
    if (!people.some(p => p.id === personId)) throw new Error('经历关联的人物不存在。');
    return { id: str(m.id, '经历 ID', true), personId, title: str(m.title, '经历标题', true), date: date(m.date), description: str(m.description, '经历描述') };
  });
  uniqueIds(memories);
  const graph: GraphData = { schemaVersion: 1, rootPersonId, people, relationships: [], memories };
  relationships.forEach(r => { assertRelationship(graph, r.sourceId, r.targetId, r.label); graph.relationships.push(r); });
  return graph;
}
