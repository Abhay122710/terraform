/**
 * Terraform — Materials, Colour Palettes, and Shading.
 * Color themes:
 * - Mountain Reference (Stylized natural greens, earthy midlands, rocky cliffs, pale summits)
 * - Alpine High Country
 * - Desert / Canyon
 * - Volcanic Caldera
 * - Arctic Tundra
 */

import * as THREE from 'three';
import { clamp } from './utils.js';

export const PALETTES = {
  'mountain-reference': {
    name: 'Mountain Reference',
    bands: [
      { maxHeight: 0.18, color: 0x789b45, label: 'Natural Grass Green' },
      { maxHeight: 0.36, color: 0x86a64e, label: 'Lowland Meadow' },
      { maxHeight: 0.54, color: 0x94744b, label: 'Olive / Earthy Brown' },
      { maxHeight: 0.72, color: 0x80634d, label: 'Rocky Brown Slopes' },
      { maxHeight: 0.88, color: 0xa3a09a, label: 'Grey Mountain Rock' },
      { maxHeight: 1.00, color: 0xc4c0b6, label: 'Light Summit Stone' },
    ],
    rockColor: 0x80634d,
    cliffColor: 0x6e523f,
    snowColor: 0xe8e6df,
  },
  alpine: {
    name: 'Alpine High Country',
    bands: [
      { maxHeight: 0.18, color: 0x62963b, label: 'Valley Green' },
      { maxHeight: 0.38, color: 0x78a848, label: 'Alpine Meadow' },
      { maxHeight: 0.56, color: 0x8a7a58, label: 'Highland Soil' },
      { maxHeight: 0.74, color: 0x8a7060, label: 'Scree Slope' },
      { maxHeight: 0.88, color: 0x9e9b94, label: 'Grey Granite' },
      { maxHeight: 1.00, color: 0xe6e4dc, label: 'Snow Summit' },
    ],
    rockColor: 0x7d6350,
    cliffColor: 0x5e4838,
    snowColor: 0xf5f5fa,
  },
  desert: {
    name: 'Desert / Canyon',
    bands: [
      { maxHeight: 0.20, color: 0xd8af72, label: 'Dune Basin' },
      { maxHeight: 0.40, color: 0xce9254, label: 'Sandstone Plain' },
      { maxHeight: 0.60, color: 0xc07840, label: 'Mesa Tier' },
      { maxHeight: 0.80, color: 0xaa5830, label: 'Red Rock Cliff' },
      { maxHeight: 1.00, color: 0xd28654, label: 'Canyon Rim' },
    ],
    rockColor: 0xa0542e,
    cliffColor: 0x7e3c1c,
    snowColor: 0xf0d8be,
  },
  volcanic: {
    name: 'Volcanic Caldera',
    bands: [
      { maxHeight: 0.18, color: 0x48484e, label: 'Basalt Plain' },
      { maxHeight: 0.35, color: 0x645e5e, label: 'Volcanic Ash' },
      { maxHeight: 0.54, color: 0x845454, label: 'Scoria Ridge' },
      { maxHeight: 0.75, color: 0xcc4818, label: 'Magma Slag' },
      { maxHeight: 1.00, color: 0xff6a00, label: 'Molten Ridge' },
    ],
    rockColor: 0x544c4c,
    cliffColor: 0x3a3232,
    snowColor: 0xffb070,
  },
  arctic: {
    name: 'Arctic Tundra',
    bands: [
      { maxHeight: 0.20, color: 0x5f869e, label: 'Frozen Waterway' },
      { maxHeight: 0.40, color: 0x90aec0, label: 'Tundra Moss' },
      { maxHeight: 0.60, color: 0xb8ccd8, label: 'Permafrost' },
      { maxHeight: 0.80, color: 0xdceaf4, label: 'Glacial Ice' },
      { maxHeight: 1.00, color: 0xffffff, label: 'Ice Peak' },
    ],
    rockColor: 0x7a8e9e,
    cliffColor: 0x566878,
    snowColor: 0xffffff,
  },
};

export function getPalette(name) {
  return PALETTES[name] || PALETTES['mountain-reference'];
}

export function getPaletteList() {
  return Object.keys(PALETTES).map((key) => ({
    id: key,
    name: PALETTES[key].name,
  }));
}

const up = new THREE.Vector3(0, 1, 0);
const tmpNormal = new THREE.Vector3();
const tmpColor = new THREE.Color();

/**
 * Apply height-band + slope-override coloring to terrain geometry.
 */
export function applyTerrainColours(geometry, options = {}) {
  const palette = getPalette(options.palette);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = geometry.getAttribute('color');
  const steepRad = ((options.steepnessThreshold || 38) * Math.PI) / 180;
  const maxY = options.heightScale || 2.5;

  const rockColor = new THREE.Color(palette.rockColor);
  const cliffColor = new THREE.Color(palette.cliffColor || palette.rockColor);
  const snowColor = new THREE.Color(palette.snowColor || 0xffffff);

  for (let i = 0; i < positions.count; i += 3) {
    const avgY = (positions.getY(i) + positions.getY(i + 1) + positions.getY(i + 2)) / 3;
    const t = clamp(avgY / Math.max(maxY, 0.001), 0, 1);

    tmpNormal.set(normals.getX(i), normals.getY(i), normals.getZ(i));
    const slopeAngle = Math.acos(clamp(tmpNormal.dot(up), -1, 1));
    const slopeDeg = (slopeAngle * 180) / Math.PI;

    // 1. Elevation base color
    let bandColor = palette.bands[palette.bands.length - 1].color;
    for (let b = 0; b < palette.bands.length; b++) {
      if (t <= palette.bands[b].maxHeight) {
        bandColor = palette.bands[b].color;
        break;
      }
    }
    tmpColor.setHex(bandColor);

    // 2. High peaks get snowy / pale highlights
    if (t > 0.85 && slopeAngle < steepRad * 0.9) {
      const snowBlend = (t - 0.85) / 0.15;
      tmpColor.lerp(snowColor, snowBlend * 0.75);
    }

    // 3. Slope override: steep faces transition to rock and dark cliffs
    if (slopeAngle > steepRad) {
      const steepFactor = Math.min(1, (slopeAngle - steepRad) / (Math.PI / 6));
      if (slopeDeg > 52) {
        const cliffFactor = Math.min(1, (slopeDeg - 52) / 20);
        const blendedRock = rockColor.clone().lerp(cliffColor, cliffFactor);
        tmpColor.lerp(blendedRock, steepFactor);
      } else {
        tmpColor.lerp(rockColor, steepFactor);
      }
    } else if (t < 0.35 && slopeAngle < steepRad * 0.6) {
      // Gentle lowland gets lush base green tint
      const lowGreen = new THREE.Color(palette.bands[0].color);
      tmpColor.lerp(lowGreen, 0.35 * (1 - t / 0.35));
    }

    for (let j = 0; j < 3; j++) {
      colors.setXYZ(i + j, tmpColor.r, tmpColor.g, tmpColor.b);
    }
  }

  colors.needsUpdate = true;
}

/**
 * Create standard outdoor terrain material.
 */
export function createTerrainMaterial(flatShading = true) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: Boolean(flatShading),
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
}

/**
 * Create skirt material.
 */
export function createSkirtMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
}

/**
 * Safely dispose a Three.js mesh and free GPU memory.
 */
export function disposeMesh(mesh) {
  if (!mesh) return;
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
}
