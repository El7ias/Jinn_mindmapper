/**
 * History — Undo/redo stack with state snapshots.
 */
export class History {
  constructor(bus, opts = {}) {
    this.bus = bus;
    this.maxSize = opts.maxSize || 50;
    this._stack = [];
    this._pointer = -1;
    this._paused = false;
  }

  /** Push a new state snapshot. Clears any redo history beyond current pointer. */
  push(state) {
    if (this._paused) return;
    // Remove everything after current pointer
    this._stack = this._stack.slice(0, this._pointer + 1);
    this._stack.push(JSON.parse(JSON.stringify(state)));
    if (this._stack.length > this.maxSize) this._stack.shift();
    this._pointer = this._stack.length - 1;
    this.bus.emit('history:changed', this.status());
  }

  undo() {
    if (!this.canUndo()) return null;
    this._pointer--;
    const state = JSON.parse(JSON.stringify(this._stack[this._pointer]));
    this.bus.emit('history:changed', this.status());
    return state;
  }

  redo() {
    if (!this.canRedo()) return null;
    this._pointer++;
    const state = JSON.parse(JSON.stringify(this._stack[this._pointer]));
    this.bus.emit('history:changed', this.status());
    return state;
  }

  canUndo() { return this._pointer > 0; }
  canRedo() { return this._pointer < this._stack.length - 1; }

  status() {
    return { canUndo: this.canUndo(), canRedo: this.canRedo() };
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; }
}
