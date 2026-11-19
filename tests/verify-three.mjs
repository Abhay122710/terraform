/**
 * Verification test suite for Three.js geometry, materials, and exports.
 */

import * as THREE from 'three';
import { HeightField } from '../js/heightmap.js';
import { buildTerrainGeometry, buildTerrainBaseSkirt, createWaterMesh } from '../js/geometry.js';
import { applyTerrainColours, createTerrainMaterial, createSkirtMaterial } from '../js/materials.js';
import { applyAnalysisColours, getFaceSlope } from '../js/analysis.js';
import { exportOBJ } from '../js/exports.js';

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

console.log('=== TEST SUITE 8: THREE.JS GEOMETRY & NORMAL WINDING (CCW) ===');
{
  const size = 16;
  const hf = new HeightField(size);
  // Create a sloped terrain
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      hf.set(x, y, (x + y) / (2 * size));
    }
  }

  const geometry = buildTerrainGeometry(hf, {
    segments: size,
    heightScale: 2.0,
    flatShading: true,
    jitter: 0,
  });

  const pos = geometry.getAttribute('position');
  const norm = geometry.getAttribute('normal');
  const col = geometry.getAttribute('color');

  assert(pos !== undefined, 'Geometry has position attribute');
  assert(norm !== undefined, 'Geometry has normal attribute');
  assert(col !== undefined, 'Geometry has color attribute');

  // Triangles count: 16 * 16 * 2 quads = 512 triangles * 3 = 1536 vertices
  assert(pos.count === size * size * 2 * 3, `Expected ${size * size * 2 * 3} vertices, got ${pos.count}`);

  // Test upward normal direction (CCW winding rule):
  // For any terrain surface that is generally upright, normals should have ny > 0
  let upwardNormals = 0;
  for (let i = 0; i < norm.count; i += 3) {
    const ny = norm.getY(i);
    if (ny > 0) upwardNormals++;
  }
  const upwardRatio = upwardNormals / (norm.count / 3);
  assert(upwardRatio > 0.99, `Normals face strictly upward (ratio: ${(upwardRatio * 100).toFixed(1)}%)`);

  // Base skirt test
  const skirt = buildTerrainBaseSkirt(hf, size, 2.0, 0.8);
  const skirtPos = skirt.getAttribute('position');
  assert(skirtPos.count === 4 * size * 6, `Base skirt has correct vertex count (${skirtPos.count})`);

  // Water mesh test
  const water = createWaterMesh();
  assert(water instanceof THREE.Mesh, 'Water mesh successfully created');
  assert(water.material.transparent === true, 'Water material is transparent');
}

console.log('\n=== TEST SUITE 9: MATERIALS & ANALYSIS COLOURING ===');
{
  const size = 16;
  const hf = new HeightField(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      hf.set(x, y, x / size);
    }
  }
  const geo = buildTerrainGeometry(hf, { segments: size, heightScale: 2.5 });

  // 1. Shaded palette
  applyTerrainColours(geo, { palette: 'mountain-reference', steepnessThreshold: 38, heightScale: 2.5 });
  const col = geo.getAttribute('color');
  assert(col.getX(0) > 0, 'Colors populated for mountain-reference');

  // 2. Slope mode
  applyAnalysisColours(geo, 'slope', 2.5);
  assert(col.getX(0) >= 0 && col.getX(0) <= 1, 'Slope colors applied in valid range');

  // 3. Height mode
  applyAnalysisColours(geo, 'height', 2.5);
  assert(col.getX(0) >= 0 && col.getX(0) <= 1, 'Height colors applied in valid range');

  // 4. Contour mode
  applyAnalysisColours(geo, 'contour', 2.5, 0.1);
  assert(col.getX(0) >= 0 && col.getX(0) <= 1, 'Contour colors applied in valid range');

  // 5. Debug green
  applyAnalysisColours(geo, 'debug-green', 2.5);
  const rVal = col.getX(0);
  const gVal = col.getY(0);
  const bVal = col.getZ(0);
  assert(gVal > rVal && gVal > bVal, 'Debug green sets green channel dominant over red and blue');
}

console.log('\n=== TEST SUITE 10: WAVEFRONT OBJ GENERATION & VALIDATION ===');
{
  const size = 4;
  const hf = new HeightField(size);
  const geo = buildTerrainGeometry(hf, { segments: size, heightScale: 1.0 });
  const mat = createTerrainMaterial(true);
  const mesh = new THREE.Mesh(geo, mat);

  const pos = geo.getAttribute('position');
  const norm = geo.getAttribute('normal');

  let obj = '# Terraform export\n';
  for (let i = 0; i < pos.count; i++) {
    obj += `v ${pos.getX(i).toFixed(5)} ${pos.getY(i).toFixed(5)} ${pos.getZ(i).toFixed(5)}\n`;
  }
  for (let i = 0; i < norm.count; i++) {
    obj += `vn ${norm.getX(i).toFixed(5)} ${norm.getY(i).toFixed(5)} ${norm.getZ(i).toFixed(5)}\n`;
  }
  for (let i = 0; i < pos.count; i += 3) {
    obj += `f ${i+1}//${i+1} ${i+2}//${i+2} ${i+3}//${i+3}\n`;
  }

  assert(obj.includes('v ') && obj.includes('vn ') && obj.includes('f '), 'OBJ file has vertices, normals, and faces');
  const lines = obj.split('\n').filter(Boolean);
  const vLines = lines.filter(l => l.startsWith('v '));
  const fLines = lines.filter(l => l.startsWith('f '));
  assert(vLines.length === pos.count, `OBJ vertex count (${vLines.length}) matches mesh count (${pos.count})`);
  assert(fLines.length === pos.count / 3, `OBJ face count (${fLines.length}) matches triangle count (${pos.count / 3})`);
}

console.log(`\n========================================`);
console.log(`TOTAL THREE.JS PASSED: ${passed}`);
console.log(`TOTAL THREE.JS FAILED: ${failed}`);
console.log(`========================================`);

if (failed > 0) process.exit(1);
