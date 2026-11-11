/**
 * Low-poly mesh builder.
 * Creates a non-indexed BufferGeometry from a HeightField with flat per-face normals.
 * Supports organic vertex jitter for stylized low-poly mountain peaks and ridges.
 * 
 * CRITICAL NORMAL CALCULATION:
 * Triangle vertices must be ordered with Counter-Clockwise (CCW) winding when viewed from +Y
 * so that cross product (edge1 x edge2) produces an outward, upward-facing normal (n.y > 0).
 */

import * as THREE from 'three';
import { HeightField } from '../core/heightfield';
import { TERRAIN_SIZE } from '../core/types';

export interface MeshOptions {
  /** Grid segments (the mesh will have segments×segments quads = 2×segments² triangles) */
  segments: number;
  /** Height scale multiplier in world units */
  heightScale: number;
  /** Whether to use flat shading (true) or smooth (false) */
  flatShading: boolean;
  /** Vertex jitter amount 0..1 for organic look */
  jitter: number;
  /** Random seed for jitter */
  jitterSeed: number;
}

const DEFAULT_MESH_OPTIONS: MeshOptions = {
  segments: 128,
  heightScale: 2.5,
  flatShading: true,
  jitter: 0.12,
  jitterSeed: 42,
};

/** Simple seeded pseudo-random number generator */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Build a low-poly terrain mesh from a heightfield.
 * Returns non-indexed geometry with position, normal, and color attributes.
 */
export function buildTerrainGeometry(
  heightfield: HeightField,
  options: Partial<MeshOptions> = {}
): THREE.BufferGeometry {
  const opts = { ...DEFAULT_MESH_OPTIONS, ...options };
  const { segments, heightScale, flatShading, jitter, jitterSeed } = opts;

  const triCount = segments * segments * 2;
  const vertCount = triCount * 3;

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);

  const halfSize = TERRAIN_SIZE / 2;
  const step = TERRAIN_SIZE / segments;

  // Pre-generate grid node positions with jitter so adjacent triangles share corner vertex positions cleanly
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

      // Jitter interior vertices
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

  for (let gy = 0; gy < segments; gy++) {
    for (let gx = 0; gx < segments; gx++) {
      const i00 = gy * (segments + 1) + gx;
      const i10 = gy * (segments + 1) + (gx + 1);
      const i01 = (gy + 1) * (segments + 1) + gx;
      const i11 = (gy + 1) * (segments + 1) + (gx + 1);

      const p00 = new THREE.Vector3(gridNodesX[i00], gridNodesY[i00], gridNodesZ[i00]);
      const p10 = new THREE.Vector3(gridNodesX[i10], gridNodesY[i10], gridNodesZ[i10]);
      const p01 = new THREE.Vector3(gridNodesX[i01], gridNodesY[i01], gridNodesZ[i01]);
      const p11 = new THREE.Vector3(gridNodesX[i11], gridNodesY[i11], gridNodesZ[i11]);

      // Alternating diagonal triangulation for natural mountain slopes & ridgelines
      // Both patterns are strictly CCW wound so outward normal points UP:
      const alternate = (gx + gy) % 2 === 1;

      let a1: THREE.Vector3, b1: THREE.Vector3, c1: THREE.Vector3;
      let a2: THREE.Vector3, b2: THREE.Vector3, c2: THREE.Vector3;

      if (alternate) {
        // Diagonal from 01 to 10:
        // Triangle 1: p00 -> p01 -> p10
        a1 = p00; b1 = p01; c1 = p10;
        // Triangle 2: p10 -> p01 -> p11
        a2 = p10; b2 = p01; c2 = p11;
      } else {
        // Diagonal from 00 to 11:
        // Triangle 1: p00 -> p01 -> p11
        a1 = p00; b1 = p01; c1 = p11;
        // Triangle 2: p00 -> p11 -> p10
        a2 = p00; b2 = p11; c2 = p10;
      }

      // Compute face normal 1: edge1 = (b1 - a1), edge2 = (c1 - a1)
      const edge1 = new THREE.Vector3().subVectors(b1, a1);
      const edge2 = new THREE.Vector3().subVectors(c1, a1);
      const n1 = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

      // Compute face normal 2: edge3 = (b2 - a2), edge4 = (c2 - a2)
      const edge3 = new THREE.Vector3().subVectors(b2, a2);
      const edge4 = new THREE.Vector3().subVectors(c2, a2);
      const n2 = new THREE.Vector3().crossVectors(edge3, edge4).normalize();

      const grey = 0.7;

      // Triangle 1
      for (const v of [a1, b1, c1]) {
        positions[vi * 3] = v.x;
        positions[vi * 3 + 1] = v.y;
        positions[vi * 3 + 2] = v.z;
        if (flatShading) {
          normals[vi * 3] = n1.x;
          normals[vi * 3 + 1] = n1.y;
          normals[vi * 3 + 2] = n1.z;
        }
        colors[vi * 3] = grey;
        colors[vi * 3 + 1] = grey;
        colors[vi * 3 + 2] = grey;
        vi++;
      }

      // Triangle 2
      for (const v of [a2, b2, c2]) {
        positions[vi * 3] = v.x;
        positions[vi * 3 + 1] = v.y;
        positions[vi * 3 + 2] = v.z;
        if (flatShading) {
          normals[vi * 3] = n2.x;
          normals[vi * 3 + 1] = n2.y;
          normals[vi * 3 + 2] = n2.z;
        }
        colors[vi * 3] = grey;
        colors[vi * 3 + 1] = grey;
        colors[vi * 3 + 2] = grey;
        vi++;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  if (!flatShading) {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}

/**
 * Compute face slope in degrees from surface normal.
 */
export function computeFaceSlope(normal: THREE.Vector3): number {
  const up = new THREE.Vector3(0, 1, 0);
  const angle = Math.acos(Math.min(1, Math.max(-1, normal.dot(up))));
  return (angle * 180) / Math.PI;
}
