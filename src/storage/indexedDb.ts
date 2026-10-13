import { openDB } from 'idb';
import type { GraphData, ViewPreferences } from '../types/graph';
import { validateGraph } from '../domain/graph';

let connection: ReturnType<typeof openDB> | undefined;
const database = () => connection ??= openDB('relaverse', 1, {
  upgrade(db) { db.createObjectStore('universe'); },
});
export async function loadUniverse(): Promise<{ graph?: GraphData; view?: ViewPreferences }> {
  const db = await database();
  const stored = await db.get('universe', 'graph');
  const view = await db.get('universe', 'view');
  const validVector = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every(v => typeof v === 'number' && Number.isFinite(v));
  return { graph: stored ? validateGraph(stored) : undefined, view: view && validVector(view.camera) && validVector(view.target) && typeof view.showLabels === 'boolean' ? view : undefined };
}
export async function saveUniverse(graph: GraphData, view: ViewPreferences) {
  const db = await database();
  const tx = db.transaction('universe', 'readwrite');
  await Promise.all([tx.store.put(graph, 'graph'), tx.store.put(view, 'view')]);
  await tx.done;
}
