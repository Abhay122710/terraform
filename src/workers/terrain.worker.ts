/**
 * Terrain generation Web Worker.
 * Handles:
 * - Off-thread procedural noise generation (multi-octave ridged/simplex/etc)
 * - Spatial heightmap preservation with high-frequency detail synthesis
 * - Ridge sharpening & valley deepening
 * - Hydraulic & Thermal erosion
 * - Zero-copy Float32Array transfers
 */

import { generateNoise } from '../noise/index';
import type { WorkerRequest, WorkerResponse } from '../core/types';

// ─── Post-Processing & Erosion ──────────────────────────────────

/** Box-blur smoothing pass */
function smooth(data: Float32Array, size: number, passes: number): Float32Array {
  let current = data;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
              sum += current[ny * size + nx];
              count++;
            }
          }
        }
        next[y * size + x] = sum / count;
      }
    }
    current = next;
  }
  return current;
}

/** Particle-based hydraulic erosion */
function hydraulicErode(
  data: Float32Array,
  size: number,
  iterations: number
): Float32Array {
  const result = new Float32Array(data);
  const inertia = 0.05;
  const capacity = 3.5;
  const deposition = 0.25;
  const erosion = 0.25;
  const evaporation = 0.015;
  const minSlope = 0.01;
  const maxSteps = 48;

  let seed = 12345;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let iter = 0; iter < iterations; iter++) {
    let posX = rng() * (size - 2) + 1;
    let posY = rng() * (size - 2) + 1;
    let dirX = 0;
    let dirY = 0;
    let speed = 1;
    let water = 1;
    let sediment = 0;

    for (let step = 0; step < maxSteps; step++) {
      const cellX = Math.floor(posX);
      const cellY = Math.floor(posY);

      if (cellX <= 0 || cellX >= size - 2 || cellY <= 0 || cellY >= size - 2) break;

      const hL = result[cellY * size + (cellX - 1)];
      const hR = result[cellY * size + (cellX + 1)];
      const hU = result[(cellY - 1) * size + cellX];
      const hD = result[(cellY + 1) * size + cellX];
      const gradX = (hR - hL) * 0.5;
      const gradY = (hD - hU) * 0.5;

      dirX = dirX * inertia - gradX * (1 - inertia);
      dirY = dirY * inertia - gradY * (1 - inertia);

      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len < 1e-10) break;
      dirX /= len;
      dirY /= len;

      const newX = posX + dirX;
      const newY = posY + dirY;

      if (newX <= 0 || newX >= size - 1 || newY <= 0 || newY >= size - 1) break;

      const oldH = result[cellY * size + cellX];
      const newCellX = Math.floor(newX);
      const newCellY = Math.floor(newY);
      const newH = result[newCellY * size + newCellX];
      const heightDiff = newH - oldH;

      const cap = Math.max(-heightDiff, minSlope) * speed * water * capacity;

      if (sediment > cap || heightDiff > 0) {
        const amount = heightDiff > 0
          ? Math.min(heightDiff, sediment)
          : (sediment - cap) * deposition;
        sediment -= amount;
        result[cellY * size + cellX] += amount;
      } else {
        const amount = Math.min((cap - sediment) * erosion, -heightDiff);
        sediment += amount;
        result[cellY * size + cellX] -= amount;
      }

      posX = newX;
      posY = newY;
      speed = Math.sqrt(Math.max(0, speed * speed + heightDiff));
      water *= (1 - evaporation);
    }
  }

  return result;
}

/** Thermal erosion — material redistribution above talus angle */
function thermalErode(
  data: Float32Array,
  size: number,
  iterations: number
): Float32Array {
  const result = new Float32Array(data);
  const talusThreshold = 3.5 / size;

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const h = result[y * size + x];
        let totalDiff = 0;
        let maxDiff = 0;

        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
        ];

        for (const [nx, ny] of neighbors) {
          const diff = h - result[ny * size + nx];
          if (diff > talusThreshold) {
            totalDiff += diff;
            if (diff > maxDiff) maxDiff = diff;
          }
        }

        if (totalDiff > 0) {
          const moveAmount = (maxDiff - talusThreshold) * 0.4;
          for (const [nx, ny] of neighbors) {
            const diff = h - result[ny * size + nx];
            if (diff > talusThreshold) {
              const share = moveAmount * (diff / totalDiff);
              result[y * size + x] -= share;
              result[ny * size + nx] += share;
            }
          }
        }
      }
    }
  }

  return result;
}

/** Apply shape transforms & mountain shaping curves */
function applyShape(
  data: Float32Array,
  power: number,
  plateauSteps: number,
  ridgeSharpening: number,
  valleyDeepening: number
): Float32Array {
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let v = Math.max(0, Math.min(1, data[i]));

    // 1. Valley deepening: gently flatten bottom region for flat plains/meadows
    if (valleyDeepening > 0 && v < 0.45) {
      const valleyFactor = v / 0.45;
      // Soft sigmoid curve in lower elevation
      const lowered = Math.pow(valleyFactor, 1 + valleyDeepening * 1.5) * 0.45;
      v = v * (1 - valleyDeepening) + lowered * valleyDeepening;
    }

    // 2. Ridge sharpening: boost high elevations into sharp peaks and jagged ranges
    if (ridgeSharpening > 1.0 && v > 0.4) {
      const peakNorm = (v - 0.4) / 0.6;
      // Exponential curve for peaks
      const sharpened = 0.4 + Math.pow(peakNorm, ridgeSharpening) * 0.6;
      v = sharpened;
    }

    // 3. User redistribution power
    if (power !== 1.0) {
      v = Math.pow(v, power);
    }

    // 4. Plateau / terracing steps
    if (plateauSteps > 0) {
      v = Math.round(v * plateauSteps) / plateauSteps;
    }

    result[i] = v;
  }
  return result;
}

