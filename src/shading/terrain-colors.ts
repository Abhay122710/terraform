/**
 * Terrain colouring: per-face height-band + slope-based rock override + peak highlights.
 * Accurately models the reference image: lush green plains, steep rocky cliffs,
 * and pale mountain peaks.
 */

import * as THREE from 'three';
import { getPalette } from './palettes';

export interface ColourOptions {
  palette: string;
  steepnessThreshold: number; // degrees — above this, force rock/cliff colour
  heightScale: number;
}

const tmpNormal = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/**
 * Apply height-band + slope-based colouring to terrain geometry.
 * Operates on non-indexed geometry per-face (3 vertices per triangle).
 */
export function applyTerrainColours(
  geometry: THREE.BufferGeometry,
  options: ColourOptions
): void {
  const palette = getPalette(options.palette);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = geometry.getAttribute('color');
  const steepRad = (options.steepnessThreshold * Math.PI) / 180;
  const maxY = options.heightScale;

  const tmpColor = new THREE.Color();
  const rockColor = new THREE.Color(palette.rockColor);
  const cliffColor = new THREE.Color(palette.cliffColor ?? palette.rockColor);
  const snowColor = new THREE.Color(palette.snowColor ?? 0xffffff);

  // Process each face (3 vertices at a time)
  for (let i = 0; i < positions.count; i += 3) {
    // Average height of the face
    const avgY = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    const t = Math.max(0, Math.min(1, avgY / Math.max(maxY, 0.001)));

    // Face normal
    tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
    const slopeAngle = Math.acos(Math.min(1, Math.max(-1, tmpNormal.dot(up))));
    const slopeDeg = (slopeAngle * 180) / Math.PI;

    // 1. Base colour from elevation bands
    let bandColor = palette.bands[palette.bands.length - 1].color;
    for (const band of palette.bands) {
      if (t <= band.maxHeight) {
        bandColor = band.color;
        break;
      }
    }
    tmpColor.setHex(bandColor);

    // 2. High peaks get extra rocky/snowy highlights if elevation is high (> 0.75) and fairly flat
    if (t > 0.85 && slopeAngle < steepRad * 0.9) {
      const snowBlend = (t - 0.85) / 0.15;
      tmpColor.lerp(snowColor, snowBlend * 0.75);
    }

    // 3. Slope override: steep faces become rock or dark cliff
    if (slopeAngle > steepRad) {
      // Transition smoothly from grass to rock
      const steepFactor = Math.min(1, (slopeAngle - steepRad) / (Math.PI / 6));
      
      // Moderately steep -> rockColor
      // Extremely steep (> 55 degrees) -> cliffColor
      if (slopeDeg > 52) {
        const cliffFactor = Math.min(1, (slopeDeg - 52) / 20);
        const blendedRock = rockColor.clone().lerp(cliffColor, cliffFactor);
        tmpColor.lerp(blendedRock, steepFactor);
      } else {
        tmpColor.lerp(rockColor, steepFactor);
      }
    } else if (t < 0.35 && slopeAngle < steepRad * 0.6) {
      // Low elevation flat areas: guarantee rich, warm green grassland
      // Add subtle height tinting
      const lowGreen = new THREE.Color(palette.bands[0].color);
      tmpColor.lerp(lowGreen, 0.35 * (1 - t / 0.35));
    }

    // Apply color to all 3 vertices of the face
    for (let j = 0; j < 3; j++) {
      colors.setXYZ(i + j, tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  colors.needsUpdate = true;
}
