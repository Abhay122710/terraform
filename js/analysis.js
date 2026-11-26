/**
 * Terraform — Analysis & Inspection Views.
 * Views:
 * - shaded: Full PBR terrain shading with elevation & slope rock
 * - slope: Slope angle heatmap (0° Green → 30° Yellow → 60° Red)
 * - height: Normalized elevation heatmap (Blue → Cyan → Green → Yellow → White)
 * - contour: Topographical contour elevation isolines
 * - wireframe: Facet wireframe overlay
 * - debug-green: Solid diagnostic green to verify baseline lighting
 */

import * as THREE from 'three';
import { clamp } from './utils.js';

const up = new THREE.Vector3(0, 1, 0);
const tmpNormal = new THREE.Vector3();
const tmpColor = new THREE.Color();
const tmpV1 = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const tmpV3 = new THREE.Vector3();
const tmpEdge1 = new THREE.Vector3();
const tmpEdge2 = new THREE.Vector3();

/**
 * Apply analytical vertex colors.
 */
export function applyAnalysisColours(geometry, mode, maxY, contourInterval = 0.1) {
  if (mode === 'shaded' || mode === 'wireframe') return;

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = geometry.getAttribute('color');

  if (mode === 'debug-green') {
    const green = new THREE.Color(0x789b45);
    for (let i = 0; i < colors.count; i++) {
      colors.setXYZ(i, green.r, green.g, green.b);
    }
    colors.needsUpdate = true;
    return;
  }

  const blue = new THREE.Color(0x0000aa);
  const cyan = new THREE.Color(0x00aaff);
  const midGreen = new THREE.Color(0x00cc44);
  const yellow = new THREE.Color(0xffff00);
  const white = new THREE.Color(0xffffff);

  for (let i = 0; i < positions.count; i += 3) {
    const avgY = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    const t = clamp(avgY / Math.max(maxY, 0.001), 0, 1);

    tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
    const slopeAngle = Math.acos(clamp(tmpNormal.dot(up), -1, 1));
    const slopeDeg = (slopeAngle * 180) / Math.PI;

    switch (mode) {
      case 'slope': {
        // Green (0°) → Yellow (30°) → Red (60°+)
        const s = clamp(slopeDeg / 60, 0, 1);
        if (s < 0.5) {
          tmpColor.setRGB(s * 2, 1, 0); // Green -> Yellow
        } else {
          tmpColor.setRGB(1, 1 - (s - 0.5) * 2, 0); // Yellow -> Red
        }
        break;
      }

      case 'height': {
        // Blue (low) → Cyan → Green → Yellow → White (high)
        if (t < 0.25) {
          tmpColor.lerpColors(blue, cyan, t / 0.25);
        } else if (t < 0.5) {
          tmpColor.lerpColors(cyan, midGreen, (t - 0.25) / 0.25);
        } else if (t < 0.75) {
          tmpColor.lerpColors(midGreen, yellow, (t - 0.5) / 0.25);
        } else {
          tmpColor.lerpColors(yellow, white, (t - 0.75) / 0.25);
        }
        break;
      }

      case 'contour': {
        const interval = contourInterval || 0.1;
        const mod = t % interval;
        const lineWidth = 0.008;
        const isContour = mod < lineWidth || mod > interval - lineWidth;
        if (isContour) {
          tmpColor.setRGB(1, 1, 1);
        } else {
          const grey = 0.25 + t * 0.45;
          tmpColor.setRGB(grey, grey, grey);
        }
        break;
      }
    }

    for (let j = 0; j < 3; j++) {
      colors.setXYZ(i + j, tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  colors.needsUpdate = true;
}

/**
 * Compute face slope angle in degrees from normal vector.
 */
export function computeFaceSlope(normal) {
  const angle = Math.acos(clamp(normal.dot(up), -1, 1));
  return (angle * 180) / Math.PI;
}

/**
 * Calculate minimum, maximum, arithmetic average elevation (normalized [0, 1]),
 * and area-weighted average slope in degrees from valid terrain faces only
 * (excludes water plane and base skirt geometry).
 */
export function calculateTerrainStatistics(heightfield, terrainGeometry) {
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  let totalElevation = 0;
  let validSamples = 0;

  if (heightfield && heightfield.data && heightfield.data.length > 0) {
    const data = heightfield.data;
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (!Number.isFinite(val)) continue;
      if (val < minElevation) minElevation = val;
      if (val > maxElevation) maxElevation = val;
      totalElevation += val;
      validSamples++;
    }
  }

  const avgElevation = validSamples > 0 ? totalElevation / validSamples : 0;
  if (validSamples === 0) {
    minElevation = 0;
    maxElevation = 0;
  }

  let totalArea = 0;
  let weightedSlopeSum = 0;

  if (terrainGeometry) {
    const posAttr = terrainGeometry.getAttribute('position');
    if (posAttr && posAttr.count >= 3) {
      const triangleCount = Math.floor(posAttr.count / 3);
      for (let i = 0; i < triangleCount; i++) {
        const idx = i * 3;
        tmpV1.fromBufferAttribute(posAttr, idx);
        tmpV2.fromBufferAttribute(posAttr, idx + 1);
        tmpV3.fromBufferAttribute(posAttr, idx + 2);

        tmpEdge1.subVectors(tmpV2, tmpV1);
        tmpEdge2.subVectors(tmpV3, tmpV1);

        // Cross product length equals 2 * triangle area
        tmpNormal.crossVectors(tmpEdge1, tmpEdge2);
        const doubleArea = tmpNormal.length();

        if (doubleArea > 1e-8) {
          tmpNormal.divideScalar(doubleArea);
          // Ensure normal points into upper hemisphere before computing slope angle
          if (tmpNormal.y < 0) tmpNormal.negate();
          const slopeDeg = computeFaceSlope(tmpNormal);
          const area = doubleArea * 0.5;
          weightedSlopeSum += slopeDeg * area;
          totalArea += area;
        }
      }
    }
  }

  const avgSlope = totalArea > 0 ? weightedSlopeSum / totalArea : 0;

  return {
    minElevation,
    maxElevation,
    avgElevation,
    avgSlope,
  };
}

/**
 * Get slope angle in degrees for a given face index.
 */
export function getFaceSlope(geometry, faceIndex) {
  const normals = geometry.getAttribute('normal');
  const i = faceIndex * 3;
  if (!normals || i >= normals.count) return 0;
  tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
  const angle = Math.acos(clamp(tmpNormal.dot(up), -1, 1));
  return (angle * 180) / Math.PI;
}

/**
 * Setup raycaster hover readout for height, slope, and world position.
 */
export function setupRaycasterHover(camera, canvas, getTerrainMesh, getHeightScale) {
  const readoutEl = document.getElementById('hover-readout');
  if (!readoutEl) return;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const mesh = getTerrainMesh();
    if (!mesh) {
      readoutEl.classList.remove('visible');
      return;
    }

    const intersects = raycaster.intersectObject(mesh);
    if (intersects.length === 0) {
      readoutEl.classList.remove('visible');
      return;
    }

    const hit = intersects[0];
    const point = hit.point;
    const faceIdx = hit.faceIndex || 0;
    const hScale = getHeightScale();

    const normalizedHeight = clamp(point.y / Math.max(hScale, 0.001), 0, 1);
    const slope = getFaceSlope(mesh.geometry, faceIdx);

    readoutEl.classList.add('visible');
    readoutEl.innerHTML = `
      <div class="readout-row"><span class="readout-label">Height:</span> <span class="readout-val">${normalizedHeight.toFixed(3)}</span></div>
      <div class="readout-row"><span class="readout-label">Slope:</span> <span class="readout-val">${slope.toFixed(1)}°</span></div>
      <div class="readout-row"><span class="readout-label">Pos:</span> <span class="readout-val">${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}</span></div>
    `;
  });

  canvas.addEventListener('mouseleave', () => {
    readoutEl.classList.remove('visible');
  });
}
