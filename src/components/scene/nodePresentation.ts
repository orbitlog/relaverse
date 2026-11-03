import { Vector3, type Camera } from 'three';

// Keep people readable when the camera pulls back to fit a large relationship graph.
export function getNodeScale(camera: Camera, center: Vector3, radius: number, viewportWidth: number, minDiameter: number): number {
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const projectedCenter = center.clone().project(camera);
  const projectedEdge = center.clone().addScaledVector(right, radius).project(camera);
  const diameter = Math.abs(projectedEdge.x - projectedCenter.x) * viewportWidth;
  return Math.max(1, minDiameter / Math.max(diameter, 0.001));
}
