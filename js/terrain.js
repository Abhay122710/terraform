/**
 * Terraform — Terrain Generation Engine.
 * Implements:
 * - Spatial heightmap preservation with high-frequency detail synthesis
 * - Ridge sharpening & valley deepening
 * - Hydraulic & Thermal erosion simulations
 * - Smoothing filters & Terracing / Plateau stepping
 * - Asynchronous execution with cancelable request IDs
 */

import { generateNoise } from './noise.js';
import { HeightField } from './heightmap.js';
import { clamp } from './utils.js';

/** Box-blur smoothing pass */
export function smooth(data, size, passes) {
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

/** Particle-based hydraulic erosion simulation */
export function hydraulicErode(data, size, iterations) {
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
        const amount = heightDiff > 0 ? Math.min(heightDiff, sediment) : (sediment - cap) * deposition;
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
      water *= 1 - evaporation;
    }
  }

  return result;
}

/** Thermal erosion simulation */
export function thermalErode(data, size, iterations) {
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

        for (let n = 0; n < neighbors.length; n++) {
          const nx = neighbors[n][0];
          const ny = neighbors[n][1];
          const diff = h - result[ny * size + nx];
          if (diff > talusThreshold) {
            totalDiff += diff;
            if (diff > maxDiff) maxDiff = diff;
          }
        }

        if (totalDiff > 0) {
          const moveAmount = (maxDiff - talusThreshold) * 0.4;
          for (let n = 0; n < neighbors.length; n++) {
            const nx = neighbors[n][0];
            const ny = neighbors[n][1];
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

/** Bilinear resample between resolutions */
export function resampleGrid(src, srcW, srcH, size) {
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

/** Normalize Float32Array into [0, 1] range */
export function normalizeGrid(data) {
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

/** Apply mountain shaping curves: valley deepening, ridge sharpening, elevation power, terraces */
export function applyShapeCurves(data, power, plateauSteps, ridgeSharpening, valleyDeepening) {
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let v = clamp(data[i], 0, 1);

    // 1. Valley deepening: flatten lower areas into lush plains/valleys
    if (valleyDeepening > 0 && v < 0.45) {
      const valleyFactor = v / 0.45;
      const lowered = Math.pow(valleyFactor, 1 + valleyDeepening * 1.5) * 0.45;
      v = v * (1 - valleyDeepening) + lowered * valleyDeepening;
    }

    // 2. Ridge sharpening: boost high elevations into sharp alpine peaks
    if (ridgeSharpening > 1.0 && v > 0.4) {
      const peakNorm = (v - 0.4) / 0.6;
      v = 0.4 + Math.pow(peakNorm, ridgeSharpening) * 0.6;
    }

    // 3. User redistribution elevation curve power
    if (power !== 1.0 && power > 0) {
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

/**
 * Execute full terrain generation synchronously.
 * Clean, portable, deterministic.
 */
export function generateTerrainHeightfield(state, loadedData, loadedWidth, loadedHeight) {
  const size = state.resolution;
  let heightfieldData;

  // Case A: Uploaded or bundled heightmap exists
  if (loadedData && loadedData.length > 0) {
    let baseData;
    if (loadedWidth !== size || loadedHeight !== size) {
      baseData = resampleGrid(loadedData, loadedWidth, loadedHeight, size);
    } else {
      baseData = new Float32Array(loadedData);
    }

    if (state.normalizeElevation) {
      baseData = normalizeGrid(baseData);
    }

    // Procedural micro-roughness detail synthesis
    if (state.enableDetail && state.detailStrength > 0) {
      const microNoise = generateNoise({
        type: 'ridged',
        size,
        seed: state.seed,
        scale: 9.0,
        octaves: 4,
        lacunarity: 2.2,
        persistence: 0.5,
      });

      const detailAmount = state.detailStrength;
      for (let i = 0; i < baseData.length; i++) {
        const elev = baseData[i];
        const mountainWeight = Math.pow(elev, 1.4);
        const rockyOffset = (microNoise[i] - 0.45) * detailAmount * mountainWeight;
        baseData[i] = clamp(elev + rockyOffset, 0, 1);
      }
    }

    // Blend with procedural noise if blendFactor > 0
    if (state.blendFactor > 0) {
      const proceduralNoise = generateNoise({
        type: state.noiseType,
        size,
        seed: state.seed,
        scale: state.noiseScale,
        octaves: state.octaves,
        lacunarity: state.lacunarity,
        persistence: state.persistence,
      });

      for (let i = 0; i < baseData.length; i++) {
        baseData[i] = (1 - state.blendFactor) * baseData[i] + state.blendFactor * proceduralNoise[i];
      }
    }

    heightfieldData = baseData;
  } else {
    // Case B: Pure procedural generation
    heightfieldData = generateNoise({
      type: state.noiseType,
      size,
      seed: state.seed,
      scale: state.noiseScale,
      octaves: state.octaves,
      lacunarity: state.lacunarity,
      persistence: state.persistence,
    });
  }

  // Apply mountain shape curves
  heightfieldData = applyShapeCurves(
    heightfieldData,
    state.elevationCurve,
    state.plateauSteps,
    state.ridgeSharpening,
    state.valleyDeepening
  );

  // Smoothing
  if (state.smoothingPasses > 0) {
    heightfieldData = smooth(heightfieldData, size, state.smoothingPasses);
  }

  // Hydraulic erosion
  if (state.hydraulicIterations > 0) {
    heightfieldData = hydraulicErode(heightfieldData, size, state.hydraulicIterations);
  }

  // Thermal erosion
  if (state.thermalIterations > 0) {
    heightfieldData = thermalErode(heightfieldData, size, state.thermalIterations);
  }

  // Final normalization
  if (state.normalizeElevation) {
    heightfieldData = normalizeGrid(heightfieldData);
  }

  return new HeightField(size, heightfieldData);
}
