/**
 * AgentPanel — Collapsible side panel for CEO ↔ Agent communication
 *
 * Phase 4.3 — Live orchestration wiring
 *
 * Features:
 *   - Collapsible panel (side-by-side with canvas)
 *   - Live progress feed from Claude Code (via orchestration events)
 *   - Session state indicator (idle/executing/monitoring/completed/failed)
 *   - Cancel / Pause / Resume controls
 *   - Hands-off toggle
 *   - Session metrics (messages, errors, elapsed time)
 *   - CEO input area with send/revision buttons
 *   - Mind map readiness indicator
 *   - Approval gate prompts
 */

import { marked } from 'marked';
import { AGENT_ROLES } from '../nodes/NodeManager.js';
import { escapeHtml, sanitizeHtml, escapeAttr } from '../core/Sanitize.js';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false,
});

/** Map engine states → display labels & CSS classes */
const STATE_DISPLAY = {
  idle:          { label: 'Idle',          css: 'idle',     icon: '⏸' },
  initializing:  { label: 'Initializing',  css: 'starting', icon: '⏳' },
  executing:     { label: 'Executing',     css: 'starting', icon: '⚡' },
  monitoring:    { label: 'Monitoring',    css: 'active',   icon: '🔄' },
  paused:        { label: 'Paused',        css: 'paused',   icon: '⏸' },
  completed:     { label: 'Completed',     css: 'success',  icon: '✅' },
  failed:        { label: 'Failed',        css: 'error',    icon: '❌' },
  cancelled:     { label: 'Cancelled',     css: 'idle',     icon: '🛑' },
};

export class AgentPanel {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this._isOpen = false;
    this._messages = [];
    this._state = 'idle';
    this._metrics = null;
    this._handsOff = false;
    this._elapsedInterval = null;

