/**
 * HeightField: a square grid of height values stored as Float32Array.
 * All values are normalized to [0, 1].
 */

export class HeightField {
  readonly data: Float32Array;
  readonly size: number;

  constructor(size: number, data?: Float32Array) {
    this.size = size;
    if (data) {
      if (data.length !== size * size) {
        throw new Error(
          `HeightField data length ${data.length} doesn't match size ${size}×${size} = ${size * size}`
        );
      }
      this.data = data;
    } else {
      this.data = new Float32Array(size * size);
    }
  }

  /** Get height at (x, y), clamped to bounds */
  get(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.size - 1, x));
    const cy = Math.max(0, Math.min(this.size - 1, y));
    return this.data[cy * this.size + cx];
  }

  /** Set height at (x, y) */
  set(x: number, y: number, value: number): void {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.data[y * this.size + x] = value;
    }
  }

  /** Bilinear interpolation at fractional coordinates (u, v) in [0, 1] */
  sample(u: number, v: number): number {
    const x = u * (this.size - 1);
    const y = v * (this.size - 1);

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, this.size - 1);
    const y1 = Math.min(y0 + 1, this.size - 1);

    const fx = x - x0;
    const fy = y - y0;

    const v00 = this.get(x0, y0);
    const v10 = this.get(x1, y0);
    const v01 = this.get(x0, y1);
    const v11 = this.get(x1, y1);

    return (
      v00 * (1 - fx) * (1 - fy) +
      v10 * fx * (1 - fy) +
      v01 * (1 - fx) * fy +
      v11 * fx * fy
    );
  }

  /** Normalize all values to [0, 1] in-place */
  normalize(): void {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i] < min) min = this.data[i];
      if (this.data[i] > max) max = this.data[i];
    }
    const range = max - min;
    if (range < 1e-10) {
      this.data.fill(0);
      return;
    }
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] = (this.data[i] - min) / range;
    }
  }

  /** Downsample to target resolution using bilinear interpolation */
  downsample(targetSize: number): HeightField {
    const result = new HeightField(targetSize);
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const u = x / (targetSize - 1);
        const v = y / (targetSize - 1);
        result.set(x, y, this.sample(u, v));
      }
    }
    return result;
  }

  /** Clone this heightfield */
  clone(): HeightField {
    return new HeightField(this.size, new Float32Array(this.data));
  }

  /** Create from a raw Float32Array with known dimensions */
  static fromFlat(data: Float32Array, width: number, height: number): HeightField {
    // If not square, resample onto a square grid using the larger dimension
    const size = Math.max(width, height);
    if (width === height) {
      return new HeightField(size, new Float32Array(data));
    }
    const hf = new HeightField(size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Map to source coordinates
        const sx = (x / (size - 1)) * (width - 1);
        const sy = (y / (size - 1)) * (height - 1);
        const sx0 = Math.floor(sx);
        const sy0 = Math.floor(sy);
        const sx1 = Math.min(sx0 + 1, width - 1);
        const sy1 = Math.min(sy0 + 1, height - 1);
        const fx = sx - sx0;
        const fy = sy - sy0;
        const v00 = data[sy0 * width + sx0];
        const v10 = data[sy0 * width + sx1];
        const v01 = data[sy1 * width + sx0];
        const v11 = data[sy1 * width + sx1];
        hf.set(x, y, v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
      }
    }
    return hf;
  }
}

