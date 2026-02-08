/**
 * MiniMap — Bottom-right overview showing all nodes and viewport position.
 */
export class MiniMap {
  constructor(bus, nodeManager, viewport) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.viewport = viewport;

    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this._bindEvents();
    // Initial render
    requestAnimationFrame(() => this.render());
  }

  _bindEvents() {
    // Re-render on relevant events
    const render = () => requestAnimationFrame(() => this.render());
    this.bus.on('node:created', render);
    this.bus.on('node:moved', render);
    this.bus.on('node:deleted', render);
    this.bus.on('viewport:changed', render);
    this.bus.on('state:loaded', render);

    // Click to navigate
    this.canvas.addEventListener('click', (e) => {
      const bounds = this.nodeManager.getBounds();
      if (!bounds) return;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const padding = 60;
      const bw = bounds.width + padding * 2;
      const bh = bounds.height + padding * 2;
      const scale = Math.min(this.width / bw, this.height / bh);

      const ox = (this.width - bw * scale) / 2;
      const oy = (this.height - bh * scale) / 2;

      const worldX = (mx - ox) / scale + bounds.minX - padding;
      const worldY = (my - oy) / scale + bounds.minY - padding;

      const containerRect = document.getElementById('canvas-container').getBoundingClientRect();
      this.viewport.x = -worldX * this.viewport.zoom + containerRect.width / 2;
      this.viewport.y = -worldY * this.viewport.zoom + containerRect.height / 2;
      this.viewport._applyTransform();
      this.bus.emit('viewport:changed', this.viewport.getState());
    });
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, w, h);

    const bounds = this.nodeManager.getBounds();
    if (!bounds) {
      // Draw empty state
      ctx.fillStyle = '#1a2332';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No nodes', w / 2, h / 2);
      return;
    }

    const padding = 60;
    const bw = bounds.width + padding * 2;
    const bh = bounds.height + padding * 2;
    const scale = Math.min(w / bw, h / bh);

    const ox = (w - bw * scale) / 2;
    const oy = (h - bh * scale) / 2;

    const toMiniX = (x) => (x - bounds.minX + padding) * scale + ox;
    const toMiniY = (y) => (y - bounds.minY + padding) * scale + oy;

    // Draw connections
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 1;
    // We don't have direct access to connectionManager here, so we'll skip connection rendering in minimap

    // Draw nodes as dots
    this.nodeManager.nodes.forEach(node => {
      const nx = toMiniX(node.x);
      const ny = toMiniY(node.y);
      const nw = Math.max(node.el.offsetWidth * scale, 4);
      const nh = Math.max(node.el.offsetHeight * scale, 3);

      ctx.fillStyle = node.color || '#00e5ff';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(nx, ny, nw, nh);
      ctx.globalAlpha = 1;
    });

    // Draw viewport rectangle
    const containerRect = document.getElementById('canvas-container').getBoundingClientRect();
    const vpLeft = (-this.viewport.x / this.viewport.zoom);
    const vpTop = (-this.viewport.y / this.viewport.zoom);
    const vpWidth = containerRect.width / this.viewport.zoom;
    const vpHeight = containerRect.height / this.viewport.zoom;

    const rx = toMiniX(vpLeft);
    const ry = toMiniY(vpTop);
    const rw = vpWidth * scale;
    const rh = vpHeight * scale;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
  }
}
