/**
 * Terrain base skirt and ground pedestal.
 * Solidly seals the perimeter of the terrain mesh so it doesn't float disconnectedly in air.
 */

import * as THREE from 'three';
import { HeightField } from '../core/heightfield';
import { TERRAIN_SIZE } from '../core/types';

export function buildTerrainBaseSkirt(
  heightfield: HeightField,
  segments: number,
  heightScale: number,
  baseDepth: number = 1.2
): THREE.BufferGeometry {
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

  function addQuad(
    p0: THREE.Vector3,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    normal: THREE.Vector3
  ) {
    // 2 triangles: (p0, p1, p2) and (p0, p2, p3)
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
  return geometry;
}

