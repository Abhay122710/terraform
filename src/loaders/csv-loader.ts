/**
 * CSV loader: parse CSV point data → scattered points for IDW interpolation.
 * Auto-detects column format: x,y,z OR lat,lon,elevation
 */

import { idwInterpolation, ScatteredPoint } from '../core/interpolation';

/**
 * Parse a CSV file into a heightfield Float32Array.
 * Supports: x,y,z | lat,lon,elevation | latitude,longitude,elevation
 * Returns { data, width: size, height: size }
 */
export async function loadCSV(
  file: File,
  gridSize: number = 128
): Promise<{ data: Float32Array; width: number; height: number }> {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row.');
  }

  const header = lines[0].toLowerCase().split(',').map((s) => s.trim());

  // Detect column indices
  let xIdx = -1, yIdx = -1, zIdx = -1;

  // Try x,y,z
  xIdx = header.indexOf('x');
  yIdx = header.indexOf('y');
  zIdx = header.indexOf('z');

  // Try lat,lon,elevation
  if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
    const latIdx = header.findIndex((h) => h.includes('lat'));
    const lonIdx = header.findIndex((h) => h.includes('lon'));
    const elevIdx = header.findIndex((h) => h.includes('elev') || h.includes('alt') || h === 'z' || h === 'height');

    if (latIdx >= 0 && lonIdx >= 0 && elevIdx >= 0) {
      xIdx = lonIdx;
      yIdx = latIdx;
      zIdx = elevIdx;
    }
  }

  // Fallback: first 3 numeric columns
  if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
    if (header.length >= 3) {
      xIdx = 0;
      yIdx = 1;
      zIdx = 2;
    } else {
      throw new Error(
        'Cannot detect CSV columns. Expected headers: x,y,z or lat,lon,elevation (found: ' +
          header.join(', ') + ')'
      );
    }
  }

  const points: ScatteredPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((s) => s.trim());
    const x = parseFloat(cols[xIdx]);
    const y = parseFloat(cols[yIdx]);
    const z = parseFloat(cols[zIdx]);

    if (isNaN(x) || isNaN(y) || isNaN(z)) continue;
    points.push({ x, y, z });
  }

  if (points.length === 0) {
    throw new Error('No valid data points found in CSV.');
  }

  const data = idwInterpolation(points, gridSize);
  return { data, width: gridSize, height: gridSize };
}

