/**
 * Raycaster-based hover readout: height, slope, world position.
 */

import * as THREE from 'three';
import { getFaceSlope } from '../shading/analysis';
import { TERRAIN_SIZE } from '../core/types';

export interface ReadoutData {
  height: number; // normalized 0..1
  slope: number; // degrees
  worldPos: THREE.Vector3;
}

let readoutEl: HTMLElement | null = null;

function ensureReadoutEl(): HTMLElement {
  if (!readoutEl) {
    readoutEl = document.createElement('div');
    readoutEl.id = 'readout';
    document.body.appendChild(readoutEl);
  }
  return readoutEl;
}

export function setupRaycaster(
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  getTerrainMesh: () => THREE.Mesh | null,
  heightScale: () => number
): void {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const el = ensureReadoutEl();

  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const mesh = getTerrainMesh();
    if (!mesh) {
      el.classList.remove('visible');
      return;
    }

    const intersects = raycaster.intersectObject(mesh);
    if (intersects.length === 0) {
      el.classList.remove('visible');
      return;
    }

    const hit = intersects[0];
    const point = hit.point;
    const faceIdx = hit.faceIndex ?? 0;
    const hScale = heightScale();

    const normalizedHeight = Math.max(0, Math.min(1, point.y / Math.max(hScale, 0.001)));
    const slope = getFaceSlope(mesh.geometry, faceIdx);

    el.classList.add('visible');
    el.innerHTML = `
      <div>Height: <strong>${normalizedHeight.toFixed(3)}</strong></div>
      <div>Slope: <strong>${slope.toFixed(1)}°</strong></div>
      <div>Pos: <strong>${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}</strong></div>
    `;
  });

  canvas.addEventListener('mouseleave', () => {
    el.classList.remove('visible');
  });
}

