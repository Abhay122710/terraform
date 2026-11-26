/**
 * Terraform — Main Application Orchestrator.
 * Pure ES6+ and Three.js client-side application.
 * Zero framework dependencies, zero build step required.
 */

import * as THREE from 'three';
import {
  getState,
  updateState,
  resetStateToDefault,
  setLoadedDataCache,
  getLoadedDataCache,
  clearLoadedDataCache,
  subscribe,
  undo,
  redo,
  TERRAIN_SIZE,
} from './state.js';
import { createLighting } from './lighting.js';
import { setupCameraAndControls, VIEWPORT_CLEAR_COLOR } from './camera.js';
import { buildTerrainGeometry, buildTerrainBaseSkirt, createWaterMesh } from './geometry.js';
import {
  applyTerrainColours,
  createTerrainMaterial,
  createSkirtMaterial,
  disposeMesh,
} from './materials.js';
import { applyAnalysisColours, calculateTerrainStatistics, setupRaycasterHover } from './analysis.js';
import { generateTerrainHeightfield } from './terrain.js';
import { loadTerrainFile } from './heightmap.js';
import {
  exportScreenshotPNG,
  exportHeightmapPNG,
  exportOBJ,
  exportGLB,
  exportPresetJSON,
  parsePresetJSON,
} from './exports.js';
import { setupUI, syncUIFromState, updateSourceIndicator, updateLegend } from './ui.js';
import { debounce, showToast } from './utils.js';

// ─── 3D Scene Variables ─────────────────────────────────────────
let renderer, scene;
let cameraCtx;
let lightingCtx;
let terrainMesh = null;
let baseSkirtMesh = null;
let wireframeOverlay = null;
let waterMesh = null;
let currentHeightfield = null;
let uiHandlers = null;

// Cancellation & Generation Tracking
let currentGenerationId = 0;

/**
 * Initialize application.
 */
export async function initApp() {
  const container = document.getElementById('viewport');
  if (!container) return;

  // 1. Create WebGL Renderer with PCF Shadow Map (Fixes Defect 4.2)
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(VIEWPORT_CLEAR_COLOR, 1.0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // Clean, supported Three.js shadow map
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const canvas = renderer.domElement;
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'region');
  canvas.setAttribute('aria-label', '3D Interactive Terrain Viewport. Use arrow keys to orbit, + and - to zoom.');
  container.appendChild(canvas);

  // 2. Scene & Fog
  scene = new THREE.Scene();
  scene.background = new THREE.Color(VIEWPORT_CLEAR_COLOR);
  scene.fog = new THREE.FogExp2(VIEWPORT_CLEAR_COLOR, 0.01);

  // 3. Camera & Orbit Controls
  cameraCtx = setupCameraAndControls(canvas, container);

  // 4. Lighting System
  lightingCtx = createLighting(scene);

  // 5. Water Plane
  waterMesh = createWaterMesh();
  waterMesh.visible = false;
  scene.add(waterMesh);

  // 6. UI Setup
  uiHandlers = setupUI({
    onTerrainChange: () => debouncedGenerate(),
    onMeshChange: () => rebuildMesh(),
    onViewChange: () => updateView(),
    onLightChange: () => lightingCtx.update(getState()),
    onWaterChange: () => updateWater(),
    onElevationModeChange: () => redecodeImageMap(),
    onRandomizeSeed: () => randomizeSeed(),
    onResetDefault: () => resetAllToDefault(),
    onResetCamera: () => cameraCtx.resetCamera(terrainMesh, baseSkirtMesh),
    onFitTerrain: () => cameraCtx.fitToTerrain(terrainMesh, baseSkirtMesh),
    onRestoreSample: () => restoreSampleHeightmap(),
    onUploadClick: () => triggerFileInput(),
    onClearFile: () => clearUploadedMap(),
    onExportPNG: () => doExportPNG(),
    onExportHeightmap: () => doExportHeightmap(),
    onExportOBJ: () => doExportOBJ(),
    onExportGLB: () => doExportGLB(),
    onSavePreset: () => doSavePreset(),
    onLoadPreset: () => triggerPresetInput(),
    onApplyPreset: (settings) => applyPresetSettings(settings),
    onAutoRotateToggle: () => {
      cameraCtx.controls.autoRotate = getState().autoRotate;
    },
  });

  // Subscribe state changes to UI
  subscribe((newState, changedKeys) => {
    uiHandlers.syncUIFromState(newState);
  });

  // 7. Raycaster Hover Readout
  setupRaycasterHover(
    cameraCtx.camera,
    canvas,
    () => terrainMesh,
    () => getHeightScale()
  );

  // 8. Drag and Drop File Handlers
  setupFileDropzone();

  // 9. Window Resize Handling
  window.addEventListener('resize', handleResize);

  // 10. Keyboard Shortcuts
  setupKeyboardShortcuts();

  // 11. Load Bundled Sample Heightmap as initial opening scene
  await loadOpeningSample();

  // 12. Start Render Loop
  animate();
}

