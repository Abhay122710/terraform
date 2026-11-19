/**
 * Terraform — File Exports & Preset Serialization.
 * Implements:
 * 1. Screenshot (PNG) at 1x and 2x resolution with optional transparent background
 * 2. Heightmap (PNG) grayscale elevation export
 * 3. Mesh (OBJ) Wavefront export with vertices, normals, and faces
 * 4. Mesh (GLB) binary glTF export using official Three.js GLTFExporter
 * 5. Save Preset & Load Preset (JSON)
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { downloadBlob, downloadText } from './utils.js';
import { VIEWPORT_CLEAR_COLOR } from './camera.js';

/**
 * Capture high-res screenshot PNG of current 3D view.
 */
export function exportScreenshotPNG(renderer, scene, camera, options = {}) {
  const scale = options.scale || 1;
  const transparent = Boolean(options.transparentBackground);
  const seed = options.seed || 42;
  const filename = `terraform-${seed}${transparent ? '-alpha' : ''}-${scale}x.png`;

  const canvas = renderer.domElement;
  const w = canvas.clientWidth * scale;
  const h = canvas.clientHeight * scale;

  const offRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: transparent,
    preserveDrawingBuffer: true,
  });
  offRenderer.setSize(w, h);
  offRenderer.setPixelRatio(1);
  offRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
  offRenderer.shadowMap.type = renderer.shadowMap.type;
  offRenderer.toneMapping = renderer.toneMapping;
  offRenderer.toneMappingExposure = renderer.toneMappingExposure;

  if (transparent) {
    offRenderer.setClearColor(0x000000, 0);
    const origBackground = scene.background;
    scene.background = null;

    const origAspect = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    offRenderer.render(scene, camera);

    scene.background = origBackground;
    camera.aspect = origAspect;
    camera.updateProjectionMatrix();
  } else {
    offRenderer.setClearColor(VIEWPORT_CLEAR_COLOR, 1.0);
    const origAspect = camera.aspect;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    offRenderer.render(scene, camera);

    camera.aspect = origAspect;
    camera.updateProjectionMatrix();
  }

  offRenderer.domElement.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
    offRenderer.dispose();
  }, 'image/png');
}

/**
 * Export heightfield as a standard grayscale PNG.
 */
export function exportHeightmapPNG(data, size, filename = 'terraform-heightmap.png') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);

  for (let i = 0; i < data.length; i++) {
    const v = Math.floor(Math.max(0, Math.min(1, data[i])) * 255);
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);

  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, filename);
    }
  }, 'image/png');
}

/**
 * Export terrain mesh as Wavefront OBJ.
 */
export function exportOBJ(terrainMesh, filename = 'terraform.obj') {
  if (!terrainMesh || !terrainMesh.geometry) return;

  const geometry = terrainMesh.geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');

  let obj = '# Terraform Low-Poly Terrain Generator Export\n';
  obj += `# Vertices: ${positions.count}\n\n`;

  // Vertices
  for (let i = 0; i < positions.count; i++) {
    obj += `v ${positions.getX(i).toFixed(5)} ${positions.getY(i).toFixed(5)} ${positions.getZ(i).toFixed(5)}\n`;
  }

  // Normals
  for (let i = 0; i < normals.count; i++) {
    obj += `vn ${normals.getX(i).toFixed(5)} ${normals.getY(i).toFixed(5)} ${normals.getZ(i).toFixed(5)}\n`;
  }

  // Faces (non-indexed triangles: every 3 vertices = 1 face)
  for (let i = 0; i < positions.count; i += 3) {
    const a = i + 1;
    const b = i + 2;
    const c = i + 3;
    obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
  }

  downloadText(obj, filename, 'model/obj');
}

/**
 * Export terrain mesh as binary glTF (GLB).
 */
export function exportGLB(terrainMesh, filename = 'terraform.glb') {
  if (!terrainMesh) return;

  const exporter = new GLTFExporter();
  exporter.parse(
    terrainMesh,
    (result) => {
      if (result instanceof ArrayBuffer) {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        downloadBlob(blob, filename);
      }
    },
    (err) => {
      console.error('GLB export error:', err);
    },
    { binary: true }
  );
}

/**
 * Save complete application preset to JSON.
 */
export function exportPresetJSON(state, filename = null) {
  const name = filename || `terraform-preset-${state.seed}.json`;
  const preset = {
    version: '2.0.0',
    app: 'Terraform',
    timestamp: new Date().toISOString(),
    settings: { ...state },
  };

  const json = JSON.stringify(preset, null, 2);
  downloadText(json, name, 'application/json');
}

/**
 * Parse and load preset from JSON string.
 */
export function parsePresetJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (parsed && parsed.settings) {
    return parsed.settings;
  } else if (parsed && typeof parsed === 'object') {
    return parsed;
  }
  throw new Error('Unrecognized preset format.');
}
