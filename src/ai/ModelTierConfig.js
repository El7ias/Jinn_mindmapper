/**
 * ModelTierConfig — Three-tier model hierarchy for cost-optimized agentic operations.
 *
 * Tier 1 (FLASH) — Free/cheapest models for unthinking, mechanical tasks
 *   Heartbeats, idle checks, status pings, simple formatting, layout generation,
 *   template rendering, file listing, basic validation
 *
 * Tier 2 (STANDARD) — Mid-range models for clear thinking tasks
 *   Code review, documentation, structured analysis, test generation,
 *   refactoring suggestions, dependency analysis, progress summaries
 *
 * Tier 3 (OPUS) — Premium "thinking" models for hard agentic work
 *   Architecture decisions, complex multi-file implementation, debugging obscure issues,
 *   security audits, creative problem-solving, cross-system integration,
 *   critical decision-making that requires deep reasoning
 *
 * Philosophy: "Don't bring a bazooka to a pillow fight."
 * The system should automatically route each sub-task to the cheapest model
 * capable of handling it correctly. Reserve the heavy artillery for tasks
 * that genuinely require it.
 */

// ─── Tier Definitions ────────────────────────────────────────────────

export const MODEL_TIERS = {
  flash: {
    id: 'flash',
    name: 'Tier 1 — Flash',
    description: 'Cheapest/free models for mechanical, unthinking tasks',
    philosophy: 'No reasoning needed — just follow the pattern.',
    costProfile: 'Near-zero (~$0.001 per call)',
    models: {
      google:   'gemini-2.0-flash-lite',
      openai:   'gpt-4o-mini',
      anthropic: 'claude-haiku-3-20250307',
    },
    tasks: [
      'Heartbeat checks — periodic "still alive" pings',
      'Idle state monitoring — agent status polling',
      'File listing and directory scanning',
      'Simple string formatting and template rendering',
      'Mind map layout generation from structured data',
      'JSON schema validation',
      'Log aggregation and basic filtering',
      'Timestamp and metadata generation',
      'Status report compilation (no analysis)',
      'Boilerplate scaffolding from templates',
    ],
    criteria: [
      'Task has a fixed, well-defined pattern',
      'Output is deterministic or near-deterministic',
      'No creative judgment or ambiguity resolution needed',
      'Can be validated with simple rules (regex, schema, etc.)',
    ],
  },

  standard: {
    id: 'standard',
    name: 'Tier 2 — Standard',
    description: 'Mid-range models for clear thinking and structured analysis',
    philosophy: 'Thinking required, but the path is clear.',
    costProfile: 'Moderate (~$0.01-0.05 per call)',
    models: {
      google:    'gemini-2.0-flash',
      openai:    'gpt-4o',
      anthropic:  'claude-sonnet-4-20250514',
    },
    tasks: [
      'Code review with feedback generation',
      'Documentation writing and API reference generation',
      'Test case generation from specifications',
      'Dependency analysis and impact assessment',
      'Refactoring suggestions with rationale',
      'Progress report analysis and summaries',
      'Error message interpretation and fix suggestions',
      'Configuration file generation from requirements',
      'Sprint planning and task decomposition',
      'QC pass — style, lint, and pattern compliance checks',
    ],
    criteria: [
      'Task requires understanding context and making judgments',
      'Output needs to be coherent and well-reasoned',
      'Multiple valid approaches exist but the domain is well-understood',
      'Moderate complexity — not trivial, not groundbreaking',
    ],
  },

  opus: {
    id: 'opus',
    name: 'Tier 3 — Opus',
    description: 'Premium thinking models for hard agentic work requiring deep reasoning',
    philosophy: 'The hard problems. The ones that keep CTOs up at night.',
    costProfile: 'Premium (~$0.10-0.50+ per call)',
    models: {
      anthropic: 'claude-opus-4-20250514',
      openai:    'o3',
      google:    'gemini-2.5-pro',
    },
    tasks: [
      'System architecture design and decisions',
      'Complex multi-file implementation with cross-cutting concerns',
      'Debugging obscure, hard-to-reproduce issues',
      'Security audits and vulnerability analysis',
      'Performance optimization with profiling analysis',
      'Creative problem-solving for novel requirements',
      'Cross-system integration design',
      'Critical decision-making with trade-off analysis',
      'Algorithm design and optimization',
      'Large-scale refactoring with state preservation',
    ],
    criteria: [
      'Task has genuine ambiguity requiring deep reasoning',
      'Wrong answers have significant consequences',
      'Multiple systems or concerns must be held in context simultaneously',
      'Creative synthesis or novel solutions are needed',
      'The problem space is large and interconnected',
    ],
  },
};

