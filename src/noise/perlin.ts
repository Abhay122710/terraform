/**
 * Classic Perlin 2D noise with fBm.
 */

/** Seeded permutation table */
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

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function dot2(g: number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

/** Single-sample 2D Perlin noise, returns [-1, 1] */
export function perlin2D(x: number, y: number, perm: Uint8Array): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[xi + perm[yi]] % 8;
  const ab = perm[xi + perm[yi + 1]] % 8;
  const ba = perm[xi + 1 + perm[yi]] % 8;
  const bb = perm[xi + 1 + perm[yi + 1]] % 8;

  const x1 = lerp(dot2(GRAD2[aa], xf, yf), dot2(GRAD2[ba], xf - 1, yf), u);
  const x2 = lerp(dot2(GRAD2[ab], xf, yf - 1), dot2(GRAD2[bb], xf - 1, yf - 1), u);

  return lerp(x1, x2, v);
}

/**
 * Generate a heightfield using Perlin fBm.
 */
export function perlinFBm(
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
        value += perlin2D(nx, ny, perm) * amplitude;
        maxAmp += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }

      data[y * size + x] = (value / maxAmp + 1) * 0.5;
    }
  }

  return data;
}

