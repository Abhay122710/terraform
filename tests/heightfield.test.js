import { describe, it, expect } from 'vitest';
import { HeightField } from '../js/heightmap.js';

describe('HeightField', () => {
  it('creates an empty grid with correct dimensions', () => {
    const hf = new HeightField(16);
    expect(hf.size).toBe(16);
    expect(hf.data.length).toBe(256);
    expect(hf.get(0, 0)).toBe(0);
  });

  it('clamps coordinates on get/set', () => {
    const hf = new HeightField(8);
    hf.set(0, 0, 0.5);
    expect(hf.get(0, 0)).toBe(0.5);
    // Out of bounds get should clamp
    expect(hf.get(-1, 0)).toBe(0.5);
    expect(hf.get(0, -1)).toBe(0.5);
  });

  it('samples with bilinear interpolation', () => {
    const hf = new HeightField(2);
    // 2x2 grid:
    // (0,0)=0   (1,0)=1
    // (0,1)=0   (1,1)=1
    hf.set(0, 0, 0);
    hf.set(1, 0, 1);
    hf.set(0, 1, 0);
    hf.set(1, 1, 1);

    // Center should be 0.5
    expect(hf.sample(0.5, 0.5)).toBeCloseTo(0.5, 4);
    // Left edge should be 0
    expect(hf.sample(0, 0.5)).toBeCloseTo(0, 4);
    // Right edge should be 1
    expect(hf.sample(1, 0.5)).toBeCloseTo(1, 4);
  });

  it('normalizes values to [0, 1]', () => {
    const hf = new HeightField(2);
    hf.set(0, 0, 10);
    hf.set(1, 0, 20);
    hf.set(0, 1, 20);
    hf.set(1, 1, 30);
    hf.normalize();

    expect(hf.get(0, 0)).toBeCloseTo(0, 4);
    expect(hf.get(1, 1)).toBeCloseTo(1, 4);
    expect(hf.get(1, 0)).toBeCloseTo(0.5, 4);
  });

  it('downsamples correctly', () => {
    const hf = new HeightField(4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        hf.set(x, y, x / 3);
      }
    }
    const downsampled = hf.downsample(2);
    expect(downsampled.size).toBe(2);
    expect(downsampled.get(0, 0)).toBeCloseTo(0, 4);
    expect(downsampled.get(1, 0)).toBeCloseTo(1, 4);
  });
});
