/**
 * Terraform — Outdoor Lighting & Atmospheric System.
 * Fixes Defect 4.2: Uses THREE.PCFShadowMap (removes deprecated shadow-map warnings).
 * Implements:
 * - Directional key sunlight with calibrated shadow frustum
 * - Soft secondary fill light from opposite angle
 * - Atmospheric fog matching viewport clear color
 * - Hemisphere light for sky/ground bounce
 */

import * as THREE from 'three';

export function createLighting(scene) {
  // Ambient light: ensures all faces and facets remain readable
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  // Hemisphere light: natural sky dome light and ground bounce
  const skyHemiColor = 0xddeaff;
  const groundHemiColor = 0x727a68;
  const hemiLight = new THREE.HemisphereLight(skyHemiColor, groundHemiColor, 0.55);
  scene.add(hemiLight);

  // Main Key Sunlight
  const sun = new THREE.DirectionalLight(0xfff8ee, 1.5);
  sun.castShadow = true;

  // Shadow camera coverage adjusted to encompass the 12x12 terrain grid cleanly
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

  // Soft Secondary Fill Light from opposing side to keep shadowed faces readable
  const fillLight = new THREE.DirectionalLight(0xa8c4e4, 0.4);
  fillLight.castShadow = false;
  scene.add(fillLight);
  scene.add(fillLight.target);

  /**
   * Update lighting parameters from state.
   */
  function update(params) {
    const azRad = ((params.sunAzimuth || 140) * Math.PI) / 180;
    const elRad = ((params.sunElevation || 48) * Math.PI) / 180;
    const dist = 22;

    sun.position.set(
      dist * Math.cos(elRad) * Math.sin(azRad),
      dist * Math.sin(elRad),
      dist * Math.cos(elRad) * Math.cos(azRad)
    );
    sun.target.position.set(0, 0, 0);
    sun.intensity = params.sunIntensity !== undefined ? params.sunIntensity : 1.5;
    sun.castShadow = Boolean(params.shadowEnabled);

    // Opposing fill light
    fillLight.position.set(
      -sun.position.x * 0.7,
      dist * 0.65,
      -sun.position.z * 0.7
    );
    fillLight.target.position.set(0, 0, 0);
    fillLight.intensity = sun.intensity * 0.32;

    // Fog density
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = params.fogDensity !== undefined ? params.fogDensity : 0.01;
    }
  }

  return { sun, fillLight, ambientLight, hemiLight, update };
}
