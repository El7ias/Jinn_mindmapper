/**
 * ClaudeCodeBridge — Adapter between Tauri IPC and MindMapper's EventBus.
 *
 * Desktop: invokes Rust commands to spawn Claude Code CLI subprocess,
 *          listens to Tauri events for streaming progress.
 * Browser: no-ops gracefully (SaaS mode will be Phase 4B).
 *
 * Events emitted via EventBus:
 *   orchestration:started            — subprocess launched
 *   orchestration:progress           — each stdout line (JSON or text)
 *   orchestration:error              — stderr lines / errors
 *   orchestration:complete           — process exited
 *   orchestration:approval-needed    — Claude requests user confirmation
 */

import { EnvironmentDetector } from './EnvironmentDetector.js';

export class ClaudeCodeBridge {

  /** @param {import('../core/EventBus.js').EventBus} bus */
  constructor(bus) {
    this._bus = bus;
    this._sessionId = null;
    this._unlisteners = [];
    this._status = 'idle'; // idle | starting | running | completed | failed | cancelled
  }

  /* ─── Public API ────────────────────────────────────────── */

  /**
   * Check if Claude Code CLI is installed (desktop only).
   * @returns {Promise<{ installed: boolean, version?: string, error?: string }>}
   */
  async detectCLI() {
    if (!EnvironmentDetector.isTauri) {
      return { installed: false, error: 'Not running in desktop mode' };
    }
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('detect_claude_cli');
  }

  /**
   * Spawn Claude Code with a prompt and stream progress.
   *
   * @param {string} prompt      — the full prompt to send to Claude Code
   * @param {Object} options
   * @param {string} options.outputDir  — working directory for the subprocess
   * @param {string} [options.model]    — model override (e.g. 'claude-sonnet-4-20250514')
   * @param {boolean} [options.handsOff] — if true, allow all tool use without confirmation
   * @returns {Promise<{ sessionId: string, pid: number }>}
   */
  async execute(prompt, options = {}) {
    EnvironmentDetector.requireDesktop('Claude Code execution');

    if (this._status === 'running') {
      throw new Error('A Claude Code session is already running. Cancel it first.');
    }

    this._status = 'starting';

    // Set up Tauri event listeners before spawning
    await this._attachListeners();

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke('spawn_claude', {
        prompt,
        outputDir: options.outputDir || '.',
        model: options.model || null,
        handsOff: options.handsOff || false,
      });

      this._sessionId = result.sessionId;
      this._status = 'running';

      this._bus.emit('orchestration:started', {
        sessionId: result.sessionId,
        pid: result.pid,
      });

      return result;
    } catch (err) {
      this._status = 'failed';
      this._bus.emit('orchestration:error', {
        message: err.toString(),
        phase: 'spawn',
      });
      this._detachListeners();
      throw err;
    }
  }

  /**
   * Cancel the running Claude Code subprocess.
   * @returns {Promise<{ cancelled: boolean }>}
   */
  async cancel() {
    if (this._status !== 'running' && this._status !== 'starting') {
      return { cancelled: false, reason: 'No active session' };
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('cancel_claude');

    if (result.cancelled) {
      this._status = 'cancelled';
      this._bus.emit('orchestration:cancel', {
        sessionId: this._sessionId,
      });
      this._detachListeners();
    }

    return result;
  }

  /**
   * @returns {'idle'|'starting'|'running'|'completed'|'failed'|'cancelled'}
   */
  getStatus() {
    return this._status;
  }

  /* ─── API Key Management ────────────────────────────────── */

  /**
   * Read an API key from the secure Tauri store.
   * @param {string} [provider='anthropic']
   * @returns {Promise<string|null>}
   */
  async getApiKey(provider = 'anthropic') {
    if (!EnvironmentDetector.isTauri) return null;
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('get_api_key', { provider });
    return result.key ?? null;
  }

  /**
   * Save an API key to the secure Tauri store.
   * @param {string} key
   * @param {string} [provider='anthropic']
   * @returns {Promise<boolean>}
   */
  async setApiKey(key, provider = 'anthropic') {
    if (!EnvironmentDetector.isTauri) return false;
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('set_api_key', { provider, key });
    return result.saved;
  }

  /* ─── Tauri Event Listeners ─────────────────────────────── */

  /** Attach Tauri event listeners that bridge into EventBus. */
  async _attachListeners() {
    const { listen } = await import('@tauri-apps/api/event');

    // Progress events (stdout lines from Claude Code)
    const unProgress = await listen('claude:progress', (event) => {
      const data = event.payload;
      this._bus.emit('orchestration:progress', {
        sessionId: data.sessionId,
        type: data.type,         // 'json' or 'text'
        data: data.data,
      });

      // Detect approval-needed events in Claude Code's JSON output
      if (data.type === 'json' && data.data?.type === 'tool_use_permission') {
        this._bus.emit('orchestration:approval-needed', {
          sessionId: data.sessionId,
          tool: data.data.tool,
          input: data.data.input,
        });
      }
    });

    // Error events (stderr lines)
    const unError = await listen('claude:error', (event) => {
      this._bus.emit('orchestration:error', {
        sessionId: event.payload.sessionId,
        message: event.payload.message,
        phase: 'runtime',
      });
    });

    // Completion event
    const unComplete = await listen('claude:complete', (event) => {
      const data = event.payload;
      this._status = data.success ? 'completed' : 'failed';

      this._bus.emit('orchestration:complete', {
        sessionId: data.sessionId,
        exitCode: data.exitCode,
        success: data.success,
      });

      this._detachListeners();
    });

    // Session started event
    const unStarted = await listen('claude:started', (event) => {
      this._sessionId = event.payload.sessionId;
    });

    this._unlisteners = [unProgress, unError, unComplete, unStarted];
  }

  /** Remove all Tauri event listeners. */
  _detachListeners() {
    this._unlisteners.forEach(fn => fn());
    this._unlisteners = [];
  }

  /** Clean up on destruction. */
  destroy() {
    this._detachListeners();
    this._status = 'idle';
    this._sessionId = null;
  }
}
