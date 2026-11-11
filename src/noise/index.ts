/**
 * Unified noise generator.
 * Dispatches to the appropriate noise function by type.
 */

import { NoiseType } from '../core/types';
import { simplexFBm } from './simplex';
import { perlinFBm } from './perlin';
import { ridgedFBm } from './ridged';
import { billowFBm } from './billow';
import { voronoiNoise } from './voronoi';

export interface NoiseGeneratorParams {
  type: NoiseType;
  size: number;
  seed: number;
  scale: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
}

/**
 * Generate a noise heightfield as Float32Array (size×size), normalized [0,1].
 */
export function generateNoise(params: NoiseGeneratorParams): Float32Array {
  const { type, size, seed, scale, octaves, lacunarity, persistence } = params;

  switch (type) {
    case 'simplex':
      return simplexFBm(size, seed, scale, octaves, lacunarity, persistence);
    case 'perlin':
      return perlinFBm(size, seed, scale, octaves, lacunarity, persistence);
    case 'ridged':
      return ridgedFBm(size, seed, scale, octaves, lacunarity, persistence);
    case 'billow':
      return billowFBm(size, seed, scale, octaves, lacunarity, persistence);
    case 'voronoi':
      return voronoiNoise(size, seed, scale, octaves, lacunarity, persistence);
    default:
      throw new Error(`Unknown noise type: ${type}`);
  }
}

