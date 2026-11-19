/**
 * Terraform — UI Management & Synchronization.
 * Implements:
 * - Solves Defect 3.1: Complete bi-directional synchronization between state and DOM controls.
 * - Solves Defect 3.2: Responsive sidebar for desktop & bottom sheet for mobile (320px–1440px).
 * - Solves Defect 4.1: Height and Slope legends with vertically aligned labels and explicit units.
 * - Top 3 immediately accessible controls: Mountain Height, Color Theme, View Mode.
 * - Active Terrain Source indicator badge.
 * - Accessibility: Semantic HTML, focus rings, ARIA attributes.
 */

import { getState, updateState, resetStateToDefault, getLoadedDataCache } from './state.js';
import { getPaletteList } from './materials.js';
import { BUNDLED_PRESETS } from './presets.js';

/**
 * Initialize all UI components and event bindings.
 */
export function setupUI(callbacks) {
  const panel = document.getElementById('controls-panel');
  const backdrop = document.getElementById('sheet-backdrop');
  const mobileToggleBtn = document.getElementById('mobile-controls-btn');
  const closePanelBtn = document.getElementById('close-panel-btn');
  const sourceBadge = document.getElementById('source-badge');
  const legendContainer = document.getElementById('legend-container');

  // Populate color theme dropdown
  const themeSelect = document.getElementById('input-palette');
  if (themeSelect) {
    themeSelect.innerHTML = '';
    getPaletteList().forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      themeSelect.appendChild(opt);
    });
  }

  // Populate presets dropdown
  const presetSelect = document.getElementById('input-preset-select');
  if (presetSelect) {
    presetSelect.innerHTML = '<option value="">-- Choose a Preset --</option>';
    BUNDLED_PRESETS.forEach((preset) => {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.name;
      presetSelect.appendChild(opt);
    });
  }

  // ─── Input Synchronization Map ───────────────────────────────
  // Pairs of [rangeInputId, numberInputId, stateKey, callbackType]
  const numericControls = [
    { range: 'range-mountain-height', num: 'num-mountain-height', key: 'mountainHeight', type: 'mesh' },
    { range: 'range-ridge-sharpening', num: 'num-ridge-sharpening', key: 'ridgeSharpening', type: 'terrain' },
    { range: 'range-valley-deepening', num: 'num-valley-deepening', key: 'valleyDeepening', type: 'terrain' },
    { range: 'range-detail-strength', num: 'num-detail-strength', key: 'detailStrength', type: 'terrain' },
    { range: 'range-elevation-curve', num: 'num-elevation-curve', key: 'elevationCurve', type: 'terrain' },
    { range: 'range-plateau-steps', num: 'num-plateau-steps', key: 'plateauSteps', type: 'terrain' },
    { range: 'range-resolution', num: 'num-resolution', key: 'resolution', type: 'terrain' },
    { range: 'range-blend-factor', num: 'num-blend-factor', key: 'blendFactor', type: 'terrain' },
    { range: 'range-seed', num: 'num-seed', key: 'seed', type: 'terrain' },
    { range: 'range-noise-scale', num: 'num-noise-scale', key: 'noiseScale', type: 'terrain' },
    { range: 'range-octaves', num: 'num-octaves', key: 'octaves', type: 'terrain' },
    { range: 'range-lacunarity', num: 'num-lacunarity', key: 'lacunarity', type: 'terrain' },
    { range: 'range-persistence', num: 'num-persistence', key: 'persistence', type: 'terrain' },
    { range: 'range-smoothing-passes', num: 'num-smoothing-passes', key: 'smoothingPasses', type: 'terrain' },
    { range: 'range-hydraulic-iterations', num: 'num-hydraulic-iterations', key: 'hydraulicIterations', type: 'terrain' },
    { range: 'range-thermal-iterations', num: 'num-thermal-iterations', key: 'thermalIterations', type: 'terrain' },
    { range: 'range-jitter', num: 'num-jitter', key: 'jitter', type: 'mesh' },
    { range: 'range-steepness', num: 'num-steepness', key: 'steepnessThreshold', type: 'mesh' },
    { range: 'range-water-level', num: 'num-water-level', key: 'waterLevel', type: 'water' },
    { range: 'range-water-opacity', num: 'num-water-opacity', key: 'waterOpacity', type: 'water' },
    { range: 'range-sun-azimuth', num: 'num-sun-azimuth', key: 'sunAzimuth', type: 'light' },
    { range: 'range-sun-elevation', num: 'num-sun-elevation', key: 'sunElevation', type: 'light' },
    { range: 'range-sun-intensity', num: 'num-sun-intensity', key: 'sunIntensity', type: 'light' },
    { range: 'range-fog-density', num: 'num-fog-density', key: 'fogDensity', type: 'light' },
    { range: 'range-contour-interval', num: 'num-contour-interval', key: 'contourInterval', type: 'view' },
  ];

  numericControls.forEach(({ range, num, key, type }) => {
    const rangeEl = document.getElementById(range);
    const numEl = document.getElementById(num);

    const onValChange = (val) => {
      const parsed = parseFloat(val);
      if (isNaN(parsed)) return;
      updateState({ [key]: parsed });

      if (type === 'terrain') callbacks.onTerrainChange();
      else if (type === 'mesh') callbacks.onMeshChange();
      else if (type === 'water') callbacks.onWaterChange();
      else if (type === 'light') callbacks.onLightChange();
      else if (type === 'view') callbacks.onViewChange();
    };

    if (rangeEl && numEl) {
      rangeEl.addEventListener('input', (e) => {
        numEl.value = e.target.value;
        onValChange(e.target.value);
      });
      numEl.addEventListener('input', (e) => {
        rangeEl.value = e.target.value;
        onValChange(e.target.value);
      });
      numEl.addEventListener('blur', () => {
        // Enforce valid bounds on blur
        syncUIFromState(getState());
      });
    }
  });

  // ─── Selects ────────────────────────────────────────────────
  bindSelect('input-view-mode', 'viewMode', () => callbacks.onViewChange());
  bindSelect('input-palette', 'palette', () => callbacks.onMeshChange());
  bindSelect('input-noise-type', 'noiseType', () => callbacks.onTerrainChange());
  bindSelect('input-elevation-mode', 'elevationMode', () => callbacks.onElevationModeChange());
  bindSelect('input-export-scale', 'exportScale', null);

  // ─── Checkboxes ─────────────────────────────────────────────
  bindCheckbox('check-flat-shading', 'flatShading', () => callbacks.onMeshChange());
  bindCheckbox('check-show-base', 'showBase', () => callbacks.onMeshChange());
  bindCheckbox('check-enable-detail', 'enableDetail', () => callbacks.onTerrainChange());
  bindCheckbox('check-normalize-bounds', 'normalizeElevation', () => callbacks.onTerrainChange());
  bindCheckbox('check-water-enabled', 'waterEnabled', () => callbacks.onWaterChange());
  bindCheckbox('check-shadow-enabled', 'shadowEnabled', () => callbacks.onLightChange());
  bindCheckbox('check-auto-rotate', 'autoRotate', () => callbacks.onAutoRotateToggle());
  bindCheckbox('check-export-transparent', 'exportTransparent', null);

  // ─── Preset select ──────────────────────────────────────────
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      const presetId = e.target.value;
      if (!presetId) return;
      const found = BUNDLED_PRESETS.find((p) => p.id === presetId);
      if (found) {
        callbacks.onApplyPreset(found.settings);
        presetSelect.value = '';
      }
    });
  }

  // ─── Action Buttons ─────────────────────────────────────────
  bindButton('btn-randomize-seed', () => callbacks.onRandomizeSeed());
  bindButton('btn-reset-default', () => callbacks.onResetDefault());
  bindButton('btn-reset-camera', () => callbacks.onResetCamera());
  bindButton('btn-restore-sample', () => callbacks.onRestoreSample());
  bindButton('btn-upload-file', () => callbacks.onUploadClick());
  bindButton('btn-clear-file', () => callbacks.onClearFile());
  bindButton('btn-export-png', () => callbacks.onExportPNG());
  bindButton('btn-export-heightmap', () => callbacks.onExportHeightmap());
  bindButton('btn-export-obj', () => callbacks.onExportOBJ());
  bindButton('btn-export-glb', () => callbacks.onExportGLB());
  bindButton('btn-save-preset', () => callbacks.onSavePreset());
  bindButton('btn-load-preset', () => callbacks.onLoadPreset());

  // Quick toolbar floating buttons
  bindButton('quick-reset-camera', () => callbacks.onResetCamera());
  bindButton('quick-restore-sample', () => callbacks.onRestoreSample());
  bindButton('quick-fit-terrain', () => callbacks.onFitTerrain());

  // ─── Mobile Bottom Sheet Controls ───────────────────────────
  function openMobileSheet() {
    panel.classList.add('mobile-open');
    backdrop.classList.add('visible');
    mobileToggleBtn.setAttribute('aria-expanded', 'true');
    panel.focus();
  }

  function closeMobileSheet() {
    panel.classList.remove('mobile-open');
    backdrop.classList.remove('visible');
    mobileToggleBtn.setAttribute('aria-expanded', 'false');
    mobileToggleBtn.focus();
  }

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
      if (panel.classList.contains('mobile-open')) {
        closeMobileSheet();
      } else {
        openMobileSheet();
      }
    });
  }

  if (closePanelBtn) {
    closePanelBtn.addEventListener('click', closeMobileSheet);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSheet);
  }

  // Dismiss on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('mobile-open')) {
      closeMobileSheet();
    }
  });

  // Touch drag-down handle to close sheet
  const sheetHandle = document.getElementById('sheet-handle');
  if (sheetHandle) {
    let startY = 0;
    sheetHandle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    }, { passive: true });
    sheetHandle.addEventListener('touchmove', (e) => {
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 60) {
        closeMobileSheet();
      }
    }, { passive: true });
  }

  // Sync initial UI
  syncUIFromState(getState());

  return {
    syncUIFromState,
    updateSourceIndicator,
    updateLegend,
    openMobileSheet,
    closeMobileSheet,
  };
}

