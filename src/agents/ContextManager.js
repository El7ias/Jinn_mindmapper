/**
 * ContextManager — Per-agent context window management.
 *
 * Controls what information each agent sees based on their role,
 * visibility rules, and token budget constraints.
 *
 * Key concepts:
 *   - Each agent has a context budget (max tokens for their input)
 *   - Sentinel sees everything; Flash agents see minimal context
 *   - Older context is summarized/compressed when budget is exceeded
 *   - Project-wide context (mind map, architecture) is shared across all
 */

// ─── Token Budget per Tier ──────────────────────────────────────────────

const TIER_BUDGETS = {
  flash:    4000,    // minimal context — just the task
  standard: 12000,   // moderate context — task + relevant history
  opus:     32000,   // full context — deep reasoning needs broad view
};

// ─── Visibility Rules ───────────────────────────────────────────────────
// Which roles can see which types of information.

const VISIBILITY = {
  // Sentinel sees EVERYTHING — security requires full visibility
  sentinel: { all: true },

  // Project Auditor sees everything for retrospective analysis
  'project-auditor': { all: true },

  // COO sees operational data — not raw code
  coo: {
    allow: ['task', 'status', 'report', 'escalation', 'approval', 'broadcast', 'plan'],
    deny:  ['code'],
  },

  // CTO sees technical data + reports
  cto: {
    allow: ['task', 'code', 'architecture', 'report', 'security', 'broadcast', 'plan'],
    deny:  [],
  },

  // CFO sees financial data
  cfo: {
    allow: ['task', 'cost', 'report', 'budget', 'broadcast'],
    deny:  ['code', 'architecture'],
  },

  // Developers see code + tasks
  frontend: { allow: ['task', 'code', 'design', 'broadcast'], deny: [] },
  backend:  { allow: ['task', 'code', 'architecture', 'broadcast'], deny: [] },
  devops:   { allow: ['task', 'code', 'infra', 'broadcast'], deny: [] },

  // Default: see tasks and broadcasts
  _default: { allow: ['task', 'broadcast', 'report'], deny: [] },
};

// ─── ContextManager ─────────────────────────────────────────────────────

export class ContextManager {

  /**
   * @param {object} projectContext — shared project data
   * @param {string} projectContext.projectName
   * @param {string} projectContext.stack
   * @param {string[]} projectContext.features
   * @param {string[]} projectContext.constraints
   * @param {object} projectContext.architecture — architecture summary
   */
  constructor(projectContext = {}) {
    this._projectContext = projectContext;

    /** @type {Map<string, object[]>} roleId → context entries */
    this._agentContexts = new Map();

    /** @type {Map<string, string>} roleId → compressed summary of old context */
    this._summaries = new Map();
  }

  /* ─── Context Building ─────────────────────────────────── */

  /**
   * Build the full context for an agent about to execute a task.
   *
   * @param {string}   roleId          — the agent's role
   * @param {string}   tier            — model tier (flash/standard/opus)
   * @param {object}   task            — current task
   * @param {object[]} messageHistory  — from MessageBus
   * @returns {{ systemContext: string, taskContext: string, budget: number, used: number }}
   */
  buildContext(roleId, tier, task, messageHistory = []) {
    const budget = TIER_BUDGETS[tier] || TIER_BUDGETS.standard;

    // 1. Project context (shared across all agents)
    const projectBlock = this._buildProjectBlock();

    // 2. Filter messages by visibility rules
    const visibleMessages = this._filterByVisibility(roleId, messageHistory);

    // 3. Agent-specific accumulated context
    const agentSpecific = this._getAgentContext(roleId);

    // 4. Compressed summary of older context (if any)
    const summary = this._summaries.get(roleId) || '';

    // 5. Assemble within budget
    let context = '';
    let used = 0;

    // Project context always included (usually small)
    context += projectBlock;
    used += this._estimateTokens(projectBlock);

    // Add summary of older context
    if (summary && used + this._estimateTokens(summary) <= budget) {
      context += `\n## Prior Context Summary\n${summary}\n`;
      used += this._estimateTokens(summary);
    }

    // Add agent-specific context
    if (agentSpecific.length > 0) {
      const agentBlock = agentSpecific.map(e => `- ${e.content}`).join('\n');
      if (used + this._estimateTokens(agentBlock) <= budget) {
        context += `\n## Your Prior Notes\n${agentBlock}\n`;
        used += this._estimateTokens(agentBlock);
      }
    }

    // Add relevant messages (most recent first, within budget)
    const remainingBudget = budget - used - this._estimateTokens(task.description || '');
    const messageBudget = Math.max(0, remainingBudget - 500); // reserve 500 for task
    let messageBlock = '';
    let msgTokens = 0;

    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const msg = visibleMessages[i];
      const line = `[${msg.fromRole}→${msg.to}] ${msg.content}\n`;
      const lineTokens = this._estimateTokens(line);
      if (msgTokens + lineTokens > messageBudget) break;
      messageBlock = line + messageBlock;
      msgTokens += lineTokens;
    }

