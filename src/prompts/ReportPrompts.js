/**
 * ReportPrompts — CEO report prompt templates and map summarization.
 *
 * Extracted from main.js to keep the entry point lean.
 * Provides:
 *   - buildReportPrompt(type, label, serialized) → prompt string
 *   - summarizeMap(serialized) → factual data block string
 */

// ─── Map Summary Builder ─────────────────────────────────────────────

/**
 * Build a comprehensive, factual data block from a serialized mind map.
 * Provides ONLY observable facts — no estimates, no projections.
 * @param {object} serialized
 * @returns {string}
 */
export function summarizeMap(serialized) {
  const lines = [];
  const nodes = serialized.nodes || [];
  const conns = serialized.connections || [];

  // ── Project identity ──
  if (serialized.projectName) lines.push(`**Project Name**: ${serialized.projectName}`);
  if (serialized.ceoVision) lines.push(`**Vision Statement**: ${serialized.ceoVision}`);

  // ── Structural metrics ──
  lines.push(`\n### Observable Metrics`);
  lines.push(`- **Total Nodes**: ${nodes.length}`);
  lines.push(`- **Total Connections**: ${conns.length}`);

  // Node type breakdown
  const typeCounts = {};
  const priorityCounts = {};
  const phaseCounts = {};
  const agentStatuses = {};
  const commerceNodes = [];

  for (const n of nodes) {
    const t = n.nodeType || 'general';
    typeCounts[t] = (typeCounts[t] || 0) + 1;

    const p = n.priority || 'medium';
    priorityCounts[p] = (priorityCounts[p] || 0) + 1;

    if (n.phase != null) {
      phaseCounts[n.phase] = (phaseCounts[n.phase] || 0) + 1;
    }

    if (n.agentStatus && n.agentStatus !== 'unassigned') {
      agentStatuses[n.agentStatus] = (agentStatuses[n.agentStatus] || 0) + 1;
    }

    if (n.commerceType) {
      const hasCredentials = n.credentials && Object.keys(n.credentials).length > 0;
      commerceNodes.push({
        type: n.commerceType,
        text: n.text,
        configured: hasCredentials,
      });
    }
  }

  // Node types
  if (Object.keys(typeCounts).length > 0) {
    lines.push(`- **Node Types**: ${Object.entries(typeCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  }

  // Priority distribution
  if (Object.keys(priorityCounts).length > 0) {
    lines.push(`- **Priority Distribution**: ${Object.entries(priorityCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  }

  // Phase distribution
  if (Object.keys(phaseCounts).length > 0) {
    lines.push(`- **Phase Assignment**: ${Object.entries(phaseCounts).map(([k, v]) => `Phase ${k}: ${v} nodes`).join(', ')}`);
  }

  // Agent status
  if (Object.keys(agentStatuses).length > 0) {
    lines.push(`- **Agent Work Status**: ${Object.entries(agentStatuses).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  } else {
    lines.push(`- **Agent Work Status**: No agent work has been assigned yet`);
  }

  // Commerce integrations
  if (commerceNodes.length > 0) {
    lines.push(`\n### Commerce Integrations (${commerceNodes.length})`);
    for (const c of commerceNodes) {
      lines.push(`- **${c.text}** [${c.type}] — ${c.configured ? '✅ credentials configured' : '⚠️ unconfigured'}`);
    }
  }

  // ── Node hierarchy ──
  const topNodes = nodes.filter(n => !conns.some(c => c.toId === n.id));

  lines.push(`\n### Node Inventory`);
  if (topNodes.length > 0) {
    lines.push(`**Root/Top-Level Nodes (${topNodes.length}):**`);
    for (const n of topNodes.slice(0, 20)) {
      const meta = [];
      if (n.nodeType && n.nodeType !== 'general') meta.push(n.nodeType);
      if (n.priority && n.priority !== 'medium') meta.push(n.priority);
      if (n.commerceType) meta.push(n.commerceType);
      const tag = meta.length ? ` [${meta.join(', ')}]` : '';
      lines.push(`- ${n.text || '(untitled)'}${tag}`);
    }
    if (topNodes.length > 20) lines.push(`- ... and ${topNodes.length - 20} more`);
  }

  // ── What data does NOT exist ──
  lines.push(`\n### Data NOT Available (Do Not Fabricate)`);
  lines.push(`- No revenue data, sales figures, or product pricing`);
  lines.push(`- No actual API usage metrics or token consumption logs`);
  lines.push(`- No human labor hours — this project uses AI agents, not human developers`);
  lines.push(`- No deployment history or production environment data`);
  lines.push(`- No user analytics, customer data, or market research`);
  lines.push(`- No git history, commit counts, or development velocity data`);

  return lines.join('\n');
}

// ─── Actions Instruction Block ───────────────────────────────────────

const ACTIONS_INSTRUCTION = `

## ⚡ Required: Actionable Recommendations (CRITICAL)

At the **very end** of your report, you MUST include an actions block in this exact format:

\`\`\`json:actions
[
  {
    "title": "Short action title",
    "nodeType": "feature",
    "priority": "high",
    "parent": "Name of existing node to connect to, or null",
    "description": "What needs to be done and why",
    "phase": 1
  }
]
\`\`\`

Rules for the actions block:
- nodeType must be one of: feature, constraint, milestone, reference, risk, techNote, general
- priority must be one of: critical, high, medium, low
- parent should match the text of an existing node from the mind map (case-insensitive), or null if standalone
- Include 5-15 actionable recommendations, ordered by priority
- Each recommendation should be specific and implementable as a project node
- phase is a number (1 = immediate, 2 = next sprint, 3 = future)`;

// ─── Report Template Builder ─────────────────────────────────────────

/**
 * Build a role-specific report prompt from a report type, label, and serialized mind map.
 *
 * @param {string} type    — report type key (e.g., 'bug-audit', 'cfo-report')
 * @param {string} label   — human-readable label for the report
 * @param {object} serialized — output of serializeMindMap()
 * @returns {string|null}  — prompt string, or null if type is unknown
 */
export function buildReportPrompt(type, label, serialized) {
  const mapSummary = summarizeMap(serialized);

  const REPORT_TEMPLATES = {
    'bug-audit': {
      role: 'Devil\'s Advocate + QA Agent',
      icon: '🔍',
      prompt: `# ${label}

## ⛔ GROUNDING RULES (MANDATORY)
- You may ONLY reference nodes, types, connections, and structures described in the Project Context below.
- Do NOT invent file names, class names, or code paths that are not listed in the node inventory.
- If you lack data to assess something, say "⚠️ INSUFFICIENT DATA — [what's missing]".
- Every finding MUST reference a specific node or structural pattern from the provided data.

## Your Role
You are the **Devil's Advocate** and **QA Agent**. Identify structural risks, missing elements, logic gaps, and architectural weaknesses **based on what the mind map reveals**.

## Project Context
${mapSummary}

## Audit Criteria (based on observable data only)
1. **Structural Gaps**: Missing node connections, orphaned nodes, disconnected branches
2. **Type Imbalances**: Too many features without constraints/risks? Missing milestones?
3. **Priority Issues**: Critical items without parent connections? Mismatched priorities?
4. **Missing Concerns**: Security nodes absent? No testing strategy nodes? No error handling?
5. **Commerce Gaps**: Unconfigured integrations? Missing payment/checkout flow nodes?
6. **Scope Risks**: Feature creep signals, unclear boundaries, vague node labels

## Output Format
Produce a structured markdown report:
- **Critical** (🔴) — structural gaps that block progress
- **Major** (🟠) — significant missing elements
- **Minor** (🟡) — improvements to project structure
- **Suggestions** (🟢) — enhancements

For each finding: title, which node(s) it relates to, why it matters, what to add.${ACTIONS_INSTRUCTION}`,
    },

    'project-audit': {
      role: 'Project Auditor',
      icon: '📋',
      prompt: `# ${label}

## ⛔ GROUNDING RULES (MANDATORY)
- You may ONLY analyze what exists in the Project Context below — nodes, connections, types, priorities.
- Do NOT fabricate completion percentages, timelines, or progress metrics that are not directly observable.
- If a node has no status/phase data, state "status unknown" — do not assume it's complete or incomplete.
- Mark any estimate clearly with "📊 ESTIMATE:" prefix.

## Your Role
You are the **Project Auditor**. Assess project structure, completeness, and readiness based strictly on the mind map topology.

## Project Context
${mapSummary}

## Audit Criteria (observable only)
1. **Structural Completeness**: Do major features have sub-nodes? Are constraint/risk nodes present?
2. **Connection Health**: Are there orphaned nodes? Broken chains? Missing parent-child relationships?
3. **Coverage Analysis**: Which node types are represented? Which are missing entirely?
4. **Phase Readiness**: If phases are assigned, is the distribution balanced? Are dependencies in order?
5. **Agent Readiness**: Are nodes assigned to agents? What's the assignment coverage?
6. **Commerce Readiness**: Are commerce integrations configured? What's missing for launch?

## Output Format
Produce a structured markdown report:
- **Executive Summary**: 1 paragraph of factual observations only
- **Structure Matrix**: node type → count, with gap analysis
- **Readiness Assessment**: green/yellow/red based strictly on observable node data
- **Missing Elements**: what needs to be added (as concrete node recommendations)${ACTIONS_INSTRUCTION}`,
    },

    'cfo-report': {
      role: 'Chief Financial Officer — Agent Cost Optimizer',
      icon: '💰',
      prompt: (() => {
        // Pull real cost history from localStorage
        let costHistorySection = '';
        try {
          const raw = localStorage.getItem('mindmapper_cost_history');
          const history = raw ? JSON.parse(raw) : [];
          if (history.length > 0) {
            const totalSpent = history.reduce((s, h) => s + (h.totalCost || 0), 0);
            const totalTokens = history.reduce((s, h) => s + (h.totalTokens || 0), 0);
            const avgCost = totalSpent / history.length;
            const mostExpensive = [...history].sort((a, b) => (b.totalCost || 0) - (a.totalCost || 0))[0];
            costHistorySection = `
### 📊 REAL Cost Data — ${history.length} Sessions Recorded
- **Total API Spend (all time)**: $${totalSpent.toFixed(2)}
- **Total Tokens Consumed**: ${totalTokens.toLocaleString()}
- **Average Cost Per Session**: $${avgCost.toFixed(2)}
- **Most Expensive Session**: $${(mostExpensive.totalCost || 0).toFixed(2)} (${(mostExpensive.totalTokens || 0).toLocaleString()} tokens, model: ${mostExpensive.model || 'unknown'})
- **Sessions by Model**: ${Object.entries(history.reduce((acc, h) => { acc[h.model || 'unknown'] = (acc[h.model || 'unknown'] || 0) + 1; return acc; }, {})).map(([m,c]) => m + ': ' + c).join(', ')}
- **Input vs Output Token Ratio**: ${history.reduce((s, h) => s + (h.inputTokens || 0), 0).toLocaleString()} input / ${history.reduce((s, h) => s + (h.outputTokens || 0), 0).toLocaleString()} output`;
          } else {
            costHistorySection = `
### 📊 Cost Data
⚠️ No session cost history recorded yet. This is the first run or localStorage was cleared.
Estimates below will use published API pricing rates.`;
          }
        } catch {
          costHistorySection = `
### 📊 Cost Data
⚠️ Unable to read cost history from storage.`;
        }

        return `# ${label}

## ⛔ GROUNDING RULES (MANDATORY)
- You HAVE real cost data below — use it. Do NOT ignore it or replace it with hypothetical numbers.
- Financial projections ARE encouraged, but ONLY when derived from the real session data and published API pricing.
- 🚫 Do NOT estimate human labor costs — this project is built by AI AGENTS, not human developers.
- ✅ You MAY project costs based on real session data × expected usage patterns.
- ✅ You MAY estimate savings from optimization strategies — but show your math.
- ✅ Label all projections with "📊 PROJECTED:" and show the calculation.

## Your Role — CFO: Cost vs. Quality Optimizer
You are the **Chief Financial Officer**. Your PRIMARY job is to **balance API costs against the quality of agent output**. Every AI agent session costs real tokens — your job is to make sure we're getting maximum value per dollar spent.

You must answer the core question: **"How do we maximize the quality of agent output while minimizing the cost?"**

## API Pricing Reference (per 1M tokens, USD)
| Model | Input | Output |
|-------|-------|--------|
| Claude Sonnet 4 | $3.00 | $15.00 |
| Claude 3.5 Haiku | $0.80 | $4.00 |
| Claude 3 Haiku | $0.25 | $1.25 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o-mini | $0.15 | $0.60 |
${costHistorySection}

## Project Context
${mapSummary}

## Required Analysis
### 1. 💸 Current Burn Rate Analysis
Using the REAL session data above, calculate:
- Cost per report type (estimate based on token counts)
- Projected monthly cost at different usage levels (5/10/25/50 reports per week)
- Input-to-output token ratio analysis — are prompts too large? Are responses too verbose?

### 2. ⚖️ Cost vs. Quality Balance Scheme
Design a **model tiering strategy** that matches task complexity to model cost:
- Which reports/tasks justify premium models (Sonnet 4, GPT-4o)?
- Which can use cheaper models (Haiku, GPT-4o-mini) with acceptable quality?
- What quality signals should trigger upgrading to a better model?

### 3. 💰 Optimization Opportunities  
Propose specific cost reduction strategies with estimated savings:
- **Prompt Compression**: Can the map summary be smaller without losing quality?
- **Response Caps**: Should max_tokens be tuned per report type?
- **Caching**: Can repeated analyses cache results instead of re-querying?
- **Batching**: Can multiple report types share a single, longer session?

### 4. 📈 Cost Projection — Your Balance Scheme
Provide a clear estimate:
- What will your proposed optimization scheme **cost to implement** (in additional engineering agent sessions)?
- What will it **save per month** once running?
- What's the break-even point?
- Show the math using the real pricing data above.

### 5. 🚨 Financial Risk Flags
- Token cost spikes from prompt size growth
- Model deprecation risks
- API rate limit or quota concerns
- Runaway cost scenarios (e.g., agent loops)

## Output Format
Produce a structured markdown report:
- **Executive Summary** — one paragraph, key numbers, primary recommendation
- **Burn Rate Analysis** — real data, projections with math shown
- **Model Tiering Strategy** — table of task → recommended model → reason
- **Cost Optimization Plan** — specific strategies with projected savings
- **Balance Scheme Cost Estimate** — implementation cost, monthly savings, ROI
- **Financial Risk Register** — top 3-5 risks with mitigation${ACTIONS_INSTRUCTION}`;
      })(),
    },

    'coo-report': {
      role: 'Chief Operating Officer',
      icon: '📊',
      prompt: `# ${label}

## ⛔ GROUNDING RULES (MANDATORY)
- Do NOT fabricate sprint velocities, deployment frequencies, or team metrics.
- Do NOT reference human team members — operations are run by AI agents.
- You may ONLY analyze the operational structure visible in the mind map data below.
- If operational data is missing, explicitly state what's missing instead of inventing metrics.
- Mark any estimate with "📊 ESTIMATE:" prefix.

## Your Role
You are the **COO**. Assess operational readiness and delivery pipeline health based on the mind map structure. Operations in this project are **AI agent-driven**, not human-driven.

## Project Context
${mapSummary}

## Analysis Criteria (observable only)
1. **Agent Pipeline**: Which agent roles are defined? What's the orchestration flow?
2. **Workflow Coverage**: Are all phases of work represented? (planning → build → test → deploy)
3. **Operational Gaps**: Missing process nodes? No CI/CD? No testing strategy? No deployment plan?
4. **Dependency Analysis**: What blocks what? Are there circular dependencies? Missing prerequisites?
5. **Risk Register**: Based on node structure — what operational risks are visible? (e.g., single points of failure, unconfigured integrations)
6. **Launch Readiness**: Based on node completeness, how ready is the project structure for execution?

## Output Format
Produce a structured markdown report:
- **Operations Overview** (factual structure assessment)
- **Agent Pipeline Analysis** (what exists vs. what's missing)
- **Operational Gaps** (specific missing nodes/processes)
- **Risk Register** (only risks derivable from the data)
- **Launch Readiness Checklist** (concrete, actionable items)${ACTIONS_INSTRUCTION}`,
    },

    'cto-report': {
      role: 'Chief Technology Officer',
      icon: '🏗️',
      prompt: `# ${label}

## ⛔ GROUNDING RULES (MANDATORY)
- Analyze ONLY the technical architecture visible in the mind map nodes.
- Do NOT fabricate code metrics, test coverage percentages, or performance benchmarks.
- If technical details are missing from the mind map, state what's missing.
- Base your assessment on node types, connections, and labels — not assumptions about implementation.
- Mark any inference with "🔍 INFERRED:" prefix.

## Your Role
You are the **CTO**. Evaluate the technical architecture, technology choices, and engineering structure based on what the mind map reveals. This project uses **AI agents for development**, not traditional human dev teams.

## Project Context
${mapSummary}

## Analysis Criteria (observable only)
1. **Architecture Assessment**: What does the node structure reveal about system architecture?
2. **Technology Stack**: What technologies are mentioned in node labels? Are choices appropriate?
3. **Technical Coverage**: Are there nodes for: API design, data models, security, testing, deployment?
4. **Scalability Indicators**: Does the structure suggest scaling concerns? Missing infrastructure nodes?
5. **Technical Debt Risks**: Structural patterns that suggest future debt (too many features, no constraints)
6. **Security Posture**: Are there security-related nodes? Authentication? Data protection?

## Output Format
Produce a structured markdown report:
- **Architecture Overview** (based on node topology)
- **Tech Stack Assessment** (what's defined vs. what's missing)
- **Technical Gaps** (specific missing technical nodes)
- **Security Assessment** (based on present/absent security nodes)
- **Recommendations** (what technical nodes to add)${ACTIONS_INSTRUCTION}`,
    },
  };

  const template = REPORT_TEMPLATES[type];
  if (!template) return null;

  return template.prompt;
}
