/**
 * Keyboard shortcuts.
 */

export interface ShortcutHandlers {
  randomize: () => void;
  exportPng: () => void;
  toggleAutoRotate: () => void;
  undo: () => void;
  redo: () => void;
}

export function setupShortcuts(handlers: ShortcutHandlers): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Don't fire when typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'r':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlers.randomize();
        }
        break;
      case 'e':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlers.exportPng();
        }
        break;
      case 'a':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handlers.toggleAutoRotate();
        }
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            handlers.redo();
          } else {
            handlers.undo();
          }
        }
        break;
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handlers.redo();
        }
        break;
    }
  });
}

