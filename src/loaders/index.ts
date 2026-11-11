/**
 * Loader index — detect format and dispatch to appropriate loader.
 */

import { loadImageHeightmap } from './image-loader';
import { loadCSV } from './csv-loader';
import { loadJSON } from './json-loader';
import { loadASC } from './asc-loader';
import type { ElevationMapMode } from '../core/types';

export type LoadResult = {
  data: Float32Array;
  width: number;
  height: number;
  format: string;
  rawImageData?: ImageData;
};

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'webp'];
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/bmp', 'image/webp'];

/**
 * Detect format and load a file into a heightfield.
 */
export async function loadFile(
  file: File,
  gridSize: number = 128,
  elevationMode: ElevationMapMode = 'luminance'
): Promise<LoadResult> {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop() || '';
  const mime = file.type.toLowerCase();

  // Image
  if (IMAGE_EXTENSIONS.includes(ext) || IMAGE_MIMES.includes(mime)) {
    const result = await loadImageHeightmap(file, elevationMode);
    return { ...result, format: 'image' };
  }

  // CSV
  if (ext === 'csv' || mime === 'text/csv') {
    const result = await loadCSV(file, gridSize);
    return { ...result, format: 'csv' };
  }

  // JSON
  if (ext === 'json' || mime === 'application/json') {
    const result = await loadJSON(file, gridSize);
    return { ...result, format: 'json' };
  }

  // ASC (ESRI ASCII Grid)
  if (ext === 'asc') {
    const result = await loadASC(file);
    return { ...result, format: 'asc' };
  }

  throw new Error(
    `Unsupported file format: .${ext}\nSupported: PNG, JPG, CSV, JSON, ASC`
  );
}
