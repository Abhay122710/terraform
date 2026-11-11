/**
 * "Generating…" indicator overlay.
 */

let indicator: HTMLElement | null = null;

function ensure(): HTMLElement {
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'generating-indicator';
    indicator.innerHTML = '<div class="spinner"></div><span>Generating terrain…</span>';
    document.body.appendChild(indicator);
  }
  return indicator;
}

export function showGenerating(): void {
  ensure().classList.add('visible');
}

export function hideGenerating(): void {
  ensure().classList.remove('visible');
}

