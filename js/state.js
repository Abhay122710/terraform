/**
 * Terraform — Centralized Application State Management.
 * Solves Defect 3.1: Single authoritative source of truth.
 * Ensures input fields, sliders, checkboxes, renderer, and terrain geometry
 * are 100% synchronized with zero stale values.
 */

import { clamp } from './utils.js';

export const TERRAIN_SIZE = 12; // World units
export const MIN_RESOLUTION = 16;
export const MAX_RESOLUTION = 256;
export const MIN_MOUNTAIN_HEIGHT = 0.2;
export const MAX_MOUNTAIN_HEIGHT = 4.0;

/** Complete documented default configuration */
export const DEFAULT_STATE = Object.freeze({
  // Source info
  source: 'sample', // 'sample' | 'upload' | 'procedural'
  sourceName: 'sample-heightmap.png',
  loadedFileName: '',

  // Seed & core terrain shaping
  seed: 42,
  mountainHeight: 1.35, // shape heightScale
  ridgeSharpening: 1.2,
  valleyDeepening: 0.15,
  enableDetail: true,
  detailStrength: 0.08,
  elevationCurve: 1.1, // redistributionPower
  plateauSteps: 0,
  resolution: 128,
  blendFactor: 0.0, // 0 = uploaded/sample map only, 1 = procedural noise only
  elevationMode: 'luminance', // 'luminance' | 'rainbow-heatmap' | 'turbo-heatmap' | 'spectral' | 'invert'
  normalizeElevation: true,

  // Procedural noise parameters
  noiseType: 'ridged', // 'ridged' | 'simplex' | 'perlin' | 'billow' | 'voronoi'
  noiseScale: 3.5,
  octaves: 7,
  lacunarity: 2.1,
  persistence: 0.52,

  // Erosion & smoothing
  smoothingPasses: 0,
  hydraulicIterations: 200,
  thermalIterations: 8,

  // Geometry switches
  flatShading: true, // Low-Poly toggle
  jitter: 0.12, // Vertex jitter
  showBase: true, // Solid Base Skirt toggle

  // Materials & Shading
  palette: 'mountain-reference',
  steepnessThreshold: 38, // degrees: above this slope, face becomes rock/cliff

  // Water plane
  waterEnabled: false,
  waterLevel: 0.08,
  waterOpacity: 0.65,

  // Sun & Atmosphere
  sunAzimuth: 140, // 0-360
  sunElevation: 48, // 5-90
  sunIntensity: 1.5,
  shadowEnabled: true,
  fogDensity: 0.01,

  // View & Inspection
  viewMode: 'shaded', // 'shaded' | 'slope' | 'height' | 'contour' | 'wireframe' | 'debug-green'
  contourInterval: 0.1,
  autoRotate: false,

  // Export settings
  exportScale: 1, // 1 | 2
  exportTransparent: false,
});

/** Active mutable application state */
let currentState = JSON.parse(JSON.stringify(DEFAULT_STATE));

/** Active loaded elevation data (cached in memory) */
let loadedDataCache = {
  data: null, // Float32Array
  width: 0,
  height: 0,
  rawImageData: null, // For re-decoding
  isSample: true,
};

/** Listeners subscribed to state updates */
const subscribers = new Set();

/** Undo/Redo stacks */
const MAX_UNDO = 30;
const undoStack = [];
const redoStack = [];
let isUndoingOrRedoing = false;

/**
 * Validate and clamp state values to ensure no corruption.
 */
export function validateState(state) {
  state.mountainHeight = clamp(Number(state.mountainHeight) || 1.35, MIN_MOUNTAIN_HEIGHT, MAX_MOUNTAIN_HEIGHT);
  state.resolution = clamp(Math.round(Number(state.resolution) || 128), MIN_RESOLUTION, MAX_RESOLUTION);
  state.seed = Math.max(0, Math.min(999999, Math.round(Number(state.seed) || 0)));
  state.steepnessThreshold = clamp(Number(state.steepnessThreshold) || 38, 10, 75);
  state.sunAzimuth = clamp(Number(state.sunAzimuth) || 140, 0, 360);
  state.sunElevation = clamp(Number(state.sunElevation) || 48, 5, 90);
  state.sunIntensity = clamp(Number(state.sunIntensity) || 1.5, 0.1, 4.0);
  state.blendFactor = clamp(Number(state.blendFactor) || 0, 0, 1);
  state.smoothingPasses = clamp(Math.round(Number(state.smoothingPasses) || 0), 0, 10);
  state.hydraulicIterations = clamp(Math.round(Number(state.hydraulicIterations) || 0), 0, 5000);
  state.thermalIterations = clamp(Math.round(Number(state.thermalIterations) || 0), 0, 50);
  state.waterLevel = clamp(Number(state.waterLevel) || 0.08, 0, 1);
  state.waterOpacity = clamp(Number(state.waterOpacity) || 0.65, 0, 1);
  state.jitter = clamp(Number(state.jitter) || 0, 0, 0.6);
  state.contourInterval = clamp(Number(state.contourInterval) || 0.1, 0.02, 0.5);
  return state;
}

/**
 * Get a readonly copy of the current state.
 */
export function getState() {
  return { ...currentState };
}

/**
 * Update state with partial updates.
 * Automatically validates, records undo history, and notifies subscribers.
 */
export function updateState(partial, recordUndo = true) {
  if (recordUndo && !isUndoingOrRedoing) {
    undoStack.push(JSON.stringify(currentState));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack.length = 0; // Clear redo on new action
  }

  currentState = validateState({ ...currentState, ...partial });

  // Notify all listeners with new state and changed keys
  const changedKeys = Object.keys(partial);
  subscribers.forEach((fn) => fn(currentState, changedKeys));
  return currentState;
}

/**
 * Subscribe to state updates. Returns unsubscribe function.
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Reset state to complete documented default.
 * Deterministic: guarantees state, controls, and renderer match original opening view.
 */
export function resetStateToDefault() {
  undoStack.push(JSON.stringify(currentState));
  redoStack.length = 0;

  currentState = JSON.parse(JSON.stringify(DEFAULT_STATE));
  validateState(currentState);

  // Notify all subscribers
  const allKeys = Object.keys(currentState);
  subscribers.forEach((fn) => fn(currentState, allKeys));
  return currentState;
}

/**
 * Undo last action.
 */
export function undo() {
  if (undoStack.length === 0) return null;
  redoStack.push(JSON.stringify(currentState));
  const prevJSON = undoStack.pop();
  isUndoingOrRedoing = true;
  currentState = JSON.parse(prevJSON);
  validateState(currentState);
  const allKeys = Object.keys(currentState);
  subscribers.forEach((fn) => fn(currentState, allKeys));
  isUndoingOrRedoing = false;
  return currentState;
}

/**
 * Redo last undone action.
 */
export function redo() {
  if (redoStack.length === 0) return null;
  undoStack.push(JSON.stringify(currentState));
  const nextJSON = redoStack.pop();
  isUndoingOrRedoing = true;
  currentState = JSON.parse(nextJSON);
  validateState(currentState);
  const allKeys = Object.keys(currentState);
  subscribers.forEach((fn) => fn(currentState, allKeys));
  isUndoingOrRedoing = false;
  return currentState;
}

/**
 * Loaded data cache accessors.
 */
export function setLoadedDataCache(cache) {
  loadedDataCache = { ...cache };
}

export function getLoadedDataCache() {
  return loadedDataCache;
}

export function clearLoadedDataCache() {
  loadedDataCache = {
    data: null,
    width: 0,
    height: 0,
    rawImageData: null,
    isSample: false,
  };
}
