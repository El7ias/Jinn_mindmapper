/**
 * AgentStatusDisplay — Real-time agent roster panel.
 *
 * Shows a live grid of all active agents with:
 *   - Name + role icon
 *   - Current state (idle → thinking → responding → done / error)
 *   - Tier badge (flash / standard / opus)
 *   - Token count
 *
 * Injected into the Agent Panel when a multi-agent session starts.
 * Listens to `agent:state-change` events to update in real time.
 */

const STATE_ICONS = {
  idle:       '⏸',
  thinking:   '🧠',
  responding: '💬',
  waiting:    '⏳',
  done:       '✅',
  error:      '❌',
};

const STATE_CSS = {
  idle:       'agent-idle',
  thinking:   'agent-thinking',
  responding: 'agent-responding',
  waiting:    'agent-waiting',
  done:       'agent-done',
  error:      'agent-error',
};

const TIER_LABELS = {
  flash:    { short: 'F1', color: '#4caf50', label: 'Flash' },
  standard: { short: 'S2', color: '#2196f3', label: 'Standard' },
  opus:     { short: 'O3', color: '#9c27b0', label: 'Opus' },
};

export class AgentStatusDisplay {

  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
    this._agents = new Map();  // roleId → { displayName, state, tier, tokens }
    this._container = null;
    this._visible = false;
    this._unlisteners = [];
    this._createDOM();
    this._bindEvents();
  }

  // ─── DOM ───────────────────────────────────────────────────────────

  _createDOM() {
    this._container = document.createElement('div');
    this._container.id = 'agent-status-display';
    this._container.className = 'agent-status-display';
    this._container.style.display = 'none';
    this._container.innerHTML = `
      <div class="asd-header">
        <span class="asd-title">🤖 Agent Roster</span>
        <span class="asd-count" id="asd-count">0 agents</span>
      </div>
      <div class="asd-grid" id="asd-grid"></div>
    `;
  }

  /** Get the DOM element for insertion into the Agent Panel */
  get element() { return this._container; }

  // ─── Events ────────────────────────────────────────────────────────

  _bindEvents() {
    this._unlisteners.push(
      this._bus.on('agent:state-change', (data) => this._onAgentStateChange(data)),
      this._bus.on('agent:response', (data) => this._onAgentResponse(data)),
      this._bus.on('agent:error', (data) => this._onAgentError(data)),
    );
  }

  _onAgentStateChange({ roleId, current }) {
    const agent = this._agents.get(roleId);
    if (agent) {
      agent.state = current;
      this._renderAgent(roleId);
    }
  }

  _onAgentResponse({ roleId, tier, response }) {
    const agent = this._agents.get(roleId);
    if (agent && response?.tokens) {
      agent.tokens.input += response.tokens.input || 0;
      agent.tokens.output += response.tokens.output || 0;
      this._renderAgent(roleId);
    }
  }

  _onAgentError({ roleId }) {
    const agent = this._agents.get(roleId);
    if (agent) {
      agent.state = 'error';
      this._renderAgent(roleId);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Register an agent to be tracked in the display.
   * @param {string} roleId
   * @param {string} displayName
   * @param {string} tier — 'flash' | 'standard' | 'opus'
   */
  registerAgent(roleId, displayName, tier = 'standard') {
    this._agents.set(roleId, {
      displayName,
      state: 'idle',
      tier,
      tokens: { input: 0, output: 0 },
    });
    this._render();
  }

  /**
   * Register multiple agents from a plan.
   * @param {Array<{assignedTo: string, tier: string}>} tasks
   * @param {object} agentDisplayNames — { roleId: displayName }
   */
  registerFromPlan(tasks, agentDisplayNames = {}) {
    const seen = new Set();
    for (const task of tasks) {
      if (!seen.has(task.assignedTo)) {
        seen.add(task.assignedTo);
        const name = agentDisplayNames[task.assignedTo] || task.assignedTo;
        this.registerAgent(task.assignedTo, name, task.tier || 'standard');
      }
    }
    this._render();
  }

  /**
   * Programmatically update an agent's status.
   * @param {string} roleId
   * @param {string} state — 'idle' | 'thinking' | 'responding' | 'waiting' | 'done' | 'error'
   */
  updateStatus(roleId, state) {
    const agent = this._agents.get(roleId);
    if (agent) {
      agent.state = state;
      this._renderAgent(roleId);
    }
  }

  /** Show the status display */
  show() {
    this._container.style.display = '';
    this._visible = true;
  }

  /** Hide the status display */
  hide() {
    this._container.style.display = 'none';
    this._visible = false;
  }

  /** Clear all tracked agents */
  clear() {
    this._agents.clear();
    this._render();
  }

  /** Tear down */
  destroy() {
    this._unlisteners.forEach(fn => fn());
    this._container.remove();
  }

  // ─── Rendering ────────────────────────────────────────────────────

  _render() {
    const grid = this._container.querySelector('#asd-grid');
    const count = this._container.querySelector('#asd-count');
    count.textContent = `${this._agents.size} agent${this._agents.size !== 1 ? 's' : ''}`;
    grid.innerHTML = '';

    for (const [roleId] of this._agents) {
      this._renderAgent(roleId, grid);
    }
  }

  _renderAgent(roleId, appendTo = null) {
    const agent = this._agents.get(roleId);
    if (!agent) return;

    const grid = appendTo || this._container.querySelector('#asd-grid');
    const tier = TIER_LABELS[agent.tier] || TIER_LABELS.standard;
    const stateIcon = STATE_ICONS[agent.state] || '⏸';
    const stateCss = STATE_CSS[agent.state] || 'agent-idle';
    const totalTokens = agent.tokens.input + agent.tokens.output;
    const tokenDisplay = totalTokens > 0
      ? `${(totalTokens / 1000).toFixed(1)}k`
      : '—';

    // Find or create card
    let card = grid.querySelector(`[data-role="${roleId}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'asd-card';
      card.dataset.role = roleId;
      grid.appendChild(card);
    }

    card.className = `asd-card ${stateCss}`;
    card.innerHTML = `
      <div class="asd-card-header">
        <span class="asd-state-icon">${stateIcon}</span>
        <span class="asd-name">${agent.displayName}</span>
      </div>
      <div class="asd-card-meta">
        <span class="asd-tier" style="background:${tier.color}">${tier.short}</span>
        <span class="asd-tokens">${tokenDisplay}</span>
      </div>
    `;
  }
}
