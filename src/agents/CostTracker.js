/**
 * CostTracker — Per-agent, per-session token counting and budget enforcement.
 *
 * Tracks token usage and dollar costs across all agents, model tiers,
 * and sessions. Emits alerts when budgets are exceeded.
 *
 * Integrates with:
 *   - BrowserAgentBridge (MODEL_PRICING for cost calculations)
 *   - AgentRegistry (per-role tier mapping)
 *   - EventBus (cost alert events)
 */

import { MODEL_PRICING } from '../orchestration/BrowserAgentBridge.js';

const STORAGE_KEY = 'mindmapper_cost_tracker';

// Default budget limits (USD)
const DEFAULT_BUDGETS = {
  session:   5.00,    // $5 per session
  agent:     1.50,    // $1.50 per agent per session
  tier: {
    flash:    0.50,   // $0.50 total for all flash agents
    standard: 3.00,   // $3.00 total for all standard agents
    opus:     5.00,   // $5.00 total for all opus agents
  },
};

// ─── CostTracker ────────────────────────────────────────────────────────

export class CostTracker {

  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {object} [budgets] — override default budgets
   */
  constructor(bus, budgets = {}) {
    this._bus = bus;
    this._budgets = { ...DEFAULT_BUDGETS, ...budgets };

    /** @type {Map<string, { input: number, output: number, cost: number, calls: number }>} */
    this._agentUsage = new Map();

    /** @type {{ input: number, output: number, cost: number, calls: number }} */
    this._sessionUsage = { input: 0, output: 0, cost: 0, calls: 0 };

    /** @type {Map<string, { input: number, output: number, cost: number }>} */
    this._tierUsage = new Map();

    /** @type {Set<string>} — already-fired alerts (avoid spamming) */
    this._firedAlerts = new Set();

    this._sessionStart = Date.now();

    // Load historical data
    this._history = this._load();
  }

  /* ─── Recording ────────────────────────────────────────── */

  /**
   * Record token usage for an agent call.
   *
   * @param {string} roleId — agent role
   * @param {string} tier   — model tier used
   * @param {string} model  — exact model name
   * @param {{ input: number, output: number }} tokens — token counts
   */
  record(roleId, tier, model, tokens) {
    const cost = this._calculateCost(model, tokens);

    // Per-agent
    if (!this._agentUsage.has(roleId)) {
      this._agentUsage.set(roleId, { input: 0, output: 0, cost: 0, calls: 0 });
    }
    const agent = this._agentUsage.get(roleId);
    agent.input += tokens.input || 0;
    agent.output += tokens.output || 0;
    agent.cost += cost;
    agent.calls += 1;

    // Per-tier
    if (!this._tierUsage.has(tier)) {
      this._tierUsage.set(tier, { input: 0, output: 0, cost: 0 });
    }
    const tierData = this._tierUsage.get(tier);
    tierData.input += tokens.input || 0;
    tierData.output += tokens.output || 0;
    tierData.cost += cost;

    // Session total
    this._sessionUsage.input += tokens.input || 0;
    this._sessionUsage.output += tokens.output || 0;
    this._sessionUsage.cost += cost;
    this._sessionUsage.calls += 1;

    // Emit live update
    this._bus.emit('cost:update', this.getSnapshot());

    // Check budgets
    this._checkBudgets(roleId, tier);
  }

  /* ─── Querying ─────────────────────────────────────────── */

  /**
   * Get current session cost snapshot.
   */
  getSnapshot() {
    return {
      session: { ...this._sessionUsage },
      agents: Object.fromEntries(this._agentUsage),
      tiers: Object.fromEntries(this._tierUsage),
      elapsed: Date.now() - this._sessionStart,
      budgets: this._budgets,
    };
  }

  /**
   * Get cost for a specific agent.
   * @param {string} roleId
   */
  getAgentCost(roleId) {
    return this._agentUsage.get(roleId) || { input: 0, output: 0, cost: 0, calls: 0 };
  }

  /**
   * Get cost for a specific tier.
   * @param {string} tier
   */
  getTierCost(tier) {
    return this._tierUsage.get(tier) || { input: 0, output: 0, cost: 0 };
  }

  /**
   * Get total session cost in USD.
   */
  get totalCost() {
    return this._sessionUsage.cost;
  }

  /**
   * Get total tokens used.
   */
  get totalTokens() {
    return this._sessionUsage.input + this._sessionUsage.output;
  }

