/**
 * Terraform — HeightField, Elevation Processing, and File Loaders.
 * Supports:
 * - Grayscale Heightmaps (PNG, JPG, BMP, WebP) with Luminance / Invert / Heatmap decoding
 * - Scattered Points CSV (x,y,z or lat,lon,elevation) via Inverse-Distance Weighting (IDW)
 * - Scattered Points JSON via IDW
 * - ESRI ASCII Grid (.asc)
 */

import { clamp } from './utils.js';

/**
 * HeightField: 2D elevation grid stored in Float32Array [0, 1].
 */
export class HeightField {
  constructor(size, data = null) {
    this.size = size;
    if (data) {
      if (data.length !== size * size) {
        throw new Error(`HeightField size mismatch: expected ${size * size}, got ${data.length}`);
      }
      this.data = data;
    } else {
      this.data = new Float32Array(size * size);
    }
  }

  get(x, y) {
    const cx = clamp(Math.floor(x), 0, this.size - 1);
    const cy = clamp(Math.floor(y), 0, this.size - 1);
    return this.data[cy * this.size + cx];
  }

  set(x, y, val) {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.data[y * this.size + x] = val;
    }
  }

  sample(u, v) {
    const x = clamp(u, 0, 1) * (this.size - 1);
    const y = clamp(v, 0, 1) * (this.size - 1);

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

  normalize() {
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

  clone() {
    return new HeightField(this.size, new Float32Array(this.data));
  }

  downsample(targetSize) {
    const result = new HeightField(targetSize);
    for (let y = 0; y < targetSize; y++) {
      for (let x = 0; x < targetSize; x++) {
        const u = targetSize === 1 ? 0 : x / (targetSize - 1);
        const v = targetSize === 1 ? 0 : y / (targetSize - 1);
        result.set(x, y, this.sample(u, v));
      }
    }
    return result;
  }

  static fromFlat(data, width, height) {
    const size = Math.max(width, height);
    if (width === height) {
      return new HeightField(size, new Float32Array(data));
    }
    const hf = new HeightField(size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = (x / (size - 1)) * (width - 1);
        const sy = (y / (size - 1)) * (height - 1);
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(x0 + 1, width - 1);
        const y1 = Math.min(y0 + 1, height - 1);
        const fx = sx - x0;
        const fy = sy - y0;
        const v00 = data[y0 * width + x0];
        const v10 = data[y0 * width + x1];
        const v01 = data[y1 * width + x0];
        const v11 = data[y1 * width + x1];
        hf.set(x, y, v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
      }
    }
    return hf;
  }
}

/**
 * Convert RGB to Hue in degrees [0, 360).
 */
function rgbToHue(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  let h = 0;
  const d = max - min;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return h * 60;
}

/**
 * Decode height value [0, 1] from pixel RGB based on decoding mode.
 */
export function decodePixelElevation(r, g, b, mode = 'luminance') {
  switch (mode) {
    case 'luminance':
      // Perceptual luminance ITU-R BT.709
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    case 'invert':
      return 1.0 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    case 'rainbow-heatmap': {
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat < 0.15) {
        return (r + g + b) / (3 * 255);
      }
      const hue = rgbToHue(r, g, b);
      let norm = 0;
      if (hue >= 240) {
        norm = 0.05 * (1 - (hue - 240) / 60);
      } else if (hue >= 180) {
        norm = 0.15 * (1 - (hue - 180) / 60);
      } else if (hue >= 120) {
        norm = 0.15 + 0.3 * (1 - (hue - 120) / 60);
      } else if (hue >= 60) {
        norm = 0.45 + 0.3 * (1 - (hue - 60) / 60);
      } else {
        norm = 0.75 + 0.25 * (1 - hue / 60);
      }
      if (r > 230 && g > 230 && b > 230) norm = 1.0;
      return clamp(norm, 0, 1);
    }
    case 'turbo-heatmap':
    case 'spectral': {
      const redWeight = r / 255;
      const blueWeight = b / 255;
      const greenWeight = g / 255;
      const val = 0.55 * redWeight + 0.35 * greenWeight - 0.25 * blueWeight + 0.25;
      return clamp(val, 0, 1);
    }
    default:
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
}

/**
 * Inverse-Distance Weighting (IDW) interpolation from scattered points to a regular grid.
 */
export function idwInterpolation(points, size, power = 2) {
  if (points.length === 0) return new Float32Array(size * size);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
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

      grid[gy * size + gx] = exactMatch >= 0 ? normalized[exactMatch].z : valueSum / weightSum;
    }
  }

  return grid;
}

