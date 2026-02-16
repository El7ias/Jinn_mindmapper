/**
 * FileManager — Handles New / Open / Save / Export / Import operations
 *
 * Manages project name, file I/O via download links and file pickers,
 * PNG/JSON/SVG export, and reference file import.
 */

import { importReferenceFile } from '../import/ReferenceImporter.js';

const FILE_EXT = '.mindmap';
const MIME_JSON = 'application/json';

export class FileManager {
  /**
   * @param {object} opts
   * @param {Function} opts.getState   — returns { nodes, connections, viewport }
   * @param {Function} opts.loadState  — receives { nodes, connections } to load
   * @param {Function} opts.clearState — clears the canvas
   * @param {Function} opts.fitToContent — fits viewport to nodes
   * @param {Function} opts.getNodeManager  — returns NodeManager (for export rendering)
   * @param {Function} opts.getConnectionManager — returns ConnectionManager
   */
  constructor(opts) {
    this.getState = opts.getState;
    this.loadState = opts.loadState;
    this.clearState = opts.clearState;
    this.fitToContent = opts.fitToContent;
    this.getNodeManager = opts.getNodeManager;
    this.getConnectionManager = opts.getConnectionManager;
    this.bus = opts.bus || null;

    this.currentFileName = 'Untitled';
    this.projectDescription = '';
    this._titleEl = document.getElementById('project-title');
    this._descEl = document.getElementById('project-description');
    this._updateTitle();
    this._initEditableTitle();

    // Hidden file inputs
    this._openInput = this._createInput(FILE_EXT, '.json');
    this._importInput = this._createInput('.md,.txt,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx');
  }

  // ═════════════════════════════════════
  //  New / Open / Save
  // ═════════════════════════════════════

  newProject() {
    if (!this._confirmDiscard()) return;
    this.clearState();
    this.currentFileName = 'Untitled';
    this.projectDescription = '';
    this._updateTitle();
  }

  openFile() {
    this._openInput.click();
  }

  save() {
    this._downloadState(this.currentFileName);
  }

  saveAs() {
    const name = prompt('Save as:', this.currentFileName);
    if (!name || !name.trim()) return;
    const clean = name.trim().replace(/\.mindmap$/i, '');
    this.currentFileName = clean;
    this._updateTitle();
    this._downloadState(clean);
  }

  // ═════════════════════════════════════
  //  Export
  // ═════════════════════════════════════

