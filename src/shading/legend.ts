/**
 * Legend overlay — canvas-drawn gradient for heatmap / contour views.
 */

import type { ViewMode } from '../core/types';

let legendCanvas: HTMLCanvasElement | null = null;
let legendContainer: HTMLElement | null = null;

function ensureLegendEl(): HTMLElement {
  if (!legendContainer) {
    legendContainer = document.createElement('div');
    legendContainer.id = 'legend';
    legendContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 320px;
      z-index: 20;
      pointer-events: none;
      display: none;
    `;
    document.body.appendChild(legendContainer);
  }
  return legendContainer;
}

export function updateLegend(mode: ViewMode): void {
  const container = ensureLegendEl();

  if (mode === 'shaded' || mode === 'wireframe') {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = '';

  legendCanvas = document.createElement('canvas');
  legendCanvas.width = 24;
  legendCanvas.height = 200;
  legendCanvas.style.borderRadius = '4px';
  legendCanvas.style.border = '1px solid rgba(255,255,255,0.1)';

  const ctx = legendCanvas.getContext('2d')!;

  if (mode === 'slope') {
    // Green → Yellow → Red (bottom to top)
    const grad = ctx.createLinearGradient(0, 200, 0, 0);
    grad.addColorStop(0, '#00ff00');
    grad.addColorStop(0.5, '#ffff00');
    grad.addColorStop(1, '#ff0000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 200);
  } else if (mode === 'height') {
    const grad = ctx.createLinearGradient(0, 200, 0, 0);
    grad.addColorStop(0, '#0000aa');
    grad.addColorStop(0.25, '#00aaff');
    grad.addColorStop(0.5, '#00cc44');
    grad.addColorStop(0.75, '#ffff00');
    grad.addColorStop(1, '#ffffff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 200);
  } else if (mode === 'contour') {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, 24, 200);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const y = 200 - (i / 10) * 200;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(24, y);
      ctx.stroke();
    }
  }

  container.appendChild(legendCanvas);

  // Labels
  const labelsDiv = document.createElement('div');
  labelsDiv.style.cssText = 'font-size:10px;color:#aaa;margin-top:4px;text-align:center;font-family:monospace;';

  if (mode === 'slope') {
    labelsDiv.innerHTML = '60°<br><br><br>30°<br><br><br>0°';
  } else if (mode === 'height') {
    labelsDiv.innerHTML = '1.0<br><br><br>0.5<br><br><br>0.0';
  } else if (mode === 'contour') {
    labelsDiv.innerHTML = 'Contours';
  }

  container.appendChild(labelsDiv);
}