function bindSelect(id, stateKey, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', (e) => {
    const val = el.dataset.type === 'number' ? Number(e.target.value) : e.target.value;
    updateState({ [stateKey]: val });
    if (onChange) onChange();
  });
}

function bindCheckbox(id, stateKey, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', (e) => {
    updateState({ [stateKey]: e.target.checked });
    if (onChange) onChange();
  });
}

function bindButton(id, onClick) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', onClick);
}

/**
 * Synchronize all DOM controls from current state.
 * Solves Defect 3.1: Ensures displayed values never become stale or desynced.
 */
export function syncUIFromState(state) {
  // Update all paired range and number inputs
  setVal('range-mountain-height', 'num-mountain-height', state.mountainHeight);
  setVal('range-ridge-sharpening', 'num-ridge-sharpening', state.ridgeSharpening);
  setVal('range-valley-deepening', 'num-valley-deepening', state.valleyDeepening);
  setVal('range-detail-strength', 'num-detail-strength', state.detailStrength);
  setVal('range-elevation-curve', 'num-elevation-curve', state.elevationCurve);
  setVal('range-plateau-steps', 'num-plateau-steps', state.plateauSteps);
  setVal('range-resolution', 'num-resolution', state.resolution);
  setVal('range-blend-factor', 'num-blend-factor', state.blendFactor);
  setVal('range-seed', 'num-seed', state.seed);
  setVal('range-noise-scale', 'num-noise-scale', state.noiseScale);
  setVal('range-octaves', 'num-octaves', state.octaves);
  setVal('range-lacunarity', 'num-lacunarity', state.lacunarity);
  setVal('range-persistence', 'num-persistence', state.persistence);
  setVal('range-smoothing-passes', 'num-smoothing-passes', state.smoothingPasses);
  setVal('range-hydraulic-iterations', 'num-hydraulic-iterations', state.hydraulicIterations);
  setVal('range-thermal-iterations', 'num-thermal-iterations', state.thermalIterations);
  setVal('range-jitter', 'num-jitter', state.jitter);
  setVal('range-steepness', 'num-steepness', state.steepnessThreshold);
  setVal('range-water-level', 'num-water-level', state.waterLevel);
  setVal('range-water-opacity', 'num-water-opacity', state.waterOpacity);
  setVal('range-sun-azimuth', 'num-sun-azimuth', state.sunAzimuth);
  setVal('range-sun-elevation', 'num-sun-elevation', state.sunElevation);
  setVal('range-sun-intensity', 'num-sun-intensity', state.sunIntensity);
  setVal('range-fog-density', 'num-fog-density', state.fogDensity);
  setVal('range-contour-interval', 'num-contour-interval', state.contourInterval);

  // Select dropdowns
  setSelect('input-view-mode', state.viewMode);
  setSelect('input-palette', state.palette);
  setSelect('input-noise-type', state.noiseType);
  setSelect('input-elevation-mode', state.elevationMode);
  setSelect('input-export-scale', state.exportScale);

  // Checkboxes
  setChecked('check-flat-shading', state.flatShading);
  setChecked('check-show-base', state.showBase);
  setChecked('check-enable-detail', state.enableDetail);
  setChecked('check-normalize-bounds', state.normalizeElevation);
  setChecked('check-water-enabled', state.waterEnabled);
  setChecked('check-shadow-enabled', state.shadowEnabled);
  setChecked('check-auto-rotate', state.autoRotate);
  setChecked('check-export-transparent', state.exportTransparent);

  // Update source badge and legend
  updateSourceIndicator(state);
  updateLegend(state.viewMode);
}

