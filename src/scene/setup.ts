/**
 * Scene setup: renderer, camera, controls, neutral aesthetic viewport, resize handling.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  canvas: HTMLCanvasElement;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
}

// Elevated 3/4 perspective camera displaying the entire 12x12 terrain cleanly
export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(13, 11, 15);
export const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.5, 0);

// Neutral, clear sky viewport background (#323846) providing sharp contrast against green & rock
export const VIEWPORT_CLEAR_COLOR = 0x323846;
export const SKY_HEMI_COLOR = 0xddeaff;
export const GROUND_HEMI_COLOR = 0x727a68;

export function createScene(container: HTMLElement): SceneContext {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(VIEWPORT_CLEAR_COLOR, 1.0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VIEWPORT_CLEAR_COLOR);

  // Atmospheric fog matching the viewport clear color
  scene.fog = new THREE.FogExp2(VIEWPORT_CLEAR_COLOR, 0.01);

  // Camera: elevated three-quarter view, 45 FOV, broad depth clipping
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.2,
    200
  );
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  camera.lookAt(DEFAULT_CAMERA_TARGET);

  // Controls: Orbit, Pan, Zoom with smooth damping
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.minDistance = 3;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.48; // Prevent camera flipping below ground
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

  // Ambient light: ensures all faces and shadows remain readable
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  // Hemisphere light: natural sky dome light and ground bounce
  const hemiLight = new THREE.HemisphereLight(SKY_HEMI_COLOR, GROUND_HEMI_COLOR, 0.55);
  scene.add(hemiLight);

  return {
    renderer,
    scene,
    camera,
    controls,
    canvas: renderer.domElement,
    ambientLight,
    hemiLight,
  };
}

/** Reset camera to default three-quarter elevated perspective */
export function resetCamera(ctx: SceneContext): void {
  ctx.camera.position.copy(DEFAULT_CAMERA_POSITION);
  ctx.controls.target.copy(DEFAULT_CAMERA_TARGET);
  ctx.controls.update();
}