  exportJSON() {
    const state = this.getState();
    const data = {
      version: '1.1',
      name: this.currentFileName,
      description: this.projectDescription,
      exportedAt: new Date().toISOString(),
      ...state,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: MIME_JSON });
    this._downloadBlob(blob, `${this.currentFileName}.json`);
  }

  exportPNG() {
    const nm = this.getNodeManager();
    const cm = this.getConnectionManager();
    const bounds = nm.getBounds();
    if (!bounds) { alert('Canvas is empty.'); return; }

    const pad = 60;
    const w = bounds.width + pad * 2;
    const h = bounds.height + pad * 2;
    const ox = bounds.minX - pad;
    const oy = bounds.minY - pad;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, w, h);

    // Draw connections
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    cm.connections.forEach(conn => {
      const pathD = conn.pathEl?.getAttribute('d') || conn._basePathD;
      if (!pathD) return;
      try {
        const path = new Path2D(this._translatePath(pathD, -ox, -oy));
        ctx.stroke(path);
      } catch { /* skip malformed paths */ }
    });

    // Draw nodes
    nm.nodes.forEach(node => {
      const nx = node.x - ox;
      const ny = node.y - oy;
      const el = node.el;
      const nw = el.offsetWidth || 140;
      const nh = el.offsetHeight || 40;

      // Node body
      ctx.fillStyle = '#0d1117';
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      this._drawRoundedRect(ctx, nx, ny, nw, nh, 8);
      ctx.fill();
      ctx.stroke();

      // Color bar
      ctx.fillStyle = node.color || '#00e5ff';
      this._drawRoundedRect(ctx, nx, ny, nw, 3, 8, true);
      ctx.fill();

      // Text
      ctx.fillStyle = '#e6edf3';
      ctx.font = '13px Inter, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const text = node.text || '';
      const maxW = nw - 20;
      const truncated = ctx.measureText(text).width > maxW
        ? text.slice(0, Math.floor(text.length * maxW / ctx.measureText(text).width)) + '…'
        : text;
      ctx.fillText(truncated, nx + nw / 2, ny + nh / 2);
    });

    // Download
    canvas.toBlob(blob => {
      if (blob) this._downloadBlob(blob, `${this.currentFileName}.png`);
    }, 'image/png');
  }

  exportSVG() {
    const nm = this.getNodeManager();
    const cm = this.getConnectionManager();
    const bounds = nm.getBounds();
    if (!bounds) { alert('Canvas is empty.'); return; }

    const pad = 60;
    const w = bounds.width + pad * 2;
    const h = bounds.height + pad * 2;
    const ox = bounds.minX - pad;
    const oy = bounds.minY - pad;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
    svg += `  <rect width="${w}" height="${h}" fill="#06060f"/>\n`;

    // Connections
    cm.connections.forEach(conn => {
      const pathD = conn.pathEl?.getAttribute('d') || conn._basePathD;
      if (!pathD) return;
      const translated = this._translatePath(pathD, -ox, -oy);
      svg += `  <path d="${translated}" fill="none" stroke="#00e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n`;
    });

    // Nodes
    nm.nodes.forEach(node => {
      const nx = node.x - ox;
      const ny = node.y - oy;
      const nw = node.el.offsetWidth || 140;
      const nh = node.el.offsetHeight || 40;
      svg += `  <rect x="${nx}" y="${ny}" width="${nw}" height="${nh}" rx="8" fill="#0d1117" stroke="rgba(255,255,255,0.08)"/>\n`;
      svg += `  <rect x="${nx}" y="${ny}" width="${nw}" height="3" rx="1.5" fill="${node.color || '#00e5ff'}"/>\n`;
      const escaped = (node.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      svg += `  <text x="${nx + nw / 2}" y="${ny + nh / 2 + 4}" text-anchor="middle" fill="#e6edf3" font-family="Inter, sans-serif" font-size="13">${escaped}</text>\n`;
    });

    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    this._downloadBlob(blob, `${this.currentFileName}.svg`);
  }

  // ═════════════════════════════════════
  //  Import Reference File
  // ═════════════════════════════════════

  importReference() {
    this._importInput.click();
  }

  async _handleImport(file) {
    try {
      const data = await importReferenceFile(file);
      if (!data || !data.nodes || data.nodes.length === 0) {
        alert('Could not extract structure from this file.');
        return;
      }

      const hasContent = this.getState().nodes?.length > 0;
      if (hasContent) {
        if (!confirm(`Import "${file.name}"?\n\nThis will replace your current canvas.`)) return;
      }

      this.currentFileName = file.name.replace(/\.[^.]+$/, '');
      this._updateTitle();
      this.loadState(data);
    } catch (err) {
      console.error('Import error:', err);
      alert(`Failed to import file: ${err.message}`);
    }
  }

  // ═════════════════════════════════════
  //  Private helpers
  // ═════════════════════════════════════

  _confirmDiscard() {
    const state = this.getState();
    if (state.nodes && state.nodes.length > 0) {
      return confirm('Discard current canvas? Unsaved changes will be lost.');
    }
    return true;
  }

  _downloadState(name) {
    const state = this.getState();
    const data = {
      version: '1.1',
      name,
      description: this.projectDescription,
      ...state,
    };
    const blob = new Blob([JSON.stringify(data)], { type: MIME_JSON });
    this._downloadBlob(blob, `${name}${FILE_EXT}`);
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  _createInput(...accepts) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accepts.join(',');
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      input.value = ''; // reset for re-use

      if (accepts.includes(FILE_EXT) || accepts.includes('.json')) {
        this._handleOpen(file);
      } else {
        this._handleImport(file);
      }
    });
    return input;
  }

  async _handleOpen(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate structure
      if (!data.nodes || !Array.isArray(data.nodes)) {
        alert('Invalid MindMapper file — missing nodes array.');
        return;
      }

      const hasContent = this.getState().nodes?.length > 0;
      if (hasContent) {
        if (!confirm(`Open "${file.name}"?\n\nThis will replace your current canvas.`)) return;
      }

      this.currentFileName = data.name || file.name.replace(/\.[^.]+$/, '');
      this.projectDescription = data.description || '';
      this._updateTitle();
      this.loadState({
        nodes: data.nodes,
        connections: data.connections || [],
      });
    } catch (err) {
      console.error('Open error:', err);
      alert(`Failed to open file: ${err.message}`);
    }
  }

  _updateTitle() {
    if (this._titleEl) {
      this._titleEl.textContent = this.currentFileName;
      this._titleEl.title = this.currentFileName;
    }
    if (this._descEl) {
      this._descEl.textContent = this.projectDescription || 'Add description...';
      this._descEl.classList.toggle('placeholder', !this.projectDescription);
      this._descEl.title = this.projectDescription || 'Click to add project description';
    }
  }

  /** Make title and description clickable to edit inline */
  _initEditableTitle() {
    // --- Title editing ---
    if (this._titleEl) {
      this._titleEl.setAttribute('tabindex', '0');
      this._titleEl.addEventListener('click', () => this._startEditing(this._titleEl, 'title'));
      this._titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._titleEl.blur(); }
        if (e.key === 'Escape') { this._cancelEditing(this._titleEl, 'title'); }
      });
      this._titleEl.addEventListener('blur', () => this._commitEditing(this._titleEl, 'title'));
    }

    // --- Description editing ---
    if (this._descEl) {
      this._descEl.setAttribute('tabindex', '0');
      this._descEl.addEventListener('click', () => this._startEditing(this._descEl, 'description'));
      this._descEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this._descEl.blur(); }
        if (e.key === 'Escape') { this._cancelEditing(this._descEl, 'description'); }
      });
      this._descEl.addEventListener('blur', () => this._commitEditing(this._descEl, 'description'));
    }
  }

  _startEditing(el, field) {
    if (el.contentEditable === 'true') return;
    this._editBackup = field === 'title' ? this.currentFileName : this.projectDescription;
    el.contentEditable = 'true';
    el.classList.add('editing');
    el.classList.remove('placeholder');
    if (field === 'description' && !this.projectDescription) {
      el.textContent = '';
    }
    // Select all text for easy replacement
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  _commitEditing(el, field) {
    if (el.contentEditable !== 'true') return;
    el.contentEditable = 'false';
    el.classList.remove('editing');
    const value = el.textContent.trim();

    if (field === 'title') {
      this.currentFileName = value || 'Untitled';
    } else {
      this.projectDescription = value;
    }
    this._updateTitle();
    // Trigger auto-save so title persists in localStorage
    if (this.bus) this.bus.emit('state:changed');
  }

  _cancelEditing(el, field) {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    if (field === 'title') {
      el.textContent = this.currentFileName;
    } else {
      this._updateTitle(); // re-renders description with placeholder logic
    }
  }

  /** Returns title metadata for inclusion in auto-save state */
  getProjectMeta() {
    return {
      title: this.currentFileName,
      description: this.projectDescription,
    };
  }

  /** Restores title metadata from loaded state */
  setProjectMeta(meta) {
    if (!meta) return;
    this.currentFileName = meta.title || 'Untitled';
    this.projectDescription = meta.description || '';
    this._updateTitle();
  }

  /** Translate all absolute coordinates in an SVG path by dx,dy */
  _translatePath(d, dx, dy) {
    // Split into tokens: commands and numbers
    const tokens = d.match(/[a-zA-Z]|[-+]?[\d.]+(?:e[-+]?\d+)?/g);
    if (!tokens) return d;

    let result = '';
    let i = 0;
    let cmd = '';

    while (i < tokens.length) {
      if (/[a-zA-Z]/.test(tokens[i])) {
        cmd = tokens[i];
        result += cmd;
        i++;
        continue;
      }

      // Only translate absolute commands (uppercase)
      if (cmd === cmd.toUpperCase() && /[MLHVCSQTA]/.test(cmd)) {
        if (cmd === 'H') {
          result += ' ' + (parseFloat(tokens[i]) + dx).toFixed(1);
          i++;
        } else if (cmd === 'V') {
          result += ' ' + (parseFloat(tokens[i]) + dy).toFixed(1);
          i++;
        } else if (cmd === 'A' && i + 6 < tokens.length) {
          // A rx ry rotation large-arc-flag sweep-flag x y
          result += ` ${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]} ${tokens[i + 3]} ${tokens[i + 4]}`;
          result += ` ${(parseFloat(tokens[i + 5]) + dx).toFixed(1)} ${(parseFloat(tokens[i + 6]) + dy).toFixed(1)}`;
          i += 7;
        } else {
          // M, L, C, S, Q, T — pairs of x,y
          if (i + 1 < tokens.length) {
            result += ` ${(parseFloat(tokens[i]) + dx).toFixed(1)} ${(parseFloat(tokens[i + 1]) + dy).toFixed(1)}`;
            i += 2;
          } else {
            result += ' ' + tokens[i];
            i++;
          }
        }
      } else {
        // Relative commands: pass through unchanged
        result += ' ' + tokens[i];
        i++;
      }
    }
    return result;
  }

  _drawRoundedRect(ctx, x, y, w, h, r, topOnly = false) {
    ctx.beginPath();
    if (topOnly) {
      // Only top corners rounded (for color bar)
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
    }
    ctx.closePath();
  }
}
