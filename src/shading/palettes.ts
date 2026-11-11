/**
 * Colour palettes for terrain shading.
 * Vibrant, physically grounded outdoor tones with clean distinction between:
 * - Low elevation: natural grass green (#789B45)
 * - Mid elevation: olive and earthy brown (#94744B)
 * - Steep slopes: rocky brown (#80634D)
 * - High elevation: grey rock (#A3A09A)
 * - Highest peaks: light stone (#C4C0B6)
 */

import type { Palette } from '../core/types';

export const PALETTES: Record<string, Palette> = {
  'mountain-reference': {
    name: 'Mountain Reference (Stylized)',
    bands: [
      { maxHeight: 0.18, color: 0x789b45, label: 'Natural Grass Green' },  // #789B45 Low elevation
      { maxHeight: 0.36, color: 0x86a64e, label: 'Lowland Meadow' },       // Lush meadow transition
      { maxHeight: 0.54, color: 0x94744b, label: 'Olive / Earthy Brown' }, // #94744B Mid elevation
      { maxHeight: 0.72, color: 0x80634d, label: 'Rocky Brown Slopes' },   // #80634D Rocky slopes
      { maxHeight: 0.88, color: 0xa3a09a, label: 'Grey Mountain Rock' },   // #A3A09A High elevation
      { maxHeight: 1.00, color: 0xc4c0b6, label: 'Light Summit Stone' },   // #C4C0B6 Highest peaks
    ],
    rockColor: 0x80634d,   // Rocky brown (#80634D) for steep faces
    cliffColor: 0x6e523f,  // Deep cliff brown
    snowColor: 0xe8e6df,   // Light summit stone highlight
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
  },
};

export function getPalette(name: string): Palette {
  return PALETTES[name] || PALETTES['mountain-reference'];
}

export function getPaletteNames(): string[] {
  return Object.keys(PALETTES);
}
