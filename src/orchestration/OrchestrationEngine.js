/**
 * OrchestrationEngine — Session lifecycle manager for agent execution.
 *
 * Ties together the full pipeline:
 *   Canvas → MindMapSerializer → WorkflowPromptGenerator → Bridge
 *
 * Dual-mode bridge:
 *   - Desktop (Tauri):  ClaudeCodeBridge  — spawns Claude Code CLI subprocess
 *   - Browser:          BrowserAgentBridge — calls Anthropic/OpenAI APIs via fetch()
 *
 * State machine:
 *   idle → initializing → executing → monitoring → completed | failed
 *                                   ↕ paused
 *                                   → cancelled
 *
 * Events consumed from Bridge (via EventBus):
 *   orchestration:started, orchestration:progress, orchestration:error,
 *   orchestration:complete, orchestration:approval-needed
 *
 * Events emitted:
 *   orchestration:state-change    — whenever session state transitions
 *   orchestration:metrics-update  — periodic metrics snapshot
 */

import { ClaudeCodeBridge } from './ClaudeCodeBridge.js';
import { BrowserAgentBridge } from './BrowserAgentBridge.js';
import { EnvironmentDetector } from './EnvironmentDetector.js';
import { SessionStore } from './SessionStore.js';
import { serializeMindMap } from '../export/MindMapSerializer.js';
import { generateWorkflowPrompt } from '../export/WorkflowPromptGenerator.js';

/** @readonly */
const STATE = Object.freeze({
  IDLE:          'idle',
  INITIALIZING:  'initializing',
  EXECUTING:     'executing',
  MONITORING:    'monitoring',
  PAUSED:        'paused',
  COMPLETED:     'completed',
  FAILED:        'failed',
  CANCELLED:     'cancelled',
});

export class OrchestrationEngine {

  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {object} managers — { nodeManager, connectionManager }
   */
  constructor(bus, managers) {
    this._bus = bus;
    this._nodeManager = managers.nodeManager;
    this._connManager = managers.connectionManager;

    // Auto-select bridge based on environment
    this._isDesktop = EnvironmentDetector.isTauri;
    this._desktopBridge = new ClaudeCodeBridge(bus);
    this._browserBridge = new BrowserAgentBridge(bus);
    this._bridge = this._isDesktop ? this._desktopBridge : this._browserBridge;

    this._store = new SessionStore();
    this._state = STATE.IDLE;

    // Live session data
    this._session = null;
    this._metrics = this._freshMetrics();
    this._messages = [];      // collected progress messages
    this._lastPrompt = null;  // stored for retry support
    this._lastOptions = null;
    this._unlisteners = [];

    // Bind EventBus listeners
    this._attachBusListeners();
  }

  /* ─── Public API ────────────────────────────────────────── */

  /** Current engine state. */
  get state() { return this._state; }

  /** Expose states enum. */
  static get STATE() { return STATE; }

  /** Current session info (if any). */
  get session() { return this._session; }

  /** Current metrics snapshot. */
  get metrics() { return { ...this._metrics }; }

  /** Collected messages for the current session. */
  get messages() { return [...this._messages]; }

  /** Whether the engine is running in desktop mode. */
  get isDesktop() { return this._isDesktop; }

  /** Active bridge instance (for external API key checks). */
  get bridge() { return this._bridge; }

  /** Browser bridge instance (for API key mgmt). */
  get browserBridge() { return this._browserBridge; }

  /** Last generated prompt (for retry). */
  get lastPrompt() { return this._lastPrompt; }

  /** Last session options (for retry). */
  get lastOptions() { return this._lastOptions; }

