/**
 * ESRI ASCII Grid (.asc) loader.
 * Format:
 *   ncols <int>
 *   nrows <int>
 *   xllcorner <float>
 *   yllcorner <float>
 *   cellsize <float>
 *   NODATA_value <float>
 *   <data rows>
 */

/**
 * Parse an ESRI ASCII grid file into a heightfield.
 */
export async function loadASC(
  file: File
): Promise<{ data: Float32Array; width: number; height: number }> {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);

  let ncols = 0, nrows = 0, nodata = -9999;
  let headerLines = 0;

  // Parse header
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim().toLowerCase();
    const parts = line.split(/\s+/);
    if (parts.length < 2) break;

    const key = parts[0];
    const val = parseFloat(parts[1]);

    if (key === 'ncols') { ncols = val; headerLines = i + 1; }
    else if (key === 'nrows') { nrows = val; headerLines = i + 1; }
    else if (key === 'nodata_value') { nodata = val; headerLines = i + 1; }
    else if (key === 'xllcorner' || key === 'yllcorner' || key === 'cellsize' ||
             key === 'xllcenter' || key === 'yllcenter') {
      headerLines = i + 1;
    }
    else {
      break; // Data starts
    }
  }

  if (ncols <= 0 || nrows <= 0) {
    throw new Error('Invalid ASC file: could not find ncols/nrows in header.');
  }

  const data = new Float32Array(ncols * nrows);
  let min = Infinity, max = -Infinity;
  let dataRow = 0;

  for (let i = headerLines; i < lines.length && dataRow < nrows; i++) {
    const vals = lines[i].trim().split(/\s+/).map(Number);
    for (let j = 0; j < Math.min(vals.length, ncols); j++) {
      let v = vals[j];
      if (v === nodata || isNaN(v)) v = 0;
      data[dataRow * ncols + j] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    dataRow++;
  }

  // Normalize to [0, 1]
  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i] - min) / range;
  }

  return { data, width: ncols, height: nrows };
}

