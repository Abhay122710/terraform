/**
 * Drag-and-drop zone + file picker for terrain data input.
 */

export interface DropzoneCallbacks {
  onFile: (file: File) => void;
  onError: (message: string) => void;
}

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'csv', 'json', 'asc'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function setupDropzone(callbacks: DropzoneCallbacks): HTMLElement {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'dropzone-overlay';
  overlay.innerHTML = `
    <div class="drop-content">
      <div class="icon">📁</div>
      <p>Drop terrain file here</p>
      <p class="formats">PNG, JPG, CSV, JSON, ASC</p>
    </div>
  `;
  document.body.appendChild(overlay);

  // File input (hidden)
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', () => {
    if (input.files && input.files.length > 0) {
      handleFile(input.files[0], callbacks);
      input.value = '';
    }
  });

  // Drag-and-drop events on document
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    overlay.classList.add('active');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.remove('active');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove('active');

    if (e.dataTransfer?.files.length) {
      handleFile(e.dataTransfer.files[0], callbacks);
    }
  });

  return input; // Return input element so toolbar can trigger it
}

function handleFile(file: File, callbacks: DropzoneCallbacks) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    callbacks.onError(
      `Unsupported file type: .${ext}\nSupported: ${ALLOWED_EXTENSIONS.join(', ')}`
    );
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    callbacks.onError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 50 MB.`);
    return;
  }

  callbacks.onFile(file);
}

/** Show a brief toast notification */
export function showToast(message: string, isError: boolean = true): void {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? '' : ' success'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

