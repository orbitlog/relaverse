import type { Person, Vector3Data } from '../types/graph';

export const MIN_NODE_DISTANCE = 2.5;
export function findOpenPosition(candidate: Vector3Data, people: Person[], source?: Vector3Data): Vector3Data {
  const origin = source ?? { x: 0, y: 0, z: 0 };
  const delta = { x: candidate.x - origin.x, y: candidate.y - origin.y, z: candidate.z - origin.z };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  const scale = length < 3.5 ? 3.5 / (length || 1) : 1;
  const base = length ? { x: origin.x + delta.x * scale, y: origin.y + delta.y * scale, z: origin.z + delta.z * scale } : { x: origin.x + 3.5, y: origin.y, z: origin.z };
  const free = (p: Vector3Data) => people.every(n => Math.hypot(n.position.x - p.x, n.position.y - p.y, n.position.z - p.z) >= MIN_NODE_DISTANCE);
  if (free(base)) return base;
  // Search progressively larger spheres, leaving all existing nodes untouched.
  for (let radius = 0.8; radius <= 200; radius += 0.8) {
    for (let i = 0; i < 48; i++) {
      const y = 1 - 2 * ((i + 0.5) / 48), angle = i * 2.399963229728653;
      const r = Math.sqrt(1 - y * y);
      const point = { x: base.x + Math.cos(angle) * r * radius, y: base.y + y * radius, z: base.z + Math.sin(angle) * r * radius };
      if (free(point)) return point;
    }
  }
  // Guaranteed escape beyond the finite graph's bounding volume.
  return { x: Math.max(...people.map(p => p.position.x), base.x) + MIN_NODE_DISTANCE, y: base.y, z: base.z };
}
