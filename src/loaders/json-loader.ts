/**
 * JSON loader: parse JSON point array → scattered points for IDW interpolation.
 * Supports: [{x,y,z}] or [{lat,lon,elevation}]
 */

import { idwInterpolation, ScatteredPoint } from '../core/interpolation';

/**
 * Parse a JSON file of points into a heightfield.
 */
export async function loadJSON(
  file: File,
  gridSize: number = 128
): Promise<{ data: Float32Array; width: number; height: number }> {
  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file. Could not parse.');
  }

  // Accept array at top level or nested under "points" / "data"
  let arr: unknown[];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.points)) arr = obj.points;
    else if (Array.isArray(obj.data)) arr = obj.data;
    else {
      throw new Error('JSON must be an array of points or contain a "points" / "data" array.');
    }
  } else {
    throw new Error('JSON must be an array of points.');
  }

  if (arr.length === 0) {
    throw new Error('JSON point array is empty.');
  }

  const points: ScatteredPoint[] = [];

  for (const item of arr) {
    if (typeof item !== 'object' || item === null) continue;
    const p = item as Record<string, unknown>;

    let x: number | undefined, y: number | undefined, z: number | undefined;

    // Try x,y,z
    if ('x' in p && 'y' in p && 'z' in p) {
      x = Number(p.x);
      y = Number(p.y);
      z = Number(p.z);
    }
    // Try lat,lon,elevation
    else if ('lat' in p && 'lon' in p) {
      x = Number(p.lon);
      y = Number(p.lat);
      z = Number(p.elevation ?? p.alt ?? p.height ?? p.z ?? 0);
    }
    else if ('latitude' in p && 'longitude' in p) {
      x = Number(p.longitude);
      y = Number(p.latitude);
      z = Number(p.elevation ?? p.alt ?? p.height ?? p.z ?? 0);
    }

    if (x !== undefined && y !== undefined && z !== undefined &&
        !isNaN(x) && !isNaN(y) && !isNaN(z)) {
      points.push({ x, y, z });
    }
  }

  if (points.length === 0) {
    throw new Error('No valid points found in JSON. Expected {x,y,z} or {lat,lon,elevation}.');
  }

  const data = idwInterpolation(points, gridSize);
  return { data, width: gridSize, height: gridSize };
}