/**
 * Load an image heightmap from File or Blob.
 */
export async function loadImageHeightmap(file, mode = 'luminance') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const pixels = imageData.data;
        const data = new Float32Array(img.width * img.height);

        for (let i = 0; i < data.length; i++) {
          data[i] = decodePixelElevation(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], mode);
        }

        URL.revokeObjectURL(url);
        resolve({ data, width: img.width, height: img.height, rawImageData: imageData });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to process image data: ' + err.message));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. Ensure it is a valid PNG, JPG, BMP, or WebP.'));
    };

    img.src = url;
  });
}

/**
 * Load CSV scattered points or height grid.
 */
export async function loadCSV(file, gridSize = 128) {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row.');
  }

  const header = lines[0].toLowerCase().split(',').map((s) => s.trim());
  let xIdx = header.indexOf('x');
  let yIdx = header.indexOf('y');
  let zIdx = header.indexOf('z');

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

  if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
    if (header.length >= 3) {
      xIdx = 0; yIdx = 1; zIdx = 2;
    } else {
      throw new Error('Expected CSV columns: x,y,z or lat,lon,elevation.');
    }
  }

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((s) => s.trim());
    const x = parseFloat(cols[xIdx]);
    const y = parseFloat(cols[yIdx]);
    const z = parseFloat(cols[zIdx]);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      points.push({ x, y, z });
    }
  }

  if (points.length === 0) throw new Error('No valid numeric points found in CSV.');
  const data = idwInterpolation(points, gridSize);
  return { data, width: gridSize, height: gridSize };
}

/**
 * Load JSON scattered points.
 */
export async function loadJSON(file, gridSize = 128) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file format.');
  }

  let arr = Array.isArray(parsed) ? parsed : (parsed.points || parsed.data);
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('JSON file must contain an array of points.');
  }

  const points = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    let x = item.x ?? item.lon ?? item.longitude;
    let y = item.y ?? item.lat ?? item.latitude;
    let z = item.z ?? item.elevation ?? item.alt ?? item.height;
    x = Number(x); y = Number(y); z = Number(z);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      points.push({ x, y, z });
    }
  }

  if (points.length === 0) throw new Error('No valid {x, y, z} or {lat, lon, elevation} points in JSON.');
  const data = idwInterpolation(points, gridSize);
  return { data, width: gridSize, height: gridSize };
}

/**
 * Load ESRI ASCII Grid (.asc).
 */
export async function loadASC(file) {
  const text = await file.text();
  const lines = text.trim().split(/\r?\n/);
  let ncols = 0, nrows = 0, nodata = -9999;
  let headerLines = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const parts = lines[i].trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) break;
    const key = parts[0];
    const val = parseFloat(parts[1]);
    if (key === 'ncols') { ncols = val; headerLines = i + 1; }
    else if (key === 'nrows') { nrows = val; headerLines = i + 1; }
    else if (key === 'nodata_value') { nodata = val; headerLines = i + 1; }
    else if (['xllcorner', 'yllcorner', 'cellsize', 'xllcenter', 'yllcenter'].includes(key)) {
      headerLines = i + 1;
    } else {
      break;
    }
  }

  if (ncols <= 0 || nrows <= 0) throw new Error('Invalid ASC grid file: missing ncols/nrows header.');

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

  const range = max - min || 1;
  for (let i = 0; i < data.length; i++) {
    data[i] = (data[i] - min) / range;
  }

  return { data, width: ncols, height: nrows };
}

/**
 * Master file loader dispatcher.
 */
export async function loadTerrainFile(file, gridSize = 128, elevationMode = 'luminance') {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';
  const mime = (file.type || '').toLowerCase();

  const imageExts = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];
  if (imageExts.includes(ext) || mime.startsWith('image/')) {
    const result = await loadImageHeightmap(file, elevationMode);
    return { ...result, format: 'image', fileName: file.name };
  }

  if (ext === 'csv' || mime === 'text/csv') {
    const result = await loadCSV(file, gridSize);
    return { ...result, format: 'csv', fileName: file.name };
  }

  if (ext === 'json' || mime === 'application/json') {
    const result = await loadJSON(file, gridSize);
    return { ...result, format: 'json', fileName: file.name };
  }

  if (ext === 'asc') {
    const result = await loadASC(file);
    return { ...result, format: 'asc', fileName: file.name };
  }

  throw new Error(`Unsupported file format: .${ext}. Allowed: PNG, JPG, BMP, WebP, CSV, JSON, ASC.`);
}
