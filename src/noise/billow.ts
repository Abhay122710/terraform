/**
 * Billow noise — uses simplex as base with abs() for billowy clouds/hills.
 */

import { simplex2D } from './simplex';

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
 * Generate billow noise — abs(simplex) for soft rolling hills.
 */
export function billowFBm(
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
      let maxAmp = 0;

      for (let o = 0; o < octaves; o++) {
        const nx = (x / size) * scale * frequency;
        const ny = (y / size) * scale * frequency;
        const signal = Math.abs(simplex2D(nx, ny, perm));
        value += signal * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }

      data[y * size + x] = value / maxAmp;
    }
  }

  return data;
}

