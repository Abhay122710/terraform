/**
 * Verification test suite for Terraform ES Modules.
 * Tests state management, Reset Default, procedural noise, heightfield,
 * geometry generation, and exports.
 */

import {
  DEFAULT_STATE,
  getState,
  updateState,
  resetStateToDefault,
  validateState,
  setLoadedDataCache,
  getLoadedDataCache,
} from '../js/state.js';
import {
  simplexFBm,
  perlinFBm,
  ridgedFBm,
  billowFBm,
  voronoiNoise,
  generateNoise,
} from '../js/noise.js';
import {
  HeightField,
  decodePixelElevation,
  idwInterpolation,
} from '../js/heightmap.js';
import {
  generateTerrainHeightfield,
  applyShapeCurves,
  smooth,
  hydraulicErode,
  thermalErode,
} from '../js/terrain.js';
import { PALETTES, getPalette } from '../js/materials.js';
import { BUNDLED_PRESETS } from '../js/presets.js';
import { parsePresetJSON } from '../js/exports.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== TEST SUITE 1: STATE MANAGEMENT & RESET DEFAULT (PHASE 3.1) ===');
{
  // 1. Initial state matches defaults
  resetStateToDefault();
  let s = getState();
  assert(s.mountainHeight === 1.35, 'Initial mountainHeight is 1.35');
  assert(s.seed === 42, 'Initial seed is 42');
  assert(s.resolution === 128, 'Initial resolution is 128');
  assert(s.flatShading === true, 'Initial flatShading is true');
  assert(s.showBase === true, 'Initial showBase is true');

  // 2. Modify state (reproducing QA defect: mountainHeight changed to 0.4)
  updateState({
    mountainHeight: 0.4,
    seed: 999,
    smoothingPasses: 3,
    resolution: 64,
    noiseType: 'voronoi',
    flatShading: false,
    showBase: false,
  });

  s = getState();
  assert(s.mountainHeight === 0.4, 'mountainHeight updated to 0.4');
  assert(s.seed === 999, 'seed updated to 999');
  assert(s.resolution === 64, 'resolution updated to 64');
  assert(s.flatShading === false, 'flatShading updated to false');

  // 3. Reset Default
  resetStateToDefault();
  s = getState();
  assert(s.mountainHeight === 1.35, 'Reset Default restored mountainHeight to 1.35 (NOT 0.4)');
  assert(s.seed === 42, 'Reset Default restored seed to 42');
  assert(s.resolution === 128, 'Reset Default restored resolution to 128');
  assert(s.noiseType === 'ridged', 'Reset Default restored noiseType to ridged');
  assert(s.flatShading === true, 'Reset Default restored flatShading to true');
  assert(s.showBase === true, 'Reset Default restored showBase to true');

  // 4. Repeated Reset Default produces exact same state
  resetStateToDefault();
  const s2 = getState();
  assert(JSON.stringify(s) === JSON.stringify(s2), 'Repeated Reset Default is strictly deterministic');
}

console.log('\n=== TEST SUITE 2: INPUT BOUNDARIES & VALIDATION (PHASE 5.4) ===');
{
  // Test lower bound clamping on Mountain Height (min 0.2)
  const invalidLow = validateState({ mountainHeight: 0.05 });
  assert(invalidLow.mountainHeight === 0.2, 'Mountain height below 0.2 clamped to 0.2');

  const invalidHigh = validateState({ mountainHeight: 10.0 });
  assert(invalidHigh.mountainHeight === 4.0, 'Mountain height above 4.0 clamped to 4.0');

  // Resolution bounds (min 16, max 256)
  const invalidResLow = validateState({ resolution: 8 });
  assert(invalidResLow.resolution === 16, 'Resolution below 16 clamped to 16');

  const invalidResHigh = validateState({ resolution: 512 });
  assert(invalidResHigh.resolution === 256, 'Resolution above 256 clamped to 256');

  // Non-numeric / NaN handling
  const nanHeight = validateState({ mountainHeight: 'abc' });
  assert(nanHeight.mountainHeight === 1.35, 'Invalid alphabetic mountain height safely defaults');

  const nanSeed = validateState({ seed: 'xyz' });
  assert(nanSeed.seed === 0, 'Invalid alphabetic seed safely defaults');
}

console.log('\n=== TEST SUITE 3: PROCEDURAL NOISE ALGORITHMS (PHASE 5.2) ===');
{
  const size = 32;
  const seed = 42;
  const scale = 3.5;
  const octaves = 4;
  const lacunarity = 2.0;
  const persistence = 0.5;

  const simplex = simplexFBm(size, seed, scale, octaves, lacunarity, persistence);
  assert(simplex.length === size * size, 'Simplex fBm generates correct buffer length');
  assert(simplex[0] >= 0 && simplex[0] <= 1, 'Simplex values normalized to [0, 1]');

  const perlin = perlinFBm(size, seed, scale, octaves, lacunarity, persistence);
  assert(perlin.length === size * size, 'Perlin fBm generates correct buffer length');
  assert(perlin[0] >= 0 && perlin[0] <= 1, 'Perlin values normalized to [0, 1]');

  const ridged = ridgedFBm(size, seed, scale, octaves, lacunarity, persistence);
  assert(ridged.length === size * size, 'Ridged multifractal generates correct buffer length');
  assert(ridged[0] >= 0 && ridged[0] <= 1, 'Ridged values normalized to [0, 1]');

  const billow = billowFBm(size, seed, scale, octaves, lacunarity, persistence);
  assert(billow.length === size * size, 'Billow noise generates correct buffer length');
  assert(billow[0] >= 0 && billow[0] <= 1, 'Billow values normalized to [0, 1]');

  const voronoi = voronoiNoise(size, seed, scale, octaves, lacunarity, persistence);
  assert(voronoi.length === size * size, 'Voronoi cellular generates correct buffer length');
  assert(voronoi[0] >= 0 && voronoi[0] <= 1, 'Voronoi values normalized to [0, 1]');

  // Determinism check: same seed produces identical results
  const ridged2 = ridgedFBm(size, seed, scale, octaves, lacunarity, persistence);
  let identical = true;
  for (let i = 0; i < ridged.length; i++) {
    if (Math.abs(ridged[i] - ridged2[i]) > 1e-6) { identical = false; break; }
  }
  assert(identical, 'Seeded noise calculations are strictly deterministic');
}

