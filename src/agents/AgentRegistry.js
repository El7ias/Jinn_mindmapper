/**
 * AgentRegistry — Maps agent role IDs to their configurations and instances.
 *
 * The registry is the single source of truth for which agents exist,
 * their tier assignments, capabilities, and runtime instances.
 *
 * Usage:
 *   const registry = new AgentRegistry(deps);
 *   const coo = registry.get('coo');
 *   const allAgents = registry.getAll();
 *   const opusAgents = registry.getByTier('opus');
 */

import { AGENT_ROLES } from '../nodes/NodeManager.js';

// ─── Role Metadata ──────────────────────────────────────────────────────
// Enriches AGENT_ROLES with tier + capability data.

const ROLE_CONFIG = {
  ceo: {
    tier: 'standard',
    routing: 'human',
    capabilities: ['approve', 'reject', 'escalate'],
    isHuman: true,
  },
  coo: {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['plan', 'assign', 'sequence', 'report'],
    reportsTo: 'ceo',
    receives: ['da', 'devops', 'qa', 'documenter'],
  },
  cto: {
    tier: 'opus',
    routing: 'opus',
    capabilities: ['architecture', 'review', 'approve', 'techDecision'],
    reportsTo: 'ceo',
    receives: ['cfo', 'sentinel', 'researcher', 'backend'],
  },
  cfo: {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['budget', 'costAnalysis', 'tierRecommend'],
    reportsTo: 'cto',
    receives: ['token-auditor', 'api-cost-auditor'],
  },
  frontend: {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['code', 'ui', 'design', 'test', 'brandGuard'],
    reportsTo: 'coo',
    receives: ['researcher'],
  },
  backend: {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['code', 'api', 'data', 'auth', 'test'],
    reportsTo: 'cto',
    receives: ['researcher'],
  },
  devops: {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['cicd', 'deploy', 'infra', 'monitor'],
    reportsTo: 'coo',
    receives: ['researcher'],
  },
  'qa-tester': {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['test', 'coverage', 'automation'],
    reportsTo: 'coo',
    receives: ['researcher'],
  },
  'deep-researcher': {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['research', 'document', 'brief'],
    reportsTo: 'cto',
    receives: [],
  },
  'devils-advocate': {
    tier: 'standard',
    routing: 'standard',
    capabilities: ['review', 'challenge', 'qualityGate'],
    reportsTo: 'coo',
    receives: [],
  },
  sentinel: {
    tier: 'opus',
    routing: 'opus',
    capabilities: ['securityAudit', 'veto', 'complianceCheck'],
    reportsTo: 'cto',
    receives: [],
  },
  documenter: {
    tier: 'flash',
    routing: 'flash',
    capabilities: ['document', 'changelog', 'retrospective'],
    reportsTo: 'coo',
    receives: [],
  },
  'token-auditor': {
    tier: 'flash',
    routing: 'flash',
    capabilities: ['tokenTrack', 'budgetAlert'],
    reportsTo: 'cfo',
    receives: [],
  },
  'api-cost-auditor': {
    tier: 'flash',
    routing: 'flash',
    capabilities: ['costTrack', 'anomalyDetect'],
    reportsTo: 'cfo',
    receives: [],
  },
  'project-auditor': {
    tier: 'flash',
    routing: 'flash',
    capabilities: ['retrospective', 'healthCheck', 'actionTrack'],
    reportsTo: 'coo',
    receives: [],
  },
};

// ─── Registry ───────────────────────────────────────────────────────────

export class AgentRegistry {

  constructor() {
    /** @type {Map<string, { role: object, config: object, instance: AgentBase|null }>} */
    this._agents = new Map();

    // Bootstrap from AGENT_ROLES
    AGENT_ROLES.forEach(role => {
      const config = ROLE_CONFIG[role.id] || {
        tier: 'standard',
        routing: 'standard',
        capabilities: [],
      };

      this._agents.set(role.id, {
        role,           // { id, icon, label }
        config,         // { tier, routing, capabilities, reportsTo, receives }
        instance: null, // Populated when agent is instantiated
      });
    });
  }

  /* ─── Lookup ───────────────────────────────────────────── */

  /**
   * Get a registered agent entry by role ID.
   * @param {string} roleId
   * @returns {{ role: object, config: object, instance: AgentBase|null } | undefined}
   */
  get(roleId) {
    return this._agents.get(roleId);
  }

  /**
   * Get all registered agents.
   * @returns {Array<{ role: object, config: object, instance: AgentBase|null }>}
   */
  getAll() {
    return [...this._agents.values()];
  }

  /**
   * Get agents filtered by model tier.
   * @param {'flash'|'standard'|'opus'} tier
   */
  getByTier(tier) {
    return this.getAll().filter(a => a.config.tier === tier);
  }

  /**
   * Get agents that report to a specific role.
   * @param {string} roleId
   */
  getDirectReports(roleId) {
    return this.getAll().filter(a => a.config.reportsTo === roleId);
  }

  /**
   * Get non-human, executable agents.
   */
  getExecutable() {
    return this.getAll().filter(a => !a.config.isHuman);
  }

  /**
   * Get agents that have a specific capability.
   * @param {string} capability
   */
  getByCapability(capability) {
    return this.getAll().filter(a => a.config.capabilities?.includes(capability));
  }

  /* ─── Instance Management ──────────────────────────────── */

  /**
   * Register a live agent instance.
   * @param {string} roleId
   * @param {AgentBase} instance
   */
  registerInstance(roleId, instance) {
    const entry = this._agents.get(roleId);
    if (!entry) {
      console.warn(`[AgentRegistry] Unknown role "${roleId}"`);
      return;
    }
    entry.instance = instance;
  }

  /**
   * Get a live agent instance by role ID.
   * @param {string} roleId
   * @returns {AgentBase|null}
   */
  getInstance(roleId) {
    return this._agents.get(roleId)?.instance || null;
  }

  /**
   * Clear all instances (between sessions).
   */
  clearInstances() {
    this._agents.forEach(entry => { entry.instance = null; });
  }

  /* ─── Reporting Structure ──────────────────────────────── */

  /**
   * Get the org chart as an adjacency list.
   * @returns {object} — { roleId: { reportsTo, directReports[] } }
   */
  getOrgChart() {
    const chart = {};
    this._agents.forEach((entry, id) => {
      chart[id] = {
        label: entry.role.label,
        icon: entry.role.icon,
        tier: entry.config.tier,
        reportsTo: entry.config.reportsTo || null,
        directReports: [],
      };
    });

    // Populate direct reports
    Object.entries(chart).forEach(([id, node]) => {
      if (node.reportsTo && chart[node.reportsTo]) {
        chart[node.reportsTo].directReports.push(id);
      }
    });

    return chart;
  }

  /**
   * Summary stats for display.
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      executable: this.getExecutable().length,
      byTier: {
        flash: this.getByTier('flash').length,
        standard: this.getByTier('standard').length,
        opus: this.getByTier('opus').length,
      },
      active: all.filter(a => a.instance !== null).length,
    };
  }
}
