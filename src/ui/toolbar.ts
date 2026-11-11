/**
 * Toolbar: lil-gui panel with all terrain parameters.
 * Extended with Mountain Detail, Heatmap decoding modes, elevation normalization, and Diagnostic Debug Mode.
 */

import GUI from 'lil-gui';
import type {
  TerrainParams,
  LightParams,
  WaterParams,
  NoiseType,
  ViewMode,
  ElevationMapMode,
} from '../core/types';
import {
  DEFAULT_TERRAIN_PARAMS,
  DEFAULT_LIGHT_PARAMS,
  DEFAULT_WATER_PARAMS,
} from '../core/types';
import { getPaletteNames } from '../shading/palettes';

export interface ToolbarState {
  terrain: TerrainParams;
  light: LightParams;
  water: WaterParams;
  view: {
    mode: ViewMode;
    contourInterval: number;
    flatShading: boolean;
    jitter: number;
    showBase: boolean;
  };
  palette: string;
  steepnessThreshold: number;
  autoRotate: boolean;
  exportScale: number;
  exportTransparent: boolean;
}

export function getDefaultState(): ToolbarState {
  return {
    terrain: JSON.parse(JSON.stringify(DEFAULT_TERRAIN_PARAMS)),
    light: { ...DEFAULT_LIGHT_PARAMS },
    water: { ...DEFAULT_WATER_PARAMS },
    view: {
      mode: 'shaded' as ViewMode,
      contourInterval: 0.1,
      flatShading: true,
      jitter: 0.12,
      showBase: true,
    },
    palette: 'mountain-reference',
    steepnessThreshold: 38,
    autoRotate: false,
    exportScale: 1,
    exportTransparent: false,
  };
}

export interface ToolbarCallbacks {
  onTerrainChange: () => void;
  onMeshChange: () => void;
  onViewChange: () => void;
  onLightChange: () => void;
  onWaterChange: () => void;
  onElevationModeChange: () => void;
  onRandomize: () => void;
  onReset: () => void;
  onLoadFile: () => void;
  onClearFile: () => void;
  onExportPNG: () => void;
  onExportHeightmap: () => void;
  onExportOBJ: () => void;
  onExportGLB: () => void;
  onSaveSettings: () => void;
  onLoadSettings: () => void;
  onResetCamera: () => void;
  onAutoRotateToggle: () => void;
}

