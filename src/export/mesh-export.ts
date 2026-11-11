/**
 * Export terrain mesh as OBJ or GLB.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/**
 * Export mesh as OBJ string and download.
 */
export function exportOBJ(mesh: THREE.Mesh, filename: string = 'terraform.obj'): void {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');

  let obj = '# Terraform terrain export\n';

  // Vertices
  for (let i = 0; i < positions.count; i++) {
    obj += `v ${positions.getX(i).toFixed(6)} ${positions.getY(i).toFixed(6)} ${positions.getZ(i).toFixed(6)}\n`;
  }

  // Normals
  for (let i = 0; i < normals.count; i++) {
    obj += `vn ${normals.getX(i).toFixed(6)} ${normals.getY(i).toFixed(6)} ${normals.getZ(i).toFixed(6)}\n`;
  }

  // Faces (non-indexed, every 3 vertices = 1 face)
  for (let i = 0; i < positions.count; i += 3) {
    const a = i + 1;
    const b = i + 2;
    const c = i + 3;
    obj += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
  }

  downloadText(obj, filename, 'model/obj');
}

/**
 * Export mesh as GLB (binary glTF) and download.
 */
export function exportGLB(mesh: THREE.Mesh, filename: string = 'terraform.glb'): void {
  const exporter = new GLTFExporter();
  exporter.parse(
    mesh,
    (result) => {
      if (result instanceof ArrayBuffer) {
        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    (error) => {
      console.error('GLB export failed:', error);
    },
    { binary: true }
  );
}

function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

