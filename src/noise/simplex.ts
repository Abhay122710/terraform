/**
 * Simplex 2D noise implementation with fBm.
 * Based on Stefan Gustavson's implementation.
 */

// Gradient vectors for 2D
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** Seeded permutation table */
function buildPermutation(seed: number): Uint8Array {
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);

  // Initialize with identity
  for (let i = 0; i < 256; i++) base[i] = i;

  // Fisher-Yates shuffle with seeded PRNG
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

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

function dot2(g: number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

/** Single-sample 2D Simplex noise, returns [-1, 1] */
export function simplex2D(x: number, y: number, perm: Uint8Array): number {
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;

  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  let i1: number, j1: number;
  if (x0 > y0) {
    i1 = 1; j1 = 0;
  } else {
    i1 = 0; j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  const gi0 = perm[ii + perm[jj]] % 8;
  const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
  const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    n0 = t0 * t0 * dot2(GRAD2[gi0], x0, y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    n1 = t1 * t1 * dot2(GRAD2[gi1], x1, y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    n2 = t2 * t2 * dot2(GRAD2[gi2], x2, y2);
  }

  return 70 * (n0 + n1 + n2);
}

/**
 * Generate a heightfield using Simplex fBm.
 */
export function simplexFBm(
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
        value += simplex2D(nx, ny, perm) * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }

      // Normalize to [0, 1]
      data[y * size + x] = (value / maxAmp + 1) * 0.5;
    }
  }

  return data;
}

