/**
 * Translucent water plane.
 */

import * as THREE from 'three';
import { TERRAIN_SIZE, WaterParams, DEFAULT_WATER_PARAMS } from '../core/types';

export interface WaterContext {
  mesh: THREE.Mesh;
  update: (params: WaterParams, heightScale: number) => void;
}

export function createWater(scene: THREE.Scene): WaterContext {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE * 1.2, TERRAIN_SIZE * 1.2, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: 0x3388bb,
    transparent: true,
    opacity: DEFAULT_WATER_PARAMS.opacity,
    roughness: 0.1,
    metalness: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  scene.add(mesh);

  const update = (params: WaterParams, heightScale: number) => {
    mesh.visible = params.enabled;
    mesh.position.y = params.level * heightScale;
    (mesh.material as THREE.MeshStandardMaterial).opacity = params.opacity;
  };

  update(DEFAULT_WATER_PARAMS, DEFAULT_WATER_PARAMS.level);

  return { mesh, update };
}

