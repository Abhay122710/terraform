/**
 * Terraform — Utility functions.
 * Pure ES6+ helper functions for math, seeding, file downloads, and notifications.
 */

/**
 * Seeded pseudo-random number generator (Lehmer LCG).
 * Deterministic for given seed, returns [0, 1).
 */
export function seededRandom(seed) {
  let s = Math.abs(Math.floor(seed)) || 1;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Clamp a value between min and max */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** Linear interpolation between a and b */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep interpolation */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

/** Degrees to radians */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Radians to degrees */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Debounce a function call by waitMs.
 */
export function debounce(fn, waitMs) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, waitMs);
  };
}

/**
 * Trigger download of a Blob file in the browser.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Trigger download of text content as a file.
 */
export function downloadText(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Show a floating toast notification.
 */
export function showToast(message, isError = false) {
  const existing = document.querySelectorAll('.toast');
  existing.forEach((t) => t.remove());

  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ' success'}`;
  toast.setAttribute('role', 'alert');
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}
