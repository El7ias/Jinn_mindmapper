/**
 * AgentBase — Abstract base class for all virtual agent roles.
 *
 * Every agent in the MindMapper orchestration system extends this class.
 * It provides the standard lifecycle:
 *
 *   1. Receive a task via execute(task, messageHistory)
 *   2. Build a context-aware prompt from the system template + task + history
 *   3. Call the AI API via BrowserAgentBridge
 *   4. Parse the response and emit results to the MessageBus
 *
 * Subclasses MUST override:
 *   - get roleId()       → string
 *   - get displayName()  → string
 *   - parseResponse(raw) → structured output
 *
 * Subclasses MAY override:
 *   - buildTaskPrompt(task) → string
 *   - get modelTier()       → 'flash' | 'standard' | 'opus'
 */

import { getAgentPrompt } from './prompts/AgentPrompts.js';
import { MODEL_TIERS } from '../ai/ModelTierConfig.js';

// ─── Agent States ────────────────────────────────────────────────────────

export const AGENT_STATE = Object.freeze({
  IDLE:       'idle',
  THINKING:   'thinking',
  RESPONDING: 'responding',
  WAITING:    'waiting',     // waiting for another agent
  DONE:       'done',
  ERROR:      'error',
});

// ─── Default Tier Mapping ────────────────────────────────────────────────
// Maps role IDs to their default model tier.  CTO / Sentinel use opus;
// Sentinel need deep reasoning (opus); auditors need minimal (flash);
// everyone else uses standard.

const DEFAULT_TIER_MAP = {
  coo:              'standard',
  cto:              'opus',
  cfo:              'standard',
  frontend:         'standard',
  backend:          'standard',
  devops:           'standard',
  qa:               'standard',
  researcher:       'standard',
  da:               'standard',
  sentinel:         'opus',
  documenter:       'flash',
  'token-auditor':  'flash',
  'api-cost-auditor':'flash',
  'project-auditor': 'flash',
};

// ─── Abstract Base ───────────────────────────────────────────────────────

export class AgentBase {

  /**
   * @param {object} deps
   * @param {import('../core/EventBus.js').EventBus} deps.bus
   * @param {import('../orchestration/BrowserAgentBridge.js').BrowserAgentBridge} deps.bridge
   * @param {object} deps.projectContext — { projectName, stack, features, constraints }
   */
  constructor(deps) {
    if (new.target === AgentBase) {
      throw new Error('AgentBase is abstract — extend it, don\'t instantiate it.');
    }

    this._bus = deps.bus;
    this._bridge = deps.bridge;
    this._projectContext = deps.projectContext || {};

    this._state = AGENT_STATE.IDLE;
    this._lastResponse = null;
    this._tokenUsage = { input: 0, output: 0 };
    this._error = null;
  }

  /* ─── Abstract (must override) ─────────────────────────── */

  /** Role identifier matching AGENT_ROLES.id in NodeManager.js */
  get roleId() { throw new Error('Subclass must implement get roleId()'); }

  /** Human-readable name for display */
  get displayName() { throw new Error('Subclass must implement get displayName()'); }

  /**
   * Parse the raw AI response into structured output.
   * @param {string} rawResponse
   * @returns {object} — role-specific structured data
   */
  parseResponse(_rawResponse) {
    throw new Error('Subclass must implement parseResponse()');
  }

  /* ─── Overridable ──────────────────────────────────────── */

  /** Model tier for this agent. Override to change. */
  get modelTier() {
    return DEFAULT_TIER_MAP[this.roleId] || 'standard';
  }

  /** Reporting chain — which agent this one reports to. Override in subclass. */
  get reportsTo() { return null; }

  /** Get the model tier config object */
  get tierConfig() {
    return MODEL_TIERS[this.modelTier] || MODEL_TIERS.standard;
  }

  /**
   * Build the user-facing task prompt from a task object.
   * Override for role-specific formatting.
   *
   * @param {object} task — { title, description, context?, assignedTo? }
   * @returns {string}
   */
  buildTaskPrompt(task) {
    let prompt = `## Task: ${task.title}\n\n`;
    if (task.description) prompt += `${task.description}\n\n`;
    if (task.context) prompt += `### Additional Context\n${task.context}\n\n`;
    prompt += `Respond with structured, actionable output. Tag your response with [${this.displayName}].`;
    return prompt;
  }

  /* ─── Public API ───────────────────────────────────────── */

  /** Current agent state */
  get state() { return this._state; }

  /** Last response from this agent */
  get lastResponse() { return this._lastResponse; }

  /** Accumulated token usage */
  get tokenUsage() { return { ...this._tokenUsage }; }

  /** Last error if state is ERROR */
  get error() { return this._error; }

