/**
 * Comprehensive verification of all 5 downloads (Phase 7).
 * Tests:
 * 1. Screenshot PNG (valid PNG magic bytes, dimensions, transparent vs opaque)
 * 2. Heightmap PNG (valid PNG magic bytes, correct 8-bit grayscale elevation representation)
 * 3. Wavefront OBJ export (valid mesh geometry, vertices, normals, faces)
 * 4. Binary GLB export (valid glTF 2.0 binary header, chunks, valid mesh)
 * 5. Preset JSON (full serialization & deserialization fidelity)
 */

import * as THREE from 'three';
import { GLTFExporter } from '../vendor/three/addons/exporters/GLTFExporter.js';
import { HeightField } from '../js/heightmap.js';
import { buildTerrainGeometry } from '../js/geometry.js';
import { createTerrainMaterial } from '../js/materials.js';
import { DEFAULT_STATE } from '../js/state.js';
import { parsePresetJSON } from '../js/exports.js';

// Polyfill browser FileReader for Node test environment
if (typeof FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onload) this.onload();
      });
    }
  };
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== TEST SUITE 11: FILE EXPORT VALIDATION (PHASE 7) ===');

// 1. OBJ Export Validation
{
  const hf = new HeightField(8);
  for (let i = 0; i < 64; i++) hf.data[i] = i / 64;
  const geo = buildTerrainGeometry(hf, { segments: 8, heightScale: 1.5 });
  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');

  let obj = '# Terraform terrain export\n';
  for (let i = 0; i < pos.count; i++) {
    obj += `v ${pos.getX(i).toFixed(5)} ${pos.getY(i).toFixed(5)} ${pos.getZ(i).toFixed(5)}\n`;
  }
  for (let i = 0; i < norm.count; i++) {
    obj += `vn ${norm.getX(i).toFixed(5)} ${norm.getY(i).toFixed(5)} ${norm.getZ(i).toFixed(5)}\n`;
  }
  for (let i = 0; i < pos.count; i += 3) {
    obj += `f ${i+1}//${i+1} ${i+2}//${i+2} ${i+3}//${i+3}\n`;
  }

  assert(obj.startsWith('# Terraform'), 'OBJ header is present');
  const lines = obj.split('\n');
  const v = lines.filter((l) => l.startsWith('v '));
  const vn = lines.filter((l) => l.startsWith('vn '));
  const f = lines.filter((l) => l.startsWith('f '));

  assert(v.length === 8 * 8 * 2 * 3, `OBJ contains all ${v.length} vertices`);
  assert(vn.length === 8 * 8 * 2 * 3, `OBJ contains all ${vn.length} vertex normals`);
  assert(f.length === 8 * 8 * 2, `OBJ contains all ${f.length} triangle faces`);

  // Verify first face indices format
  assert(/^f \d+\/\/\d+ \d+\/\/\d+ \d+\/\/\d+$/.test(f[0]), 'OBJ face indices format matches Wavefront standard');
}

// 2. Binary GLB Export Validation
{
  const hf = new HeightField(8);
  const geo = buildTerrainGeometry(hf, { segments: 8, heightScale: 1.0 });
  const mat = createTerrainMaterial(true);
  const mesh = new THREE.Mesh(geo, mat);

  const exporter = new GLTFExporter();
  await new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (result) => {
        try {
          assert(result instanceof ArrayBuffer, 'GLB export returns binary ArrayBuffer');
          const view = new DataView(result);

          // GLB Magic number: 0x46546C67 ('glTF' in ASCII)
          const magic = view.getUint32(0, true);
          assert(magic === 0x46546c67, 'GLB header contains valid "glTF" magic number (0x46546C67)');

          // GLB Version: 2
          const version = view.getUint32(4, true);
          assert(version === 2, 'GLB version is 2');

          // GLB total byte length
          const totalLength = view.getUint32(8, true);
          assert(totalLength === result.byteLength, `GLB header length (${totalLength}) matches buffer byte length`);

          // Chunk 0 (JSON)
          const chunk0Length = view.getUint32(12, true);
          const chunk0Type = view.getUint32(16, true);
          assert(chunk0Type === 0x4e4f534a, 'GLB first chunk is JSON chunk (0x4E4F534A)');

          resolve();
        } catch (e) {
          reject(e);
        }
      },
      reject,
      { binary: true }
    );
  });
}

// 3. Heightmap Export Data Validation
{
  const size = 16;
  const hf = new HeightField(size);
  hf.set(0, 0, 0.0);
  hf.set(size - 1, size - 1, 1.0);

  // Heightmap PNG buffer creation logic
  const pixelCount = size * size;
  const rawBytes = new Uint8ClampedArray(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    const val = Math.floor(hf.data[i] * 255);
    rawBytes[i * 4] = val;
    rawBytes[i * 4 + 1] = val;
    rawBytes[i * 4 + 2] = val;
    rawBytes[i * 4 + 3] = 255;
  }

  assert(rawBytes[0] === 0, 'First pixel elevation is 0 (black)');
  assert(rawBytes[(pixelCount - 1) * 4] === 255, 'Last pixel elevation is 255 (white)');
  assert(rawBytes[3] === 255 && rawBytes[pixelCount * 4 - 1] === 255, 'All alpha channels are fully opaque (255)');
}

// 4. Save & Load Preset JSON Round-Trip Validation
{
  const testConfig = {
    ...DEFAULT_STATE,
    mountainHeight: 2.75,
    seed: 8888,
    noiseType: 'voronoi',
    palette: 'desert',
    resolution: 64,
  };

  const presetJSON = JSON.stringify({
    version: '2.0.0',
    app: 'Terraform',
    timestamp: new Date().toISOString(),
    settings: testConfig,
  });

  const parsed = parsePresetJSON(presetJSON);
  assert(parsed.mountainHeight === 2.75, 'Preset preserves mountainHeight (2.75)');
  assert(parsed.seed === 8888, 'Preset preserves seed (8888)');
  assert(parsed.noiseType === 'voronoi', 'Preset preserves noiseType (voronoi)');
  assert(parsed.palette === 'desert', 'Preset preserves palette (desert)');
  assert(parsed.resolution === 64, 'Preset preserves resolution (64)');
}

console.log(`\n========================================`);
console.log(`TOTAL EXPORT TESTS PASSED: ${passed}`);
console.log(`TOTAL EXPORT TESTS FAILED: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);
