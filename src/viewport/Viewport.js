/**
 * Viewport — Manages pan, zoom, and coordinate transforms for the infinite canvas.
 */
export class Viewport {
  constructor(bus) {
    this.bus = bus;
    this.container = document.getElementById('canvas-container');
    this.viewport = document.getElementById('canvas-viewport');
    this.zoomDisplay = document.getElementById('zoom-level');

    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.15;
    this.maxZoom = 3;

    this._isPanning = false;
    this._spaceDown = false;
    this._startX = 0;
    this._startY = 0;

    this._bindEvents();
    this._applyTransform();
  }

  _bindEvents() {
    // Wheel zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const rect = this.container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.zoomAt(mx, my, delta);
    }, { passive: false });

    // Middle-click pan
    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && this._spaceDown)) {
        e.preventDefault();
        this._isPanning = true;
        this._startX = e.clientX - this.x;
        this._startY = e.clientY - this.y;
        this.container.classList.add('panning');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this._isPanning) {
        this.x = e.clientX - this._startX;
        this.y = e.clientY - this._startY;
        this._applyTransform();
        this.bus.emit('viewport:changed', this.getState());
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this._isPanning && (e.button === 1 || e.button === 0)) {
        this._isPanning = false;
        this.container.classList.remove('panning');
      }
    });

    // Space key for pan mode
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'TEXTAREA' && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        this._spaceDown = true;
        this.container.classList.add('panning');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._spaceDown = false;
        if (!this._isPanning) {
          this.container.classList.remove('panning');
        }
      }
    });

    // Toolbar zoom buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      const rect = this.container.getBoundingClientRect();
      this.zoomAt(rect.width / 2, rect.height / 2, 1.2);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      const rect = this.container.getBoundingClientRect();
      this.zoomAt(rect.width / 2, rect.height / 2, 0.8);
    });

    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
      this.bus.emit('viewport:fit-request');
    });
  }

  zoomAt(screenX, screenY, factor) {
    const oldZoom = this.zoom;
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    const ratio = this.zoom / oldZoom;
    this.x = screenX - (screenX - this.x) * ratio;
    this.y = screenY - (screenY - this.y) * ratio;
    this._applyTransform();
    this.bus.emit('viewport:changed', this.getState());
  }

  _applyTransform() {
    this.viewport.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
    this.zoomDisplay.textContent = `${Math.round(this.zoom * 100)}%`;

    // Update grid to scale with viewport
    const gs = 24 * this.zoom;
    const gm = gs * 6;
    const ox = this.x % gs;
    const oy = this.y % gs;
    const omx = this.x % gm;
    const omy = this.y % gm;
    this.container.style.backgroundSize = `${gs}px ${gs}px, ${gs}px ${gs}px, ${gm}px ${gm}px, ${gm}px ${gm}px`;
    this.container.style.backgroundPosition = `${ox}px ${oy}px, ${ox}px ${oy}px, ${omx}px ${omy}px, ${omx}px ${omy}px`;
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.x) / this.zoom,
      y: (sy - this.y) / this.zoom
    };
  }

  /** Convert world coordinates to screen coordinates */
  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.x,
      y: wy * this.zoom + this.y
    };
  }

  getState() {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }

  setState(state) {
    if (state) {
      this.x = state.x || 0;
      this.y = state.y || 0;
      this.zoom = state.zoom || 1;
      this._applyTransform();
    }
  }

  /** Check if space is down (used by other modules to prevent actions during panning) */
  get isSpaceDown() {
    return this._spaceDown;
  }

  get isPanning() {
    return this._isPanning;
  }
}
