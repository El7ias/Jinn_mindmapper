/**
 * PromptExportModal — Full-screen modal for previewing, copying, and downloading
 * the generated Claude Code workflow prompt.
 * 
 * Pipeline:  Canvas → MindMapSerializer → WorkflowPromptGenerator → THIS MODAL → Claude Code
 * 
 * Features:
 *   - Live preview of the generated markdown prompt
 *   - Project name and CEO vision inputs (editable)
 *   - Copy full markdown to clipboard
 *   - Copy raw JSON only to clipboard
 *   - Download as .md file
 *   - Mind map stats sidebar
 *   - Regenerate on input changes
 */

import { serializeMindMap } from '../export/MindMapSerializer.js';
import { generateWorkflowPrompt, generateTaskJSON } from '../export/WorkflowPromptGenerator.js';

export class PromptExportModal {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {Function} getNodes - Returns serialized nodes array
   * @param {Function} getConnections - Returns serialized connections array
   * @param {import('./WorkspaceSettingsModal.js').WorkspaceSettingsModal} [settingsModal] - Workspace settings
   */
  constructor(bus, getNodes, getConnections, settingsModal) {
    this.bus = bus;
    this._getNodes = getNodes;
    this._getConnections = getConnections;
    this._settingsModal = settingsModal || null;
    this._currentPrompt = '';
    this._currentJSON = null;
    this._serializedData = null;

    this._createDOM();
    this._bindEvents();
  }

  // ─── DOM Construction ──────────────────────────────────────────────