export function createToolbar(
  state: ToolbarState,
  callbacks: ToolbarCallbacks
): GUI {
  const gui = new GUI({
    title: '🏔️ TERRAFORM',
    width: 320,
  });

  // ─── Input & Map Processing ────────────────────────────────
  const inputFolder = gui.addFolder('📁 Input & Heightmap');
  inputFolder.add({ loadFile: callbacks.onLoadFile }, 'loadFile').name('Upload Map / File…');
  inputFolder.add({ clearFile: callbacks.onClearFile }, 'clearFile').name('Clear Loaded Map');

  inputFolder
    .add(state.terrain, 'elevationMode', [
      'luminance',
      'rainbow-heatmap',
      'turbo-heatmap',
      'spectral',
      'invert',
    ] as ElevationMapMode[])
    .name('Map Decoding')
    .onChange(callbacks.onElevationModeChange);

  inputFolder
    .add(state.terrain, 'normalizeElevation')
    .name('Normalize Bounds')
    .onChange(callbacks.onTerrainChange);

  inputFolder
    .add(state.terrain, 'blendFactor', 0, 1, 0.01)
    .name('Blend with Noise')
    .onChange(callbacks.onTerrainChange);

  // ─── Mountain Structure & Detail ────────────────────────────
  const detailFolder = gui.addFolder('🏔️ Mountain Structure');
  detailFolder
    .add(state.terrain.shape, 'heightScale', 0.2, 4.0, 0.05)
    .name('Mountain Height')
    .onChange(callbacks.onMeshChange);

  detailFolder
    .add(state.terrain.detail, 'ridgeSharpening', 0.8, 2.5, 0.05)
    .name('Ridge Sharpness')
    .onChange(callbacks.onTerrainChange);

  detailFolder
    .add(state.terrain.detail, 'valleyDeepening', 0.0, 0.8, 0.05)
    .name('Valley Flattening')
    .onChange(callbacks.onTerrainChange);

  detailFolder
    .add(state.terrain.detail, 'enableDetail')
    .name('Procedural Detail')
    .onChange(callbacks.onTerrainChange);

  detailFolder
    .add(state.terrain.detail, 'detailStrength', 0.0, 0.3, 0.01)
    .name('Detail Strength')
    .onChange(callbacks.onTerrainChange);

  detailFolder
    .add(state.terrain.shape, 'redistributionPower', 0.2, 3.5, 0.05)
    .name('Elevation Curve')
    .onChange(callbacks.onTerrainChange);

  detailFolder
    .add(state.terrain.shape, 'plateauSteps', 0, 20, 1)
    .name('Plateau / Terraces')
    .onChange(callbacks.onTerrainChange);

  // ─── Procedural Noise ──────────────────────────────────────
  const noiseFolder = gui.addFolder('🌊 Procedural Noise');
  noiseFolder
    .add(state.terrain.noise, 'type', ['ridged', 'simplex', 'perlin', 'billow', 'voronoi'] as NoiseType[])
    .name('Noise Type')
    .onChange(callbacks.onTerrainChange);
  noiseFolder
    .add(state.terrain.noise, 'seed', 0, 99999, 1)
    .name('Seed')
    .onChange(callbacks.onTerrainChange);
  noiseFolder
    .add(state.terrain.noise, 'scale', 0.5, 15, 0.1)
    .name('Noise Scale')
    .onChange(callbacks.onTerrainChange);
  noiseFolder
    .add(state.terrain.noise, 'octaves', 1, 10, 1)
    .name('Octaves')
    .onChange(callbacks.onTerrainChange);
  noiseFolder
    .add(state.terrain.noise, 'lacunarity', 1, 4, 0.1)
    .name('Lacunarity')
    .onChange(callbacks.onTerrainChange);
  noiseFolder
    .add(state.terrain.noise, 'persistence', 0.1, 1, 0.02)
    .name('Persistence')
    .onChange(callbacks.onTerrainChange);
  noiseFolder.add({ randomize: callbacks.onRandomize }, 'randomize').name('🎲 Randomize Seed');
  noiseFolder.close();

  // ─── Erosion ───────────────────────────────────────────────
  const erosionFolder = gui.addFolder('💧 Erosion Simulation');
  erosionFolder
    .add(state.terrain.erosion, 'smoothingPasses', 0, 10, 1)
    .name('Smoothing')
    .onChange(callbacks.onTerrainChange);
  erosionFolder
    .add(state.terrain.erosion, 'hydraulicIterations', 0, 5000, 100)
    .name('Hydraulic Drops')
    .onChange(callbacks.onTerrainChange);
  erosionFolder
    .add(state.terrain.erosion, 'thermalIterations', 0, 50, 1)
    .name('Thermal Talus')
    .onChange(callbacks.onTerrainChange);
  erosionFolder.close();

  // ─── Mesh Geometry ─────────────────────────────────────────
  const meshFolder = gui.addFolder('🔺 Mesh Geometry');
  meshFolder
    .add(state.terrain, 'resolution', 16, 256, 1)
    .name('Resolution (N×N)')
    .onChange(callbacks.onTerrainChange);
  meshFolder
    .add(state.view, 'flatShading')
    .name('Low-Poly (Flat)')
    .onChange(callbacks.onMeshChange);
  meshFolder
    .add(state.view, 'jitter', 0, 0.6, 0.02)
    .name('Vertex Jitter')
    .onChange(callbacks.onMeshChange);
  meshFolder
    .add(state.view, 'showBase')
    .name('Solid Base Skirt')
    .onChange(callbacks.onMeshChange);

  // ─── Materials & Colours ───────────────────────────────────
  const colourFolder = gui.addFolder('🎨 Terrain Materials');
  colourFolder
    .add(state, 'palette', getPaletteNames())
    .name('Color Theme')
    .onChange(callbacks.onMeshChange);
  colourFolder
    .add(state, 'steepnessThreshold', 10, 75, 1)
    .name('Steep → Rock (°)')
    .onChange(callbacks.onMeshChange);

  // ─── Water ─────────────────────────────────────────────────
  const waterFolder = gui.addFolder('🌊 Valley Water Plane');
  waterFolder
    .add(state.water, 'enabled')
    .name('Water Enabled')
    .onChange(callbacks.onWaterChange);
  waterFolder
    .add(state.water, 'level', 0, 1, 0.01)
    .name('Water Level')
    .onChange(callbacks.onWaterChange);
  waterFolder
    .add(state.water, 'opacity', 0, 1, 0.05)
    .name('Water Opacity')
    .onChange(callbacks.onWaterChange);
  waterFolder.close();

  // ─── Light & Atmosphere ────────────────────────────────────
  const lightFolder = gui.addFolder('☀️ Sun & Atmosphere');
  lightFolder
    .add(state.light, 'azimuth', 0, 360, 1)
    .name('Sun Azimuth')
    .onChange(callbacks.onLightChange);
  lightFolder
    .add(state.light, 'elevation', 5, 90, 1)
    .name('Sun Elevation')
    .onChange(callbacks.onLightChange);
  lightFolder
    .add(state.light, 'intensity', 0.1, 4, 0.1)
    .name('Sun Intensity')
    .onChange(callbacks.onLightChange);
  lightFolder
    .add(state.light, 'shadowEnabled')
    .name('Shadows')
    .onChange(callbacks.onLightChange);
  lightFolder
    .add(state.light, 'fogDensity', 0, 0.08, 0.002)
    .name('Atmosphere Fog')
    .onChange(callbacks.onLightChange);
  lightFolder.close();

  // ─── View & Diagnostic ─────────────────────────────────────
  const viewFolder = gui.addFolder('👁️ Analysis & Debug Views');
  viewFolder
    .add(state.view, 'mode', [
      'shaded',
      'debug-green',
      'slope',
      'height',
      'contour',
      'wireframe',
    ] as ViewMode[])
    .name('View Mode')
    .onChange(callbacks.onViewChange);
  viewFolder
    .add(state.view, 'contourInterval', 0.02, 0.3, 0.01)
    .name('Contour Interval')
    .onChange(callbacks.onViewChange);
  viewFolder
    .add(state, 'autoRotate')
    .name('Auto Rotate')
    .onChange(callbacks.onAutoRotateToggle);
  viewFolder.add({ resetCamera: callbacks.onResetCamera }, 'resetCamera').name('📷 Reset Camera');

  // ─── Export ────────────────────────────────────────────────
  const exportFolder = gui.addFolder('💾 Export');
  exportFolder
    .add(state, 'exportScale', { '1x': 1, '2x': 2, '4x': 4 })
    .name('Resolution');
  exportFolder
    .add(state, 'exportTransparent')
    .name('Transparent BG');
  exportFolder.add({ exportPng: callbacks.onExportPNG }, 'exportPng').name('📸 Screenshot (PNG)');
  exportFolder.add({ exportHm: callbacks.onExportHeightmap }, 'exportHm').name('🗺️ Heightmap (PNG)');
  exportFolder.add({ exportObj: callbacks.onExportOBJ }, 'exportObj').name('📦 Mesh (OBJ)');
  exportFolder.add({ exportGlb: callbacks.onExportGLB }, 'exportGlb').name('📦 Mesh (GLB)');
  exportFolder.close();

  // ─── Settings ──────────────────────────────────────────────
  const settingsFolder = gui.addFolder('⚙️ Settings');
  settingsFolder.add({ save: callbacks.onSaveSettings }, 'save').name('💾 Save Preset');
  settingsFolder.add({ load: callbacks.onLoadSettings }, 'load').name('📂 Load Preset');
  settingsFolder.add({ reset: callbacks.onReset }, 'reset').name('🔄 Reset Default');
  settingsFolder.close();

  return gui;
}
