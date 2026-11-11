import { describe, it, expect } from 'vitest';
import { idwInterpolation, ScatteredPoint } from '../src/core/interpolation';

describe('IDW Interpolation', () => {
  it('returns an empty grid for empty points', () => {
    const grid = idwInterpolation([], 8);
    expect(grid.length).toBe(64);
    expect(grid[0]).toBe(0);
  });

  it('interpolates known values at exact point locations', () => {
    const points: ScatteredPoint[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 100 },
      { x: 0, y: 1, z: 50 },
      { x: 1, y: 1, z: 150 },
    ];

    const size = 3;
    const grid = idwInterpolation(points, size);

    // Corner (0,0) normalized z is 0
    expect(grid[0]).toBeCloseTo(0, 2);
    // Corner (size-1, size-1) max z is 150 → normalized 1.0
    expect(grid[size * size - 1]).toBeCloseTo(1.0, 2);
    // Center point should be roughly intermediate
    const center = grid[1 * size + 1];
    expect(center).toBeGreaterThan(0);
    expect(center).toBeLessThan(1);
  });

  it('handles single point gracefully', () => {
    const points: ScatteredPoint[] = [{ x: 5, y: 5, z: 42 }];
    const grid = idwInterpolation(points, 4);
    expect(grid.length).toBe(16);
    // All values should be normalized to 0 (range is 0)
    expect(grid[0]).toBe(0);
  });
});