  _createDOM() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'prompt-export-overlay';
    this.overlay.className = 'prompt-export-overlay';
    this.overlay.innerHTML = `
      <div class="prompt-export-modal glass-panel" id="prompt-export-modal">
        <!-- Header -->
        <div class="prompt-export-header">
          <div class="export-header-left">
            <span class="export-icon">🚀</span>
            <h2 class="export-title">Generate Workflow Prompt</h2>
          </div>
          <button class="prompt-export-close" id="prompt-export-close" title="Close">✕</button>
        </div>

        <!-- Inputs Row -->
        <div class="prompt-export-inputs">
          <div class="export-input-group">
            <label class="export-label" for="export-project-name">Project Name</label>
            <input type="text" id="export-project-name" class="export-input" placeholder="My Awesome Project" />
          </div>
          <div class="export-input-group full-width">
            <label class="export-label" for="export-ceo-vision">CEO Vision <span class="label-hint">(Describe your concept in 1-3 sentences)</span></label>
            <textarea id="export-ceo-vision" class="export-textarea" rows="2" placeholder="An AI-powered platform that..."></textarea>
          </div>
        </div>

        <!-- Body: Stats + Preview -->
        <div class="prompt-export-body">
          <!-- Stats Sidebar -->
          <div class="export-stats" id="export-stats">
            <h4 class="stats-title">Mind Map Analysis</h4>
            <div class="stats-grid" id="stats-grid"></div>
          </div>

          <!-- Preview -->
          <div class="export-preview-wrap">
            <div class="preview-toolbar">
              <span class="preview-label">📄 Prompt Preview</span>
              <div class="preview-actions">
                <label class="compact-toggle" title="Compress prompt for smaller token budgets">
                  <input type="checkbox" id="compact-mode-toggle" />
                  <span class="toggle-label">⚡ Compact</span>
                </label>
                <button class="export-btn small" id="btn-regenerate" title="Regenerate">🔄 Regenerate</button>
              </div>
            </div>
            <pre class="export-preview" id="export-preview"></pre>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="prompt-export-footer">
          <div class="export-footer-left">
            <span class="export-char-count" id="export-char-count">0 chars</span>
            <span class="export-token-badge" id="export-token-badge"></span>
          </div>
          <div class="export-footer-right">
            <button class="export-btn" id="btn-copy-json" title="Copy just the JSON task definition">
              📋 Copy JSON Only
            </button>
            <button class="export-btn" id="btn-download-md" title="Download as .md file">
              💾 Download .md
            </button>
            <button class="export-btn primary" id="btn-copy-full" title="Copy the full markdown prompt to clipboard">
              📋 Copy Full Prompt
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  }

  // ─── Event Binding ─────────────────────────────────────────────────

  _bindEvents() {
    // Close
    this.overlay.querySelector('#prompt-export-close').addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Regenerate
    this.overlay.querySelector('#btn-regenerate').addEventListener('click', () => this._generate());

    // Copy Full Prompt
    this.overlay.querySelector('#btn-copy-full').addEventListener('click', () => {
      this._copyToClipboard(this._currentPrompt, 'Full prompt copied to clipboard!');
    });

    // Copy JSON Only
    this.overlay.querySelector('#btn-copy-json').addEventListener('click', () => {
      const json = JSON.stringify(this._currentJSON, null, 2);
      this._copyToClipboard(json, 'JSON task definition copied to clipboard!');
    });

    // Download .md
    this.overlay.querySelector('#btn-download-md').addEventListener('click', () => {
      this._downloadFile();
    });

    // Escape to close
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) {
        this.hide();
      }
    });

    // Auto-regenerate on input change (debounced)
    let debounce = null;
    const inputs = [
      this.overlay.querySelector('#export-project-name'),
      this.overlay.querySelector('#export-ceo-vision'),
    ];
    inputs.forEach(el => {
      el.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this._generate(), 500);
      });
    });

    // Compact mode toggle
    this.overlay.querySelector('#compact-mode-toggle').addEventListener('change', () => {
      this._generate();
    });
  }

  // ─── Public API ────────────────────────────────────────────────────

  show() {
    this.overlay.classList.add('visible');
    const modal = this.overlay.querySelector('#prompt-export-modal');
    requestAnimationFrame(() => modal.classList.add('visible'));
    this._generate();
  }

  hide() {
    const modal = this.overlay.querySelector('#prompt-export-modal');
    modal.classList.remove('visible');
    setTimeout(() => this.overlay.classList.remove('visible'), 250);
  }

  // ─── Generation Pipeline ───────────────────────────────────────────

  _generate() {
    const nodes = this._getNodes();
    const connections = this._getConnections();
    const projectName = this.overlay.querySelector('#export-project-name').value.trim();
    const ceoVision = this.overlay.querySelector('#export-ceo-vision').value.trim();

    // Stage 1: Serialize
    this._serializedData = serializeMindMap(nodes, connections, { projectName, ceoVision });

    // Stage 2: Generate prompt (inject workspace settings + compact mode)
    const genOptions = {};
    if (this._settingsModal) {
      genOptions.workspaceInstructions = this._settingsModal.getWorkspaceInstructions();
    }
    genOptions.compact = this.overlay.querySelector('#compact-mode-toggle')?.checked || false;
    this._currentPrompt = generateWorkflowPrompt(this._serializedData, genOptions);
    this._currentJSON = generateTaskJSON(this._serializedData, genOptions);

    // Update preview
    this._renderPreview();
    this._renderStats();

    // Auto-fill project name if empty
    const nameInput = this.overlay.querySelector('#export-project-name');
    if (!nameInput.value.trim() && this._serializedData.projectName !== 'Untitled Project') {
      nameInput.value = this._serializedData.projectName;
    }
  }

  _renderPreview() {
    const preview = this.overlay.querySelector('#export-preview');
    preview.textContent = this._currentPrompt;

    const chars = this._currentPrompt.length;
    const tokens = Math.ceil(chars / 4);

    const charCount = this.overlay.querySelector('#export-char-count');
    charCount.textContent = `${chars.toLocaleString()} chars · ~${tokens.toLocaleString()} tokens`;

    // P2.3: Token budget warning indicator
    const badge = this.overlay.querySelector('#export-token-badge');
    if (tokens > 20000) {
      badge.textContent = '🔴 Over budget';
      badge.className = 'export-token-badge danger';
    } else if (tokens > 10000) {
      badge.textContent = '🟡 Large prompt';
      badge.className = 'export-token-badge warn';
    } else {
      badge.textContent = '🟢 Efficient';
      badge.className = 'export-token-badge ok';
    }
  }

  _renderStats() {
    const data = this._serializedData;
    if (!data) return;

    const grid = this.overlay.querySelector('#stats-grid');
    grid.innerHTML = `
      <div class="stat-item">
        <span class="stat-value">${data.stats.totalNodes}</span>
        <span class="stat-label">Nodes</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${data.stats.totalConnections}</span>
        <span class="stat-label">Connections</span>
      </div>
      <div class="stat-item accent">
        <span class="stat-value">${data.stats.featureCount}</span>
        <span class="stat-label">Features</span>
      </div>
      <div class="stat-item warn">
        <span class="stat-value">${data.stats.constraintCount}</span>
        <span class="stat-label">Constraints</span>
      </div>
      <div class="stat-item danger">
        <span class="stat-value">${data.stats.riskCount}</span>
        <span class="stat-label">Risks</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${data.stats.referenceCount}</span>
        <span class="stat-label">References</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${data.stats.directedConnections}</span>
        <span class="stat-label">Dependencies</span>
      </div>
      <div class="stat-item ${data.stats.criticalCount > 0 ? 'danger' : ''}">
        <span class="stat-value">${data.stats.criticalCount}</span>
        <span class="stat-label">Critical</span>
      </div>
    `;
  }

  // ─── Clipboard & Download ──────────────────────────────────────────

  async _copyToClipboard(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      this._showToast(successMsg);
    } catch (err) {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this._showToast(successMsg);
    }
  }

  _downloadFile() {
    const name = (this._serializedData?.projectName || 'workflow-prompt')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+$/, '');

    const blob = new Blob([this._currentPrompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-workflow.md`;
    a.click();
    URL.revokeObjectURL(url);

    this._showToast('Downloaded!');
  }

  _showToast(message) {
    // Remove existing toast
    const existing = document.querySelector('.export-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'export-toast';
    toast.innerHTML = `<span>✅ ${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }
}