console.log('\n=== TEST SUITE 4: HEIGHTFIELD & ELEVATION DECODING (PHASE 5.1) ===');
{
  const hf = new HeightField(16);
  hf.set(0, 0, 0.0);
  hf.set(15, 15, 1.0);
  assert(hf.get(0, 0) === 0.0, 'HeightField get/set works at (0,0)');
  assert(hf.get(15, 15) === 1.0, 'HeightField get/set works at (15,15)');

  // Bilinear interpolation
  const sampleMid = hf.sample(0.5, 0.5);
  assert(!isNaN(sampleMid), 'Bilinear sampling returns valid numeric elevation');

  // Luminance decoding (ITU-R BT.709)
  const whiteElev = decodePixelElevation(255, 255, 255, 'luminance');
  assert(Math.abs(whiteElev - 1.0) < 1e-4, 'White pixel decodes to 1.0 elevation');

  const blackElev = decodePixelElevation(0, 0, 0, 'luminance');
  assert(Math.abs(blackElev - 0.0) < 1e-4, 'Black pixel decodes to 0.0 elevation');

  // Invert mode
  const invertWhite = decodePixelElevation(255, 255, 255, 'invert');
  assert(Math.abs(invertWhite - 0.0) < 1e-4, 'Invert mode turns white into 0.0 elevation');

  // IDW scattered interpolation
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 100, y: 100, z: 100 },
  ];
  const idwGrid = idwInterpolation(points, 16);
  assert(idwGrid.length === 256, 'IDW generates 16x16 grid');
  assert(idwGrid[0] >= 0 && idwGrid[0] <= 1, 'IDW values normalized in [0, 1]');
}

console.log('\n=== TEST SUITE 5: TERRAIN GENERATION ENGINE & POST-PROCESSING ===');
{
  const state = { ...DEFAULT_STATE, resolution: 32 };
  const hf = generateTerrainHeightfield(state, null, 0, 0);
  assert(hf.size === 32, 'Terrain generated with resolution 32');
  assert(hf.data.length === 1024, 'Terrain data array length is 1024');

  // Test smoothing
  const smoothed = smooth(hf.data, 32, 2);
  assert(smoothed.length === 1024, 'Smoothing filter produces correct length');

  // Test hydraulic erosion
  const erodedH = hydraulicErode(hf.data, 32, 50);
  assert(erodedH.length === 1024, 'Hydraulic erosion simulation runs cleanly');

  // Test thermal erosion
  const erodedT = thermalErode(hf.data, 32, 5);
  assert(erodedT.length === 1024, 'Thermal erosion simulation runs cleanly');
}

console.log('\n=== TEST SUITE 6: PRESETS & ROUNDTRIP SERIALIZATION (PHASE 7) ===');
{
  assert(BUNDLED_PRESETS.length >= 5, 'At least 5 bundled presets available');

  // Test save -> load roundtrip
  const testPreset = {
    version: '2.0.0',
    app: 'Terraform',
    settings: {
      mountainHeight: 2.2,
      seed: 12345,
      noiseType: 'billow',
      palette: 'volcanic',
      resolution: 64,
    },
  };
  const jsonStr = JSON.stringify(testPreset);
  const loaded = parsePresetJSON(jsonStr);
  assert(loaded.mountainHeight === 2.2, 'Preset roundtrip preserves mountainHeight');
  assert(loaded.seed === 12345, 'Preset roundtrip preserves seed');
  assert(loaded.noiseType === 'billow', 'Preset roundtrip preserves noiseType');
  assert(loaded.palette === 'volcanic', 'Preset roundtrip preserves palette');
}

console.log('\n=== TEST SUITE 7: COLOR PALETTES (PHASE 5.5) ===');
{
  assert(PALETTES['mountain-reference'] !== undefined, 'Mountain Reference palette exists');
  assert(PALETTES['alpine'] !== undefined, 'Alpine palette exists');
  assert(PALETTES['desert'] !== undefined, 'Desert palette exists');
  assert(PALETTES['volcanic'] !== undefined, 'Volcanic palette exists');
  assert(PALETTES['arctic'] !== undefined, 'Arctic palette exists');
  assert(getPalette('desert').bands.length > 0, 'Desert palette has defined color bands');
}

console.log(`\n========================================`);
console.log(`TOTAL PASSED: ${passed}`);
console.log(`TOTAL FAILED: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);
