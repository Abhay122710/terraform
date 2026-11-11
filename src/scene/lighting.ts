/**
 * Lighting: directional sun with shadow mapping.
 */

import * as THREE from 'three';
import { LightParams, DEFAULT_LIGHT_PARAMS } from '../core/types';

export interface LightingContext {
  sun: THREE.DirectionalLight;
  update: (params: LightParams) => void;
}

export function createLighting(scene: THREE.Scene): LightingContext {
  const sun = new THREE.DirectionalLight(0xfff5e6, DEFAULT_LIGHT_PARAMS.intensity);
  sun.castShadow = true;

  // Shadow camera settings
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;

  scene.add(sun);
  scene.add(sun.target);

  const update = (params: LightParams) => {
    const azRad = (params.azimuth * Math.PI) / 180;
    const elRad = (params.elevation * Math.PI) / 180;
    const dist = 15;

    sun.position.set(
      dist * Math.cos(elRad) * Math.sin(azRad),
      dist * Math.sin(elRad),
      dist * Math.cos(elRad) * Math.cos(azRad)
    );
    sun.target.position.set(0, 0, 0);
    sun.intensity = params.intensity;
    sun.castShadow = params.shadowEnabled;

    // Update fog
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = params.fogDensity;
    }
  };

  // Apply defaults
  update(DEFAULT_LIGHT_PARAMS);

  return { sun, update };
}