  /**
   * Execute a task.
   *
   * @param {object}   task           — { title, description, context? }
   * @param {object[]} messageHistory — prior MessageBus messages for context
   * @returns {Promise<{ raw: string, parsed: object, tokens: { input: number, output: number } }>}
   */
  async execute(task, messageHistory = []) {
    this._transition(AGENT_STATE.THINKING);
    this._error = null;

    try {
      // 1. Build the system prompt
      const systemPrompt = getAgentPrompt(this.roleId, this._projectContext);

      // 2. Build the user prompt from task + context
      const userPrompt = this._buildFullPrompt(task, messageHistory);

      // 3. Call the AI API
      this._transition(AGENT_STATE.RESPONDING);
      const result = await this._callApi(systemPrompt, userPrompt);

      // 4. Parse the response
      const parsed = this.parseResponse(result.text);

      // 5. Track tokens
      this._tokenUsage.input += result.tokens?.input || 0;
      this._tokenUsage.output += result.tokens?.output || 0;

      // 6. Emit completion
      this._lastResponse = { raw: result.text, parsed, tokens: result.tokens };
      this._transition(AGENT_STATE.DONE);

      this._bus.emit('agent:response', {
        roleId: this.roleId,
        displayName: this.displayName,
        tier: this.modelTier,
        response: this._lastResponse,
      });

      return this._lastResponse;

    } catch (err) {
      this._error = err;
      this._transition(AGENT_STATE.ERROR);
      this._bus.emit('agent:error', {
        roleId: this.roleId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Reset agent to idle state (between rounds).
   */
  reset() {
    this._state = AGENT_STATE.IDLE;
    this._lastResponse = null;
    this._error = null;
  }

  /* ─── Internal ──────────────────────────────────────────── */

  /**
   * Build the full user prompt including message history context.
   */
  _buildFullPrompt(task, messageHistory) {
    let prompt = '';

    // Include recent relevant messages as context
    if (messageHistory.length > 0) {
      const relevant = messageHistory
        .filter(m => m.to === `@${this.roleId}` || m.to === '@all')
        .slice(-10);  // last 10 relevant messages

      if (relevant.length > 0) {
        prompt += '## Recent Team Messages\n\n';
        relevant.forEach(m => {
          prompt += `**[${m.fromRole}]** → ${m.content}\n\n`;
        });
      }
    }

    // Add the task
    prompt += this.buildTaskPrompt(task);

    return prompt;
  }

  /**
   * Call the AI API via the bridge.
   * This wraps BrowserAgentBridge.execute with role-specific config.
   * @returns {Promise<{ text: string, tokens: { input: number, output: number } }>}
   */
  async _callApi(systemPrompt, userPrompt) {
    // Build a combined prompt for the single-message API
    const combinedPrompt = `<system>\n${systemPrompt}\n</system>\n\n${userPrompt}`;

    // Collect the streamed response as a single string.
    // We filter by sessionId to avoid cross-agent contamination in
    // multi-agent scenarios where multiple agents run sequentially.
    return new Promise((resolve, reject) => {
      let responseText = '';
      let tokens = { input: 0, output: 0 };
      let activeSessionId = null;

      // Listen for progress to capture streamed chunks.
      // BrowserAgentBridge emits: { type: 'text', content: '...', sessionId }
      const progressUnsub = this._bus.on('orchestration:progress', (data) => {
        // Filter by sessionId when available
        if (activeSessionId && data?.sessionId && data.sessionId !== activeSessionId) return;

        if (data?.type === 'text' && typeof data.content === 'string') {
          responseText += data.content;
        } else if (typeof data === 'string') {
          responseText += data;
        } else if (data?.text) {
          responseText += data.text;
        }
      });

      // Capture the sessionId from the started event
      const startedUnsub = this._bus.on('orchestration:started', (data) => {
        activeSessionId = data?.sessionId || null;
      });

      // Capture token usage from cost events
      const costUnsub = this._bus.on('orchestration:cost', (data) => {
        if (data?.inputTokens) tokens.input = data.inputTokens;
        if (data?.outputTokens) tokens.output = data.outputTokens;
      });

      // Listen for completion
      const completeUnsub = this._bus.on('orchestration:complete', (data) => {
        if (activeSessionId && data?.sessionId && data.sessionId !== activeSessionId) return;
        cleanup();
        resolve({ text: responseText, tokens });
      });

      // Listen for errors
      const errorUnsub = this._bus.on('orchestration:error', (data) => {
        if (activeSessionId && data?.sessionId && data.sessionId !== activeSessionId) return;
        cleanup();
        reject(new Error(data?.message || 'Agent API call failed'));
      });

      const cleanup = () => {
        progressUnsub();
        startedUnsub();
        costUnsub();
        completeUnsub();
        errorUnsub();
      };

      // Fire the request
      this._bridge.execute(combinedPrompt, {
        model: this.tierConfig.models?.anthropic,
      }).catch(err => {
        cleanup();
        reject(err);
      });
    });
  }

  /**
   * Transition agent state and emit event.
   */
  _transition(newState) {
    const prev = this._state;
    this._state = newState;
    this._bus.emit('agent:state-change', {
      roleId: this.roleId,
      previous: prev,
      current: newState,
    });
  }
}