/** Bilinear resample from source grid (srcW×srcH) to target (size×size) */
function resample(src: Float32Array, srcW: number, srcH: number, size: number): Float32Array {
  const dst = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = (x / (size - 1)) * (srcW - 1);
      const sy = (y / (size - 1)) * (srcH - 1);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = sx - x0;
      const fy = sy - y0;
      dst[y * size + x] =
        src[y0 * srcW + x0] * (1 - fx) * (1 - fy) +
        src[y0 * srcW + x1] * fx * (1 - fy) +
        src[y1 * srcW + x0] * (1 - fx) * fy +
        src[y1 * srcW + x1] * fx * fy;
    }
  }
  return dst;
}

/** Normalize Float32Array to [0, 1] */
function normalize(data: Float32Array): Float32Array {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const range = max - min;
  if (range < 1e-10) return new Float32Array(data.length);
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = (data[i] - min) / range;
  }
  return result;
}

// ─── Worker Message Handler ─────────────────────────────────────

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const t0 = performance.now();
  const size = req.resolution;

  let heightfield: Float32Array;

  // Case A: Uploaded elevation map / heightmap data exists
  if (req.inputData && req.inputData.length > 0) {
    // 1. Resample to current mesh resolution while preserving exact spatial layout
    let baseData: Float32Array;
    if (req.inputWidth !== size || req.inputHeight !== size) {
      baseData = resample(req.inputData, req.inputWidth, req.inputHeight, size);
    } else {
      baseData = new Float32Array(req.inputData);
    }

    if (req.normalizeElevation) {
      baseData = normalize(baseData);
    }

    // 2. If procedural detail is enabled, synthesize fine rocky displacement on slopes & ridges
    // WITHOUT destroying the underlying elevation map
    if (req.detail.enableDetail && req.detail.detailStrength > 0) {
      const microNoise = generateNoise({
        type: 'ridged',
        size,
        seed: req.noise.seed,
        scale: 9.0, // High frequency for rocky faceted ridges
        octaves: 4,
        lacunarity: 2.2,
        persistence: 0.5,
      });

      const detailAmount = req.detail.detailStrength;
      for (let i = 0; i < baseData.length; i++) {
        const elev = baseData[i];
        // Apply more micro-roughness on higher mountain peaks and mountain faces,
        // and keep flat valleys/plains smooth
        const mountainWeight = Math.pow(elev, 1.4);
        const rockyOffset = (microNoise[i] - 0.45) * detailAmount * mountainWeight;
        baseData[i] = Math.max(0, Math.min(1, elev + rockyOffset));
      }
    }

    // 3. If user wants to blend procedural noise with the input map
    if (req.blendFactor > 0) {
      const proceduralNoise = generateNoise({
        type: req.noise.type,
        size,
        seed: req.noise.seed,
        scale: req.noise.scale,
        octaves: req.noise.octaves,
        lacunarity: req.noise.lacunarity,
        persistence: req.noise.persistence,
      });

      for (let i = 0; i < baseData.length; i++) {
        baseData[i] = (1 - req.blendFactor) * baseData[i] + req.blendFactor * proceduralNoise[i];
      }
    }

    heightfield = baseData;
  } else {
    // Case B: Pure procedural mode (defaults to sharp mountainous ridged multifractal)
    heightfield = generateNoise({
      type: req.noise.type,
      size,
      seed: req.noise.seed,
      scale: req.noise.scale,
      octaves: req.noise.octaves,
      lacunarity: req.noise.lacunarity,
      persistence: req.noise.persistence,
    });
  }

  // 4. Apply mountain shape curves (ridge sharpening + valley deepening)
  heightfield = applyShape(
    heightfield,
    req.shape.redistributionPower,
    req.shape.plateauSteps,
    req.detail.ridgeSharpening,
    req.detail.valleyDeepening
  );

  // 5. Post-processing: smoothing
  if (req.erosion.smoothingPasses > 0) {
    heightfield = smooth(heightfield, size, req.erosion.smoothingPasses);
  }

  // 6. Hydraulic erosion
  if (req.erosion.hydraulicIterations > 0) {
    heightfield = hydraulicErode(heightfield, size, req.erosion.hydraulicIterations);
  }

  // 7. Thermal erosion
  if (req.erosion.thermalIterations > 0) {
    heightfield = thermalErode(heightfield, size, req.erosion.thermalIterations);
  }

  // 8. Final normalization
  if (req.normalizeElevation) {
    heightfield = normalize(heightfield);
  }

  const elapsed = performance.now() - t0;

  const response: WorkerResponse = {
    id: req.id,
    heightfield,
    resolution: size,
    elapsed,
  };

  // Transfer the buffer (zero-copy)
  (self as unknown as Worker).postMessage(response, [heightfield.buffer]);
};
