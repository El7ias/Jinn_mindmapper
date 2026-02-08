/**
 * PresetModal — Template picker modal UI
 *
 * Displays built-in and custom presets in a categorized grid.
 * Allows selecting a preset to load, saving the current canvas
 * as a custom preset, and deleting custom presets.
 */

export class PresetModal {
  /**
   * @param {import('../presets/PresetManager.js').PresetManager} presetManager
   * @param {Function} onSelect – called with preset.data when user picks a preset
   * @param {Function} getState – returns current { nodes, connections } for saving
   */
  constructor(presetManager, onSelect, getState) {
    this.presetManager = presetManager;
    this.onSelect = onSelect;
    this.getState = getState;

    this.overlay = document.getElementById('preset-modal-overlay');
    this.modal = document.getElementById('preset-modal');
    this.closeBtn = document.getElementById('preset-modal-close');
    this.grid = document.getElementById('preset-grid');
    this.saveBtn = document.getElementById('preset-save-current');
    this.categoryFilter = document.getElementById('preset-category-filter');

    this._activeCategory = 'all';
    this._bind();
  }

  // ── Public ────────────────────────

  show() {
    this._render();
    this.overlay.classList.add('visible');
    this.modal.classList.add('visible');
    // Focus trap
    setTimeout(() => this.closeBtn.focus(), 100);
  }

  hide() {
    this.overlay.classList.remove('visible');
    this.modal.classList.remove('visible');
  }

  // ── Private ───────────────────────

  _bind() {
    // Close
    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) {
        e.stopPropagation();
        this.hide();
      }
    });

    // Category filter
    this.categoryFilter.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      this._activeCategory = btn.dataset.category;
      this._render();
    });

    // Save current as preset
    this.saveBtn.addEventListener('click', () => this._saveCurrentAsPreset());
  }

  _render() {
    // Update category pill active states
    this.categoryFilter.querySelectorAll('[data-category]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.category === this._activeCategory);
    });

    const allPresets = this.presetManager.getAll();
    const filtered = this._activeCategory === 'all'
      ? allPresets
      : allPresets.filter(p => p.category === this._activeCategory);

    this.grid.innerHTML = '';

    if (filtered.length === 0) {
      this.grid.innerHTML = `
        <div class="preset-empty">
          <span class="preset-empty-icon">📂</span>
          <p>No presets in this category</p>
        </div>`;
      return;
    }

    filtered.forEach(preset => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.dataset.presetId = preset.id;

      const nodeCount = preset.data.nodes?.length || 0;
      const connCount = preset.data.connections?.length || 0;
      const isCustom = preset.category === 'custom';

      card.innerHTML = `
        <div class="preset-card-header">
          <span class="preset-card-icon">${preset.icon}</span>
          ${isCustom ? '<button class="preset-card-delete" title="Delete preset">✕</button>' : ''}
        </div>
        <div class="preset-card-body">
          <h3 class="preset-card-name">${preset.name}</h3>
          <p class="preset-card-desc">${preset.description}</p>
          <div class="preset-card-meta">
            <span>${nodeCount} nodes</span>
            <span>·</span>
            <span>${connCount} wires</span>
          </div>
        </div>
        <div class="preset-card-preview">
          ${this._renderMiniPreview(preset.data)}
        </div>
      `;

      // Select
      card.addEventListener('click', (e) => {
        if (e.target.closest('.preset-card-delete')) return;
        this._confirmAndLoad(preset);
      });

      // Delete custom
      if (isCustom) {
        card.querySelector('.preset-card-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          this._deleteCustom(preset.id);
        });
      }

      this.grid.appendChild(card);
    });
  }

  /** Mini SVG preview of node layout */
  _renderMiniPreview(data) {
    if (!data.nodes || data.nodes.length === 0) return '';

    const nodes = data.nodes;
    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 120);
      maxY = Math.max(maxY, n.y + 32);
    });

    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const pad = 8;
    const svgW = 200;
    const svgH = 60;
    const scaleX = (svgW - pad * 2) / w;
    const scaleY = (svgH - pad * 2) / h;
    const scale = Math.min(scaleX, scaleY, 1);

    let circles = '';
    nodes.forEach(n => {
      const cx = pad + (n.x - minX + 60) * scale;
      const cy = pad + (n.y - minY + 16) * scale;
      circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="${n.color || '#00e5ff'}" opacity="0.8"/>`;
    });

    // Draw connections as lines
    let lines = '';
    if (data.connections) {
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      data.connections.forEach(c => {
        const s = nodeMap.get(c.sourceId);
        const t = nodeMap.get(c.targetId);
        if (!s || !t) return;
        const x1 = pad + (s.x - minX + 60) * scale;
        const y1 = pad + (s.y - minY + 16) * scale;
        const x2 = pad + (t.x - minX + 60) * scale;
        const y2 = pad + (t.y - minY + 16) * scale;
        lines += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#00e5ff" stroke-width="0.7" opacity="0.3"/>`;
      });
    }

    return `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" class="preset-preview-svg">${lines}${circles}</svg>`;
  }

  _confirmAndLoad(preset) {
    const state = this.getState();
    const hasContent = state.nodes && state.nodes.length > 0;

    if (hasContent) {
      // Show confirm before replacing
      if (!confirm(`Load "${preset.name}"?\n\nThis will replace your current canvas.`)) return;
    }

    this.hide();
    // Deep clone the data so modifications to the loaded state don't mutate the preset
    const data = JSON.parse(JSON.stringify(preset.data));
    this.onSelect(data);
  }

  _saveCurrentAsPreset() {
    const state = this.getState();
    if (!state.nodes || state.nodes.length === 0) {
      alert('Canvas is empty — add some nodes first.');
      return;
    }

    const name = prompt('Preset name:');
    if (!name || !name.trim()) return;

    const desc = prompt('Short description (optional):') || '';
    const icons = ['📌', '⭐', '💡', '🔷', '🎯', '🏷️', '📋', '🚀'];
    const icon = icons[Math.floor(Math.random() * icons.length)];

    this.presetManager.saveCustom(name.trim(), desc.trim(), icon, {
      nodes: state.nodes,
      connections: state.connections,
    });

    // Re-render with new preset
    this._activeCategory = 'custom';
    this._render();
  }

  _deleteCustom(presetId) {
    if (!confirm('Delete this custom preset?')) return;
    this.presetManager.deleteCustom(presetId);
    this._render();
  }
}
