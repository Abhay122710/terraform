/**
 * Screenshot export: render the 3D scene at 1x/2x/4x and download as PNG.
 */

import * as THREE from 'three';

export interface ScreenshotOptions {
  scale: 1 | 2 | 4;
  transparentBackground: boolean;
  filename: string;
}

/**
 * Capture a screenshot of the current scene.
 */
export function captureScreenshot(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  options: ScreenshotOptions
): void {
  const { scale, transparentBackground, filename } = options;

  const origWidth = renderer.domElement.clientWidth;
  const origHeight = renderer.domElement.clientHeight;
  const w = origWidth * scale;
  const h = origHeight * scale;

  // Create offscreen renderer
  const offRenderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: transparentBackground,
    preserveDrawingBuffer: true,
  });
  offRenderer.setSize(w, h);
  offRenderer.setPixelRatio(1);
  offRenderer.shadowMap.enabled = renderer.shadowMap.enabled;
  offRenderer.shadowMap.type = renderer.shadowMap.type;
  offRenderer.toneMapping = renderer.toneMapping;
  offRenderer.toneMappingExposure = renderer.toneMappingExposure;

  if (!transparentBackground) {
    offRenderer.setClearColor(
      (scene.background as THREE.Color) || new THREE.Color(0x1a1a2e),
      1
    );
  } else {
    offRenderer.setClearColor(0x000000, 0);
  }

  // Adjust camera aspect
  const origAspect = camera.aspect;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  offRenderer.render(scene, camera);

  // Download
  offRenderer.domElement.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    offRenderer.dispose();
  }, 'image/png');

  // Restore camera
  camera.aspect = origAspect;
  camera.updateProjectionMatrix();
}