    if (messageBlock) {
      context += `\n## Team Communication\n${messageBlock}`;
      used += msgTokens;
    }

    return {
      systemContext: context,
      taskContext: task.description || '',
      budget,
      used,
    };
  }

  /* ─── Agent Context Accumulation ───────────────────────── */

  /**
   * Add context for a specific agent (e.g., from their prior responses).
   * @param {string} roleId
   * @param {string} content
   * @param {string} [category] — 'decision', 'finding', 'note'
   */
  addAgentContext(roleId, content, category = 'note') {
    if (!this._agentContexts.has(roleId)) {
      this._agentContexts.set(roleId, []);
    }

    const entries = this._agentContexts.get(roleId);
    entries.push({
      content,
      category,
      timestamp: Date.now(),
    });

    // Compress if too many entries
    if (entries.length > 20) {
      this._compressAgentContext(roleId);
    }
  }

  /**
   * Update the project context (e.g., after architecture decisions).
   * @param {object} updates — partial project context
   */
  updateProjectContext(updates) {
    Object.assign(this._projectContext, updates);
  }

  /**
   * Clear all agent contexts (between sessions).
   */
  clear() {
    this._agentContexts.clear();
    this._summaries.clear();
  }

  /* ─── Internal ─────────────────────────────────────────── */

  /**
   * Build the shared project context block.
   */
  _buildProjectBlock() {
    const ctx = this._projectContext;
    let block = '## Project Context\n';
    block += `Project: ${ctx.projectName || 'Unnamed'}\n`;
    if (ctx.stack) block += `Stack: ${ctx.stack}\n`;
    if (ctx.features?.length) {
      block += `Features: ${ctx.features.slice(0, 10).join(', ')}`;
      if (ctx.features.length > 10) block += ` (+${ctx.features.length - 10} more)`;
      block += '\n';
    }
    if (ctx.constraints?.length) {
      block += `Constraints: ${ctx.constraints.slice(0, 5).join(', ')}\n`;
    }
    return block;
  }

  /**
   * Filter messages by role visibility rules.
   */
  _filterByVisibility(roleId, messages) {
    const rules = VISIBILITY[roleId] || VISIBILITY._default;
    if (rules.all) return messages;

    return messages.filter(msg => {
      // Always visible if sent TO this role or @all
      if (msg.to === `@${roleId}` || msg.to === '@all') return true;

      // Check against allow/deny lists
      if (rules.deny?.includes(msg.type)) return false;
      if (rules.allow?.includes(msg.type)) return true;

      return false;
    });
  }

  /**
   * Get accumulated context for a specific agent.
   */
  _getAgentContext(roleId) {
    return this._agentContexts.get(roleId) || [];
  }

  /**
   * Compress older agent context entries into a summary.
   */
  _compressAgentContext(roleId) {
    const entries = this._agentContexts.get(roleId) || [];
    if (entries.length <= 10) return;

    // Keep the last 10 entries, compress the rest into a summary
    const toCompress = entries.slice(0, entries.length - 10);
    const toKeep = entries.slice(-10);

    const summary = toCompress
      .map(e => `[${e.category}] ${e.content.substring(0, 100)}`)
      .join(' | ');

    const existing = this._summaries.get(roleId) || '';
    this._summaries.set(roleId,
      existing
        ? `${existing}\n---\n${summary}`
        : summary
    );

    this._agentContexts.set(roleId, toKeep);
  }

  /**
   * Rough token estimation (4 chars ≈ 1 token).
   */
  _estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  }
}