function setVal(rangeId, numId, val) {
  const r = document.getElementById(rangeId);
  const n = document.getElementById(numId);
  if (r) r.value = val;
  if (n) n.value = val;
}

function setSelect(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(val);
}

/**
 * Update the active terrain source badge.
 */
export function updateSourceIndicator(state) {
  const badge = document.getElementById('source-badge');
  if (!badge) return;

  const cache = getLoadedDataCache();
  let icon = '📁';
  let title = 'Sample heightmap';
  let detail = 'mountain-sample.png';

  if (state.source === 'upload' && state.loadedFileName) {
    icon = '⬆️';
    title = 'Uploaded heightmap';
    detail = state.loadedFileName;
  } else if (state.source === 'procedural' || (!cache.data && state.blendFactor >= 1.0)) {
    icon = '🌊';
    title = 'Procedural Terrain';
    detail = `Seed: ${state.seed} (${state.noiseType})`;
  } else if (state.blendFactor > 0 && state.blendFactor < 1.0) {
    icon = '🔀';
    title = 'Blended Elevation';
    detail = `${Math.round((1 - state.blendFactor) * 100)}% Map + ${Math.round(state.blendFactor * 100)}% Noise`;
  }

  badge.innerHTML = `
    <span class="badge-icon">${icon}</span>
    <span class="badge-title">${title}</span>
    <span class="badge-detail">${detail}</span>
  `;
}

