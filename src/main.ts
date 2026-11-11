/**
 * Terraform — Main entry point.
 * Complete 3D low-poly terrain generator from uploaded elevation maps,
 * grayscale heightmaps, and geographic heatmaps.
 */

import * as THREE from 'three';
import { createScene, resetCamera, SceneContext } from './scene/setup';
import { createLighting, LightingContext } from './scene/lighting';
import { buildTerrainGeometry } from './mesh/lowpoly';
import { createWater, WaterContext } from './mesh/water';
import { HeightField } from './core/heightfield';
import {
  TERRAIN_SIZE,
  DEFAULT_TERRAIN_PARAMS,
  DEFAULT_LIGHT_PARAMS,
  DEFAULT_WATER_PARAMS,
  WorkerRequest,
  WorkerResponse,
} from './core/types';
import { applyTerrainColours } from './shading/terrain-colors';
import { applyAnalysisColours } from './shading/analysis';
import { updateLegend } from './shading/legend';
import { createToolbar, getDefaultState, ToolbarState } from './ui/toolbar';
import { setupDropzone, showToast } from './ui/dropzone';
import { showGenerating, hideGenerating } from './ui/indicator';
import { setupRaycaster } from './scene/raycaster';
import { setupShortcuts } from './ui/shortcuts';
import { UndoStack } from './ui/undo';
import { loadFile } from './loaders/index';
import { decodePixelElevation } from './loaders/image-loader';
import { captureScreenshot } from './export/screenshot';
import { exportHeightmapPNG } from './export/heightmap-export';
import { exportOBJ, exportGLB } from './export/mesh-export';
import TerrainWorker from './workers/terrain.worker.ts?worker';
import './style.css';

// ─── Application State ──────────────────────────────────────────
let sceneCtx: SceneContext;
let lighting: LightingContext;
let water: WaterContext;
let terrainMesh: THREE.Mesh | null = null;
let wireframeOverlay: THREE.LineSegments | null = null;
let currentHeightfield: HeightField;
let state: ToolbarState;
let gui: ReturnType<typeof createToolbar>;
let fileInput: HTMLElement;

// Worker
let worker: Worker;
let requestId = 0;
let pendingRequestId = -1;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Loaded file data
let rawImageCache: ImageData | null = null;
let loadedData: Float32Array | null = null;
let loadedWidth = 0;
let loadedHeight = 0;
let loadedFileName: string = '';

// Undo/Redo
const undoStack = new UndoStack<ToolbarState>();