  /**
   * Start a new orchestration session.
   *
   * @param {object} options
   * @param {string} [options.projectName]   — override project name
   * @param {string} [options.ceoVision]     — user's concept description
   * @param {string} [options.outputDir]     — working directory for Claude Code
   * @param {string} [options.model]         — model override
   * @param {boolean} [options.handsOff]     — hands-off mode (no approval gates)
   * @param {string} [options.stack]         — preferred tech stack
   * @param {string} [options.customPrompt]  — P1.6: bypass serialization, use custom prompt
   * @param {string} [options.reportType]    — P1.6: type of CEO report being generated
   * @param {string} [options.reportLabel]   — P1.6: human-readable report label
   * @returns {Promise<{ sessionId: string }>}
   */
  async startSession(options = {}) {
    if (this._state !== STATE.IDLE && this._state !== STATE.COMPLETED &&
        this._state !== STATE.FAILED && this._state !== STATE.CANCELLED) {
      throw new Error(`Cannot start session in state "${this._state}". Cancel or wait for completion.`);
    }

    this._transition(STATE.INITIALIZING);
    this._messages = [];
    this._metrics = this._freshMetrics();
    this._metrics.startedAt = Date.now();

    try {
      let prompt;

      if (options.customPrompt) {
        // P1.6: Use provided custom prompt (e.g., from CEO Report buttons)
        prompt = options.customPrompt;
        this._metrics.nodeCount = 0;
        this._metrics.connectionCount = 0;
      } else {
        // 1. Serialize the current mind map
        const nodes = this._nodeManager.serialize();
        const connections = this._connManager.serialize();
        const serialized = serializeMindMap(nodes, connections, {
          projectName: options.projectName,
          ceoVision: options.ceoVision,
        });

        this._metrics.nodeCount = serialized.stats.totalNodes;
        this._metrics.connectionCount = serialized.stats.totalConnections;

        // 2. Generate the workflow prompt
        prompt = generateWorkflowPrompt(serialized, {
          stack: options.stack,
          outputDir: options.outputDir || '.',
        });
      }

      this._metrics.promptLength = prompt.length;
      this._lastPrompt = prompt;
      this._lastOptions = { ...options };

      // 3. Execute via active bridge (desktop or browser)
      this._transition(STATE.EXECUTING);
      const result = await this._bridge.execute(prompt, {
        outputDir: options.outputDir || '.',
        model: options.model,
        handsOff: options.handsOff,
        provider: options.provider,
      });

      const sessionName = options.reportLabel || options.projectName || 'Agent Session';

      this._session = {
        sessionId: result.sessionId,
        pid: result.pid,
        projectName: sessionName,
        startedAt: this._metrics.startedAt,
        handsOff: options.handsOff || false,
      };

      this._transition(STATE.MONITORING);

      // Persist session start
      await this._store.save({
        sessionId: result.sessionId,
        projectName: sessionName,
        status: STATE.MONITORING,
        startedAt: this._metrics.startedAt,
        promptPreview: prompt.substring(0, 200),
      });

      this._emitMetrics();

      return { sessionId: result.sessionId };
    } catch (err) {
      this._transition(STATE.FAILED);
      this._addMessage('system', `Failed to start session: ${err.message}`);
      throw err;
    }
  }

  /**
   * Pause the current session (CEO intervention).
   * Note: this pauses the UI monitoring — the subprocess continues
   * unless Claude Code itself is waiting for approval.
   */
  pauseSession() {
    if (this._state !== STATE.MONITORING) {
      throw new Error(`Cannot pause in state "${this._state}".`);
    }
    this._transition(STATE.PAUSED);
    this._addMessage('system', 'Session paused by CEO.');
  }

  /** Resume a paused session. */
  resumeSession() {
    if (this._state !== STATE.PAUSED) {
      throw new Error(`Cannot resume in state "${this._state}".`);
    }
    this._transition(STATE.MONITORING);
    this._addMessage('system', 'Session resumed by CEO.');
  }

  /**
   * Cancel the current session.
   * @returns {Promise<void>}
   */
  async cancelSession() {
    if (this._state !== STATE.MONITORING && this._state !== STATE.PAUSED &&
        this._state !== STATE.EXECUTING) {
      throw new Error(`Cannot cancel in state "${this._state}".`);
    }

    await this._bridge.cancel();
    this._transition(STATE.CANCELLED);

    this._metrics.completedAt = Date.now();
    this._addMessage('system', 'Session cancelled by CEO.');

    // Persist
    if (this._session) {
      await this._store.save({
        sessionId: this._session.sessionId,
        status: STATE.CANCELLED,
        completedAt: this._metrics.completedAt,
        messageCount: this._metrics.messageCount,
        errorCount: this._metrics.errorCount,
      });
    }

    this._emitMetrics();
  }