// ─── Tier Resolution ─────────────────────────────────────────────────

/**
 * Get the recommended tier for a given task type.
 * Falls back to 'standard' if no clear match.
 */
export function getRecommendedTier(taskType) {
  const taskLower = (taskType || '').toLowerCase();

  // Tier 1 keywords
  const flashKeywords = [
    'heartbeat', 'ping', 'status', 'idle', 'format', 'template',
    'scaffold', 'boilerplate', 'list', 'scan', 'validate', 'schema',
    'log', 'timestamp', 'metadata', 'layout', 'render',
  ];
  if (flashKeywords.some(k => taskLower.includes(k))) {
    return MODEL_TIERS.flash;
  }

  // Tier 3 keywords
  const opusKeywords = [
    'architect', 'design', 'debug', 'security', 'audit', 'performance',
    'optimize', 'creative', 'integration', 'critical', 'algorithm',
    'refactor', 'complex', 'novel', 'trade-off', 'vulnerability',
  ];
  if (opusKeywords.some(k => taskLower.includes(k))) {
    return MODEL_TIERS.opus;
  }

  // Default to Standard
  return MODEL_TIERS.standard;
}

/**
 * Get the model for a specific tier and provider.
 */
export function getModelForTier(tierKey, provider = 'anthropic') {
  const tier = MODEL_TIERS[tierKey];
  if (!tier) return null;
  return tier.models[provider] || Object.values(tier.models)[0];
}

/**
 * Generate the model routing section for embedding in workflow prompts.
 * This tells Claude Code agents which models to use for which tasks.
 */
export function generateModelRoutingPrompt() {
  return {
    model_routing: {
      philosophy: 'Cost-optimized intelligence: use the cheapest model capable of handling each sub-task correctly. Never bring a bazooka to a pillow fight.',
      tiers: Object.values(MODEL_TIERS).map(tier => ({
        tier: tier.id,
        name: tier.name,
        description: tier.description,
        philosophy: tier.philosophy,
        cost_profile: tier.costProfile,
        recommended_models: tier.models,
        task_types: tier.tasks,
        selection_criteria: tier.criteria,
      })),
      routing_rules: [
        'DEFAULT to Tier 1 (Flash) unless the task explicitly requires reasoning.',
        'ESCALATE to Tier 2 (Standard) when the task needs contextual understanding or judgment calls.',
        'RESERVE Tier 3 (Opus) for architecture decisions, complex debugging, security audits, and novel problem-solving.',
        'When in doubt, start with the lower tier — escalate only if the output quality is insufficient.',
        'Heartbeats, status checks, and idle monitoring MUST use Tier 1. No exceptions.',
        'Agent coordination messages (task assignment, progress updates) use Tier 1.',
        'Code generation for well-defined specs uses Tier 2. Ambiguous specs escalate to Tier 3.',
        'All security-critical decisions MUST use Tier 3.',
      ],
      cost_tracking: {
        log_every_call: true,
        track_tier_usage: true,
        alert_threshold: 'Flag if Tier 3 usage exceeds 20% of total calls — likely indicates over-escalation.',
        budget_allocation: '~70% Flash, ~25% Standard, ~5% Opus by call volume',
      },
    },
  };
}

// ─── Quick Access ────────────────────────────────────────────────────

export const FLASH = MODEL_TIERS.flash;
export const STANDARD = MODEL_TIERS.standard;
export const OPUS = MODEL_TIERS.opus;