// ─── Initialize ─────────────────────────────────────────────────
function init() {
  const container = document.getElementById('viewport')!;

  // Scene
  sceneCtx = createScene(container);
  lighting = createLighting(sceneCtx.scene);
  water = createWater(sceneCtx.scene);

  // Title overlay
  const title = document.createElement('div');
  title.id = 'title-overlay';
  title.innerHTML = '<h1>Terraform</h1><p>Low-Poly Mountainous Terrain Generator</p>';
  document.body.appendChild(title);

  // Worker
  worker = new TerrainWorker();
  worker.onmessage = onWorkerMessage;

  // State
  state = getDefaultState();
  undoStack.push(state);

  // Toolbar
  gui = createToolbar(state, {
    onTerrainChange: () => debouncedGenerate(),
    onMeshChange: () => rebuildMesh(),
    onViewChange: () => updateView(),
    onLightChange: () => lighting.update(state.light),
    onWaterChange: () => updateWater(),
    onElevationModeChange: () => redecodeImageMap(),
    onRandomize: randomizeSeed,
    onReset: resetAll,
    onLoadFile: () => (fileInput as HTMLInputElement).click(),
    onClearFile: clearLoadedData,
    onExportPNG: doExportPNG,
    onExportHeightmap: doExportHeightmap,
    onExportOBJ: doExportOBJ,
    onExportGLB: doExportGLB,
    onSaveSettings: saveSettings,
    onLoadSettings: loadSettings,
    onResetCamera: () => resetCamera(sceneCtx),
    onAutoRotateToggle: () => {
      sceneCtx.controls.autoRotate = state.autoRotate;
    },
  });

  // Dropzone
  const dropInput = setupDropzone({
    onFile: handleFileLoad,
    onError: (msg) => showToast(msg),
  });
  fileInput = dropInput;

  // Raycaster readout
  setupRaycaster(
    sceneCtx.camera,
    sceneCtx.canvas,
    () => terrainMesh,
    () => getHeightScale()
  );

  // Keyboard shortcuts
  setupShortcuts({
    randomize: randomizeSeed,
    exportPng: doExportPNG,
    toggleAutoRotate: () => {
      state.autoRotate = !state.autoRotate;
      sceneCtx.controls.autoRotate = state.autoRotate;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
    undo: doUndo,
    redo: doRedo,
  });

  // Automatically load bundled sample heightmap if available, or generate mountainous terrain
  loadDefaultSample();

  // Render loop
  animate();
}

/** Preload sample mountain elevation map to showcase capabilities immediately */
async function loadDefaultSample() {
  try {
    const res = await fetch('/samples/heightmap.png');
    if (res.ok) {
      const blob = await res.blob();
      const file = new File([blob], 'mountain-sample.png', { type: 'image/png' });
      await handleFileLoad(file);
      return;
    }
  } catch {
    // Fall back to pure procedural ridged mountain range
  }
  requestGeneration();
}

// ─── Worker Communication ───────────────────────────────────────
function requestGeneration() {
  const id = ++requestId;
  pendingRequestId = id;
  showGenerating();

  const req: WorkerRequest = {
    id,
    resolution: state.terrain.resolution,
    noise: { ...state.terrain.noise },
    shape: { ...state.terrain.shape },
    erosion: { ...state.terrain.erosion },
    detail: { ...state.terrain.detail },
    blendFactor: state.terrain.blendFactor,
    normalizeElevation: state.terrain.normalizeElevation,
    inputData: loadedData ? new Float32Array(loadedData) : null,
    inputWidth: loadedWidth,
    inputHeight: loadedHeight,
  };

  const transferables: Transferable[] = [];
  if (req.inputData) {
    transferables.push(req.inputData.buffer);
  }

  worker.postMessage(req, transferables);
}

function onWorkerMessage(e: MessageEvent<WorkerResponse>) {
  const resp = e.data;
  if (resp.id !== pendingRequestId) return;

  hideGenerating();
  currentHeightfield = new HeightField(resp.resolution, resp.heightfield);
  rebuildMesh();

  undoStack.push(JSON.parse(JSON.stringify(state)));
}

function debouncedGenerate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => requestGeneration(), 100);
}

// ─── Mesh Building ──────────────────────────────────────────────
function getHeightScale(): number {
  return state.terrain.shape.heightScale * (TERRAIN_SIZE / 2.8);
}

function rebuildMesh() {
  if (!currentHeightfield) return;

  // Dispose old mesh
  if (terrainMesh) {
    sceneCtx.scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    (terrainMesh.material as THREE.Material).dispose();
  }
  if (wireframeOverlay) {
    sceneCtx.scene.remove(wireframeOverlay);
    wireframeOverlay.geometry.dispose();
    (wireframeOverlay.material as THREE.Material).dispose();
    wireframeOverlay = null;
  }

  const heightScale = getHeightScale();

  const geometry = buildTerrainGeometry(currentHeightfield, {
    segments: state.terrain.resolution,
    heightScale,
    flatShading: state.view.flatShading,
    jitter: state.view.jitter,
    jitterSeed: state.terrain.noise.seed,
  });

  applyColouring(geometry, heightScale);

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: state.view.flatShading,
    roughness: 0.82,
    metalness: 0.08,
    side: THREE.FrontSide,
  });

  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  sceneCtx.scene.add(terrainMesh);

  if (state.view.mode === 'wireframe') {
    addWireframeOverlay();
  }

  updateWater();
}

function applyColouring(geometry: THREE.BufferGeometry, heightScale: number) {
  const mode = state.view.mode;

  if (mode === 'shaded' || mode === 'wireframe') {
    applyTerrainColours(geometry, {
      palette: state.palette,
      steepnessThreshold: state.steepnessThreshold,
      heightScale,
    });
  } else {
    applyAnalysisColours(geometry, mode, heightScale, state.view.contourInterval);
  }

  updateLegend(mode);
}

function addWireframeOverlay() {
  if (!terrainMesh) return;
  const wireGeo = new THREE.WireframeGeometry(terrainMesh.geometry);
  const wireMat = new THREE.LineBasicMaterial({
    color: 0x000000,
    opacity: 0.28,
    transparent: true,
  });
  wireframeOverlay = new THREE.LineSegments(wireGeo, wireMat);
  sceneCtx.scene.add(wireframeOverlay);
}

function updateView() {
  rebuildMesh();
}

function updateWater() {
  water.update(state.water, getHeightScale());
}