  /**
   * Get a summary of the current or last session.
   * @returns {object}
   */
  getSessionSummary() {
    const elapsed = this._metrics.completedAt
      ? this._metrics.completedAt - this._metrics.startedAt
      : (this._state !== STATE.IDLE ? Date.now() - this._metrics.startedAt : 0);

    return {
      state: this._state,
      session: this._session,
      metrics: {
        ...this._metrics,
        elapsedMs: elapsed,
        elapsedFormatted: this._formatElapsed(elapsed),
      },
    };
  }

  /** Get session history from the store. */
  async getHistory() {
    return this._store.list();
  }

  /** Clean up. */
  destroy() {
    this._unlisteners.forEach(fn => fn());
    this._unlisteners = [];
    if (typeof this._desktopBridge?.destroy === 'function') {
      this._desktopBridge.destroy();
    }
  }

  /**
   * Check if a browser API key is available.
   * @returns {boolean}
   */
  hasBrowserApiKey() {
    return this._browserBridge.hasAnyApiKey();
  }

  /* ─── EventBus Listeners ────────────────────────────────── */

  _attachBusListeners() {
    const on = (event, handler) => {
      this._unlisteners.push(this._bus.on(event, handler));
    };

    // Progress events from ClaudeCodeBridge
    on('orchestration:progress', (data) => {
      if (this._state === STATE.MONITORING || this._state === STATE.PAUSED) {
        this._metrics.messageCount++;
        this._addMessage('agent', data);
        this._emitMetrics();
      }
    });

    // Error events
    on('orchestration:error', (data) => {
      this._metrics.errorCount++;
      this._addMessage('error', data.message || 'Unknown error');
      this._emitMetrics();
    });

    // Completion event
    on('orchestration:complete', async (data) => {
      const newState = data.success ? STATE.COMPLETED : STATE.FAILED;
      this._transition(newState);

      this._metrics.completedAt = Date.now();
      this._metrics.exitCode = data.exitCode;
      this._addMessage('system',
        data.success ? 'Session completed successfully.' : `Session failed (exit code: ${data.exitCode}).`
      );

      // Persist final state
      if (this._session) {
        await this._store.save({
          sessionId: this._session.sessionId,
          status: newState,
          completedAt: this._metrics.completedAt,
          exitCode: data.exitCode,
          messageCount: this._metrics.messageCount,
          errorCount: this._metrics.errorCount,
        });
      }

      this._emitMetrics();
    });

    // Approval-needed events
    on('orchestration:approval-needed', (data) => {
      this._addMessage('approval', data);
      this._emitMetrics();
    });

    // CEO approval from AgentPanel
    on('ceo:approval', (data) => {
      this._addMessage('system', `CEO approved: ${data.decision}`);
    });

    // External cancel request (from AgentPanel)
    on('orchestration:cancel', () => {
      // Already handled in cancelSession(), this catches external emits
    });
  }

  /* ─── Internal Helpers ──────────────────────────────────── */

  /**
   * Transition to a new state and emit state-change event.
   * @param {string} newState
   */
  _transition(newState) {
    const prev = this._state;
    this._state = newState;
    this._bus.emit('orchestration:state-change', {
      previous: prev,
      current: newState,
      sessionId: this._session?.sessionId,
    });
  }

  /**
   * Add a message to the session log.
   * @param {'agent'|'system'|'error'|'approval'} type
   * @param {*} content
   */
  _addMessage(type, content) {
    this._messages.push({
      type,
      content,
      timestamp: Date.now(),
    });
  }

  /** Emit a metrics update event. */
  _emitMetrics() {
    this._bus.emit('orchestration:metrics-update', this.getSessionSummary());
  }

  /** Fresh metrics object. */
  _freshMetrics() {
    return {
      startedAt: 0,
      completedAt: 0,
      messageCount: 0,
      errorCount: 0,
      nodeCount: 0,
      connectionCount: 0,
      promptLength: 0,
      exitCode: null,
    };
  }

  /**
   * Format elapsed time for display.
   * @param {number} ms
   * @returns {string}
   */
  _formatElapsed(ms) {
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remainSecs}s`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m`;
  }
}
