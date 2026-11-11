/**
 * Lighting: directional sun with soft PCF shadows and balanced fill light.
 */

import * as THREE from 'three';
import { LightParams, DEFAULT_LIGHT_PARAMS } from '../core/types';

export interface LightingContext {
  sun: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  update: (params: LightParams) => void;
}

export function createLighting(scene: THREE.Scene): LightingContext {
  // Main Key Sunlight
  const sun = new THREE.DirectionalLight(0xfff8ee, DEFAULT_LIGHT_PARAMS.intensity);
  sun.castShadow = true;

  // Shadow camera coverage adjusted to encompass the full 12x12 terrain grid cleanly
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03; // Prevents shadow acne on low-poly facets

  scene.add(sun);
  scene.add(sun.target);

  // Soft Secondary Fill Light from the opposite side to keep shadowed mountain faces readable
  const fillLight = new THREE.DirectionalLight(0xa8c4e4, 0.4);
  fillLight.castShadow = false;
  scene.add(fillLight);
  scene.add(fillLight.target);

  const update = (params: LightParams) => {
    const azRad = (params.azimuth * Math.PI) / 180;
    const elRad = (params.elevation * Math.PI) / 180;
    const dist = 22;

    sun.position.set(
      dist * Math.cos(elRad) * Math.sin(azRad),
      dist * Math.sin(elRad),
      dist * Math.cos(elRad) * Math.cos(azRad)
    );
    sun.target.position.set(0, 0, 0);
    sun.intensity = params.intensity;
    sun.castShadow = params.shadowEnabled;

    // Fill light from opposing horizontal angle
    fillLight.position.set(
      -sun.position.x * 0.7,
      dist * 0.65,
      -sun.position.z * 0.7
    );
    fillLight.target.position.set(0, 0, 0);
    fillLight.intensity = params.intensity * 0.32;

    // Fog density
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = params.fogDensity;
    }
  };

  update(DEFAULT_LIGHT_PARAMS);

  return { sun, fillLight, update };
}
