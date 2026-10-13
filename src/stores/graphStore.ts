import { create } from 'zustand';
import type { ConnectionDraft, GraphData, Person, Relationship, SharedMemory, Vector3Data, ViewPreferences } from '../types/graph';
import { assertRelationship, createInitialGraph, now, removePerson, uid } from '../domain/graph';
import { findOpenPosition } from '../domain/layout';
import { loadUniverse, saveUniverse } from '../storage/indexedDb';

interface GraphState {
  graph: GraphData;
  ready: boolean;
  selectedId: string | null;
  focusedId: string | null;
  focusNonce: number;
  draft: ConnectionDraft | null;
  view: ViewPreferences;
  saveStatus: 'saved' | 'saving' | 'error';
  notice: string | null;
  initialize: () => Promise<void>;
  select: (id: string | null) => void;
  focus: (id: string | null) => void;
  setDraft: (draft: ConnectionDraft | null) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  movePerson: (id: string, position: Vector3Data) => void;
  createConnection: (name: string, label: string) => void;
  deletePerson: (id: string) => void;
  updateRelationship: (id: string, label: string, description: string) => void;
  deleteRelationship: (id: string) => void;
  saveMemory: (memory: SharedMemory) => void;
  deleteMemory: (id: string) => void;
  replaceGraph: (graph: GraphData) => void;
  setView: (patch: Partial<ViewPreferences>) => void;
  notify: (message: string | null) => void;
  retrySave: () => void;
}
let scheduled = false;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let loading: Promise<void> | undefined;
let sequence = 0;
let writeQueue = Promise.resolve();
function persist() {
  ++sequence;
  useGraphStore.setState({ saveStatus: 'saving' });
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const revision = sequence;
    const { graph, view } = useGraphStore.getState();
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      try {
        await saveUniverse(graph, view);
        if (revision === sequence) useGraphStore.setState({ saveStatus: 'saved' });
      } catch {
        useGraphStore.setState({ saveStatus: 'error' });
        useGraphStore.getState().notify('本地保存失败，请导出备份或点击重试。');
      }
    });
  });
}
function commit(graph: GraphData) { useGraphStore.setState({ graph }); persist(); }

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: createInitialGraph(), ready: false, selectedId: null, focusedId: null, focusNonce: 0, draft: null,
  view: { camera: [0, 2, 17], target: [0, 0, 0], showLabels: true },
  saveStatus: 'saved', notice: null,
  initialize: () => {
    if (!loading) loading = (async () => {
      try {
        const saved = await loadUniverse();
        const graph = saved.graph ?? get().graph;
        set({ graph, view: saved.view ?? get().view, ready: true, selectedId: graph.rootPersonId });
        if (!saved.graph) persist();
      } catch {
        set({ ready: true, selectedId: get().graph.rootPersonId, saveStatus: 'error' });
        get().notify('无法读取本地数据。请保留备份，并检查浏览器的存储权限。');
      }
    })();
    return loading;
  },
  select: selectedId => set({ selectedId }),
  focus: focusedId => set(s => ({ focusedId, focusNonce: s.focusNonce + 1, selectedId: focusedId ?? s.selectedId })),
  setDraft: draft => set({ draft }),
  updatePerson: (id, patch) => {
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('姓名不能为空。');
    commit({ ...get().graph, people: get().graph.people.map(p => p.id === id ? { ...p, ...patch, id: p.id, name: patch.name?.trim() ?? p.name, updatedAt: now() } : p) });
  },
  movePerson: (id, position) => get().updatePerson(id, { position, positionLocked: true }),
  createConnection: (name, label) => {
    const { graph, draft } = get();
    if (!draft) return;
    const targetId = draft.targetId ?? uid();
    if (!draft.targetId && !name.trim()) throw new Error('请填写人物姓名。');
    const source = graph.people.find(p => p.id === draft.sourceId)!;
    const person: Person = { id: targetId, name: name.trim(), position: findOpenPosition(draft.position, graph.people, source.position), createdAt: now(), updatedAt: now() };
    const next = { ...graph, people: draft.targetId ? graph.people : [...graph.people, person] };
    assertRelationship(next, draft.sourceId, targetId, label);
    commit({ ...next, relationships: [...graph.relationships, { id: uid(), sourceId: draft.sourceId, targetId, label: label.trim(), createdAt: now() }] });
    set({ draft: null, selectedId: targetId });
    get().notify(draft.targetId ? '新的关系已连接' : `${person.name} 已加入你的宇宙`);
  },
  deletePerson: id => {
    commit(removePerson(get().graph, id));
    set({ selectedId: get().graph.rootPersonId });
    if (get().focusedId === id) get().focus(null);
    get().notify('人物及其关联关系、经历已删除');
  },
  updateRelationship: (id, label, description) => {
    const graph = get().graph, relation = graph.relationships.find(r => r.id === id);
    if (!relation) return;
    assertRelationship(graph, relation.sourceId, relation.targetId, label, id);
    commit({ ...graph, relationships: graph.relationships.map(r => r.id === id ? { ...r, label: label.trim(), description } : r) });
  },
  deleteRelationship: id => commit({ ...get().graph, relationships: get().graph.relationships.filter(r => r.id !== id) }),
  saveMemory: memory => {
    if (!memory.title.trim()) throw new Error('请填写经历标题。');
    if (!get().graph.people.some(p => p.id === memory.personId)) throw new Error('人物不存在。');
    commit({ ...get().graph, memories: [...get().graph.memories.filter(m => m.id !== memory.id), { ...memory, title: memory.title.trim() }] });
  },
  deleteMemory: id => commit({ ...get().graph, memories: get().graph.memories.filter(m => m.id !== id) }),
  replaceGraph: graph => { commit(graph); set({ selectedId: graph.rootPersonId, focusedId: null, draft: null }); get().focus(null); get().notify('备份已导入，欢迎回到你的宇宙'); },
  setView: patch => { set({ view: { ...get().view, ...patch } }); persist(); },
  notify: notice => { clearTimeout(noticeTimer); set({ notice }); if (notice) noticeTimer = setTimeout(() => set({ notice: null }), 5000); },
  retrySave: persist,
}));

// Export always uses the in-memory graph, including edits waiting to be persisted.
export function exportGraph() {
  const graph = useGraphStore.getState().graph;
  const url = URL.createObjectURL(new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `relaverse-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
