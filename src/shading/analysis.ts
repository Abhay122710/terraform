/**
 * Analysis view colouring: slope heatmap, height heatmap, contour lines.
 */

import * as THREE from 'three';
import type { ViewMode } from '../core/types';

const up = new THREE.Vector3(0, 1, 0);
const tmpNormal = new THREE.Vector3();
const tmpColor = new THREE.Color();

/**
 * Apply analysis colouring to geometry based on view mode.
 * @param maxY Max height in world coords (for normalizing)
 * @param contourInterval Interval between contour lines (0..1 range)
 */
export function applyAnalysisColours(
  geometry: THREE.BufferGeometry,
  mode: ViewMode,
  maxY: number,
  contourInterval: number = 0.1
): void {
  if (mode === 'shaded' || mode === 'wireframe') return; // handled elsewhere

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = geometry.getAttribute('color');

  for (let i = 0; i < positions.count; i += 3) {
    const avgY = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    const t = Math.max(0, Math.min(1, avgY / Math.max(maxY, 0.001)));

    tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
    const slopeAngle = Math.acos(Math.min(1, Math.max(-1, tmpNormal.dot(up))));
    const slopeDeg = (slopeAngle * 180) / Math.PI;

    switch (mode) {
      case 'slope': {
        // Green (0°) → Yellow (30°) → Red (60°+)
        const s = Math.min(1, slopeDeg / 60);
        if (s < 0.5) {
          tmpColor.setRGB(s * 2, 1, 0); // green → yellow
        } else {
          tmpColor.setRGB(1, 1 - (s - 0.5) * 2, 0); // yellow → red
        }
        break;
      }
      case 'height': {
        // Blue (low) → Cyan → Green → Yellow → White (high)
        if (t < 0.25) {
          tmpColor.lerpColors(new THREE.Color(0x0000aa), new THREE.Color(0x00aaff), t / 0.25);
        } else if (t < 0.5) {
          tmpColor.lerpColors(new THREE.Color(0x00aaff), new THREE.Color(0x00cc44), (t - 0.25) / 0.25);
        } else if (t < 0.75) {
          tmpColor.lerpColors(new THREE.Color(0x00cc44), new THREE.Color(0xffff00), (t - 0.5) / 0.25);
        } else {
          tmpColor.lerpColors(new THREE.Color(0xffff00), new THREE.Color(0xffffff), (t - 0.75) / 0.25);
        }
        break;
      }
      case 'contour': {
        // Dark base with bright lines at height intervals
        const interval = contourInterval || 0.1;
        const mod = t % interval;
        const lineWidth = 0.008;
        const isContour = mod < lineWidth || mod > interval - lineWidth;
        if (isContour) {
          tmpColor.setRGB(1, 1, 1);
        } else {
          // Subtle height-based grey
          const grey = 0.15 + t * 0.25;
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
 * Get slope in degrees at a specific face index (for readout).
 */
export function getFaceSlope(geometry: THREE.BufferGeometry, faceIndex: number): number {
  const normals = geometry.getAttribute('normal');
  const i = faceIndex * 3;
  if (i >= normals.count) return 0;
  tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
  const angle = Math.acos(Math.min(1, Math.max(-1, tmpNormal.dot(up))));
  return (angle * 180) / Math.PI;
}

