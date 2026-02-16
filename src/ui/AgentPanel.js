/**
 * AgentPanel — Collapsible side panel for CEO ↔ Agent communication
 *
 * Phase 4.3 + Sprint 2 (P1.5/P1.6)
 *
 * Features:
 *   - Collapsible panel (side-by-side with canvas)
 *   - Live progress feed from agent bridge (via orchestration events)
 *   - Session state indicator (idle/executing/monitoring/completed/failed)
 *   - CEO Command Bar (P1.6) — Launch, Pause/Resume, Stop, Copy, Export, Retry
 *   - Hands-off toggle
 *   - Session metrics (messages, errors, elapsed time)
 *   - Streaming text accumulator for browser bridge (P1.5)
 *   - CEO input area with send/revision buttons
 *   - Mind map readiness indicator
 *   - Approval gate prompts
 */

import { marked } from 'marked';
import { AGENT_ROLES } from '../nodes/NodeManager.js';
import { escapeHtml, sanitizeHtml, escapeAttr } from '../core/Sanitize.js';
import { AgentStatusDisplay } from './AgentStatusDisplay.js';

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
   * @param {import('../orchestration/OrchestrationEngine.js').OrchestrationEngine} [engine]
   */
  constructor(bus, engine = null) {
    this.bus = bus;
    this._engine = engine;
    this._isOpen = false;
    this._messages = [];
    this._state = 'idle';
    this._metrics = null;
    this._handsOff = false;
    this._elapsedInterval = null;
    this._streamBuffer = '';          // Accumulate streaming text chunks
    this._liveStreamMsg = null;       // Single live message for streaming accumulation
    this._liveStreamEl = null;        // DOM element for the live message

    // Sprint 5 — Agent status roster (create before DOM so _createDOM can insert it)
    this.agentStatusDisplay = new AgentStatusDisplay(this.bus);

    this._createDOM();
    this._bindEvents();

    // Initialize cumulative cost from history
    this._refreshActualCost();
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

      <!-- ═══ P1.6 — CEO Command Bar ═══ -->
      <div class="ceo-command-bar" id="ceo-command-bar">
        <div class="command-row command-row-primary">
          <button id="cmd-launch" class="cmd-btn cmd-launch" title="Launch Agent Session">
            <span class="cmd-icon">▶</span>
            <span class="cmd-label">Launch</span>
          </button>
          <button id="cmd-pause" class="cmd-btn cmd-pause" title="Pause Session" style="display:none">
            <span class="cmd-icon">⏸</span>
            <span class="cmd-label">Pause</span>
          </button>
          <button id="cmd-resume" class="cmd-btn cmd-resume" title="Resume Session" style="display:none">
            <span class="cmd-icon">▶</span>
            <span class="cmd-label">Resume</span>
          </button>
          <button id="cmd-stop" class="cmd-btn cmd-stop" title="Stop Session" style="display:none">
            <span class="cmd-icon">🛑</span>
            <span class="cmd-label">Stop</span>
          </button>
          <button id="cmd-retry" class="cmd-btn cmd-retry" title="Retry Last Session" style="display:none">
            <span class="cmd-icon">🔄</span>
            <span class="cmd-label">Retry</span>
          </button>
        </div>
        <div class="command-row command-row-secondary">
          <button id="cmd-copy-prompt" class="cmd-btn-sm cmd-copy" title="Copy Workflow Prompt to Clipboard">
            <span class="cmd-icon-sm">📋</span>
            <span>Copy Prompt</span>
          </button>
          <button id="cmd-generate-prompt" class="cmd-btn-sm cmd-generate" title="Generate & Export Workflow Prompt (Ctrl+Shift+G)">
            <span class="cmd-icon-sm">⬡</span>
            <span>Export Prompt</span>
          </button>
          <button id="cmd-agent-config" class="cmd-btn-sm cmd-config" title="Export your commerce integrations (Stripe, Shopify, etc.) as an MCP server config file for AI agent tools. Requires commerce-typed nodes on the canvas.">
            <span class="cmd-icon-sm">⚙</span>
            <span>Agent Config</span>
          </button>
          <button id="cmd-export-log" class="cmd-btn-sm cmd-export" title="Export Session Log" style="display:none">
            <span class="cmd-icon-sm">💾</span>
            <span>Export Log</span>
          </button>
          <button id="cmd-preview-plan" class="cmd-btn-sm cmd-preview" title="Preview the multi-agent execution plan (no API call)">
            <span class="cmd-icon-sm">🧠</span>
            <span>Preview Plan</span>
          </button>
        </div>
        <!-- ═══ P1.6 — CEO Report Commands ═══ -->
        <div class="command-row command-row-reports" id="cmd-reports-row">
          <button id="cmd-bug-audit" class="cmd-btn-sm cmd-report" title="Bug Audit & Report — triggers Devil's Advocate + QA">
            <span class="cmd-icon-sm">🔍</span>
            <span>Bug Audit</span>
          </button>
          <button id="cmd-project-audit" class="cmd-btn-sm cmd-report" title="Project Audit — triggers Project Auditor">
            <span class="cmd-icon-sm">📋</span>
            <span>Project Audit</span>
          </button>
          <button id="cmd-cfo-report" class="cmd-btn-sm cmd-report" title="CFO Report — cost/budget summary">
            <span class="cmd-icon-sm">💰</span>
            <span>CFO Report</span>
          </button>
          <button id="cmd-coo-report" class="cmd-btn-sm cmd-report" title="COO Report — status summary">
            <span class="cmd-icon-sm">📊</span>
            <span>COO Report</span>
          </button>
          <button id="cmd-cto-report" class="cmd-btn-sm cmd-report" title="CTO Report — architecture summary">
            <span class="cmd-icon-sm">🏗️</span>
            <span>CTO Report</span>
          </button>
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
          <div class="controls-metrics" id="controls-metrics">
            <span class="metric"><span class="metric-icon">💬</span> <span id="metric-messages">0</span></span>
            <span class="metric"><span class="metric-icon">⚠️</span> <span id="metric-errors">0</span></span>
            <span class="metric"><span class="metric-icon">⏱</span> <span id="metric-elapsed">0s</span></span>
          </div>
        </div>
      </div>

      <div class="agent-panel-messages" id="agent-messages">
        <div class="messages-empty">
          <div class="empty-icon">💬</div>
          <p>No conversation yet.</p>
          <p class="empty-hint">Set up your mind map, then click <strong>▶ Launch</strong> to start an agent session.</p>
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
          <span class="cost-label">Est. API Cost</span>
          <span class="cost-value cost-estimate" id="cost-estimate-display">—</span>
        </div>
        <div class="cost-summary cost-actual-block">
          <span class="cost-label">Actual API Cost</span>
          <span class="cost-value cost-actual" id="cost-actual-display">$0.00</span>
        </div>
        <div class="cost-summary cost-session-block" id="cost-session-block" style="display:none;">
          <span class="cost-label">This Session</span>
          <span class="cost-value cost-session" id="cost-session-display">$0.00</span>
        </div>
      </div>
    `;
    document.body.appendChild(this.panel);

    // Sprint 5 — Insert agent status roster after readiness, before command bar
    const commandBar = this.panel.querySelector('#ceo-command-bar');
    if (commandBar && this.agentStatusDisplay) {
      commandBar.parentNode.insertBefore(this.agentStatusDisplay.element, commandBar);
    }
  }

  // ─── Event Binding ─────────────────────────────────────────────────

  _bindEvents() {
    // Create an AbortController so all DOM listeners can be cleaned up in destroy()
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    // Toggle panel open/close
    this.toggleBtn.addEventListener('click', () => this.toggle(), { signal });

    const closeBtn = this.panel.querySelector('#agent-panel-close');
    closeBtn.addEventListener('click', () => this.close(), { signal });

    // Send button
    const sendBtn = this.panel.querySelector('#btn-send-to-agents');
    sendBtn.addEventListener('click', () => this._sendMessage(), { signal });

    // Enter to send (Shift+Enter for newline)
    const input = this.panel.querySelector('#ceo-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    }, { signal });

    // Hands-off toggle
    const handsOffCheck = this.panel.querySelector('#hands-off-check');
    handsOffCheck.addEventListener('change', () => {
      this._handsOff = handsOffCheck.checked;
      this.bus.emit('orchestration:hands-off-changed', { handsOff: this._handsOff });
    }, { signal });

    // ─── P1.6 — CEO Command Buttons ──────────────────────────────────

    // Launch
    this.panel.querySelector('#cmd-launch').addEventListener('click', () => {
      this.bus.emit('ceo:launch-request');
    }, { signal });

    // Pause
    this.panel.querySelector('#cmd-pause').addEventListener('click', () => {
      this.bus.emit('orchestration:pause-request');
    }, { signal });

    // Resume
    this.panel.querySelector('#cmd-resume').addEventListener('click', () => {
      this.bus.emit('orchestration:resume-request');
    }, { signal });

    // Stop (with confirmation)
    this.panel.querySelector('#cmd-stop').addEventListener('click', () => {
      if (confirm('Are you sure you want to stop the current agent session?')) {
        this.bus.emit('orchestration:cancel-request');
      }
    }, { signal });

    // Retry
    this.panel.querySelector('#cmd-retry').addEventListener('click', () => {
      this.bus.emit('ceo:retry-request');
    }, { signal });

    // Copy Prompt
    this.panel.querySelector('#cmd-copy-prompt').addEventListener('click', () => {
      this._copyPromptToClipboard();
    }, { signal });

    // Export Log
    this.panel.querySelector('#cmd-export-log').addEventListener('click', () => {
      this._exportSessionLog();
    }, { signal });

    // Generate Prompt (moved from toolbar)
    this.panel.querySelector('#cmd-generate-prompt').addEventListener('click', () => {
      this.bus.emit('ceo:generate-prompt-request');
    }, { signal });

    // Agent Config (moved from toolbar)
    this.panel.querySelector('#cmd-agent-config').addEventListener('click', () => {
      this.bus.emit('ceo:agent-config-request');
    }, { signal });

    // Sprint 5 — Preview Plan
    this.panel.querySelector('#cmd-preview-plan').addEventListener('click', () => {
      this.bus.emit('ceo:multi-agent-request');
    }, { signal });

    // ─── P1.6 — CEO Report Command Buttons ────────────────────────
    const reportTypes = [
      { id: 'cmd-bug-audit',     type: 'bug-audit',     label: 'Bug Audit & Report' },
      { id: 'cmd-project-audit', type: 'project-audit', label: 'Project Audit' },
      { id: 'cmd-cfo-report',    type: 'cfo-report',    label: 'CFO Report' },
      { id: 'cmd-coo-report',    type: 'coo-report',    label: 'COO Report' },
      { id: 'cmd-cto-report',    type: 'cto-report',    label: 'CTO Report' },
    ];

    for (const rt of reportTypes) {
      this.panel.querySelector(`#${rt.id}`)?.addEventListener('click', () => {
        this.bus.emit('ceo:report-request', { type: rt.type, label: rt.label });
        this._showToast(`${rt.label} requested...`);
      }, { signal });
    }

    // Listen for bus events — legacy agent events
    this.bus.on('agent:message', (msg) => this._addMessage(msg));
    this.bus.on('agent:status', (status) => this._updateStatus(status));
    this.bus.on('agent:cost-update', (cost) => this._updateCost(cost));
    this.bus.on('orchestration:cost', (cost) => this._updateCost(cost));
    this.bus.on('agent:readiness', (result) => this._updateReadiness(result));

    // ─── Phase 4 — Orchestration Events ───────────────────────────
    this.bus.on('orchestration:state-change', (data) => this._onStateChange(data));
    this.bus.on('orchestration:metrics-update', (data) => this._onMetricsUpdate(data));

    this.bus.on('orchestration:progress', (data) => {
      // Accumulate ALL streaming text into a single live message
      if (data.type === 'text' && typeof data.content === 'string') {
        this._streamBuffer += data.content;
        this._updateLiveStream();
        return;
      }

      this._addMessage({
        role: 'agent',
        content: this._formatProgress(data),
        timestamp: Date.now(),
        displayName: 'Claude Code',
      });
    });

    this.bus.on('orchestration:error', (data) => {
      this._finalizeLiveStream(); // Finalize any live stream
      this._addMessage({
        role: 'system',
        content: `⚠️ ${data.message}`,
        timestamp: Date.now(),
        displayName: 'System',
      });
    });

    this.bus.on('orchestration:complete', (data) => {
      this._finalizeLiveStream(); // Finalize the live streaming message
      this._addMessage({
        role: 'system',
        content: data.exitCode === 0
          ? '✅ Session completed successfully.'
          : `❌ Session ended (exit code: ${data.exitCode}).`,
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

  /**
   * Tear down all DOM event listeners and timers.
   * Call this when the panel is permanently removed.
   */
  destroy() {
    // Abort all DOM listeners registered with the AbortController signal
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    // Stop elapsed timer
    this._stopElapsedTimer();

    // Remove DOM elements
    this.toggleBtn?.remove();
    this.panel?.remove();
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
   * Update cost displays — session cost (live), actual cost (cumulative), estimate.
   */
  setCost(sessionCost, sessionTokens) {
    // Update live session cost (only visible during active session)
    const sessionEl = this.panel.querySelector('#cost-session-display');
    const sessionBlock = this.panel.querySelector('#cost-session-block');
    if (sessionEl) sessionEl.textContent = `$${sessionCost.toFixed(2)}`;
    if (sessionBlock) sessionBlock.style.display = sessionCost > 0 ? 'flex' : 'none';

    // Update actual cumulative project cost from localStorage
    this._refreshActualCost();
  }

  /**
   * Refresh the actual cumulative API cost from cost history.
   */
  _refreshActualCost() {
    const actualEl = this.panel.querySelector('#cost-actual-display');
    if (!actualEl) return;

    try {
      const raw = localStorage.getItem('mindmapper_cost_history');
      const history = raw ? JSON.parse(raw) : [];
      const totalSpent = history.reduce((sum, h) => sum + (h.totalCost || 0), 0);
      actualEl.textContent = `$${totalSpent.toFixed(2)}`;
      // Color code: green if low, yellow if moderate, red if high
      if (totalSpent > 1.0) {
        actualEl.style.color = 'var(--accent-red, #ff4444)';
      } else if (totalSpent > 0.25) {
        actualEl.style.color = 'var(--accent-yellow, #ffbb33)';
      } else {
        actualEl.style.color = 'var(--accent-green)';
      }
    } catch {
      actualEl.textContent = '—';
    }
  }

  /**
   * Calculate and display the estimated project API cost based on mind map complexity.
   * Called when the panel opens or when map readiness changes.
   * @param {number} nodeCount — total nodes in mind map
   */
  updateCostEstimate(nodeCount = 0) {
    const estimateEl = this.panel.querySelector('#cost-estimate-display');
    if (!estimateEl) return;

    if (nodeCount === 0) {
      estimateEl.textContent = '—';
      return;
    }

    // Estimation model:
    // - Each report type = ~3K input tokens (prompt + map summary) + ~2K output tokens
    // - 5 report types available
    // - Map summary grows ~50 tokens per node
    // - Using Claude Sonnet 4 pricing: $3/1M input, $15/1M output
    const inputPerReport = 2000 + (nodeCount * 50);   // base prompt + node data
    const outputPerReport = 2500;                       // typical report length
    const reportTypes = 5;

    const inputCost = (inputPerReport * reportTypes / 1_000_000) * 3.00;
    const outputCost = (outputPerReport * reportTypes / 1_000_000) * 15.00;
    const onePassCost = inputCost + outputCost;

    // Estimate: 3 full passes (initial + 2 iterations)
    const estimatedTotal = onePassCost * 3;

    estimateEl.textContent = `~$${estimatedTotal.toFixed(2)}`;
    estimateEl.title = `Based on ${nodeCount} nodes × 5 reports × 3 passes (Sonnet 4 pricing)`;

    // Also refresh actual
    this._refreshActualCost();
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

    // P1.6: Update CEO Command Buttons visibility
    this._updateCommandButtons(data.current);

    // Auto-open panel when session starts
    if (data.current === 'executing' || data.current === 'monitoring') {
      if (!this._isOpen) this.open();
    }

    // Reset live stream state when new session starts
    if (data.current === 'initializing') {
      this._liveStreamMsg = null;
      this._liveStreamEl = null;
      this._streamBuffer = '';
    }

    // Start/stop elapsed timer
    if (data.current === 'monitoring' || data.current === 'executing') {
      this._startElapsedTimer();
    } else {
      this._stopElapsedTimer();
    }
  }

  /**
   * P1.6 — Update CEO Command Buttons based on current state.
   *
   * State → Visible Buttons:
   *   idle:            Launch  +  Copy Prompt
   *   initializing:    (all hidden, show spinner)
   *   executing:       Stop
   *   monitoring:      Pause  +  Stop
   *   paused:          Resume  +  Stop
   *   completed:       Launch  +  Copy Prompt  +  Export Log
   *   failed:          Retry  +  Launch  +  Export Log
   *   cancelled:       Retry  +  Launch  +  Export Log
   */
  _updateCommandButtons(state) {
    const launch  = this.panel.querySelector('#cmd-launch');
    const pause   = this.panel.querySelector('#cmd-pause');
    const resume  = this.panel.querySelector('#cmd-resume');
    const stop    = this.panel.querySelector('#cmd-stop');
    const retry   = this.panel.querySelector('#cmd-retry');
    const copy    = this.panel.querySelector('#cmd-copy-prompt');
    const xport   = this.panel.querySelector('#cmd-export-log');
    const reports = this.panel.querySelector('#cmd-reports-row');

    // Hide all primary/secondary buttons first
    [launch, pause, resume, stop, retry, xport].forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
    // Copy is always available
    if (copy) copy.style.display = '';

    // Reports row: visible when NOT actively executing
    const showReports = ['idle', 'completed', 'failed', 'cancelled'].includes(state);
    if (reports) reports.style.display = showReports ? '' : 'none';

    switch (state) {
      case 'idle':
        launch.style.display = '';
        break;

      case 'initializing':
        // Show nothing — just the spinner in header
        break;

      case 'executing':
        stop.style.display = '';
        break;

      case 'monitoring':
        pause.style.display = '';
        stop.style.display = '';
        break;

      case 'paused':
        resume.style.display = '';
        stop.style.display = '';
        break;

      case 'completed':
        launch.style.display = '';
        xport.style.display = '';
        break;

      case 'failed':
      case 'cancelled':
        if (this._engine?.lastPrompt) {
          retry.style.display = '';
        }
        launch.style.display = '';
        xport.style.display = '';
        break;
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

  /**
   * Update the live streaming message with accumulated text.
   * Creates a single message bubble that grows as content streams in.
   */
  _updateLiveStream() {
    const container = this.panel.querySelector('#agent-messages');
    if (!container) return;

    // Create the live message on first chunk
    if (!this._liveStreamMsg) {
      this._liveStreamMsg = {
        role: 'agent',
        content: '',
        timestamp: Date.now(),
        displayName: 'Agent',
        isLive: true,
      };
      this._messages.push(this._liveStreamMsg);

      // Create the DOM element
      const el = document.createElement('div');
      el.className = 'agent-message agent-message-other agent-message-live';
      el.setAttribute('data-role', 'agent');

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      el.innerHTML = `
        <div class="message-header">
          <span class="message-avatar">🤖</span>
          <span class="message-name">Agent</span>
          <span class="message-time">${time}</span>
          <span class="live-indicator">● LIVE</span>
        </div>
        <div class="message-body report-body"></div>
      `;
      container.appendChild(el);
      this._liveStreamEl = el;
    }

    // Update the content reference
    this._liveStreamMsg.content = this._streamBuffer;

    // Throttle DOM re-renders to avoid perf issues (~7 fps)
    if (!this._renderPending) {
      this._renderPending = true;
      setTimeout(() => {
        this._renderPending = false;
        const bodyEl = this._liveStreamEl?.querySelector('.message-body');
        if (bodyEl) {
          // Strip any in-progress json:actions block so CEO never sees raw JSON
          const displayBuffer = this._stripLiveActionsBlock(this._streamBuffer);
          bodyEl.innerHTML = sanitizeHtml(marked.parse(displayBuffer));
        }
        // Auto-scroll
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }, 150);
    }
  }

  /**
   * Finalize the live streaming message — remove live indicator,
   * persist final content, reset state.
   */
  _finalizeLiveStream() {
    if (this._liveStreamMsg) {
      this._liveStreamMsg.content = this._streamBuffer;
      this._liveStreamMsg.isLive = false;
    }

    // Final render with complete content
    if (this._liveStreamEl) {
      const bodyEl = this._liveStreamEl.querySelector('.message-body');

      // Parse action items BEFORE rendering (we need raw content)
      const { actions, matchedText } = this._parseActions(this._streamBuffer);

      // Strip the actions block from displayed markdown
      let displayContent = this._streamBuffer;
      if (actions.length > 0 && matchedText) {
        displayContent = displayContent.replace(matchedText, '').trim();
      }
      // Fallback: strip any remaining json:actions artifacts the parser didn't catch
      displayContent = this._stripLiveActionsBlock(displayContent);

      if (bodyEl && displayContent) {
        bodyEl.innerHTML = sanitizeHtml(marked.parse(displayContent));
      }
      this._liveStreamEl.classList.remove('agent-message-live');
      const indicator = this._liveStreamEl.querySelector('.live-indicator');
      if (indicator) indicator.remove();

      // Render action cards UI
      if (actions.length > 0) {
        this._renderActionCards(this._liveStreamEl, actions);
      }
    }

    this._liveStreamMsg = null;
    this._liveStreamEl = null;
    this._streamBuffer = '';
    this._renderPending = false;

    // Session complete: hide session cost, refresh actual total
    const sessionBlock = this.panel.querySelector('#cost-session-block');
    if (sessionBlock) sessionBlock.style.display = 'none';
    this._refreshActualCost();
  }

  /**
   * Parse action items from AI response content.
   * Tries multiple patterns to handle different AI output formats.
   * @param {string} content — full markdown response
   * @returns {{ actions: Array, matchedText: string }} — parsed action items and the raw matched text to strip
   */
  _parseActions(content) {
    const EMPTY = { actions: [], matchedText: '' };
    if (!content) return EMPTY;

    // Strategy 1: Exact ```json:actions ... ``` block (various formatting)
    const patterns = [
      /```json:actions\s*\r?\n([\s\S]*?)```/,         // exact tag
      /```json\s*:\s*actions\s*\r?\n([\s\S]*?)```/,    // space around colon
    ];

    for (const regex of patterns) {
      const match = content.match(regex);
      if (match) {
        const parsed = this._tryParseActionsJSON(match[1]);
        if (parsed) return { actions: parsed, matchedText: match[0] };
      }
    }

    // Strategy 2: Find the LAST json code block that contains action-like data
    const allJsonBlocks = [...content.matchAll(/```(?:json)?\s*\r?\n([\s\S]*?)```/g)];
    for (let i = allJsonBlocks.length - 1; i >= 0; i--) {
      const block = allJsonBlocks[i][1];
      if (block.includes('"title"') && block.includes('"priority"')) {
        const parsed = this._tryParseActionsJSON(block);
        if (parsed) return { actions: parsed, matchedText: allJsonBlocks[i][0] };
      }
    }

    // Strategy 3: Look for a bare JSON array at the very end of content
    const tailMatch = content.match(/\[\s*\{[\s\S]*?"title"[\s\S]*?"priority"[\s\S]*?\}\s*\]\s*$/);
    if (tailMatch) {
      const parsed = this._tryParseActionsJSON(tailMatch[0]);
      if (parsed) return { actions: parsed, matchedText: tailMatch[0] };
    }

    return EMPTY;
  }

  /**
   * Strip the json:actions block from live-streaming display so the CEO
   * never sees raw JSON building up.  Handles both complete and in-progress blocks.
   * NOTE: This only affects the DISPLAY — the full buffer is preserved for parsing.
   * @param {string} content — current stream buffer
   * @returns {string} — content safe for live display
   */
  _stripLiveActionsBlock(content) {
    if (!content) return content;

    // Strip a completed ```json:actions ... ``` block
    const complete = content.replace(/```json:actions[\s\S]*?```/g, '');
    if (complete !== content) return complete.trim();

    // Strip an in-progress block (opened but not yet closed)
    const openIdx = content.lastIndexOf('```json:actions');
    if (openIdx !== -1) {
      return content.slice(0, openIdx).trim();
    }

    // Also catch partial opening like "```json:actio" that's still typing
    const partialMatch = content.match(/```json:act[a-z]*$/);
    if (partialMatch) {
      return content.slice(0, partialMatch.index).trim();
    }

    return content;
  }

  /**
   * Safely parse a JSON string into an array of validated action objects.
   * @param {string} jsonStr
   * @returns {Array|null}
   */
  _tryParseActionsJSON(jsonStr) {
    try {
      const trimmed = jsonStr.trim();
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;

      // Validate: each item must have at least a 'title'
      const valid = parsed.filter(item =>
        item && typeof item === 'object' && typeof item.title === 'string' && item.title.trim()
      );
      if (valid.length === 0) return null;

      return valid;
    } catch (e) {
      return null;
    }
  }

  /**
   * Render interactive action cards with "Implement" buttons.
   * @param {HTMLElement} messageEl — the message element to append to
   * @param {Array} actions — parsed action items
   */
  _renderActionCards(messageEl, actions) {
    const container = document.createElement('div');
    container.className = 'action-cards-container';

    // Header with "Implement All" button
    const header = document.createElement('div');
    header.className = 'action-cards-header';
    header.innerHTML = `
      <div class="action-cards-title">
        <span class="action-cards-icon">⚡</span>
        <span>Recommended Actions (${actions.length})</span>
      </div>
      <button class="action-btn-implement-all" title="Create all recommended nodes on the canvas">
        🚀 Implement All
      </button>
    `;
    container.appendChild(header);

    // "Implement All" button handler
    header.querySelector('.action-btn-implement-all').addEventListener('click', () => {
      this.bus.emit('ceo:implement-recommendations', { actions, mode: 'all' });
      header.querySelector('.action-btn-implement-all').disabled = true;
      header.querySelector('.action-btn-implement-all').textContent = '✅ Implemented';
      // Disable individual buttons too
      container.querySelectorAll('.action-btn-implement').forEach(btn => {
        btn.disabled = true;
        btn.textContent = '✅';
      });
      this._showToast(`🚀 ${actions.length} nodes created on canvas`);
    });

    // Individual action cards
    const PRIORITY_ICONS = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
    const TYPE_ICONS = {
      feature: '✨', constraint: '🚧', milestone: '🏁',
      reference: '📎', risk: '⚠️', techNote: '🔧', general: '📌'
    };

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const card = document.createElement('div');
      card.className = `action-card priority-${action.priority || 'medium'}`;
      card.innerHTML = `
        <div class="action-card-header">
          <span class="action-priority-badge">${PRIORITY_ICONS[action.priority] || '🟡'}</span>
          <span class="action-type-badge">${TYPE_ICONS[action.nodeType] || '📌'} ${action.nodeType || 'general'}</span>
          ${action.phase ? `<span class="action-phase-badge">Phase ${action.phase}</span>` : ''}
          <button class="action-btn-implement" data-index="${i}" title="Create this node on the canvas">
            ▶ Implement
          </button>
        </div>
        <div class="action-card-title">${escapeHtml(action.title)}</div>
        ${action.description ? `<div class="action-card-desc">${escapeHtml(action.description)}</div>` : ''}
        ${action.parent ? `<div class="action-card-parent">→ connects to: <strong>${escapeHtml(action.parent)}</strong></div>` : ''}
      `;

      // Individual implement handler
      card.querySelector('.action-btn-implement').addEventListener('click', (e) => {
        this.bus.emit('ceo:implement-recommendations', { actions: [action], mode: 'single' });
        e.target.disabled = true;
        e.target.textContent = '✅ Done';
        this._showToast(`✨ "${action.title}" added to canvas`);
      });

      container.appendChild(card);
    }

    messageEl.appendChild(container);
  }

  /**
   * Legacy flush — now delegates to finalize.
   */
  _flushStreamBuffer() {
    this._finalizeLiveStream();
  }

  /**
   * P1.6: Copy the workflow prompt to clipboard.
   */
  async _copyPromptToClipboard() {
    try {
      // If we have a last prompt from the engine, use it
      if (this._engine?.lastPrompt) {
        await navigator.clipboard.writeText(this._engine.lastPrompt);
        this._showToast('Prompt copied to clipboard!');
        return;
      }

      // Otherwise, ask the main app to generate one
      this.bus.emit('ceo:copy-prompt-request');
      this._showToast('Generating prompt…');
    } catch (err) {
      console.error('Failed to copy prompt:', err);
      this._showToast('Failed to copy prompt');
    }
  }

  /**
   * P1.6: Export the session log as a Markdown file.
   */
  _exportSessionLog() {
    if (this._messages.length === 0) {
      this._showToast('No session log to export.');
      return;
    }

    const lines = [
      '# MindMapper Agent Session Log',
      `**Date**: ${new Date().toISOString()}`,
      `**State**: ${this._state}`,
      `**Messages**: ${this._messages.length}`,
      '',
      '---',
      '',
    ];

    for (const msg of this._messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const name = msg.displayName || msg.role;
      lines.push(`### [${time}] ${name}`);
      lines.push('');
      lines.push(msg.content || '');
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindmapper-session-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);

    this._showToast('Session log exported!');
  }

  /**
   * Show a brief toast notification within the panel.
   */
  _showToast(text) {
    const existing = this.panel.querySelector('.cmd-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'cmd-toast';
    toast.textContent = text;
    this.panel.querySelector('#ceo-command-bar')?.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  }

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
          <p class="empty-hint">Set up your mind map, then click <strong>▶ Launch</strong> to start an agent session.</p>
        </div>
      `;
      return;
    }

    // Detach live stream element before innerHTML replacement
    const liveEl = this._liveStreamEl;
    if (liveEl && liveEl.parentNode) {
      liveEl.remove();
    }

    // Render all non-live messages
    container.innerHTML = this._messages
      .filter(msg => !msg.isLive)
      .map(msg => this._renderMessage(msg))
      .join('');

    // Re-attach live stream element at the end
    if (liveEl) {
      container.appendChild(liveEl);
    }

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
      name = msg.displayName || 'Agent';
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

    // Update cost estimate based on current node count
    this.updateCostEstimate(result.nodeCount || 0);
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

  /**
   * Show a temporary toast notification in the agent panel.
   * @param {string} message — text to display
   * @param {number} duration — ms to show (default 3000)
   */
  _showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'agent-toast';
    toast.textContent = message;
    this.panel.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto-dismiss
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}
