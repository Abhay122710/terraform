/**
 * Undo/Redo stack for terrain parameters.
 */

export class UndoStack<T> {
  private stack: string[] = [];
  private pointer: number = -1;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  push(state: T): void {
    const json = JSON.stringify(state);
    // Remove any redo states
    this.stack = this.stack.slice(0, this.pointer + 1);
    this.stack.push(json);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
    this.pointer = this.stack.length - 1;
  }

  undo(): T | null {
    if (this.pointer <= 0) return null;
    this.pointer--;
    return JSON.parse(this.stack[this.pointer]);
  }

  redo(): T | null {
    if (this.pointer >= this.stack.length - 1) return null;
    this.pointer++;
    return JSON.parse(this.stack[this.pointer]);
  }

  canUndo(): boolean {
    return this.pointer > 0;
  }

  canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }
}

