/**
 * IdeaInputModal — AI-powered mind map generation modal.
 * 
 * The user types a high-concept product idea, selects an LLM provider,
 * and the AI generates a full structured mind map on the canvas.
 * 
 * Features:
 *   - Concept textarea with character counter
 *   - Provider selector (OpenAI, Anthropic, Google)
 *   - API key input (persisted in localStorage)
 *   - Clickable example concepts for inspiration
 *   - Loading state with animated progress
 *   - Error handling with friendly messages
 *   - Auto-layout and render on canvas
 */

import { generateMindMap, computeLayout, getProviders, EXAMPLE_CONCEPTS } from '../ai/IdeaGenerator.js';

export class IdeaInputModal {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('../nodes/NodeManager.js').NodeManager} nodeManager
   * @param {import('../connections/ConnectionManager.js').ConnectionManager} connectionManager
   */
  constructor(bus, nodeManager, connectionManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.connectionManager = connectionManager;
    this._generating = false;

    this._createDOM();
    this._bindEvents();
    this._loadSavedSettings();
  }

  // ─── DOM Construction ──────────────────────────────────────────────

  _createDOM() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'idea-input-overlay';
    this.overlay.className = 'idea-input-overlay';

    const providers = getProviders();
    const providerOptions = providers.map(p =>
      `<option value="${p.key}">${p.name}</option>`
    ).join('');

    this.overlay.innerHTML = `
      <div class="idea-input-modal glass-panel" id="idea-input-modal">
        <!-- Header -->
        <div class="idea-input-header">
          <div class="idea-header-left">
            <span class="idea-icon">✨</span>
            <h2 class="idea-title">Generate Mind Map from Concept</h2>
          </div>
          <button class="idea-input-close" id="idea-input-close" title="Close">✕</button>
        </div>

        <!-- Body -->
        <div class="idea-input-body">
          <!-- Left: Input Area -->
          <div class="idea-input-area">
            <label class="idea-label" for="idea-concept">Your Product Concept</label>
            <textarea
              id="idea-concept"
              class="idea-concept-input"
              rows="4"
              placeholder="Describe your product idea in 1-3 sentences...&#10;&#10;e.g. An AI-powered recipe app that learns your dietary preferences and generates meal plans with auto-generated grocery lists"
              maxlength="500"
            ></textarea>
            <div class="idea-concept-meta">
              <span id="idea-char-count" class="idea-char-count">0/500</span>
            </div>

            <!-- Provider & Key Row -->
            <div class="idea-config-row">
              <div class="idea-config-group">
                <label class="idea-label-sm" for="idea-provider">LLM Provider</label>
                <select id="idea-provider" class="idea-select">
                  ${providerOptions}
                </select>
              </div>
              <div class="idea-config-group grow">
                <label class="idea-label-sm" for="idea-api-key">API Key</label>
                <div class="idea-key-wrap">
                  <input type="password" id="idea-api-key" class="idea-key-input" placeholder="sk-..." />
                  <button id="idea-key-toggle" class="idea-key-toggle" title="Show/hide key">👁️</button>
                </div>
              </div>
            </div>

            <!-- Model Selection -->
            <div class="idea-config-row">
              <div class="idea-config-group grow">
                <label class="idea-label-sm" for="idea-model">Model</label>
                <select id="idea-model" class="idea-select"></select>
              </div>
              <div class="idea-config-group">
                <label class="idea-label-sm">&nbsp;</label>
                <label class="idea-checkbox-label">
                  <input type="checkbox" id="idea-clear-canvas" checked />
                  <span>Clear canvas first</span>
                </label>
              </div>
            </div>

            <!-- Error Display -->
            <div id="idea-error" class="idea-error" style="display: none"></div>

            <!-- Generate Button -->
            <button id="idea-generate-btn" class="idea-generate-btn">
              <span class="gen-icon">⚡</span>
              <span class="gen-text">Generate Mind Map</span>
            </button>
          </div>

          <!-- Right: Inspiration Panel -->
          <div class="idea-inspiration">
            <h4 class="inspiration-title">💡 Need Inspiration?</h4>
            <p class="inspiration-subtitle">Click a concept to use it:</p>
            <div class="inspiration-list" id="inspiration-list"></div>
          </div>
        </div>

        <!-- Loading Overlay -->
        <div class="idea-loading" id="idea-loading" style="display: none">
          <div class="idea-loading-inner">
            <div class="idea-spinner"></div>
            <p class="idea-loading-text">Generating your mind map...</p>
            <p class="idea-loading-sub">The AI is decomposing your concept into features, constraints, and risks</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Populate inspiration list
    this._populateExamples();
  }

  // ─── Event Binding ─────────────────────────────────────────────────

  _bindEvents() {
    // Close
    this.overlay.querySelector('#idea-input-close').addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Escape to close
    this._escHandler = (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) {
        this.hide();
      }
    };
    window.addEventListener('keydown', this._escHandler);

    // Character counter
    const textarea = this.overlay.querySelector('#idea-concept');
    const counter = this.overlay.querySelector('#idea-char-count');
    textarea.addEventListener('input', () => {
      counter.textContent = `${textarea.value.length}/500`;
    });

    // Provider change → update models and saved key
    const providerSelect = this.overlay.querySelector('#idea-provider');
    providerSelect.addEventListener('change', () => {
      this._updateModels();
      this._loadKeyForProvider();
    });

    // API key toggle visibility
    const keyToggle = this.overlay.querySelector('#idea-key-toggle');
    const keyInput = this.overlay.querySelector('#idea-api-key');
    keyToggle.addEventListener('click', () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      keyToggle.textContent = keyInput.type === 'password' ? '👁️' : '🔒';
    });

    // Save API key on blur
    keyInput.addEventListener('blur', () => {
      this._saveKeyForProvider();
    });

    // Generate button
    this.overlay.querySelector('#idea-generate-btn').addEventListener('click', () => this._generate());

    // Ctrl+Enter to generate
    textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this._generate();
      }
    });
  }

  // ─── Public API ────────────────────────────────────────────────────

  show() {
    this.overlay.classList.add('visible');
    const modal = this.overlay.querySelector('#idea-input-modal');
    requestAnimationFrame(() => modal.classList.add('visible'));
    
    // Focus the textarea
    setTimeout(() => {
      this.overlay.querySelector('#idea-concept').focus();
    }, 300);
  }

  hide() {
    if (this._generating) return; // Don't close while generating
    const modal = this.overlay.querySelector('#idea-input-modal');
    modal.classList.remove('visible');
    setTimeout(() => this.overlay.classList.remove('visible'), 250);
  }

  // ─── Generation Pipeline ───────────────────────────────────────────

  async _generate() {
    if (this._generating) return;

    const concept = this.overlay.querySelector('#idea-concept').value.trim();
    const provider = this.overlay.querySelector('#idea-provider').value;
    const apiKey = this.overlay.querySelector('#idea-api-key').value.trim();
    const model = this.overlay.querySelector('#idea-model').value;
    const clearCanvas = this.overlay.querySelector('#idea-clear-canvas').checked;

    // Validate
    if (!concept) {
      this._showError('Please enter a product concept.');
      return;
    }
    if (!apiKey) {
      this._showError('Please enter your API key.');
      return;
    }

    // Save key
    this._saveKeyForProvider();

    // Show loading state
    this._setLoading(true);
    this._hideError();

    try {
      // Call the AI
      const result = await generateMindMap(concept, { provider, apiKey, model });

      // Compute layout positions
      const viewportCenter = this._getViewportCenter();
      const positioned = computeLayout(
        result.nodes,
        result.connections,
        viewportCenter.x,
        viewportCenter.y
      );

      // Clear canvas if requested
      if (clearCanvas) {
        this.nodeManager.deserialize([]);
        this.connectionManager.deserialize([]);
      }

      // Render nodes on canvas
      const nodeIds = this._renderNodes(positioned);

      // Render connections
      this._renderConnections(result.connections, nodeIds);

      // Emit state change
      this.bus.emit('state:changed');

      // Fit viewport to new content
      setTimeout(() => this.bus.emit('viewport:fit-request'), 100);

      // Close modal
      this._setLoading(false);
      this.hide();

      // Show success toast
      this._showToast(`✨ Generated ${positioned.length} nodes from your concept!`);

    } catch (err) {
      this._setLoading(false);
      this._showError(err.message || 'Generation failed. Please try again.');
      console.error('[IdeaGenerator] Error:', err);
    }
  }

  // ─── Canvas Rendering ──────────────────────────────────────────────

  _renderNodes(positionedNodes) {
    const nodeIds = [];

    positionedNodes.forEach(n => {
      const node = this.nodeManager.createNode(
        Math.round(n.x - 70), // offset to center the node
        Math.round(n.y - 20),
        { text: n.text }
      );

      // Set Phase 3 metadata
      if (n.type) this.nodeManager.setNodeType(node.id, n.type);
      if (n.priority) this.nodeManager.setPriority(node.id, n.priority);

      nodeIds.push(node.id);
    });

    return nodeIds;
  }

  _renderConnections(connections, nodeIds) {
    connections.forEach(conn => {
      const sourceId = nodeIds[conn.from];
      const targetId = nodeIds[conn.to];
      if (!sourceId || !targetId) return;

      // Auto-detect best ports based on node positions
      const sourceNode = this.nodeManager.getNode(sourceId);
      const targetNode = this.nodeManager.getNode(targetId);
      if (!sourceNode || !targetNode) return;

      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;

      let sourcePort, targetPort;
      if (Math.abs(dx) > Math.abs(dy)) {
        sourcePort = dx > 0 ? 'right' : 'left';
        targetPort = dx > 0 ? 'left' : 'right';
      } else {
        sourcePort = dy > 0 ? 'bottom' : 'top';
        targetPort = dy > 0 ? 'top' : 'bottom';
      }

      this.connectionManager.createConnection(
        sourceId, sourcePort,
        targetId, targetPort,
        { directed: conn.directed ? 'forward' : 'none' }
      );
    });
  }

  _getViewportCenter() {
    const container = document.getElementById('canvas-container');
    if (!container) return { x: 400, y: 300 };
    const rect = container.getBoundingClientRect();
    const viewport = this.nodeManager.viewport;
    return viewport.screenToWorld(rect.width / 2, rect.height / 2);
  }

  // ─── Inspiration Examples ──────────────────────────────────────────

  _populateExamples() {
    const list = this.overlay.querySelector('#inspiration-list');
    EXAMPLE_CONCEPTS.forEach(concept => {
      const pill = document.createElement('button');
      pill.className = 'inspiration-pill';
      pill.textContent = concept;
      pill.addEventListener('click', () => {
        this.overlay.querySelector('#idea-concept').value = concept;
        this.overlay.querySelector('#idea-char-count').textContent = `${concept.length}/500`;
        // Scroll back to top
        this.overlay.querySelector('.idea-input-area').scrollTop = 0;
      });
      list.appendChild(pill);
    });
  }

  // ─── Settings Persistence ──────────────────────────────────────────

  _loadSavedSettings() {
    const savedProvider = localStorage.getItem('mm_ai_provider') || 'openai';
    const providerSelect = this.overlay.querySelector('#idea-provider');
    providerSelect.value = savedProvider;
    this._updateModels();
    this._loadKeyForProvider();
  }

  _updateModels() {
    const providerKey = this.overlay.querySelector('#idea-provider').value;
    const providers = getProviders();
    const provider = providers.find(p => p.key === providerKey);
    const modelSelect = this.overlay.querySelector('#idea-model');
    
    modelSelect.innerHTML = '';
    if (provider) {
      provider.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === provider.defaultModel) opt.selected = true;
        modelSelect.appendChild(opt);
      });
    }

    localStorage.setItem('mm_ai_provider', providerKey);
  }

  _loadKeyForProvider() {
    const provider = this.overlay.querySelector('#idea-provider').value;
    const savedKey = localStorage.getItem(`mm_ai_key_${provider}`) || '';
    this.overlay.querySelector('#idea-api-key').value = savedKey;
  }

  _saveKeyForProvider() {
    const provider = this.overlay.querySelector('#idea-provider').value;
    const key = this.overlay.querySelector('#idea-api-key').value;
    if (key) {
      localStorage.setItem(`mm_ai_key_${provider}`, key);
    }
  }

  // ─── UI Helpers ────────────────────────────────────────────────────

  _setLoading(loading) {
    this._generating = loading;
    const loadingEl = this.overlay.querySelector('#idea-loading');
    const btn = this.overlay.querySelector('#idea-generate-btn');
    
    loadingEl.style.display = loading ? 'flex' : 'none';
    btn.disabled = loading;

    if (loading) {
      btn.querySelector('.gen-text').textContent = 'Generating...';
      btn.classList.add('generating');
    } else {
      btn.querySelector('.gen-text').textContent = 'Generate Mind Map';
      btn.classList.remove('generating');
    }
  }

  _showError(message) {
    const el = this.overlay.querySelector('#idea-error');
    el.textContent = `⚠️ ${message}`;
    el.style.display = 'block';
  }

  _hideError() {
    this.overlay.querySelector('#idea-error').style.display = 'none';
  }

  _showToast(message) {
    const existing = document.querySelector('.export-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'export-toast';
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
