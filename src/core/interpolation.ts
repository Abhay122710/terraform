/**
 * Interpolation utilities for scattered point data → grid.
 */

export interface ScatteredPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Inverse-distance weighting interpolation.
 * Maps scattered (x, y, z) points onto a regular grid of given size.
 * Coordinates are normalized: x, y mapped to [0, size-1], z normalized to [0, 1].
 *
 * @param points - Array of {x, y, z} points (in any coordinate system)
 * @param size - Output grid size (size × size)
 * @param power - IDW power parameter (default 2)
 * @returns Float32Array of size×size with interpolated heights
 */
export function idwInterpolation(
  points: ScatteredPoint[],
  size: number,
  power: number = 2
): Float32Array {
  if (points.length === 0) {
    return new Float32Array(size * size);
  }

  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const rangeZ = maxZ - minZ || 1;

  // Normalize points to [0, 1]
  const normalized = points.map((p) => ({
    x: (p.x - minX) / rangeX,
    y: (p.y - minY) / rangeY,
    z: (p.z - minZ) / rangeZ,
  }));

  const grid = new Float32Array(size * size);

  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const u = gx / (size - 1);
      const v = gy / (size - 1);

      let weightSum = 0;
      let valueSum = 0;
      let exactMatch = -1;

      for (let i = 0; i < normalized.length; i++) {
        const dx = u - normalized[i].x;
        const dy = v - normalized[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 1e-10) {
          exactMatch = i;
          break;
        }

        const w = 1 / Math.pow(dist, power);
        weightSum += w;
        valueSum += w * normalized[i].z;
      }

      grid[gy * size + gx] =
        exactMatch >= 0 ? normalized[exactMatch].z : valueSum / weightSum;
    }
  }

  return grid;
}

