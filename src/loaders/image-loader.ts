/**
 * Image loader: PNG/JPG/WebP/BMP → heightfield via luminance extraction
 * or configurable heatmap decoding.
 */

import type { ElevationMapMode } from '../core/types';

/**
 * Convert RGB to Hue in degrees [0, 360)
 */
function rgbToHue(r: number, g: number, b: number): number {
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
 * Decode height value from pixel based on mode.
 * Returns normalized value [0, 1].
 */
export function decodePixelElevation(
  r: number,
  g: number,
  b: number,
  mode: ElevationMapMode = 'luminance'
): number {
  switch (mode) {
    case 'luminance': {
      // Standard perceptual luminance ITU-R BT.709
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    case 'invert': {
      return 1.0 - (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }
    case 'rainbow-heatmap': {
      // Standard geographic rainbow elevation map:
      // Blue (deep ocean/low) -> Cyan -> Green -> Yellow -> Red -> White (high mountain peak)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;

      // If near grayscale / low saturation, fall back to luminance
      if (sat < 0.15) {
        return (r + g + b) / (3 * 255);
      }

      const hue = rgbToHue(r, g, b); // 0 (Red) -> 60 (Yellow) -> 120 (Green) -> 180 (Cyan) -> 240 (Blue) -> 300 (Magenta)
      // Map 240 (Blue = low = 0.0) -> 120 (Green = mid = 0.45) -> 60 (Yellow = 0.7) -> 0 (Red = peak = 1.0)
      let norm = 0;
      if (hue >= 240) {
        // Violet/Blue: lowest elevation
        norm = 0.05 * (1 - (hue - 240) / 60);
      } else if (hue >= 180) {
        // Cyan to Blue [180..240]: 0.15 to 0.0
        norm = 0.15 * (1 - (hue - 180) / 60);
      } else if (hue >= 120) {
        // Green to Cyan [120..180]: 0.45 to 0.15
        norm = 0.15 + 0.3 * (1 - (hue - 120) / 60);
      } else if (hue >= 60) {
        // Yellow to Green [60..120]: 0.75 to 0.45
        norm = 0.45 + 0.3 * (1 - (hue - 60) / 60);
      } else {
        // Red to Yellow [0..60]: 1.0 to 0.75
        norm = 0.75 + 0.25 * (1 - hue / 60);
      }

      // If very bright (e.g. snow peaks on top of red), boost towards 1.0
      if (r > 230 && g > 230 && b > 230) {
        norm = 1.0;
      }

      return Math.max(0, Math.min(1, norm));
    }
    case 'turbo-heatmap':
    case 'spectral': {
      // Red = high, Blue/Black = low
      const redWeight = r / 255;
      const blueWeight = b / 255;
      const greenWeight = g / 255;
      const val = 0.55 * redWeight + 0.35 * greenWeight - 0.25 * blueWeight + 0.25;
      return Math.max(0, Math.min(1, val));
    }
  }
}

/**
 * Load an image file and extract elevation into a Float32Array heightfield.
 * Returns { data: Float32Array, width, height, rawImage: ImageData }.
 */
export async function loadImageHeightmap(
  file: File,
  mode: ElevationMapMode = 'luminance'
): Promise<{ data: Float32Array; width: number; height: number; rawImageData: ImageData }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data;
      const data = new Float32Array(img.width * img.height);

      for (let i = 0; i < data.length; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        const b = pixels[i * 4 + 2];
        data[i] = decodePixelElevation(r, g, b, mode);
      }

      URL.revokeObjectURL(url);
      resolve({ data, width: img.width, height: img.height, rawImageData: imageData });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. Ensure the file is a valid PNG or JPG.'));
    };

    img.src = url;
  });
}
