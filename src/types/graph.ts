export interface Vector3Data { x: number; y: number; z: number }
export interface Person {
  id: string;
  name: string;
  description?: string;
  howWeMet?: string;
  metAt?: string;
  metPlace?: string;
  city?: string;
  notes?: string;
  position: Vector3Data;
  positionLocked?: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  description?: string;
  createdAt: string;
}
export interface SharedMemory {
  id: string;
  personId: string;
  title: string;
  date?: string;
  description?: string;
}
export interface GraphData {
  schemaVersion: 1;
  rootPersonId: string;
  people: Person[];
  relationships: Relationship[];
  memories: SharedMemory[];
}
export interface ViewPreferences {
  camera: [number, number, number];
  target: [number, number, number];
  showLabels: boolean;
}
export interface ConnectionDraft {
  sourceId: string;
  targetId?: string;
  position: Vector3Data;
}
