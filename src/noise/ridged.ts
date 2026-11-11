/**
 * Ridged multifractal noise — uses simplex as base.
 */

import { simplex2D } from './simplex';

/** Seeded permutation table (duplicated for worker isolation) */
function buildPermutation(seed: number): Uint8Array {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  let s = seed;
  const next = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  return perm;
}

/**
 * Generate ridged multifractal noise.
 * abs(noise) inverted → sharp ridges.
 */
export function ridgedFBm(
  size: number,
  seed: number,
  scale: number,
  octaves: number,
  lacunarity: number,
  persistence: number
): Float32Array {
  const perm = buildPermutation(seed);
  const data = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amplitude = 1;
      let frequency = 1;
      let value = 0;
      let weight = 1;

      for (let o = 0; o < octaves; o++) {
        const nx = (x / size) * scale * frequency;
        const ny = (y / size) * scale * frequency;
        let signal = simplex2D(nx, ny, perm);
        signal = 1.0 - Math.abs(signal); // Ridges
        signal *= signal; // Sharpen
        signal *= weight;
        weight = Math.min(1, Math.max(0, signal * 2));
        value += signal * amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }

      data[y * size + x] = value;
    }
  }

  // Normalize
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i] - min) / range;
  }

  return data;
}

