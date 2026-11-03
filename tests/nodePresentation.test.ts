import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { getNodeScale } from '../src/components/scene/nodePresentation';

function projectedDiameter(camera: PerspectiveCamera, center: Vector3, radius: number, width: number) {
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  return Math.abs(center.clone().addScaledVector(right, radius).project(camera).x - center.clone().project(camera).x) * width;
}

describe('person visibility while zooming', () => {
  it('keeps distant people readable at the view distance that hid them behind the + button', () => {
    const camera = new PerspectiveCamera(45, 986 / 488, 0.1, 2000);
    camera.position.set(41.22, 34.24, 186.51);
    camera.lookAt(41.22, 20, 0);
    camera.updateMatrixWorld();
    const center = new Vector3(25.13, 15.08, -2.14);
    for (const [radius, minimum] of [[0.95, 64], [0.62, 48]]) {
      expect(projectedDiameter(camera, center, radius, 986)).toBeLessThan(10);
      const scale = getNodeScale(camera, center, radius, 986, minimum);
      expect(projectedDiameter(camera, center, radius * scale, 986)).toBeCloseTo(minimum);
    }
  });

  it('preserves the natural size of a person in a close view', () => {
    const camera = new PerspectiveCamera(45, 986 / 488, 0.1, 2000);
    camera.position.set(0, 1, 9);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    expect(getNodeScale(camera, new Vector3(), 0.95, 986, 64)).toBe(1);
    expect(getNodeScale(camera, new Vector3(), 0.62, 986, 48)).toBe(1);
  });

  it('maintains the same minimum size after resizing the viewport', () => {
    const center = new Vector3();
    for (const width of [360, 1280]) {
      const camera = new PerspectiveCamera(45, width / 600, 0.1, 2000);
      camera.position.set(0, 0, 1000);
      camera.updateMatrixWorld();
      const scale = getNodeScale(camera, center, 0.62, width, 48);
      expect(projectedDiameter(camera, center, 0.62 * scale, width)).toBeCloseTo(48);
    }
  });
});