// ─── File Loading & Decoding ────────────────────────────────────
async function handleFileLoad(file: File) {
  try {
    showGenerating();
    const result = await loadFile(file, state.terrain.resolution, state.terrain.elevationMode);
    loadedData = result.data;
    loadedWidth = result.width;
    loadedHeight = result.height;
    loadedFileName = file.name;
    rawImageCache = result.rawImageData ?? null;

    // By default when uploading a map: preserve exact map structure (blend = 0.0)
    state.terrain.blendFactor = 0.0;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    showToast(`Loaded "${file.name}" (${result.width}×${result.height})`, false);
    requestGeneration();
  } catch (err) {
    hideGenerating();
    showToast((err as Error).message);
  }
}

/** If user switches between Luminance / Rainbow Heatmap / Turbo, re-decode cached image */
function redecodeImageMap() {
  if (!rawImageCache) {
    debouncedGenerate();
    return;
  }
  const pixels = rawImageCache.data;
  const w = rawImageCache.width;
  const h = rawImageCache.height;
  const data = new Float32Array(w * h);
  const mode = state.terrain.elevationMode;

  for (let i = 0; i < data.length; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    data[i] = decodePixelElevation(r, g, b, mode);
  }

  loadedData = data;
  loadedWidth = w;
  loadedHeight = h;
  showToast(`Decoded with "${mode}" mapping`, false);
  requestGeneration();
}

function clearLoadedData() {
  loadedData = null;
  rawImageCache = null;
  loadedWidth = 0;
  loadedHeight = 0;
  loadedFileName = '';
  state.terrain.blendFactor = 1.0;
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  requestGeneration();
  showToast('Loaded map cleared', false);
}

// ─── Actions ────────────────────────────────────────────────────
function randomizeSeed() {
  state.terrain.noise.seed = Math.floor(Math.random() * 99999);
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  requestGeneration();
}

function resetAll() {
  const defaults = getDefaultState();
  Object.assign(state, defaults);
  loadedData = null;
  rawImageCache = null;
  loadedWidth = 0;
  loadedHeight = 0;
  loadedFileName = '';
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  lighting.update(state.light);
  sceneCtx.controls.autoRotate = false;
  resetCamera(sceneCtx);
  requestGeneration();
}

// ─── Undo/Redo ──────────────────────────────────────────────────
function doUndo() {
  const prev = undoStack.undo();
  if (!prev) return;
  Object.assign(state, prev);
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  lighting.update(state.light);
  requestGeneration();
}

function doRedo() {
  const next = undoStack.redo();
  if (!next) return;
  Object.assign(state, next);
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
  lighting.update(state.light);
  requestGeneration();
}

// ─── Export ─────────────────────────────────────────────────────
function doExportPNG() {
  captureScreenshot(sceneCtx.renderer, sceneCtx.scene, sceneCtx.camera, {
    scale: state.exportScale as 1 | 2 | 4,
    transparentBackground: state.exportTransparent,
    filename: `terraform-${state.terrain.noise.seed}.png`,
  });
  showToast('Screenshot saved!', false);
}

function doExportHeightmap() {
  if (!currentHeightfield) return;
  exportHeightmapPNG(
    currentHeightfield.data,
    currentHeightfield.size,
    `terraform-heightmap-${state.terrain.noise.seed}.png`
  );
  showToast('Heightmap saved!', false);
}

function doExportOBJ() {
  if (!terrainMesh) return;
  exportOBJ(terrainMesh, `terraform-${state.terrain.noise.seed}.obj`);
  showToast('OBJ exported!', false);
}

function doExportGLB() {
  if (!terrainMesh) return;
  exportGLB(terrainMesh, `terraform-${state.terrain.noise.seed}.glb`);
  showToast('GLB exported!', false);
}

// ─── Settings Save/Load ─────────────────────────────────────────
function saveSettings() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `terraform-settings-${state.terrain.noise.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Settings saved!', false);
}

function loadSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async () => {
    if (!input.files?.length) return;
    try {
      const text = await input.files[0].text();
      const loaded = JSON.parse(text);
      Object.assign(state, loaded);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      lighting.update(state.light);
      requestGeneration();
      showToast('Settings loaded!', false);
    } catch {
      showToast('Invalid settings file.');
    }
  };
  input.click();
}

// ─── Render Loop ────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  sceneCtx.controls.update();
  sceneCtx.renderer.render(sceneCtx.scene, sceneCtx.camera);
}

// ─── Go! ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
