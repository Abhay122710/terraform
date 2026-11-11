/**
 * Shared types and interfaces for Terraform.
 */

/** Supported noise algorithms */
export type NoiseType = 'simplex' | 'perlin' | 'ridged' | 'billow' | 'voronoi';

/** Analysis / rendering view modes */
export type ViewMode = 'shaded' | 'slope' | 'height' | 'contour' | 'wireframe' | 'debug-green';

/** Colour palette presets */
export type PalettePreset = 'mountain-reference' | 'alpine' | 'desert' | 'volcanic' | 'arctic';

/** Elevation mapping modes for image input */
export type ElevationMapMode = 'luminance' | 'rainbow-heatmap' | 'turbo-heatmap' | 'spectral' | 'invert';

/** A single colour band for terrain shading */
export interface ColourBand {
  /** Upper height threshold (0..1) */
  maxHeight: number;
  /** Base colour (hex) */
  color: number;
  /** Name for the legend */
  label: string;
}

/** Full palette definition */
export interface Palette {
  name: string;
  bands: ColourBand[];
  rockColor: number;
  cliffColor?: number;
  snowColor?: number;
}

/** Noise generation parameters */
export interface NoiseParams {
  type: NoiseType;
  seed: number;
  scale: number;
  octaves: number;
  lacunarity: number;
  persistence: number;
}

/** Procedural detail / micro-roughness settings for input elevation maps */
export interface DetailParams {
  enableDetail: boolean;
  detailStrength: number; // 0..0.4
  ridgeSharpening: number; // 0..2 exponent on heights to form sharp mountain ridges
  valleyDeepening: number; // 0..1 flattens/deepens lower areas into lush plains/valleys
}

/** Shape / post-processing parameters */
export interface ShapeParams {
  heightScale: number;
  redistributionPower: number;
  plateauSteps: number; // 0 = disabled
}

/** Erosion parameters */
export interface ErosionParams {
  smoothingPasses: number;
  hydraulicIterations: number;
  thermalIterations: number;
}

/** Full terrain generation parameters */
export interface TerrainParams {
  noise: NoiseParams;
  shape: ShapeParams;
  erosion: ErosionParams;
  detail: DetailParams;
  resolution: number; // grid segments (16–256)
  blendFactor: number; // 0 = uploaded data only, 1 = procedural noise only
  elevationMode: ElevationMapMode;
  normalizeElevation: boolean;
}

/** Lighting parameters */
export interface LightParams {
  azimuth: number; // degrees 0–360
  elevation: number; // degrees 0–90
  intensity: number;
  shadowEnabled: boolean;
  fogDensity: number;
}

/** Water parameters */
export interface WaterParams {
  enabled: boolean;
  level: number; // 0..1 relative to terrain height
  opacity: number;
}

/** Export options */
export interface ExportOptions {
  scale: 1 | 2 | 4;
  transparentBackground: boolean;
  hideUI: boolean;
  format: 'png' | 'obj' | 'glb' | 'heightmap';
}

/** Worker message: main → worker */
export interface WorkerRequest {
  id: number;
  resolution: number;
  noise: NoiseParams;
  shape: ShapeParams;
  erosion: ErosionParams;
  detail: DetailParams;
  blendFactor: number;
  normalizeElevation: boolean;
  inputData: Float32Array | null;
  inputWidth: number;
  inputHeight: number;
}

/** Worker message: worker → main */
export interface WorkerResponse {
  id: number;
  heightfield: Float32Array;
  resolution: number;
  elapsed: number;
}

/** Default parameter values */
export const DEFAULT_TERRAIN_PARAMS: TerrainParams = {
  noise: {
    type: 'ridged',
    seed: 42,
    scale: 3.5,
    octaves: 7,
    lacunarity: 2.1,
    persistence: 0.52,
  },
  shape: {
    heightScale: 1.35,
    redistributionPower: 1.1,
    plateauSteps: 0,
  },
  erosion: {
    smoothingPasses: 0,
    hydraulicIterations: 200,
    thermalIterations: 8,
  },
  detail: {
    enableDetail: true,
    detailStrength: 0.08,
    ridgeSharpening: 1.2,
    valleyDeepening: 0.15,
  },
  resolution: 128,
  blendFactor: 1.0,
  elevationMode: 'luminance',
  normalizeElevation: true,
};

export const DEFAULT_LIGHT_PARAMS: LightParams = {
  azimuth: 140,
  elevation: 48,
  intensity: 1.5,
  shadowEnabled: true,
  fogDensity: 0.01,
};

export const DEFAULT_WATER_PARAMS: WaterParams = {
  enabled: false, // Disabled by default so terrain base and landscape are completely unobstructed
  level: 0.08,
  opacity: 0.65,
};

/** Mesh constants */
export const TERRAIN_SIZE = 12; // world units, terrain spans -6..6
export const MIN_RESOLUTION = 16;
export const MAX_RESOLUTION = 256;
