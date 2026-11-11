/**
 * Scene setup: renderer, camera, controls, resize handling.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  canvas: HTMLCanvasElement;
}

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(8, 6, 8);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

export function createScene(container: HTMLElement): SceneContext {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x1a1a2e, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.02);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  camera.lookAt(DEFAULT_CAMERA_TARGET);

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.minDistance = 2;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.update();

  // Resize handler
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  // Ambient light (base)
  const ambient = new THREE.AmbientLight(0x404060, 0.4);
  scene.add(ambient);

  // Hemisphere light for natural outdoor feel
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0x444422, 0.3);
  scene.add(hemi);

  return { renderer, scene, camera, controls, canvas: renderer.domElement };
}

/** Reset camera to default position */
export function resetCamera(ctx: SceneContext): void {
  ctx.camera.position.copy(DEFAULT_CAMERA_POSITION);
  ctx.controls.target.copy(DEFAULT_CAMERA_TARGET);
  ctx.controls.update();
}

