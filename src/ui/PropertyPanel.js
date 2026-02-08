/**
 * PropertyPanel — Side panel for editing selected node properties (text, color).
 */
export class PropertyPanel {
  constructor(bus, nodeManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;

    this.panel = document.getElementById('property-panel');
    this.textInput = document.getElementById('prop-text');
    this.idDisplay = document.getElementById('prop-id');
    this.posDisplay = document.getElementById('prop-pos');
    this.colorPicker = document.getElementById('color-picker');
    this.closeBtn = document.getElementById('btn-close-panel');

    this._currentNodeId = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.bus.on('selection:changed', (selectedIds) => {
      if (selectedIds.length === 1) {
        this.show(selectedIds[0]);
      } else {
        this.hide();
      }
    });

    this.bus.on('node:moved', (node) => {
      if (node.id === this._currentNodeId) {
        this.posDisplay.textContent = `${Math.round(node.x)}, ${Math.round(node.y)}`;
      }
    });

    this.closeBtn?.addEventListener('click', () => {
      this.hide();
      this.nodeManager.deselectAll();
      this.bus.emit('selection:changed', []);
    });

    // Text input
    this.textInput?.addEventListener('input', () => {
      const node = this.nodeManager.getNode(this._currentNodeId);
      if (node) {
        node.text = this.textInput.value;
        node.el.querySelector('.node-text').textContent = node.text;
        this.bus.emit('node:updated', node);
      }
    });

    this.textInput?.addEventListener('change', () => {
      this.bus.emit('state:changed');
    });

    // Color picker
    this.colorPicker?.addEventListener('click', (e) => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;

      const color = swatch.dataset.color;
      const node = this.nodeManager.getNode(this._currentNodeId);
      if (node) {
        node.color = color;
        node.el.querySelector('.node-color-bar').style.background = color;
        this._updateActiveColor(color);
        this.bus.emit('node:updated', node);
        this.bus.emit('state:changed');
      }
    });
  }

  show(nodeId) {
    const node = this.nodeManager.getNode(nodeId);
    if (!node) return;

    this._currentNodeId = nodeId;
    this.textInput.value = node.text;
    this.idDisplay.textContent = node.id.substring(0, 12) + '…';
    this.posDisplay.textContent = `${Math.round(node.x)}, ${Math.round(node.y)}`;
    this._updateActiveColor(node.color);

    this.panel.style.display = 'block';
  }

  hide() {
    this.panel.style.display = 'none';
    this._currentNodeId = null;
  }

  _updateActiveColor(color) {
    this.colorPicker.querySelectorAll('.color-swatch').forEach(s => {
      s.classList.toggle('active', s.dataset.color === color);
    });
  }
}