/**
 * Rebuild and update Height and Slope legends.
 * Solves Defect 4.1: Aligns max, mid, min values alongside gradient endpoints and centers.
 */
export function updateLegend(viewMode) {
  const container = document.getElementById('legend-container');
  if (!container) return;

  if (viewMode === 'shaded' || viewMode === 'wireframe' || viewMode === 'debug-green') {
    container.classList.remove('visible');
    return;
  }

  container.classList.add('visible');
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'legend-card';

  if (viewMode === 'slope') {
    card.innerHTML = `
      <div class="legend-header">
        <span class="legend-title">Slope Analysis</span>
        <span class="legend-unit">Degrees (°)</span>
      </div>
      <div class="legend-body">
        <div class="legend-bar slope-gradient"></div>
        <div class="legend-scale">
          <span class="scale-label top">60° (Steep)</span>
          <span class="scale-label mid">30°</span>
          <span class="scale-label bottom">0° (Flat)</span>
        </div>
      </div>
    `;
  } else if (viewMode === 'height') {
    card.innerHTML = `
      <div class="legend-header">
        <span class="legend-title">Elevation Heatmap</span>
        <span class="legend-unit">Normalized Height</span>
      </div>
      <div class="legend-body">
        <div class="legend-bar height-gradient"></div>
        <div class="legend-scale">
          <span class="scale-label top">1.0 (Peak)</span>
          <span class="scale-label mid">0.5</span>
          <span class="scale-label bottom">0.0 (Base)</span>
        </div>
      </div>
    `;
  } else if (viewMode === 'contour') {
    card.innerHTML = `
      <div class="legend-header">
        <span class="legend-title">Contour Lines</span>
        <span class="legend-unit">Isolines</span>
      </div>
      <div class="legend-body">
        <div class="legend-bar contour-pattern"></div>
        <div class="legend-scale">
          <span class="scale-label top">Peak</span>
          <span class="scale-label mid">Mid</span>
          <span class="scale-label bottom">Valley</span>
        </div>
      </div>
    `;
  }

  container.appendChild(card);
}