  /**
   * Get budget utilization as percentages.
   */
  getBudgetUtilization() {
    return {
      session: this._pct(this._sessionUsage.cost, this._budgets.session),
      tiers: {
        flash:    this._pct(this.getTierCost('flash').cost, this._budgets.tier.flash),
        standard: this._pct(this.getTierCost('standard').cost, this._budgets.tier.standard),
        opus:     this._pct(this.getTierCost('opus').cost, this._budgets.tier.opus),
      },
    };
  }

  /**
   * Generate a CFO-style cost report.
   * @returns {string} — markdown table
   */
  generateReport() {
    let report = '## Cost Report\n\n';
    report += `**Session Total:** $${this._sessionUsage.cost.toFixed(4)} | `;
    report += `${this.totalTokens.toLocaleString()} tokens | `;
    report += `${this._sessionUsage.calls} API calls\n\n`;

    report += '| Role | Tier | Tokens In | Tokens Out | Cost | Calls |\n';
    report += '|------|------|-----------|------------|------|-------|\n';

    this._agentUsage.forEach((usage, roleId) => {
      const tier = this._tierUsage.has(roleId) ? roleId : '—';
      report += `| ${roleId} | ${tier} | ${usage.input.toLocaleString()} | ${usage.output.toLocaleString()} | $${usage.cost.toFixed(4)} | ${usage.calls} |\n`;
    });

    report += '\n### Tier Breakdown\n\n';
    report += '| Tier | Cost | Budget | Utilization |\n';
    report += '|------|------|--------|-------------|\n';

    ['flash', 'standard', 'opus'].forEach(tier => {
      const cost = this.getTierCost(tier).cost;
      const budget = this._budgets.tier[tier];
      const pct = this._pct(cost, budget);
      report += `| ${tier} | $${cost.toFixed(4)} | $${budget.toFixed(2)} | ${pct}% |\n`;
    });

    return report;
  }

  /* ─── Session Management ───────────────────────────────── */

  /**
   * Finalize session and save to history.
   */
  finalize() {
    const record = {
      timestamp: Date.now(),
      duration: Date.now() - this._sessionStart,
      ...this.getSnapshot(),
    };

    this._history.push(record);

    // Keep last 50 sessions
    if (this._history.length > 50) {
      this._history = this._history.slice(-50);
    }

    this._save();
    return record;
  }

  /**
   * Reset for a new session.
   */
  reset() {
    this._agentUsage.clear();
    this._tierUsage.clear();
    this._sessionUsage = { input: 0, output: 0, cost: 0, calls: 0 };
    this._firedAlerts.clear();
    this._sessionStart = Date.now();
  }

  /**
   * Get session history.
   */
  getHistory() {
    return [...this._history];
  }

  /* ─── Internal ─────────────────────────────────────────── */

  /**
   * Calculate cost from model and tokens.
   */
  _calculateCost(model, tokens) {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING['_default'];
    const inputCost = ((tokens.input || 0) / 1_000_000) * pricing.input;
    const outputCost = ((tokens.output || 0) / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  /**
   * Check budget limits and emit alerts.
   */
  _checkBudgets(roleId, tier) {
    // Session budget
    if (this._sessionUsage.cost >= this._budgets.session) {
      this._alert('session', `Session budget exceeded: $${this._sessionUsage.cost.toFixed(4)} / $${this._budgets.session.toFixed(2)}`);
    } else if (this._sessionUsage.cost >= this._budgets.session * 0.8) {
      this._alert('session-warn', `Session budget 80% used: $${this._sessionUsage.cost.toFixed(4)} / $${this._budgets.session.toFixed(2)}`);
    }

    // Agent budget
    const agentCost = this.getAgentCost(roleId).cost;
    if (agentCost >= this._budgets.agent) {
      this._alert(`agent-${roleId}`, `Agent ${roleId} budget exceeded: $${agentCost.toFixed(4)} / $${this._budgets.agent.toFixed(2)}`);
    }

    // Tier budget
    const tierCost = this.getTierCost(tier).cost;
    const tierBudget = this._budgets.tier[tier] || this._budgets.tier.standard;
    if (tierCost >= tierBudget) {
      this._alert(`tier-${tier}`, `${tier} tier budget exceeded: $${tierCost.toFixed(4)} / $${tierBudget.toFixed(2)}`);
    }
  }

  /**
   * Emit a budget alert (deduped).
   */
  _alert(key, message) {
    if (this._firedAlerts.has(key)) return;
    this._firedAlerts.add(key);
    this._bus.emit('cost:alert', { key, message });
    console.warn(`[CostTracker] ${message}`);
  }

  _pct(value, max) {
    if (!max) return 0;
    return Math.round((value / max) * 100);
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._history));
    } catch { /* quota exceeded */ }
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
