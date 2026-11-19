/**
 * Terraform — 3D Geometry Generation.
 * Builds:
 * 1. Non-indexed low-poly terrain mesh with organic vertex jitter and strict CCW winding
 * 2. Solid perimeter base skirt sealing the terrain borders
 * 3. Water plane mesh
 */

import * as THREE from 'three';
import { TERRAIN_SIZE } from './state.js';
import { seededRandom } from './utils.js';

/**
 * Build low-poly terrain geometry from HeightField.
 */
export function buildTerrainGeometry(heightfield, options = {}) {
  const segments = options.segments || 128;
  const heightScale = options.heightScale !== undefined ? options.heightScale : 2.5;
  const flatShading = options.flatShading !== false;
  const jitter = options.jitter || 0;
  const jitterSeed = options.jitterSeed || 42;

  const triCount = segments * segments * 2;
  const vertCount = triCount * 3;

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);

  const halfSize = TERRAIN_SIZE / 2;
  const step = TERRAIN_SIZE / segments;

  // Pre-generate grid node positions with jitter so shared vertices meet perfectly
  const gridNodesX = new Float32Array((segments + 1) * (segments + 1));
  const gridNodesZ = new Float32Array((segments + 1) * (segments + 1));
  const gridNodesY = new Float32Array((segments + 1) * (segments + 1));

  const rng = jitter > 0 ? seededRandom(jitterSeed) : null;
  const maxJitter = step * jitter * 0.35;

  for (let gy = 0; gy <= segments; gy++) {
    for (let gx = 0; gx <= segments; gx++) {
      const idx = gy * (segments + 1) + gx;
      const u = gx / segments;
      const v = gy / segments;
      let x = -halfSize + gx * step;
      let z = -halfSize + gy * step;

      // Jitter interior nodes only, leave borders perfectly aligned for base skirt
      if (rng && gx > 0 && gx < segments && gy > 0 && gy < segments) {
        x += (rng() - 0.5) * maxJitter;
        z += (rng() - 0.5) * maxJitter;
      }

      const h = heightfield.sample(u, v) * heightScale;
      gridNodesX[idx] = x;
      gridNodesZ[idx] = z;
      gridNodesY[idx] = h;
    }
  }

  let vi = 0;
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();

  for (let gy = 0; gy < segments; gy++) {
    for (let gx = 0; gx < segments; gx++) {
      const i00 = gy * (segments + 1) + gx;
      const i10 = gy * (segments + 1) + (gx + 1);
      const i01 = (gy + 1) * (segments + 1) + gx;
      const i11 = (gy + 1) * (segments + 1) + (gx + 1);

      const p00 = { x: gridNodesX[i00], y: gridNodesY[i00], z: gridNodesZ[i00] };
      const p10 = { x: gridNodesX[i10], y: gridNodesY[i10], z: gridNodesZ[i10] };
      const p01 = { x: gridNodesX[i01], y: gridNodesY[i01], z: gridNodesZ[i01] };
      const p11 = { x: gridNodesX[i11], y: gridNodesY[i11], z: gridNodesZ[i11] };

      // Alternating diagonal triangulation for natural mountain ridgelines
      // Both patterns wound CCW when viewed from above (+Y):
      const alternate = (gx + gy) % 2 === 1;

      let a1, b1, c1;
      let a2, b2, c2;

      if (alternate) {
        a1 = p00; b1 = p01; c1 = p10;
        a2 = p10; b2 = p01; c2 = p11;
      } else {
        a1 = p00; b1 = p01; c1 = p11;
        a2 = p00; b2 = p11; c2 = p10;
      }

      // Compute face normal 1
      edge1.set(b1.x - a1.x, b1.y - a1.y, b1.z - a1.z);
      edge2.set(c1.x - a1.x, c1.y - a1.y, c1.z - a1.z);
      n1.crossVectors(edge1, edge2).normalize();

      // Compute face normal 2
      edge1.set(b2.x - a2.x, b2.y - a2.y, b2.z - a2.z);
      edge2.set(c2.x - a2.x, c2.y - a2.y, c2.z - a2.z);
      n2.crossVectors(edge1, edge2).normalize();

      // Triangle 1
      for (const v of [a1, b1, c1]) {
        positions[vi * 3] = v.x;
        positions[vi * 3 + 1] = v.y;
        positions[vi * 3 + 2] = v.z;
        normals[vi * 3] = n1.x;
        normals[vi * 3 + 1] = n1.y;
        normals[vi * 3 + 2] = n1.z;
        colors[vi * 3] = 0.7;
        colors[vi * 3 + 1] = 0.7;
        colors[vi * 3 + 2] = 0.7;
        vi++;
      }

      // Triangle 2
      for (const v of [a2, b2, c2]) {
        positions[vi * 3] = v.x;
        positions[vi * 3 + 1] = v.y;
        positions[vi * 3 + 2] = v.z;
        normals[vi * 3] = n2.x;
        normals[vi * 3 + 1] = n2.y;
        normals[vi * 3 + 2] = n2.z;
        colors[vi * 3] = 0.7;
        colors[vi * 3 + 1] = 0.7;
        colors[vi * 3 + 2] = 0.7;
        vi++;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Build solid perimeter base skirt and pedestal.
 */
export function buildTerrainBaseSkirt(heightfield, segments, heightScale, baseDepth = 0.8) {
  const halfSize = TERRAIN_SIZE / 2;
  const step = TERRAIN_SIZE / segments;
  const bottomY = -baseDepth;

  // 4 perimeter edges x segments quads x 2 triangles x 3 vertices
  const vertCount = 4 * segments * 6;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);

  let vi = 0;
  const baseColor = new THREE.Color(0x3e3832); // Solid earthy pedestal stone

  function addQuad(p0, p1, p2, p3, normal) {
    const verts = [p0, p1, p2, p0, p2, p3];
    for (const v of verts) {
      positions[vi * 3] = v.x;
      positions[vi * 3 + 1] = v.y;
      positions[vi * 3 + 2] = v.z;
      normals[vi * 3] = normal.x;
      normals[vi * 3 + 1] = normal.y;
      normals[vi * 3 + 2] = normal.z;
      colors[vi * 3] = baseColor.r;
      colors[vi * 3 + 1] = baseColor.g;
      colors[vi * 3 + 2] = baseColor.b;
      vi++;
    }
  }

  // Edge 1: South (gy = 0, z = -halfSize)
  for (let gx = 0; gx < segments; gx++) {
    const x0 = -halfSize + gx * step;
    const x1 = x0 + step;
    const h0 = heightfield.sample(gx / segments, 0) * heightScale;
    const h1 = heightfield.sample((gx + 1) / segments, 0) * heightScale;
    const p0 = new THREE.Vector3(x0, h0, -halfSize);
    const p1 = new THREE.Vector3(x1, h1, -halfSize);
    const p2 = new THREE.Vector3(x1, bottomY, -halfSize);
    const p3 = new THREE.Vector3(x0, bottomY, -halfSize);
    addQuad(p0, p1, p2, p3, new THREE.Vector3(0, 0, -1));
  }

  // Edge 2: North (gy = segments, z = halfSize)
  for (let gx = 0; gx < segments; gx++) {
    const x0 = -halfSize + gx * step;
    const x1 = x0 + step;
    const h0 = heightfield.sample(gx / segments, 1) * heightScale;
    const h1 = heightfield.sample((gx + 1) / segments, 1) * heightScale;
    const p0 = new THREE.Vector3(x1, h1, halfSize);
    const p1 = new THREE.Vector3(x0, h0, halfSize);
    const p2 = new THREE.Vector3(x0, bottomY, halfSize);
    const p3 = new THREE.Vector3(x1, bottomY, halfSize);
    addQuad(p0, p1, p2, p3, new THREE.Vector3(0, 0, 1));
  }

  // Edge 3: West (gx = 0, x = -halfSize)
  for (let gy = 0; gy < segments; gy++) {
    const z0 = -halfSize + gy * step;
    const z1 = z0 + step;
    const h0 = heightfield.sample(0, gy / segments) * heightScale;
    const h1 = heightfield.sample(0, (gy + 1) / segments) * heightScale;
    const p0 = new THREE.Vector3(-halfSize, h1, z1);
    const p1 = new THREE.Vector3(-halfSize, h0, z0);
    const p2 = new THREE.Vector3(-halfSize, bottomY, z0);
    const p3 = new THREE.Vector3(-halfSize, bottomY, z1);
    addQuad(p0, p1, p2, p3, new THREE.Vector3(-1, 0, 0));
  }

  // Edge 4: East (gx = segments, x = halfSize)
  for (let gy = 0; gy < segments; gy++) {
    const z0 = -halfSize + gy * step;
    const z1 = z0 + step;
    const h0 = heightfield.sample(1, gy / segments) * heightScale;
    const h1 = heightfield.sample(1, (gy + 1) / segments) * heightScale;
    const p0 = new THREE.Vector3(halfSize, h0, z0);
    const p1 = new THREE.Vector3(halfSize, h1, z1);
    const p2 = new THREE.Vector3(halfSize, bottomY, z1);
    const p3 = new THREE.Vector3(halfSize, bottomY, z0);
    addQuad(p0, p1, p2, p3, new THREE.Vector3(1, 0, 0));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Create water plane mesh.
 */
export function createWaterMesh(size = TERRAIN_SIZE * 1.05) {
  const geo = new THREE.PlaneGeometry(size, size, 8, 8);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3388bb,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
