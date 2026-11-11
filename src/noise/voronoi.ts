/**
 * Voronoi / Cellular noise.
 * Uses F1 distance to nearest feature point.
 */

function buildSeededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate Voronoi cellular noise.
 * Returns a grid where each cell's value = distance to nearest feature point.
 */
export function voronoiNoise(
  size: number,
  seed: number,
  scale: number,
  _octaves: number,
  _lacunarity: number,
  _persistence: number
): Float32Array {
  const data = new Float32Array(size * size);
  const rng = buildSeededRng(seed);

  // Generate feature points — roughly scale² points
  const numPoints = Math.max(4, Math.floor(scale * scale));
  const points: Array<[number, number]> = [];
  for (let i = 0; i < numPoints; i++) {
    points.push([rng() * size, rng() * size]);
  }

  let maxDist = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let minDist = Infinity;
      let secondDist = Infinity;

      for (const [px, py] of points) {
        const dx = x - px;
        const dy = y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          secondDist = minDist;
          minDist = dist;
        } else if (dist < secondDist) {
          secondDist = dist;
        }
      }

      // F1 distance (can also use F2-F1 for a different look)
      const val = minDist;
      data[y * size + x] = val;
      if (val > maxDist) maxDist = val;
    }
  }

  // Normalize to [0, 1]
  if (maxDist > 0) {
    for (let i = 0; i < data.length; i++) {
      data[i] /= maxDist;
    }
  }

  return data;
}