/** Calculate world height scale */
function getHeightScale() {
  const state = getState();
  return state.mountainHeight * (TERRAIN_SIZE / 2.8);
}

/**
 * Debounced terrain generation.
 */
const debouncedGenerate = debounce(() => {
  generateTerrain();
}, 80);

/**
 * Generate heightfield and rebuild mesh.
 */
function generateTerrain() {
  const genId = ++currentGenerationId;
  const state = getState();
  showIndicator(true);

  // Run generation asynchronously via microtask to keep UI responsive
  setTimeout(() => {
    if (genId !== currentGenerationId) return;

    try {
      const cache = getLoadedDataCache();
      currentHeightfield = generateTerrainHeightfield(
        state,
        cache.data,
        cache.width,
        cache.height
      );

      rebuildMesh();
      showIndicator(false);
    } catch (err) {
      console.error('Terrain generation error:', err);
      showIndicator(false);
      showToast('Generation failed: ' + err.message, true);
    }
  }, 10);
}

/**
 * Rebuild 3D Mesh and Perimeter Skirt from current heightfield.
 */
function rebuildMesh() {
  if (!currentHeightfield) return;

  const state = getState();
  const heightScale = getHeightScale();

  // Dispose old terrain mesh
  if (terrainMesh) {
    scene.remove(terrainMesh);
    disposeMesh(terrainMesh);
    terrainMesh = null;
  }

  // Dispose old skirt
  if (baseSkirtMesh) {
    scene.remove(baseSkirtMesh);
    disposeMesh(baseSkirtMesh);
    baseSkirtMesh = null;
  }

  // Dispose old wireframe
  if (wireframeOverlay) {
    scene.remove(wireframeOverlay);
    disposeMesh(wireframeOverlay);
    wireframeOverlay = null;
  }

  // Build terrain geometry
  const geometry = buildTerrainGeometry(currentHeightfield, {
    segments: state.resolution,
    heightScale,
    flatShading: state.flatShading,
    jitter: state.jitter,
    jitterSeed: state.seed,
  });

  applyColouring(geometry, heightScale);

  const material = createTerrainMaterial(state.flatShading);
  terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.castShadow = true;
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // Solid base skirt
  if (state.showBase) {
    const baseGeo = buildTerrainBaseSkirt(
      currentHeightfield,
      state.resolution,
      heightScale,
      0.8
    );
    const baseMat = createSkirtMaterial();
    baseSkirtMesh = new THREE.Mesh(baseGeo, baseMat);
    baseSkirtMesh.receiveShadow = true;
    scene.add(baseSkirtMesh);
  }

  // Wireframe view overlay
  if (state.viewMode === 'wireframe') {
    const wireGeo = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x111111,
      opacity: 0.35,
      transparent: true,
    });
    wireframeOverlay = new THREE.LineSegments(wireGeo, wireMat);
    scene.add(wireframeOverlay);
  }

  updateWater();
  uiHandlers.updateLegend(state.viewMode);

  // Update Terrain Analysis statistics (terrain mesh only, excluding water & base skirt)
  const stats = calculateTerrainStatistics(currentHeightfield, geometry);
  uiHandlers.updateAnalysisStats(stats);
}

/**
 * Apply coloring based on current view mode.
 */
function applyColouring(geometry, heightScale) {
  const state = getState();
  const mode = state.viewMode;

  if (mode === 'shaded' || mode === 'wireframe') {
    applyTerrainColours(geometry, {
      palette: state.palette,
      steepnessThreshold: state.steepnessThreshold,
      heightScale,
    });
  } else {
    applyAnalysisColours(geometry, mode, heightScale, state.contourInterval);
  }
}