    this._createDOM();
    this._bindEvents();
  }

  // ─── DOM Construction ──────────────────────────────────────────────

  _createDOM() {
    // Toggle button (fixed to right edge)
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'agent-panel-toggle';
    this.toggleBtn.className = 'agent-panel-toggle';
    this.toggleBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="toggle-label">Agents</span>
    `;
    this.toggleBtn.title = 'Toggle Agent Panel';
    document.body.appendChild(this.toggleBtn);

    // Panel container
    this.panel = document.createElement('aside');
    this.panel.id = 'agent-panel';
    this.panel.className = 'agent-panel glass-panel';
    this.panel.innerHTML = `
      <div class="agent-panel-header">
        <div class="panel-header-left">
          <span class="panel-icon">🤖</span>
          <h3 class="panel-title">Agent Orchestration</h3>
        </div>
        <div class="panel-header-right">
          <span id="agent-status-indicator" class="agent-status-indicator idle" title="Status: Idle">●</span>
          <button id="agent-panel-close" class="panel-close-btn" title="Close Panel">✕</button>
        </div>
      </div>

      <div class="agent-panel-readiness" id="agent-readiness">
        <div class="readiness-icon">📋</div>
        <div class="readiness-text">
          <span class="readiness-label">Map Readiness</span>
          <span class="readiness-value" id="readiness-value">—</span>
        </div>
      </div>

      <!-- Session controls bar -->
      <div class="agent-panel-controls" id="agent-controls">
        <div class="controls-row">
          <label class="hands-off-toggle" title="Hands-off: let agents run without approval gates">
            <input type="checkbox" id="hands-off-check">
            <span class="toggle-slider"></span>
            <span class="toggle-text">Hands-off</span>
          </label>
          <div class="session-actions">
            <button id="btn-pause-session" class="ctrl-btn" title="Pause" disabled>⏸</button>
            <button id="btn-cancel-session" class="ctrl-btn ctrl-btn-danger" title="Cancel" disabled>✕</button>
          </div>
        </div>
        <div class="controls-metrics" id="controls-metrics">
          <span class="metric"><span class="metric-icon">💬</span> <span id="metric-messages">0</span></span>
          <span class="metric"><span class="metric-icon">⚠️</span> <span id="metric-errors">0</span></span>
          <span class="metric"><span class="metric-icon">⏱</span> <span id="metric-elapsed">0s</span></span>
        </div>
      </div>

      <div class="agent-panel-messages" id="agent-messages">
        <div class="messages-empty">
          <div class="empty-icon">💬</div>
          <p>No conversation yet.</p>
          <p class="empty-hint">Set up your mind map, then click <strong>▶ Run Agents</strong> to start.</p>
        </div>
      </div>

      <div class="agent-panel-input" id="agent-input-area">
        <div class="ceo-context-section" id="ceo-context-section">
          <textarea
            id="ceo-input"
            class="ceo-input"
            placeholder="Describe your concept, goals, or give feedback to agents..."
            rows="3"
          ></textarea>
          <div class="input-actions">
            <button id="btn-send-to-agents" class="agent-btn primary" title="Send to Agents">
              <span>Send to COO</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="agent-panel-footer" id="agent-footer">
        <div class="cost-summary">
          <span class="cost-label">Session Cost</span>
          <span class="cost-value" id="cost-display">$0.00</span>
        </div>
        <div class="token-summary">
          <span class="token-label">Tokens</span>
          <span class="token-value" id="token-display">0</span>
        </div>
      </div>
    `;
    document.body.appendChild(this.panel);
  }

  // ─── Event Binding ─────────────────────────────────────────────────

  _bindEvents() {
    // Toggle panel open/close
    this.toggleBtn.addEventListener('click', () => this.toggle());

    const closeBtn = this.panel.querySelector('#agent-panel-close');
    closeBtn.addEventListener('click', () => this.close());

    // Send button
    const sendBtn = this.panel.querySelector('#btn-send-to-agents');
    sendBtn.addEventListener('click', () => this._sendMessage());

    // Enter to send (Shift+Enter for newline)
    const input = this.panel.querySelector('#ceo-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    });

    // Hands-off toggle
    const handsOffCheck = this.panel.querySelector('#hands-off-check');
    handsOffCheck.addEventListener('change', () => {
      this._handsOff = handsOffCheck.checked;
      this.bus.emit('orchestration:hands-off-changed', { handsOff: this._handsOff });
    });

    // Session controls
    this.panel.querySelector('#btn-pause-session').addEventListener('click', () => {
      if (this._state === 'monitoring') {
        this.bus.emit('orchestration:pause-request');
      } else if (this._state === 'paused') {
        this.bus.emit('orchestration:resume-request');
      }
    });

    this.panel.querySelector('#btn-cancel-session').addEventListener('click', () => {
      this.bus.emit('orchestration:cancel-request');
    });

    // Listen for bus events — legacy agent events
    this.bus.on('agent:message', (msg) => this._addMessage(msg));
    this.bus.on('agent:status', (status) => this._updateStatus(status));
    this.bus.on('agent:cost-update', (cost) => this._updateCost(cost));
    this.bus.on('agent:readiness', (result) => this._updateReadiness(result));

    // ─── Phase 4 — Orchestration Events ───────────────────────────
    this.bus.on('orchestration:state-change', (data) => this._onStateChange(data));
    this.bus.on('orchestration:metrics-update', (data) => this._onMetricsUpdate(data));

    this.bus.on('orchestration:progress', (data) => {
      this._addMessage({
        role: 'agent',
        content: this._formatProgress(data),
        timestamp: Date.now(),
        displayName: 'Claude Code',
      });
    });

    this.bus.on('orchestration:error', (data) => {
      this._addMessage({
        role: 'system',
        content: `⚠️ ${data.message}`,
        timestamp: Date.now(),
        displayName: 'System',
      });
    });

    this.bus.on('orchestration:complete', (data) => {
      this._addMessage({
        role: 'system',
        content: data.success
          ? '✅ Session completed successfully.'
          : `❌ Session failed (exit code: ${data.exitCode}).`,
        timestamp: Date.now(),
        displayName: 'System',
      });
    });

    this.bus.on('orchestration:approval-needed', (data) => {
      this._addMessage({
        role: 'approval',
        content: `🔐 **Approval needed**: Claude wants to use \`${escapeHtml(data.tool)}\`.\n\nApprove or deny this action in the Claude Code CLI.`,
        timestamp: Date.now(),
        displayName: 'Approval Gate',
      });
    });
  }

  // ─── Public API ────────────────────────────────────────────────────

  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  open() {
    this._isOpen = true;
    this.panel.classList.add('open');
    this.toggleBtn.classList.add('active');
    document.getElementById('app')?.classList.add('agent-panel-open');
    this.bus.emit('agent-panel:opened');
  }

  close() {
    this._isOpen = false;
    this.panel.classList.remove('open');
    this.toggleBtn.classList.remove('active');
    document.getElementById('app')?.classList.remove('agent-panel-open');
    this.bus.emit('agent-panel:closed');
  }

  /** Whether hands-off mode is enabled. */
  get handsOff() { return this._handsOff; }

  /**
   * Update the message thread with real-time messages
   * @param {object[]} messages
   */
  setMessages(messages) {
    this._messages = messages;
    this._renderMessages();
  }

  /**
   * Update cost display
   */
  setCost(totalCost, totalTokens) {
    const costEl = this.panel.querySelector('#cost-display');
    const tokenEl = this.panel.querySelector('#token-display');
    if (costEl) costEl.textContent = `$${totalCost.toFixed(4)}`;
    if (tokenEl) tokenEl.textContent = totalTokens.toLocaleString();
  }

  // ─── Orchestration Event Handlers ──────────────────────────────────

  _onStateChange(data) {
    this._state = data.current;
    const display = STATE_DISPLAY[data.current] || STATE_DISPLAY.idle;

    // Update status indicator
    const indicator = this.panel.querySelector('#agent-status-indicator');
    if (indicator) {
      indicator.className = `agent-status-indicator ${display.css}`;
      indicator.title = `Status: ${display.label}`;
      indicator.textContent = display.icon;
    }

    // Update control button states
    const pauseBtn = this.panel.querySelector('#btn-pause-session');
    const cancelBtn = this.panel.querySelector('#btn-cancel-session');

    const isActive = ['monitoring', 'paused', 'executing'].includes(data.current);
    cancelBtn.disabled = !isActive;

    if (data.current === 'monitoring') {
      pauseBtn.disabled = false;
      pauseBtn.textContent = '⏸';
      pauseBtn.title = 'Pause';
    } else if (data.current === 'paused') {
      pauseBtn.disabled = false;
      pauseBtn.textContent = '▶';
      pauseBtn.title = 'Resume';
    } else {
      pauseBtn.disabled = true;
      pauseBtn.textContent = '⏸';
    }

    // Auto-open panel when session starts
    if (data.current === 'executing' || data.current === 'monitoring') {
      if (!this._isOpen) this.open();
    }

    // Start/stop elapsed timer
    if (data.current === 'monitoring' || data.current === 'executing') {
      this._startElapsedTimer();
    } else {
      this._stopElapsedTimer();
    }
  }

  _onMetricsUpdate(data) {
    this._metrics = data.metrics;
    const msgEl = this.panel.querySelector('#metric-messages');
    const errEl = this.panel.querySelector('#metric-errors');
    const elapsedEl = this.panel.querySelector('#metric-elapsed');

    if (msgEl) msgEl.textContent = data.metrics.messageCount || 0;
    if (errEl) errEl.textContent = data.metrics.errorCount || 0;
    if (elapsedEl) elapsedEl.textContent = data.metrics.elapsedFormatted || '0s';
  }

  // ─── Private Methods ───────────────────────────────────────────────

  _sendMessage() {
    const input = this.panel.querySelector('#ceo-input');
    const text = input.value.trim();
    if (!text) return;

    // Emit CEO message event for the orchestration engine to pick up
    this.bus.emit('ceo:message', {
      content: text,
      timestamp: Date.now(),
    });

    // Add optimistically to local display
    this._addMessage({
      role: 'ceo',
      content: text,
      timestamp: Date.now(),
      displayName: 'CEO (You)',
    });

    input.value = '';
    input.focus();
  }

  _addMessage(msg) {
    this._messages.push(msg);
    // Keep only last 200 messages in DOM for performance
    if (this._messages.length > 200) {
      this._messages = this._messages.slice(-200);
    }
    this._renderMessages();
  }

  _renderMessages() {
    const container = this.panel.querySelector('#agent-messages');
    if (this._messages.length === 0) {
      container.innerHTML = `
        <div class="messages-empty">
          <div class="empty-icon">💬</div>
          <p>No conversation yet.</p>
          <p class="empty-hint">Set up your mind map, then click <strong>▶ Run Agents</strong> to start.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this._messages.map(msg => this._renderMessage(msg)).join('');

    // Scroll to bottom
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  _renderMessage(msg) {
    const isCEO = msg.role === 'ceo';
    const isSystem = msg.role === 'system';
    const isApproval = msg.role === 'approval';
    const isAgent = msg.role === 'agent';

    let icon, name, cssClass;

    if (isCEO) {
      icon = '👤';
      name = 'CEO (You)';
      cssClass = 'ceo-message';
    } else if (isSystem) {
      icon = '⚙️';
      name = msg.displayName || 'System';
      cssClass = 'system-message';
    } else if (isApproval) {
      icon = '🔐';
      name = 'Approval Gate';
      cssClass = 'approval-message';
    } else if (isAgent) {
      icon = '🤖';
      name = msg.displayName || 'Claude Code';
      cssClass = 'agent-message-other';
    } else {
      const agentInfo = AGENT_ROLES.find(a => a.id === msg.role);
      icon = agentInfo?.icon || '🤖';
      name = msg.displayName || agentInfo?.label || msg.role;
      cssClass = 'agent-message-other';
    }

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Render content — CEO text is escaped, agent/system markdown is sanitized via DOMPurify
    const content = isCEO
      ? `<p>${escapeHtml(msg.content)}</p>`
      : sanitizeHtml(marked.parse(msg.content || ''));

    return `
      <div class="agent-message ${cssClass}" data-role="${escapeAttr(msg.role)}">
        <div class="message-header">
          <span class="message-avatar">${icon}</span>
          <span class="message-name">${escapeHtml(name)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-body">${content}</div>
        ${msg.ceoDecision ? `<div class="message-decision decision-${escapeAttr(msg.ceoDecision)}">${escapeHtml(msg.ceoDecision)}</div>` : ''}
      </div>
    `;
  }

  /**
   * Format a progress event into a readable message.
   * @param {object} data — { type: 'json'|'text', data: any }
   * @returns {string}
   */
  _formatProgress(data) {
    if (data.type === 'text') {
      return data.data || '';
    }

    // JSON events from Claude Code stream
    const json = data.data;
    if (!json) return '';

    // Handle different Claude Code event types
    if (json.type === 'assistant' && json.message?.content) {
      const parts = json.message.content;
      if (Array.isArray(parts)) {
        return parts
          .filter(p => p.type === 'text')
          .map(p => p.text)
          .join('\n');
      }
      return typeof parts === 'string' ? parts : JSON.stringify(parts);
    }

    if (json.type === 'result' && json.result) {
      return `**Result**: ${json.result}`;
    }

    if (json.type === 'tool_use') {
      return `🔧 Using tool: \`${json.name || json.tool}\``;
    }

    if (json.type === 'tool_result') {
      const output = json.output || json.content || '';
      const preview = typeof output === 'string' ? output.substring(0, 200) : JSON.stringify(output).substring(0, 200);
      return `📄 Tool output: ${preview}${output.length > 200 ? '…' : ''}`;
    }

    // Fallback — show raw type
    return `[${json.type || 'event'}]`;
  }

  _updateStatus(status) {
    const indicator = this.panel.querySelector('#agent-status-indicator');
    if (!indicator) return;
    indicator.className = `agent-status-indicator ${status}`;
    indicator.title = `Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
  }

  _updateCost(cost) {
    if (cost) {
      this.setCost(cost.totalCost || 0, cost.totalTokens || 0);
    }
  }

  _updateReadiness(result) {
    const valueEl = this.panel.querySelector('#readiness-value');
    if (!valueEl) return;

    if (result.valid) {
      valueEl.textContent = '✅ Ready';
      valueEl.className = 'readiness-value ready';
    } else if (result.errors.length > 0) {
      valueEl.textContent = `❌ ${result.errors.length} issue(s)`;
      valueEl.className = 'readiness-value error';
    } else {
      valueEl.textContent = `⚠️ ${result.warnings.length} warning(s)`;
      valueEl.className = 'readiness-value warning';
    }
  }

  // ─── Elapsed Timer ─────────────────────────────────────────────────

  _startElapsedTimer() {
    this._stopElapsedTimer();
    const start = this._metrics?.startedAt || Date.now();
    this._elapsedInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const elapsedEl = this.panel.querySelector('#metric-elapsed');
      if (elapsedEl) elapsedEl.textContent = this._formatElapsed(elapsed);
    }, 1000);
  }

  _stopElapsedTimer() {
    if (this._elapsedInterval) {
      clearInterval(this._elapsedInterval);
      this._elapsedInterval = null;
    }
  }

  _formatElapsed(ms) {
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    if (mins < 60) return `${mins}m ${rem}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  // _escapeHtml removed — now using shared escapeHtml() from core/Sanitize.js
}
