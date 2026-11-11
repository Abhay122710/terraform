/**
 * Colour palettes for terrain shading.
 */

import type { Palette } from '../core/types';

export const PALETTES: Record<string, Palette> = {
  'mountain-reference': {
    name: 'Mountain Reference (Stylized)',
    bands: [
      { maxHeight: 0.16, color: 0x4f7d32, label: 'Lush Lowland' },
      { maxHeight: 0.32, color: 0x62963b, label: 'Green Grass' },
      { maxHeight: 0.48, color: 0x738b4d, label: 'Slope Highland' },
      { maxHeight: 0.64, color: 0x787268, label: 'Rocky Scree' },
      { maxHeight: 0.78, color: 0x8a847b, label: 'Mountain Rock' },
      { maxHeight: 0.90, color: 0xc8c3bc, label: 'Sub-Alpine Peak' },
      { maxHeight: 1.00, color: 0xf5f8fc, label: 'Snow Peak' },
    ],
    rockColor: 0x58524b,
    cliffColor: 0x423d38,
    snowColor: 0xffffff,
  },
  alpine: {
    name: 'Alpine',
    bands: [
      { maxHeight: 0.18, color: 0x4b7835, label: 'Valley Grass' },
      { maxHeight: 0.36, color: 0x5a8c3a, label: 'Meadow' },
      { maxHeight: 0.55, color: 0x3d6b28, label: 'Forest' },
      { maxHeight: 0.75, color: 0x7a7068, label: 'Rock' },
      { maxHeight: 0.88, color: 0xb5b0a8, label: 'High Rock' },
      { maxHeight: 1.00, color: 0xf0f3f6, label: 'Snow' },
    ],
    rockColor: 0x5a524a,
    cliffColor: 0x3c3834,
  },
  desert: {
    name: 'Desert / Canyon',
    bands: [
      { maxHeight: 0.20, color: 0xd4a574, label: 'Dune Basin' },
      { maxHeight: 0.40, color: 0xc4955a, label: 'Sand Plains' },
      { maxHeight: 0.60, color: 0xb08040, label: 'Dry Mesa' },
      { maxHeight: 0.80, color: 0x8b5930, label: 'Red Rock' },
      { maxHeight: 1.00, color: 0xc08060, label: 'Canyon Peak' },
    ],
    rockColor: 0x7c4928,
    cliffColor: 0x5a2d18,
  },
  volcanic: {
    name: 'Volcanic Caldera',
    bands: [
      { maxHeight: 0.15, color: 0x1f1f22, label: 'Basalt' },
      { maxHeight: 0.32, color: 0x363232, label: 'Ash Field' },
      { maxHeight: 0.52, color: 0x523a3a, label: 'Lava Rock' },
      { maxHeight: 0.72, color: 0x8f2600, label: 'Magma' },
      { maxHeight: 1.00, color: 0xff5500, label: 'Molten Ridge' },
    ],
    rockColor: 0x221a1a,
    cliffColor: 0x161010,
  },
  arctic: {
    name: 'Arctic Tundra',
    bands: [
      { maxHeight: 0.20, color: 0x3e5e74, label: 'Frozen Plain' },
      { maxHeight: 0.40, color: 0x718f9e, label: 'Tundra' },
      { maxHeight: 0.60, color: 0x9eb8c8, label: 'Ice Field' },
      { maxHeight: 0.80, color: 0xcce0ee, label: 'Glacier' },
      { maxHeight: 1.00, color: 0xffffff, label: 'Ice Peak' },
    ],
    rockColor: 0x4f606e,
    cliffColor: 0x36434d,
  },
};

export function getPalette(name: string): Palette {
  return PALETTES[name] || PALETTES['mountain-reference'];
}

export function getPaletteNames(): string[] {
  return Object.keys(PALETTES);
}