/**
 * Update water plane height and opacity.
 */
function updateWater() {
  const state = getState();
  if (!waterMesh) return;

  waterMesh.visible = Boolean(state.waterEnabled);
  if (state.waterEnabled) {
    const hScale = getHeightScale();
    waterMesh.position.y = state.waterLevel * hScale;
    waterMesh.material.opacity = state.waterOpacity;
  }
}

/**
 * View mode change handler.
 */
function updateView() {
  rebuildMesh();
}

/**
 * Load initial opening sample heightmap.
 */
async function loadOpeningSample() {
  try {
    const samplePaths = ['assets/sample-heightmap.png', 'public/samples/heightmap.png'];
    let resp = null;

    for (const path of samplePaths) {
      try {
        const r = await fetch(path);
        if (r.ok) {
          resp = r;
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    if (resp) {
      const blob = await resp.blob();
      const file = new File([blob], 'mountain-sample.png', { type: 'image/png' });
      await processUploadedFile(file, true);
      return;
    }
  } catch (err) {
    console.warn('Sample map fetch fallback to procedural:', err);
  }

  // Pure procedural fallback if sample asset not accessible
  updateState({ source: 'procedural', blendFactor: 1.0 });
  generateTerrain();
}

/**
 * Restore sample heightmap through direct single action.
 */
async function restoreSampleHeightmap() {
  showToast('Restoring bundled sample heightmap…', false);
  updateState({
    source: 'sample',
    sourceName: 'sample-heightmap.png',
    loadedFileName: '',
    blendFactor: 0.0,
  });
  await loadOpeningSample();
  cameraCtx.fitToTerrain(terrainMesh, baseSkirtMesh);
}

/**
 * Process uploaded or bundled file.
 */
async function processUploadedFile(file, isInitialSample = false) {
  showIndicator(true);
  try {
    const state = getState();
    const result = await loadTerrainFile(file, state.resolution, state.elevationMode);

    setLoadedDataCache({
      data: result.data,
      width: result.width,
      height: result.height,
      rawImageData: result.rawImageData || null,
      isSample: isInitialSample,
    });

    updateState({
      source: isInitialSample ? 'sample' : 'upload',
      sourceName: isInitialSample ? 'sample-heightmap.png' : file.name,
      loadedFileName: isInitialSample ? '' : file.name,
      blendFactor: 0.0, // Preserve exact input map by default
    });

    generateTerrain();

    if (!isInitialSample) {
      showToast(`Loaded "${file.name}" (${result.width}×${result.height})`, false);
      setTimeout(() => cameraCtx.fitToTerrain(terrainMesh, baseSkirtMesh), 120);
    }
  } catch (err) {
    showIndicator(false);
    showToast(err.message, true);
  }
}

/**
 * Re-decode cached image when elevation mode changes (e.g. Luminance vs Invert vs Rainbow).
 */
function redecodeImageMap() {
  const cache = getLoadedDataCache();
  if (!cache.rawImageData) {
    debouncedGenerate();
    return;
  }

  const state = getState();
  const pixels = cache.rawImageData.data;
  const w = cache.rawImageData.width;
  const h = cache.rawImageData.height;
  const data = new Float32Array(w * h);

  for (let i = 0; i < data.length; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    data[i] = decodeElevationValue(r, g, b, state.elevationMode);
  }

  cache.data = data;
  setLoadedDataCache(cache);
  showToast(`Decoded with "${state.elevationMode}" mapping`, false);
  generateTerrain();
}

function decodeElevationValue(r, g, b, mode) {
  if (mode === 'invert') {
    return 1.0 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Clear loaded file and switch to pure procedural.
 */
function clearUploadedMap() {
  clearLoadedDataCache();
  updateState({
    source: 'procedural',
    loadedFileName: '',
    blendFactor: 1.0,
  });
  generateTerrain();
  showToast('Loaded map cleared. Switched to procedural mode.', false);
}

/**
 * Randomize seed.
 */
function randomizeSeed() {
  const newSeed = Math.floor(Math.random() * 99999);
  updateState({ seed: newSeed });
  generateTerrain();
}

/**
 * Reset Default: Completely restores original opening sample and all default parameters.
 * Solves Defect 3.1: 100% deterministic, state and UI stay synchronized.
 */
async function resetAllToDefault() {
  showToast('Resetting to original defaults…', false);
  resetStateToDefault();
  clearLoadedDataCache();
  lightingCtx.update(getState());
  cameraCtx.controls.autoRotate = false;
  cameraCtx.resetCamera();
  await loadOpeningSample();
  cameraCtx.fitToTerrain(terrainMesh, baseSkirtMesh);
}

/**
 * Apply preset settings.
 */
function applyPresetSettings(preset) {
  updateState(preset);
  lightingCtx.update(getState());
  cameraCtx.controls.autoRotate = getState().autoRotate;
  generateTerrain();
  setTimeout(() => cameraCtx.fitToTerrain(terrainMesh, baseSkirtMesh), 150);
  showToast('Applied preset!', false);
}

// ─── Export Actions ─────────────────────────────────────────────

function doExportPNG() {
  const state = getState();
  exportScreenshotPNG(renderer, scene, cameraCtx.camera, {
    scale: state.exportScale,
    transparentBackground: state.exportTransparent,
    seed: state.seed,
  });
  showToast(`Exported Screenshot (${state.exportScale}x)!`, false);
}

function doExportHeightmap() {
  if (!currentHeightfield) return;
  const state = getState();
  exportHeightmapPNG(
    currentHeightfield.data,
    currentHeightfield.size,
    `terraform-heightmap-${state.seed}.png`
  );
  showToast('Exported Heightmap PNG!', false);
}

function doExportOBJ() {
  if (!terrainMesh) return;
  const state = getState();
  exportOBJ(terrainMesh, `terraform-${state.seed}.obj`);
  showToast('Exported Mesh OBJ!', false);
}

function doExportGLB() {
  if (!terrainMesh) return;
  const state = getState();
  exportGLB(terrainMesh, `terraform-${state.seed}.glb`);
  showToast('Exported Mesh GLB!', false);
}

function doSavePreset() {
  const state = getState();
  exportPresetJSON(state);
  showToast('Preset JSON saved!', false);
}

function triggerPresetInput() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;
    try {
      const text = await input.files[0].text();
      const settings = parsePresetJSON(text);
      applyPresetSettings(settings);
    } catch (err) {
      showToast('Invalid preset JSON: ' + err.message, true);
    }
  };
  input.click();
}

function triggerFileInput() {
  const input = document.getElementById('hidden-file-input');
  if (input) input.click();
}

// ─── Dropzone & File Input ──────────────────────────────────────

function setupFileDropzone() {
  const overlay = document.getElementById('dropzone-overlay');
  const fileInput = document.getElementById('hidden-file-input');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processUploadedFile(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (overlay) overlay.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (overlay) overlay.classList.remove('active');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (overlay) overlay.classList.remove('active');
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  });
}

// ─── Keyboard Shortcuts ─────────────────────────────────────────

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ignore keystrokes when focused inside input fields
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }

    if (e.key === 'r' || e.key === 'R') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        randomizeSeed();
      }
    } else if (e.key === 'e' || e.key === 'E') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        doExportPNG();
      }
    } else if (e.key === 'a' || e.key === 'A') {
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const cur = getState().autoRotate;
        updateState({ autoRotate: !cur });
        cameraCtx.controls.autoRotate = !cur;
      }
    } else if (e.key === 'z' || e.key === 'Z') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          const s = redo();
          if (s) { generateTerrain(); showToast('Redo', false); }
        } else {
          const s = undo();
          if (s) { generateTerrain(); showToast('Undo', false); }
        }
      }
    } else if (e.key === 'y' || e.key === 'Y') {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const s = redo();
        if (s) { generateTerrain(); showToast('Redo', false); }
      }
    }
  });
}

// ─── Resize Handler ─────────────────────────────────────────────

function handleResize() {
  const container = document.getElementById('viewport');
  if (!container || !renderer || !cameraCtx) return;

  const w = container.clientWidth;
  const h = container.clientHeight;

  cameraCtx.camera.aspect = w / h;
  cameraCtx.camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ─── Generating Indicator ───────────────────────────────────────

function showIndicator(visible) {
  const el = document.getElementById('generating-indicator');
  if (!el) return;
  if (visible) el.classList.add('visible');
  else el.classList.remove('visible');
}

// ─── Animation Loop ─────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate);
  cameraCtx.controls.update();
  renderer.render(scene, cameraCtx.camera);
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
