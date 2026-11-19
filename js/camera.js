/**
 * Terraform — Camera, Orbit Controls, and Responsive Fit.
 * Solves Defect 3.2: Reliable camera fitting on all screen sizes, including 390×844 mobile portrait.
 * Accessibility: Keyboard-assisted orbit and zoom when canvas is focused.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const DEFAULT_CAMERA_POS = new THREE.Vector3(13, 11, 15);
export const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.5, 0);
export const VIEWPORT_CLEAR_COLOR = 0x323846;

/**
 * Initialize 3D PerspectiveCamera and OrbitControls.
 */
export function setupCameraAndControls(canvas, container) {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.2, 250);
  camera.position.copy(DEFAULT_CAMERA_POS);
  camera.lookAt(DEFAULT_CAMERA_TARGET);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.minDistance = 3;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.48; // Prevent looking from below ground level
  controls.update();

  /**
   * Fit camera view dynamically based on terrain bounds and canvas dimensions.
   */
  function fitToTerrain(terrainMesh, baseSkirtMesh = null, extraPadding = 1.25) {
    const box = new THREE.Box3();
    if (terrainMesh && terrainMesh.geometry) {
      box.expandByObject(terrainMesh);
    }
    if (baseSkirtMesh && baseSkirtMesh.geometry) {
      box.expandByObject(baseSkirtMesh);
    }

    if (box.isEmpty()) {
      camera.position.copy(DEFAULT_CAMERA_POS);
      controls.target.copy(DEFAULT_CAMERA_TARGET);
      controls.update();
      return;
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;
    const aspect = camera.aspect;

    // Distance required to fit vertically and horizontally
    const distVertical = (maxDim / 2) / Math.tan(fov / 2);
    const distHorizontal = (maxDim / 2) / (Math.tan(fov / 2) * aspect);
    let distance = Math.max(distVertical, distHorizontal) * extraPadding;

    // Ensure reasonable bounds
    distance = Math.max(12, Math.min(48, distance));

    // Direction vector from default elevated 3/4 angle
    const dir = new THREE.Vector3(13, 11, 15).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    controls.target.copy(center);
    controls.update();
  }

  /**
   * Reset camera to default three-quarter elevated view.
   */
  function resetCamera(terrainMesh = null, baseSkirtMesh = null) {
    if (terrainMesh) {
      fitToTerrain(terrainMesh, baseSkirtMesh);
    } else {
      camera.position.copy(DEFAULT_CAMERA_POS);
      controls.target.copy(DEFAULT_CAMERA_TARGET);
      controls.update();
    }
  }

  /**
   * Keyboard-assisted navigation for accessibility.
   */
  function handleKeyboardNav(e) {
    if (document.activeElement !== canvas) return;

    const orbitStep = 0.05;
    const zoomFactor = 1.1;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        controls.rotateLeft(orbitStep);
        controls.update();
        break;
      case 'ArrowRight':
        e.preventDefault();
        controls.rotateLeft(-orbitStep);
        controls.update();
        break;
      case 'ArrowUp':
        e.preventDefault();
        controls.rotateUp(orbitStep);
        controls.update();
        break;
      case 'ArrowDown':
        e.preventDefault();
        controls.rotateUp(-orbitStep);
        controls.update();
        break;
      case '+':
      case '=':
        e.preventDefault();
        controls.dollyIn(zoomFactor);
        controls.update();
        break;
      case '-':
      case '_':
        e.preventDefault();
        controls.dollyOut(zoomFactor);
        controls.update();
        break;
      case 'Home':
      case 'c':
      case 'C':
        e.preventDefault();
        resetCamera();
        break;
    }
  }

  canvas.addEventListener('keydown', handleKeyboardNav);

  return {
    camera,
    controls,
    fitToTerrain,
    resetCamera,
  };
}
