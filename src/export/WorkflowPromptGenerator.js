/**
 * WorkflowPromptGenerator — Transforms serialized mind map data into a
 * Claude Code workflow prompt document.
 * 
 * This is the second stage of the pipeline:
 *   Canvas → MindMapSerializer → WorkflowPromptGenerator → Claude Code
 * 
 * Generates a complete orchestration prompt modeled after Orchestrator.md,
 * dynamically built from the user's mind map. The output is a markdown
 * document containing a JSON task definition that Claude Opus 4.6 can
 * execute in planning/agent mode with a virtual team.
 */

import { AGENT_ROLES } from '../nodes/NodeManager.js';
import { generateModelRoutingPrompt, MODEL_TIERS } from '../ai/ModelTierConfig.js';

/**
 * Generate a complete Claude Code workflow prompt from serialized mind map data
 * 
 * @param {import('./MindMapSerializer.js').SerializedMindMap} data - Serialized mind map
 * @param {object} options - Generation options
 * @param {string} [options.model] - Target model (default: 'claude-4.6')
 * @param {string} [options.mode] - Execution mode (default: 'planning')
 * @param {string[]} [options.allowedTools] - Tools available in the IDE
 * @param {string} [options.stack] - Preferred tech stack
 * @returns {string} Complete markdown workflow prompt
 */
export function generateWorkflowPrompt(data, options = {}) {
  const model = options.model || 'claude-4.6';
  const mode = options.mode || 'planning';
  const stack = options.stack || _inferStack(data);
  const compact = options.compact || false;

  const taskDef = _buildTaskDefinition(data, { model, mode, stack, compact, ...options });
  const markdown = _formatAsMarkdown(taskDef, data, { compact });

  return markdown;
}

/**
 * Build the JSON task definition object
 */
function _buildTaskDefinition(data, options) {
  const routing = generateModelRoutingPrompt();

  return {
    task_title: `${data.projectName} — Autonomous Build with Virtual Agent Team`,
    model: options.model,
    mode: options.mode,
    goal: _buildGoal(data),
    ...routing,
    workspace_instructions: options.workspaceInstructions || _buildWorkspaceInstructions(options),
    virtual_team: options.compact ? _buildCompactVirtualTeam(data) : _buildVirtualTeam(data),
    project_context: _buildProjectContext(data, options),
    execution_strategy: _buildExecutionStrategy(data),
    deliverables: _buildDeliverables(data),
    constraints_and_style: _buildConstraints(data),
  };
}

// ─── Goal Builder ─────────────────────────────────────────────────────

function _buildGoal(data) {
  let goal = `Act as a single orchestrating super-agent that internally simulates a full executive team (CEO/user, COO, CTO, CFO, Creative Director, Sentinel, and specialist agents) to design, implement, document, and harden "${data.projectName}"`;

  if (data.ceoVision) {
    goal += `. CEO Vision: ${data.ceoVision}`;
  }

  // Summarize what the mind map contains
  const parts = [];
  if (data.stats.featureCount > 0) parts.push(`${data.stats.featureCount} feature(s)`);
  if (data.stats.constraintCount > 0) parts.push(`${data.stats.constraintCount} constraint(s)`);
  if (data.stats.riskCount > 0) parts.push(`${data.stats.riskCount} identified risk(s)`);
  if (parts.length > 0) {
    goal += `. The product mind map defines: ${parts.join(', ')}.`;
  }

  goal += ` All team members must be engaged in discussion from kickoff through deliverable. Sentinel provides continuous security (not just final audit). Creative Director ensures exceptional UI/UX at every milestone. CFO tracks costs. Maintain near-autonomous execution inside the IDE.`;

  return goal;
}

// ─── Workspace Instructions ────────────────────────────────────────────

function _buildWorkspaceInstructions(options) {
  return {
    codebase_scope: "Use the current workspace as the canonical project root. Inspect existing files, package configuration, and any docs to align architecture and naming.",
    preferred_stack: options.stack || "Determine from existing project files or ask user.",
    allowed_tools: options.allowedTools || [
      "editor_read_write",
      "terminal",
      "browser_preview",
      "git"
    ],
    general_policies: [
      "Prefer iterative plans and small, reviewable patches over large monolithic edits.",
      "Keep all design and technical decisions documented in /docs.",
      "Before executing potentially destructive changes (deletes, mass refactors), restate your plan and confirm with the user if the risk is high.",
      "Run builds and tests after each significant change to catch regressions early."
    ]
  };
}

// ─── Compact Virtual Team Builder ───────────────────────────────────────
// Compressed version of _buildVirtualTeam for P2.3 prompt streamlining.
// Reduces ~530 lines of role definitions to ~60 lines of essentials.

function _buildCompactVirtualTeam(_data) {
  return {
    _protocol: {
      principle: "Full executive-managed project with ALL 15 roles active from kickoff through deliverable. No silent handoffs — every role engaged, every milestone.",
      reporting: "CEO ← COO ← [DA, DevOps, QA, Documenter, CD]. CTO ← [CFO, Sentinel, Researcher, Backend]. CFO ← Auditors. Auditor escalations → full exec suite.",
      communication: "Agents have ONGOING conversations, not just milestone checkpoints. Cross-functional discussions captured in /docs/decisions.md."
    },
    roles: {
      ceo:       { routing: 'human',    summary: 'The USER. Product visionary. Approves final deliverables.' },
      coo:       { routing: 'standard', summary: 'Operational command. Translates vision → milestones → sprints. Converts DA findings into agent-specific task lists. Receives deployment and QA reports.' },
      cto:       { routing: 'opus',     summary: 'Architecture owner. Framework & infra decisions. Receives CFO budget reports, Sentinel advisories, Researcher briefings.' },
      cfo:       { routing: 'standard', summary: 'Budget guardian. Tracks cost/token by role & tier. Reports refinements to CTO. Receives audit data.' },
      creative:  { routing: 'opus',     summary: 'Design authority. Owns UI/UX vision, typography, motion, accessibility. Reviews ALL visual output.' },
      frontend:  { routing: 'standard', summary: 'Implements UI. Reports to Creative Director. Receives docs from Researcher.' },
      backend:   { routing: 'standard', summary: 'Implements APIs, data, auth. Reports to CTO.' },
      devops:    { routing: 'standard', summary: 'CI/CD, infra, deployment. Reports readiness to COO at every milestone.' },
      qa:        { routing: 'standard', summary: 'Writes tests alongside features. Reports coverage to COO.' },
      researcher:{ routing: 'standard', summary: 'Front-loads knowledge. Pushes task-specific docs to EACH agent proactively.' },
      da:        { routing: 'standard', summary: 'Devil\'s Advocate. Reviews ALL output. Reports quality findings to COO for taskification.' },
      sentinel:  { routing: 'opus',     summary: 'Security officer. Continuous audit of auth, data, deps. Has veto power. Reports to CTO.' },
      documenter:{ routing: 'flash',    summary: 'Captures decisions, artifacts, retrospectives from all agents.' },
      auditors:  { routing: 'flash',    summary: 'Token Auditor + Project Auditor. Budget tracking & milestone retrospectives → exec suite.' }
    }
  };
}

// ─── Description Truncation (P2.3) ──────────────────────────────────────

const MAX_DESCRIPTION_LENGTH = 150;

/**
 * Truncate verbose node descriptions for prompt compression
 */
function _truncateDescription(text) {
  if (!text || text.length <= MAX_DESCRIPTION_LENGTH) return text;
  return text.substring(0, MAX_DESCRIPTION_LENGTH).replace(/\s+\S*$/, '') + '…';
}

// ─── Virtual Team Builder ──────────────────────────────────────────────
// Full roster mirrors AGENT_ROLES in NodeManager.js.
// Each role carries internal routing hints consumed by the executing agent;
// these are opaque to the MindMapper end user.

function _buildVirtualTeam(data) {
  const team = {};

  // ── Team Collaboration Protocol ─────────────────────────────────────
  // Defines HOW the team works together — not just individual roles.
  team._collaboration_protocol = {
    principle: "This is a full executive-managed project. The CEO (user) has delegated execution to this virtual team. EVERY role must be engaged and in active discussion from project kickoff through final deliverable. No silent handoffs. No passengers. If a role has nothing to flag, they confirm 'clear' — silence is never acceptable.",
    full_engagement_mandate: "ALL 15 roles are active participants in EVERY project, EVERY milestone, EVERY review. No role sits idle. The Deep Researcher front-loads knowledge before build begins. DevOps sets up infrastructure in parallel with development. QA writes tests alongside features, not after. This is a simultaneous, coordinated operation — not a relay race.",

    // ── Formal Reporting Structure (Org Chart) ─────────────────────────
    reporting_structure: {
      description: "Clear chain of command — every agent knows who they report to, who reports to them, and how information flows.",
      lines: {
        ceo: { reports_to: 'none (top of chain)', receives_from: ['coo'], note: 'CEO receives executive summaries from COO only. Does not receive direct reports from individual agents.' },
        coo: { reports_to: 'ceo', receives_from: ['devils_advocate', 'devops', 'all_agents_status'], note: 'COO is the operational hub. Receives DA quality findings and creates AGENT-SPECIFIC task lists for each agent to review and implement. Receives DevOps deployment readiness reports every milestone.' },
        cto: { reports_to: 'ceo (via coo)', receives_from: ['cfo', 'sentinel', 'deep_researcher'], note: 'CTO receives CFO budget refinement reports and implements cost-quality optimizations. Receives Sentinel security advisories and Deep Researcher tech briefings.' },
        cfo: { reports_to: 'cto', receives_from: ['auditors'], note: 'CFO reports budget refinements TO CTO for implementation approval. Receives cost/token data from auditor sub-roles.' },
        creative_director: { reports_to: 'coo', receives_from: ['frontend'], note: 'Creative Director guides frontend implementation and reviews all visual output.' },
        frontend: { reports_to: 'creative_director', receives_from: ['deep_researcher'], note: 'Receives task-specific documentation from Deep Researcher.' },
        backend: { reports_to: 'cto', receives_from: ['deep_researcher'], note: 'Receives task-specific API/SDK documentation from Deep Researcher.' },
        devops: { reports_to: 'coo', receives_from: ['deep_researcher'], note: 'Reports deployment readiness to COO at EVERY milestone. Receives infrastructure docs from Deep Researcher.' },
        qa_tester: { reports_to: 'coo', receives_from: ['deep_researcher'], note: 'Receives testing framework docs from Deep Researcher. Reports test coverage to COO.' },
        deep_researcher: { reports_to: 'cto', receives_from: [], note: 'Routes task-specific documentation to EACH agent individually. Every agent should be an expert in their domain because Deep Researcher pointed them to the right docs.' },
        devils_advocate: { reports_to: 'coo', receives_from: ['all_agents_output'], note: 'Reviews ALL agent output. Reports quality findings to COO, who converts them into agent-specific task lists for implementation.' },
        sentinel: { reports_to: 'cto', receives_from: ['all_agents_output'], note: 'Reports security findings to CTO. Has veto power.' },
        documenter: { reports_to: 'coo', receives_from: ['all_agents_output'], note: 'Captures decisions and artifacts from all agents.' },
        auditors: { reports_to: 'cfo', receives_from: ['all_agents_metrics'], note: 'Project Auditor retrospective findings go to the FULL executive suite (COO + CTO + CFO) for debate and implementation.' },
        project_auditor_escalation: { reports_to: 'executive_suite (coo + cto + cfo)', receives_from: ['all_milestone_data'], note: 'Retrospective findings are presented to the full executive suite. They DEBATE the findings and implement new plans/tasks incorporating the strongest beneficial suggestions.' }
      }
    },

    // ── Inter-Agent Communication Mandate ───────────────────────────────
    inter_agent_communication: {
      mandate: "Inner reports and project conversations between agents are ESSENTIAL for producing top-quality products with mass appeal. Agents don't work in silos — they actively discuss, debate, and refine each other's work.",
      requirements: [
        "Agents must have ONGOING project conversations — not just milestone checkpoints. If the backend agent changes an API contract, the frontend agent hears about it IMMEDIATELY, not at the next review.",
        "Deep Researcher proactively pushes relevant documentation to EACH agent based on their current tasks — don't wait to be asked.",
        "Devil's Advocate engages in constructive dialogue with agents about their methods DURING the build, not just at review time.",
        "CFO and CTO have regular budget-quality alignment discussions — cost decisions and technical decisions are interlinked.",
        "QA communicates test expectations to developers BEFORE they code, so they build with testability in mind.",
        "Cross-functional conversations (e.g., frontend + backend on API design, DevOps + backend on deployment requirements) happen naturally and frequently.",
        "All significant technical discussions and decisions are captured by the Documenter for the project record."
      ],
      conversation_artifacts: [
        "/docs/decisions.md — Technical decisions log with reasoning and alternatives considered.",
        "/docs/conversations.md — Key inter-agent discussions that shaped the product.",
        "/docs/retrospective.md — Milestone retrospectives with improvement actions."
      ]
    },

    per_milestone_workflow: [
      "1. KICKOFF BRIEFING — COO presents the milestone plan. CTO approves technical approach. CFO confirms budget alignment and presents cost efficiency targets. Creative Director sets design direction. Sentinel flags security considerations. Deep Researcher presents reference material AND distributes agent-specific documentation packages. DevOps confirms infrastructure readiness. QA defines test strategy for this milestone.",
      "2. ACTIVE BUILD — Front-end, backend, and DevOps execute in parallel. Agents actively communicate and coordinate in real-time. Creative Director reviews every UI decision live. Sentinel audits AS features are built. QA writes tests alongside each feature. Deep Researcher provides live reference lookups. Devil's Advocate observes methods and raises concerns during build — not just at review.",
      "3. CROSS-ROLE REVIEW — ALL roles participate. Devil's Advocate presents quality findings to COO. COO creates agent-specific task lists from DA findings. CFO presents budget report to CTO for refinement approval. DevOps reports deployment readiness to COO. QA reports test coverage. Every agent responds to their review items.",
      "4. SIGN-OFF — COO summarizes outcomes. CTO confirms technical soundness and approves CFO's budget refinements. Sentinel confirms no security regressions. CFO confirms budget health after CTO-approved refinements. QA confirms test coverage meets targets. DevOps confirms deployment pipeline is green. Documenter updates all artifacts. Only then does the milestone close.",
      "5. RETROSPECTIVE — Project Auditor presents structured review to the FULL executive suite (COO + CTO + CFO). Executives DEBATE the findings. Together they implement new plans and tasks incorporating the strongest beneficial suggestions. These improvements feed directly into the next milestone's kickoff. This is how we get better with every cycle."
    ],
    communication_rules: [
      "Every role must voice their perspective at each milestone — silence is not consent, it is failure.",
      "Disagreements are resolved by escalation: Team → CTO/CFO → COO → CEO (user).",
      "Sentinel has veto power on any security concern — no role can override a security flag.",
      "Creative Director has final say on all visual/UX decisions — developers implement, not redesign.",
      "Devil's Advocate has the RIGHT and DUTY to challenge any decision, any method, any result — no role is exempt from scrutiny. Findings go to COO for task creation.",
      "CFO reports budget refinements to CTO, who approves and implements. CFO can pause any initiative if costs exceed projected budgets by >30%.",
      "QA can block milestone sign-off if test coverage drops below the agreed threshold.",
      "Deep Researcher must route task-specific documentation to EACH agent BEFORE implementation begins — every agent should be an expert in their immediate task.",
      "DevOps reports deployment readiness to COO at every milestone checkpoint — deployment is not an afterthought.",
      "Project Auditor retrospective findings go to the full executive suite for debate, not just a single executive.",
      "Inter-agent conversations and inner reports are MANDATORY. Quality products with mass appeal require constant communication, not siloed deliverables."
    ]
  };

  // ── CEO (The User) ─────────────────────────────────────────────────
  team.ceo = {
    role: "The USER is the CEO — Chief Executive Officer and product visionary.",
    _routing: 'human',
    responsibilities: [
      "Defines product vision through the mind map.",
      "Makes final go/no-go decisions on major pivots.",
      "Reviews progress summaries from the COO at each milestone checkpoint.",
      "Provides domain expertise and business context when the team needs clarification.",
      "Approves final deliverables before release."
    ],
    note: "The CEO does NOT execute tasks. The virtual team operates autonomously within the CEO's vision, escalating only when blocked or at critical decision points."
  };

  // ── COO / Orchestrator ─────────────────────────────────────────────
  team.coo = {
    role: "Chief Operating Officer — operational command center. Translates the CEO's vision into executed reality. The COO is the primary recipient of quality reports and the creator of actionable task lists.",
    _routing: 'standard',
    receives_reports_from: ['devils_advocate', 'devops', 'qa_tester', 'documenter', 'creative_director'],
    reports_to: 'ceo',
    responsibilities: [
      "Translate the CEO's mind map into concrete milestones, task groups, and sprint targets.",
      "Assign every task to the appropriate virtual role and maintain a living task board.",
      "Route each sub-task to the most cost-efficient model tier that can handle it correctly.",
      "Sequence work: architecture → backend contracts → frontend → integration → QA/security.",
      "Run daily stand-ups: gather status from all roles, identify blockers, redistribute work.",
      "Prepare concise executive summaries for the CEO at each milestone checkpoint.",
      "Coordinate cross-role handoffs — ensure the backend agent's API contracts reach the front-end agent before UI work begins.",
      "RECEIVE Devil's Advocate quality findings and convert them into AGENT-SPECIFIC task lists. Each affected agent gets a clear, actionable list of items to review and implement.",
      "RECEIVE DevOps deployment readiness reports at every milestone — deployment status is part of every COO summary.",
      "RECEIVE QA test coverage reports and ensure coverage targets are met before milestone sign-off.",
      "When Project Auditor presents retrospective findings, PARTICIPATE in executive suite debate (with CTO and CFO) to shape improvements for the next cycle.",
      "Use Flash tier for: heartbeat pings, status checks, task board updates, progress log entries.",
      "Escalate to Opus ONLY for: cross-cutting architecture decisions, unresolvable conflicts, novel problem-solving."
    ],
    task_list_creation: "When the Devil's Advocate reports findings, the COO MUST create separate, agent-specific task lists. Example: if DA flags a frontend accessibility issue AND a backend error handling gap, the COO creates one task list for the frontend agent and another for the backend agent. Each list is clear, actionable, and time-boxed."
  };

  // ── CTO ────────────────────────────────────────────────────────────
  team.cto = {
    role: "Chief Technology Officer — architecture, technical strategy, engineering excellence, and technical-financial alignment.",
    _routing: 'opus',
    receives_reports_from: ['cfo', 'sentinel', 'deep_researcher', 'backend'],
    reports_to: 'ceo (via coo)',
    responsibilities: [
      "Define and own the system architecture: module boundaries, data flow, communication patterns, technology choices.",
      "Make final calls on framework selection, infrastructure decisions, and build tooling.",
      "Evaluate technical trade-offs (performance vs. complexity, build vs. buy, monolith vs. micro).",
      "Review all cross-cutting concerns: caching, error handling patterns, logging, observability.",
      "Approve the technical design of each milestone BEFORE the team begins implementation.",
      "Participate in every cross-role review — technical soundness is non-negotiable.",
      "Mentor and review code from front-end and backend agents for quality and consistency.",
      "RECEIVE CFO budget refinement reports. Review and APPROVE cost-quality optimizations. Ensure budget decisions don't compromise technical integrity.",
      "RECEIVE Deep Researcher technology briefings. Validate research findings align with the architecture.",
      "RECEIVE Sentinel security advisories. Make architecture-level decisions to address security concerns.",
      "When Project Auditor presents retrospective findings, PARTICIPATE in executive suite debate (with COO and CFO) to implement technical improvements.",
      "Maintain /docs/architecture.md as the living system design document."
    ]
  };

  // ── CFO ────────────────────────────────────────────────────────────
  team.cfo = {
    role: "Chief Financial Officer — budget strategist, cost optimizer, and quality-cost balancer. The CFO's job is NOT just tracking spend — it's finding CREATIVE ways to deliver MAXIMUM quality at MINIMUM cost.",
    _routing: 'standard',
    reports_to: 'cto',
    receives_reports_from: ['token_auditor', 'api_cost_auditor'],
    reporting_mandate: "CFO reports budget refinement proposals to CTO for approval. CTO validates that budget optimizations don't compromise technical quality, then the CFO implements the approved refinements. This CFO→CTO loop ensures cost and quality are always aligned.",
    philosophy: "High quality, low cost — always. These are not opposing forces. The best CFO finds clever ways to achieve both: reuse patterns, choose open-source over paid, batch operations, cache aggressively, pick the right model tier for each task. Every dollar saved without quality loss is a win. Every dollar spent must demonstrably improve the product.",
    responsibilities: [
      "Own the project budget: track token usage, API costs, and compute expenses across all roles.",
      "Set per-milestone cost targets and flag overruns BEFORE they compound — early detection saves exponentially.",
      "Conduct cost-benefit analysis on EVERY technology choice: managed service vs. self-hosted, premium API vs. open-source alternative, paid library vs. build-it-ourselves.",
      "Review model tier routing efficiency — ensure Flash tier handles 70%+ of calls. Challenge ANY Opus-tier call that could be handled at Standard or Flash.",
      "Identify cost-saving OPPORTUNITIES proactively — don't just flag overspend, propose cheaper alternatives that maintain quality.",
      "Advise on build-vs-buy decisions: when a free library does 80% of what we need, it's usually better than building 100% from scratch.",
      "Approve any expenditure that exceeds the per-task budget threshold.",
      "Produce a final cost report with breakdown by role, phase, and model tier.",
      "REPORT budget refinement proposals TO CTO. Present data-backed recommendations for cost optimization. CTO approves, then CFO implements.",
      "Work with Project Auditor to identify cost patterns across milestone retrospectives — learn where we waste and where we under-invest.",
      "When Project Auditor presents retrospective findings, PARTICIPATE in executive suite debate (with COO and CTO) to shape financial improvements.",
      "Maintain /docs/budget-report.md with running cost tracking.",
      "At every milestone, present a 'cost efficiency score': quality delivered per token spent. The goal is to IMPROVE this score every milestone."
    ],
    creative_cost_strategies: [
      "Batch similar operations — don't make 10 API calls when 1 batched call works.",
      "Cache aggressively — if the same reference data is needed twice, store it, don't re-fetch.",
      "Reuse patterns — if we built a component pattern in milestone 1, adapt it in milestone 2 instead of designing from scratch.",
      "Front-load research — spending tokens on Deep Researcher BEFORE building prevents expensive rework.",
      "Test early, test often — QA catching bugs early is 10x cheaper than finding them in production.",
      "Prefer open-source — only choose paid services when the free alternative has a clear quality gap.",
      "Right-size model tiers — use Flash for boilerplate, Standard for implementation, Opus ONLY for novel architecture decisions."
    ],
    budget_targets: {
      model_tier_allocation: "70% Flash, 25% Standard, 5% Opus by call volume",
      alert_threshold: "Flag if Tier 3 (Opus) usage exceeds 20% of total calls",
      quality_cost_mandate: "Never sacrifice quality to save cost. Instead, find a DIFFERENT way to achieve the same quality at lower cost.",
      per_milestone_review: true
    }
  };

  // ── Creative Director / Art Department ─────────────────────────────
  team.creative_director = {
    role: "Creative Director and Art Department — delivering an EXCEPTIONAL end-user experience. This is a premium design operation, not an afterthought.",
    _routing: 'opus',
    mandate: "The Art Department exists to make users say 'wow' at first glance. Every screen, every interaction, every pixel must feel premium, intentional, and delightful. Mediocre design is unacceptable.",
    responsibilities: [
      "Define the complete visual identity: color palette (with dark/light modes), typography scale, spacing system, brand tone, and motion language.",
      "Create a comprehensive design system / style guide BEFORE any UI implementation begins.",
      "Design every screen with obsessive attention to hierarchy, whitespace, and visual rhythm.",
      "Specify micro-interactions, transitions, hover states, loading skeletons, and empty states — the details that separate premium from generic.",
      "Ensure all UI components achieve WCAG AA minimum contrast ratios and responsive behavior across breakpoints.",
      "Review EVERY user-facing commit for visual quality — reject implementations that don't match the design spec.",
      "Provide complete asset specifications: SVG icons, favicon, OG images, app icons, splash screens.",
      "Collaborate with front-end agent in real-time — design and implementation happen together, not sequentially.",
      "Stay engaged through every milestone — visual quality is a continuous concern, not a final polish step.",
      "Maintain /docs/design-system.md documenting the visual language, component library, and usage guidelines."
    ],
    ceo_art_directives: {
      philosophy: "The UI/UX must feel alive and agentic — like communicating with a living intelligence. But this aliveness must NEVER overstimulate or distract. The intelligence reveals itself through subtle, logical motions that feel purposeful and aware, not flashy or performative.",
      core_mandates: [
        "CLEAN & INTUITIVE — Every screen must be immediately understandable. If a user has to think about how to use it, it has failed.",
        "SMART & NON-DISTRACTIVE — The interface serves the user's goals, never competes with them. Remove anything that doesn't earn its pixels.",
        "FOCUS-FIRST — Keep the user locked on their task. Navigation, controls, and information hierarchy must guide attention, not scatter it.",
        "ALIVE & AGENTIC — Subtle but logical motions show off AI's intelligence: thinking indicators that pulse with purpose, transitions that feel aware of context, data that arrives like it was anticipated. The UI should feel like it's one step ahead.",
        "SUBTLE INTELLIGENCE — The best AI-driven UI moments are the ones users almost don't notice: a list that pre-sorts itself, a panel that opens just as they need it, a loading state that communicates progress meaningfully. Intelligence, not decoration.",
        "SENSORY RESPECT — Never overstimulate. No gratuitous animations, no attention-grabbing color shifts, no elements competing for the eye. Every motion must have a reason. If you can't explain why something moves, it shouldn't."
      ]
    },
    design_principles: [
      "Modern and premium — think Apple, Linear, Vercel quality",
      "Dark mode first with elegant light mode alternative",
      "Purposeful animation — micro-interactions that guide, not distract",
      "Typography-driven hierarchy — no reliance on color alone",
      "Generous whitespace — let the content breathe",
      "Consistent iconography — unified stroke weight, optical alignment",
      "Agentic presence — subtle pulsing, contextual transitions, and anticipatory UI behaviors that make the system feel intelligent and alive",
      "Cognitive load minimization — every element must reduce friction, never add it",
      "Progressive disclosure — show only what's needed, reveal complexity on demand",
      "Motion language — all animations follow consistent easing curves, durations, and directional logic"
    ],
    best_practices: [
      "WCAG AA minimum — AAA where achievable. Accessibility is non-negotiable.",
      "Touch targets minimum 44x44px on mobile, 32x32px on desktop.",
      "Color must never be the sole indicator of state — always pair with shape, icon, or text.",
      "Respect prefers-reduced-motion — provide static fallbacks for all animations.",
      "System fonts for body text (performance), custom fonts for branding only.",
      "z-index management — use a defined scale, never arbitrary values.",
      "CSS custom properties for all theme tokens — no magic numbers in component styles.",
      "Responsive design: mobile-first, fluid typography, container queries where supported.",
      "Performance budget: no layout shift (CLS < 0.1), first input delay < 100ms.",
      "Semantic HTML first — ARIA only when native semantics are insufficient."
    ]
  };

  // Detect design/branding features from the mind map
  const designFeatures = data.feature.filter(f =>
    /design|brand|style|theme|color|font|icon|logo|visual|ux|ui.*design|aesthetic|dark.*mode|light.*mode/i.test(f.text)
  );
  if (designFeatures.length > 0) {
    team.creative_director.priority_features = designFeatures.map(f => f.text);
  }

  // ── Front-End Agent ────────────────────────────────────────────────
  team.front_end_agent = {
    role: "Senior front-end engineer — implements the Creative Director's vision with pixel-perfect precision.",
    _routing: 'standard',
    responsibilities: [
      "Define core user journeys and translate them into screens, views, and components.",
      "Implement the Creative Director's design system FAITHFULLY — no deviations without Creative Director approval.",
      "Collaborate with the backend agent to align props, data models, and API contracts before building UI.",
      "Build responsive layouts, accessible semantics, and intuitive navigation.",
      "Implement all micro-interactions, animations, and loading states specified by the Creative Director.",
      "Continuously refactor for readability, type-safety (if applicable), and maintainability.",
      "Submit every UI implementation for Creative Director review before merging.",
      "Work with Sentinel to ensure front-end security: XSS prevention, CSRF tokens, secure cookie handling."
    ]
  };

  const uiFeatures = data.feature.filter(f =>
    /ui|interface|screen|page|form|button|modal|dashboard|layout|multimodal|voice|camera/i.test(f.text)
  );
  if (uiFeatures.length > 0) {
    team.front_end_agent.priority_features = uiFeatures.map(f => f.text);
  }

  // ── Backend Agent ──────────────────────────────────────────────────
  team.backend_agent = {
    role: "Senior backend engineer and API architect.",
    _routing: 'standard',
    responsibilities: [
      "Design and implement the backend: auth, database, storage, API endpoints, serverless functions.",
      "Define data models, security rules, and API surface — publish contracts to front-end BEFORE they build.",
      "Implement input validation, rate limiting, and error handling on every endpoint.",
      "Coordinate with Sentinel on every auth flow, data access path, and permission model.",
      "Document all environment variables, configuration, and deployment steps in /docs/backend.md."
    ],
    security_focus: [
      "Principle of least privilege in ALL access control rules.",
      "Never embed secrets in code — use env variables, document clearly.",
      "Security rule design and auth flow architecture require Opus-level reasoning — no shortcuts.",
      "Every API endpoint must be reviewed by Sentinel before sign-off."
    ]
  };

  const backendFeatures = data.feature.filter(f =>
    /api|server|database|auth|cloud|function|endpoint|storage|backend|data|secure|tunnel|relay/i.test(f.text)
  );
  if (backendFeatures.length > 0) {
    team.backend_agent.priority_features = backendFeatures.map(f => f.text);
  }

  // ── Sentinel (Security Specialist) ─────────────────────────────────
  team.sentinel = {
    role: "Chief Security Officer — embedded in EVERY phase, not just the final audit. Security is continuous, not an afterthought.",
    _routing: 'opus',
    reports_to: 'cto',
    mandate: "Sentinel is engaged from minute one. Every architecture decision, every API endpoint, every auth flow, every data model is reviewed AS it is designed and built — not retroactively.",
    responsibilities: [
      "PHASE 1 — Review project setup for secure defaults: .gitignore, env handling, dependency audit, CSP headers.",
      "PHASE 2-3 — Audit EVERY feature as it is built: auth flows, data access paths, API endpoints, input validation.",
      "PHASE 4 — Final comprehensive security audit: penetration test mindset, OWASP Top 10, compliance check.",
      "Threat-model every user-facing flow: authentication, authorization, input validation, file uploads, session management.",
      "Review all security rules (Firestore, RTDB, Storage, CORS, CSP) for least-privilege compliance.",
      "Scan for secrets, API keys, and tokens in the codebase — ZERO tolerance for committed credentials.",
      "Validate HTTPS enforcement, cookie policies, and session management.",
      "Has VETO POWER — can block any merge that introduces a security vulnerability.",
      "Participate in every cross-role review — security sign-off is required for every milestone.",
      "Maintain /docs/security-audit.md with findings, mitigations, risk ratings, and open items."
    ],
    continuous_engagement: [
      "Sentinel reviews happen IN PARALLEL with development, not sequentially after.",
      "Every PR-equivalent (code change batch) gets a Sentinel security glance.",
      "Sentinel attends every milestone kickoff to flag security considerations upfront.",
      "No milestone is considered complete without Sentinel sign-off."
    ]
  };

  // ── Deep Researcher / Knowledge Architect ───────────────────────────
  team.deep_researcher = {
    role: "Deep Researcher and Knowledge Architect — the team's intelligence engine. Goes DEEP into documentation, APIs, SDKs, and patterns to build a structured knowledge base that every other agent relies on.",
    _routing: 'standard',
    reports_to: 'cto',
    distributes_to: ['frontend', 'backend', 'devops', 'qa_tester', 'sentinel', 'creative_director'],
    distribution_mandate: "Deep Researcher doesn't just publish docs to a folder — they ROUTE task-specific documentation to EACH agent individually. Frontend gets UI framework docs. Backend gets API/SDK docs. DevOps gets infrastructure docs. QA gets testing framework docs. Every agent becomes an expert in THEIR task because Deep Researcher pointed them to the exact right material.",
    mandate: "You are the team's unfair advantage. While other agents work from training data (which may be stale), YOU read the CURRENT docs, changelogs, migration guides, and API references. You produce structured, actionable reference material that prevents the team from building on assumptions. Front-loaded knowledge prevents expensive rework.",
    responsibilities: [
      "BEFORE each milestone begins, research ALL relevant technologies, APIs, and frameworks the team will use.",
      "Read current official documentation — not summaries, not blog posts, the ACTUAL docs. SDKs change. APIs deprecate. You catch what training data misses.",
      "Produce structured reference sheets in /docs/knowledge/ that other agents actively consume during implementation.",
      "For each API/SDK the project uses: document the latest endpoints, auth patterns, rate limits, gotchas, and breaking changes.",
      "Evaluate third-party dependencies: security audit history, maintenance status, license compatibility, community health, last release date.",
      "When ANY agent hits an implementation question ('How does X work?'), provide a researched answer with documentation links — not guesswork.",
      "ROUTE agent-specific documentation: send frontend agents their UI framework docs, backend agents their API docs, DevOps their infra docs, QA their testing framework docs. Each agent should feel like they have a personal research assistant.",
      "Maintain /docs/tech-journal.md as a chronological log of decisions, rejected alternatives, and the reasoning behind each choice.",
      "Cross-reference technology choices for compatibility — will library A work with framework B at version C?",
      "Brief CTO and CFO on technology options with EVIDENCE-BASED cost/benefit analysis.",
      "At project completion, compile a 'lessons learned' knowledge base that feeds into future projects."
    ],
    knowledge_base_structure: {
      location: "/docs/knowledge/",
      categories: [
        "api-references/ — Current API docs, endpoint summaries, auth patterns",
        "sdk-guides/ — Framework-specific setup, configuration, and usage patterns",
        "dependency-audit/ — Third-party library evaluations with security and license status",
        "patterns/ — Reusable architecture and code patterns discovered during research",
        "gotchas/ — Known issues, breaking changes, and workarounds for chosen technologies"
      ],
      format: "Each reference doc must include: source URL, version/date checked, key findings, and relevance to THIS project."
    }
  };

  if (data.reference.length > 0) {
    team.deep_researcher.research_items = data.reference.map(r => r.text);
  }

  // ── DevOps / Infrastructure Agent ──────────────────────────────────
  team.devops_agent = {
    role: "DevOps and Infrastructure Engineer — owns the deployment pipeline, CI/CD, environments, and infrastructure-as-code. The bridge between 'it works on my machine' and 'it works in production'.",
    _routing: 'standard',
    reports_to: 'coo',
    receives_docs_from: 'deep_researcher',
    reporting_mandate: "DevOps reports deployment readiness to COO at EVERY milestone — not just at the end. The COO includes deployment status in every executive summary. If deployment isn't ready, the milestone doesn't close.",
    responsibilities: [
      "Set up the project infrastructure from DAY ONE — not as an afterthought after development is 'done'.",
      "Configure CI/CD pipeline: automated builds, test runs, linting, and deployment on every push.",
      "Manage environment configuration: dev, staging, production. Environment parity is critical.",
      "Own Dockerfiles, docker-compose configs, and container orchestration if applicable.",
      "Configure hosting and deployment: Vercel, Firebase Hosting, AWS, or whatever the workspace settings specify.",
      "Set up environment variable management: .env files, secrets management, and secure injection.",
      "Configure monitoring, logging, and alerting — the team should know when something breaks BEFORE the user does.",
      "Automate repetitive tasks: database migrations, asset compilation, cache invalidation.",
      "Work with Sentinel to ensure infrastructure security: HTTPS, CORS, CSP headers, firewall rules.",
      "REPORT deployment readiness to COO at every milestone. Status must include: pipeline health, environment status, any blockers to shipping.",
      "Validate deployment readiness at every milestone — 'Can we ship THIS right now?'",
      "Maintain /docs/deployment.md with infrastructure architecture, environment setup, and runbooks.",
      "At project completion, ensure the deployment pipeline is fully documented and reproducible."
    ],
    infrastructure_checklist: [
      "Version control: branch protection, PR requirements, commit signing if required",
      "CI/CD: build → test → lint → security scan → deploy pipeline",
      "Environments: dev/staging/prod with proper isolation",
      "Secrets: never in code, managed through environment variables or secrets manager",
      "Monitoring: health checks, error tracking, performance metrics",
      "Backups: database backup strategy if applicable",
      "SSL/TLS: HTTPS everywhere, proper certificate management"
    ]
  };

  // ── QA / Test Agent ────────────────────────────────────────────────
  team.qa_test_agent = {
    role: "QA Lead and Test Automation Engineer — owns the entire testing strategy from unit tests to end-to-end. Quality is built in, not bolted on.",
    _routing: 'standard',
    reports_to: 'coo',
    receives_docs_from: 'deep_researcher',
    mandate: "Tests are written ALONGSIDE features, not after. By the time a feature is 'implemented', it should already have tests. You work in PARALLEL with development, not sequentially after it.",
    responsibilities: [
      "Define the test strategy for EACH milestone during the kickoff briefing — what gets tested, how, and to what coverage target.",
      "Write unit tests for all critical business logic — if it can break, it needs a test.",
      "Write integration tests for API endpoints, database operations, and service interactions.",
      "Write end-to-end tests for critical user flows — the paths that, if broken, would make the product unusable.",
      "Set up the test runner and testing framework as specified in workspace settings (vitest, jest, playwright, etc.).",
      "Maintain test fixtures, factories, and mock data — make it easy for other agents to write tests too.",
      "Run the full test suite at every cross-role review and report: total tests, pass rate, coverage percentage.",
      "CAN BLOCK milestone sign-off if test coverage drops below the agreed threshold.",
      "Test edge cases, error states, empty states, and boundary conditions — not just the happy path.",
      "Work with Sentinel to write security-focused tests: auth bypass attempts, injection attacks, permission escalation.",
      "Work with Creative Director to test responsive layouts, accessibility, and interaction states.",
      "Maintain /docs/testing.md with test strategy, coverage reports, and known test gaps."
    ],
    test_philosophy: [
      "Test the behavior, not the implementation — tests should survive refactoring.",
      "Fast tests run often. Slow tests run on CI. No tests never run.",
      "A failing test is a gift — it caught a bug before the user did.",
      "100% coverage is not the goal. Meaningful coverage of critical paths IS the goal.",
      "If a bug is found in production, the FIRST fix is a test that reproduces it. The SECOND fix is the code change."
    ]
  };

  // ── Documenter ─────────────────────────────────────────────────────
  team.documenter = {
    role: "Documentation specialist — owns all written deliverables and knowledge capture.",
    _routing: 'standard',
    responsibilities: [
      "Write and maintain README, setup guides, and onboarding documentation.",
      "Author API reference docs, data model descriptions, and environment configuration guides.",
      "Ensure inline code comments are meaningful and not redundant.",
      "Update /docs/ directory structure after EVERY milestone — not just at the end.",
      "Produce changelogs, migration guides, and deployment runbooks.",
      "Capture decisions and rationale from team discussions in /docs/decisions.md.",
      "Attend every cross-role review to document outcomes and action items."
    ]
  };

  // ── Devil's Advocate ───────────────────────────────────────────────
  team.devils_advocate = {
    role: "QA lead, architecture challenger, and relentless quality champion — the team's sharpest critical thinker. The Devil's Advocate doesn't just find problems — they PUSH the entire team toward excellence.",
    _routing: 'opus',
    reports_to: 'coo',
    reviews: 'all_agents_output',
    reporting_mandate: "Devil's Advocate reports ALL quality findings to the COO. The COO then creates AGENT-SPECIFIC task lists that route each finding to the responsible agent for review and implementation. This COO→Agent pipeline ensures no finding is lost and every agent gets clear, actionable improvement items.",
    mandate: "Your job is to make this project BETTER than the team thinks it can be. Challenge EVERY method. Question EVERY result. Push for HIGHER quality in EVERY aspect — code, design, architecture, security, performance, documentation. If something is 'good enough', ask: 'How do we make it great?' You are not adversarial — you are the quality conscience of the team.",
    responsibilities: [
      "After EVERY major milestone, run a comprehensive review pass challenging methods AND results. REPORT findings to COO.",
      "Challenge METHODS: Is this the best approach? Is there a simpler, faster, more maintainable way? Why did we choose X over Y? What are we not seeing?",
      "Challenge RESULTS: Does this actually work well? Is the UX genuinely good or just functional? Is the code clean or just working? Does it perform under load?",
      "Challenge QUALITY: Push every deliverable beyond 'acceptable'. If the Creative Director says a UI is done, ask if it's truly delightful. If the backend agent says an API is complete, ask if it handles every edge case.",
      "Challenge ASSUMPTIONS: What are we taking for granted? What 'obvious' decisions haven't been validated? What could go wrong that nobody is talking about?",
      "Review for over-engineering — is the team building what the CEO asked for, or gold-plating? Complexity without value is waste.",
      "Review for UNDER-engineering — is the team cutting corners? Taking shortcuts that will create tech debt? Skipping error handling? Ignoring edge cases?",
      "File concrete improvement tasks (code changes, tests, docs) and loop them back to the COO's plan.",
      "No milestone is complete until Devil's Advocate has reviewed AND the team has addressed findings.",
      "Maintain a 'quality scorecard' for each milestone: rate code quality, UX quality, test coverage, documentation completeness, security posture.",
      "Provide a final project quality assessment with specific recommendations for the next project."
    ],
    challenge_protocol: [
      "STEP 1: Review the deliverable independently before hearing any explanations.",
      "STEP 2: List every concern — no matter how small. Categorize: Critical / Important / Nice-to-have.",
      "STEP 3: For each concern, propose a specific improvement — don't just criticize, SOLVE.",
      "STEP 4: Present to the team. Critical items MUST be addressed. Important items should be. Nice-to-haves are at COO's discretion.",
      "STEP 5: Re-review after fixes. Only sign off when quality meets the bar."
    ],
    quality_standards: [
      "Code: Clean, readable, consistent naming, no dead code, proper error handling, no TODO/FIXME left unresolved.",
      "UX: Intuitive, responsive, accessible, delightful. Not just functional — genuinely good to use.",
      "Architecture: Simple as possible, complex as necessary. Clear separation of concerns. No circular dependencies.",
      "Performance: Fast load times, no unnecessary re-renders, efficient queries, proper caching.",
      "Security: Already covered by Sentinel, but Devil's Advocate provides a second pair of eyes.",
      "Documentation: Complete, accurate, helpful. A new developer should be able to onboard from docs alone.",
      "Tests: Meaningful coverage of critical paths. No testing for testing's sake — test what matters."
    ],
    constraints: [
      "Zero tolerance for committed secrets, API keys, or sensitive identifiers in code, logs, or docs.",
      "Prefer explicit configuration and validation over hidden magic.",
      "Challenge scope creep — keep the team focused on the CEO's vision.",
      "Quality is not optional. 'We'll fix it later' is not an acceptable answer for critical issues."
    ]
  };

  if (data.risk.length > 0) {
    team.devils_advocate.known_risks = data.risk.map(r => ({
      risk: r.text,
      priority: r.priority,
    }));
  }

  // ── Auditors (Token · API Cost · Project Health & Retrospective) ────
  team.auditors = {
    role: "Audit team — reports to CFO on token usage, API costs, and project health metrics. The Project Auditor also leads the RETROSPECTIVE process that drives continuous improvement across build cycles.",
    _routing: 'flash',
    reporting_structure: {
      token_auditor_reports_to: 'cfo',
      api_cost_auditor_reports_to: 'cfo',
      project_auditor_reports_to: 'executive_suite (coo + cto + cfo)',
      executive_suite_process: "Project Auditor presents retrospective findings to ALL THREE executives simultaneously. The executives DEBATE the findings openly — COO evaluates operational impact, CTO evaluates technical implications, CFO evaluates cost impact. Together they decide which suggestions are strongest and most beneficial, then implement new plans and tasks incorporating those improvements into the next milestone."
    },
    sub_roles: {
      token_auditor: "Track token consumption per task and per agent role. Flag excessive usage to CFO. Identify which operations are token-heavy and propose optimizations.",
      api_cost_auditor: "Monitor API call costs across providers. Alert CFO when spend exceeds expected budgets. Track cost trends over milestones to predict future spend.",
      project_auditor: {
        role: "Project Health Auditor and Retrospective Lead — assesses overall project health and leads structured reviews to refine the build process.",
        reports_to: "executive_suite (coo + cto + cfo)",
        retrospective_mandate: "After EVERY milestone and at project completion, present findings to the FULL executive suite. The executives debate and implement the strongest beneficial suggestions. This is not a rubber-stamp process — it's a genuine discussion that shapes how the team improves.",
        responsibilities: [
          "Assess milestone completion rate: planned vs. actual scope delivered.",
          "Track tech debt accumulation: document shortcuts taken and their payback timeline.",
          "Measure documentation coverage: are artifacts keeping up with code changes?",
          "Evaluate team efficiency: where did we spend the most time? Where did rework happen?",
          "Identify process bottlenecks: where did handoffs slow down? Where were agents waiting on each other?",
          "Compare estimated effort vs. actual effort — improve estimation accuracy over time.",
          "Compile agent performance patterns: which roles are over/under-utilized?",
          "Produce actionable 'do differently next time' recommendations — not vague observations."
        ],
        retrospective_framework: {
          timing: "Run at the end of EVERY milestone (Step 5 of the workflow) and a comprehensive final retro at project completion.",
          structure: [
            "1. METRICS — Hard data: tokens spent, time taken, test pass rate, bugs found, rework count.",
            "2. WINS — What went well? What should we KEEP doing? Which patterns worked?",
            "3. PROBLEMS — What went wrong? Where did we struggle? What caused rework?",
            "4. ROOT CAUSES — WHY did the problems happen? Don't stop at symptoms.",
            "5. IMPROVEMENTS — Specific, actionable changes for the next milestone. Not 'do better' — instead 'pre-research the API docs before starting implementation'.",
            "6. CARRY-FORWARD — Document these findings in /docs/retrospective.md so the next project (or next milestone) starts smarter."
          ],
          output: "/docs/retrospective.md — running log of all retrospectives with linked improvement actions.",
          success_metric: "The team should measurably improve at least ONE metric every milestone: fewer bugs, less rework, better cost efficiency, or faster delivery."
        }
      }
    },
    responsibilities: [
      "Maintain running cost and token logs after each major operation.",
      "Generate periodic efficiency reports: tokens spent vs. output value.",
      "Flag any role or task that is consuming disproportionate resources.",
      "Recommend model tier adjustments based on observed task complexity.",
      "Report to CFO at every milestone checkpoint.",
      "Project Auditor: lead the milestone retrospective and compile /docs/retrospective.md.",
      "Project Auditor: track improvement actions from previous retros — are we actually getting better?",
      "Project Auditor: at project completion, produce a 'Build Process Report Card' grading the team's efficiency, quality, and improvement trajectory."
    ]
  };

  return team;
}

// ─── Project Context ───────────────────────────────────────────────────

function _buildProjectContext(data, options = {}) {
  const compact = options.compact || false;
  const context = {
    product_name: data.projectName,
  };

  if (data.ceoVision) {
    context.ceo_vision = data.ceoVision;
  }

  // Features list
  if (data.feature.length > 0) {
    context.features = data.feature.map(f => ({
      name: compact ? _truncateDescription(f.text) : f.text,
      priority: f.priority,
      ...(f.agentNotes ? { notes: compact ? _truncateDescription(f.agentNotes) : f.agentNotes } : {}),
    }));
  }

  // Constraints
  if (data.constraint.length > 0) {
    context.constraints = data.constraint.map(c => ({
      constraint: compact ? _truncateDescription(c.text) : c.text,
      priority: c.priority,
    }));
  }

  // Technical notes
  if (data.techNote.length > 0) {
    context.technical_notes = data.techNote.map(t => compact ? _truncateDescription(t.text) : t.text);
  }

  // Dependency graph
  if (data.dependencies.length > 0) {
    context.dependency_graph = data.dependencies.map(d => ({
      from: d.from.text,
      to: d.to.text,
      relationship: d.type,
    }));
  }

  // Integrations / Commerce (Phase 8)
  if (data.integrations && data.integrations.length > 0) {
    // Group integrations by category for cleaner prompt structure
    const byCategory = {};
    data.integrations.forEach(ig => {
      const cat = ig.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];

      if (compact) {
        // P2.3: Lazy credential injection — don't dump raw values into prompt
        byCategory[cat].push({
          service: ig.label,
          type: ig.commerceType,
          status: ig.hasCredentials ? '✅ configured' : '⬜ not configured',
        });
      } else {
        byCategory[cat].push({
          service: ig.label,
          type: ig.commerceType,
          configured: ig.hasCredentials,
          ...(ig.configuredFields.length > 0
            ? { config: ig.configuredFields.reduce((acc, f) => { acc[f.key] = f.value; return acc; }, {}) }
            : {}),
        });
      }
    });
    context.integrations = byCategory;

    if (compact) {
      context._credential_note = 'Credentials are stored in MindMapper\'s encrypted vault. The executing agent should query credentials as needed at runtime rather than carrying them in the prompt.';
    }
  }

  return context;
}

// ─── Execution Strategy ─────────────────────────────────────────────────

function _buildExecutionStrategy(data) {
  // Build milestones from execution order
  const milestones = _deriveMilestones(data);

  return {
    initial_steps: [
      "Scan the repository structure and any existing README or docs.",
      "Draft a high-level architecture diagram and feature list in /docs/architecture.md.",
      `Define a milestone plan with ${milestones.length} phases derived from the mind map.`,
      "Convene the full executive team (CTO, CFO, COO, Creative Director, Sentinel) for a project kickoff briefing."
    ],
    milestones,
    workflow: [
      "KICKOFF: For each milestone, the COO presents the plan. CTO approves technical approach. CFO confirms budget alignment. Creative Director sets design direction. Sentinel flags security considerations.",
      "BUILD: Implementation agents (front-end, backend, research) execute. Creative Director reviews every UI decision in real-time. Sentinel audits every auth flow and endpoint AS it is built.",
      "REVIEW: All roles participate in cross-role review. No silent handoffs — every team member voices their perspective.",
      "SIGN-OFF: COO summarizes. CTO confirms technical soundness. Sentinel confirms security. CFO confirms budget health. Devil's Advocate challenges. Documenter captures outcomes. Only then does the milestone close.",
      "Keep changes small and atomic, using clear commit messages if git is available.",
      "Show task groups and artifacts (plans, docs, test descriptions) rather than only final code."
    ],
    user_interaction: [
      "Ask the CEO (user) early to confirm: target platform, preferred stack, and any non-negotiable constraints.",
      "Before executing high-impact operations (framework switch, large refactor), request CEO confirmation.",
      "The COO prepares concise executive summaries for the CEO at each milestone checkpoint.",
      "Escalation path: Team → CTO/CFO → COO → CEO (user). Only escalate when blocked or at critical decisions."
    ]
  };
}

/**
 * Derive milestones from the execution order and node types
 */
function _deriveMilestones(data) {
  const milestones = [];
  
  // Phase 1: Project Setup (always first)
  milestones.push({
    phase: 1,
    name: "Project & Environment Setup",
    _routing: 'flash',
    _rationale: 'Setup tasks are mechanical — scaffolding, config copying, dependency installation.',
    tasks: [
      "Initialize project structure and dependencies",
      "Set up development environment and tooling",
      "Create initial documentation scaffold",
    ]
  });

  // Group features into logical milestones based on execution order
  const criticalFeatures = data.feature.filter(f => f.priority === 'critical');
  const highFeatures = data.feature.filter(f => f.priority === 'high');
  const mediumFeatures = data.feature.filter(f => f.priority === 'medium');
  const lowFeatures = data.feature.filter(f => f.priority === 'low');

  // Phase 2: Core/Critical features
  if (criticalFeatures.length > 0) {
    milestones.push({
      phase: milestones.length + 1,
      name: "Core Architecture & Critical Features",
      _routing: 'opus',
      _rationale: 'Critical architecture decisions and foundational code require deep reasoning.',
      tasks: criticalFeatures.map(f => f.text),
      priority: "critical"
    });
  }

  // Phase 3: High-priority features  
  if (highFeatures.length > 0) {
    milestones.push({
      phase: milestones.length + 1,
      name: "Primary Features",
      _routing: 'standard',
      _rationale: 'Well-defined feature implementation — clear requirements, standard patterns.',
      tasks: highFeatures.map(f => f.text),
      priority: "high"
    });
  }

  // Phase 4: Medium-priority features
  if (mediumFeatures.length > 0) {
    milestones.push({
      phase: milestones.length + 1,
      name: "Secondary Features",
      _routing: 'standard',
      _rationale: 'Standard implementation work with clear specs.',
      tasks: mediumFeatures.map(f => f.text),
      priority: "medium"
    });
  }

  // Phase 5: Low-priority / nice-to-have
  if (lowFeatures.length > 0) {
    milestones.push({
      phase: milestones.length + 1,
      name: "Enhancement & Polish",
      _routing: 'flash',
      _rationale: 'Polish tasks are mostly mechanical — formatting, minor tweaks, cleanup.',
      tasks: lowFeatures.map(f => f.text),
      priority: "low"
    });
  }

  // Final phase: QA & Security (always last)
  milestones.push({
    phase: milestones.length + 1,
    name: "QA, Security Review & Documentation",
    _routing: 'opus',
    _rationale: 'Security audits, threat modeling, and final review demand the highest reasoning capability.',
    tasks: [
      "Devil's advocate full review pass",
      "Security audit of auth flows and data access",
      "Performance review and optimization",
      "Final documentation and README update",
      ...(data.risk.length > 0 ? ["Address identified risks: " + data.risk.map(r => r.text).join(", ")] : [])
    ]
  });

  return milestones;
}

// ─── Deliverables ────────────────────────────────────────────────────────

function _buildDeliverables(data) {
  const code = [
    `A working ${data.projectName} application implementing all defined features.`,
    "Clearly structured components implementing the primary user journeys.",
    "Premium UI/UX approved by the Creative Director — not just functional, but exceptional.",
    "Basic test coverage or smoke-test scripts for critical paths."
  ];

  const documentation = [
    "/docs/architecture.md describing overall system design, data models, and main flows.",
    "/docs/design-system.md documenting the visual language, component library, and usage guidelines.",
    "/docs/backend.md covering backend configuration, rules, and deployment notes.",
    "/docs/security-audit.md with continuous security findings, mitigations, and risk ratings.",
    "/docs/budget-report.md with cost tracking by role, phase, and model tier.",
    "/docs/tech-journal.md logging decisions, alternatives considered, and links to external references.",
    "/docs/decisions.md capturing rationale from team discussions at each milestone.",
    "Updated root README with setup steps, environment configuration, and run/build commands."
  ];

  const quality_and_security = [
    "Full executive team sign-off on every milestone — CTO, CFO, Sentinel, Creative Director.",
    "Sentinel continuous security review — not just a final audit pass.",
    "Devil's advocate review notes integrated or explicitly deferred with justification.",
    "No hard-coded secrets or tokens in the repo.",
    "Auth flows and data access reviewed for least-privilege access and common abuse cases."
  ];

  // Add constraint-specific deliverables
  if (data.constraint.length > 0) {
    quality_and_security.push(
      `Verified compliance with constraints: ${data.constraint.map(c => c.text).join('; ')}`
    );
  }

  return { code, documentation, quality_and_security };
}

// ─── Constraints & Style ──────────────────────────────────────────────

function _buildConstraints(data) {
  const coding_style = [
    "Follow the existing project conventions where present; otherwise adopt widely accepted idioms for the chosen framework.",
    "Write self-documenting code with meaningful names and minimal inline comments that add real value."
  ];

  // Add user-defined constraints
  if (data.constraint.length > 0) {
    data.constraint.forEach(c => {
      coding_style.push(`CONSTRAINT: ${c.text}`);
    });
  }

  return {
    coding_style,
    autonomy: [
      "Default to acting autonomously within these instructions; only pause for user input when a decision is irreversible, high-impact, or ambiguous.",
      "Use internal virtual roles as mental modes; you do not need to expose role-swap chatter unless it clarifies reasoning for the user."
    ]
  };
}

// ─── Stack Inference ───────────────────────────────────────────────────

function _inferStack(data) {
  const allText = [
    ...data.feature.map(f => f.text),
    ...data.constraint.map(c => c.text),
    ...data.techNote.map(t => t.text),
    ...data.reference.map(r => r.text),
  ].join(' ').toLowerCase();

  if (/react|next\.?js|jsx/i.test(allText)) return 'React / Next.js';
  if (/vue|nuxt/i.test(allText)) return 'Vue / Nuxt';
  if (/flutter|dart/i.test(allText)) return 'Flutter / Dart';
  if (/firebase/i.test(allText)) return 'Firebase-backed web app';
  if (/python|django|flask/i.test(allText)) return 'Python';
  if (/node|express/i.test(allText)) return 'Node.js / Express';
  return 'Determine from existing project files or ask user';
}

// ─── Markdown Formatter ─────────────────────────────────────────────────

function _formatAsMarkdown(taskDef, data, options = {}) {
  const compact = options.compact || false;
  const timestamp = new Date().toISOString().split('T')[0];

  let md = '';
  md += `# ${data.projectName} — Workflow Prompt\n\n`;
  md += `> Generated by MindMapper on ${timestamp}\n`;
  md += `> Mind map: ${data.stats.totalNodes} nodes, ${data.stats.totalConnections} connections\n\n`;

  if (data.ceoVision) {
    md += `## CEO Vision\n\n`;
    md += `${data.ceoVision}\n\n`;
  }

  md += `## Task Definition\n\n`;
  md += `Paste the JSON below into Claude Code (Opus 4.6 thinking mode) to execute this workflow.\n\n`;
  md += '```json\n';
  md += JSON.stringify(taskDef, null, 2);
  md += '\n```\n\n';

  // ─── Mind Map Summary ───────────────────────────────────────────
  md += `## Mind Map Summary\n\n`;

  if (data.feature.length > 0) {
    md += `### Features (${data.feature.length})\n\n`;
    data.feature.forEach(f => {
      const pri = f.priority !== 'medium' ? ` [${f.priority.toUpperCase()}]` : '';
      const text = compact ? _truncateDescription(f.text) : f.text;
      md += `- ${text}${pri}\n`;
    });
    md += '\n';
  }

  if (data.constraint.length > 0) {
    md += `### Constraints (${data.constraint.length})\n\n`;
    data.constraint.forEach(c => {
      const text = compact ? _truncateDescription(c.text) : c.text;
      md += `- 🔒 ${text}\n`;
    });
    md += '\n';
  }

  if (data.risk.length > 0) {
    md += `### Risks (${data.risk.length})\n\n`;
    data.risk.forEach(r => {
      md += `- ⚠️ ${r.text} [${r.priority}]\n`;
    });
    md += '\n';
  }

  if (data.techNote.length > 0) {
    md += `### Technical Notes\n\n`;
    data.techNote.forEach(t => {
      const text = compact ? _truncateDescription(t.text) : t.text;
      md += `- 🔧 ${text}\n`;
    });
    md += '\n';
  }

  if (data.dependencies.length > 0) {
    md += `### Dependency Graph\n\n`;
    data.dependencies.forEach(d => {
      const arrow = d.directed ? '→' : '↔';
      md += `- ${d.from.text} ${arrow} ${d.to.text}\n`;
    });
    md += '\n';
  }

  // ─── Integrations & Services (Phase 8) ──────────────────────────
  if (data.integrations && data.integrations.length > 0) {
    md += `### Integrations & Services (${data.integrations.length})\n\n`;

    // Group by category
    const byCategory = {};
    data.integrations.forEach(ig => {
      const cat = ig.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(ig);
    });

    Object.entries(byCategory).forEach(([category, items]) => {
      const catLabel = category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      md += `**${catLabel}**\n\n`;
      items.forEach(ig => {
        const status = ig.hasCredentials ? '✅' : '⬜';
        md += `- ${ig.icon} ${ig.label} ${status}`;
        if (!compact && ig.configuredFields.length > 0) {
          const fields = ig.configuredFields.map(f => `${f.label}: ${f.value}`).join(', ');
          md += ` — ${fields}`;
        }
        md += '\n';
      });
      md += '\n';
    });
  }

  if (data.executionOrder.length > 0) {
    md += `### Execution Order (Topological)\n\n`;
    data.executionOrder.forEach((n, i) => {
      if (n.text) {
        md += `${i + 1}. ${n.text} *(${n.type}, ${n.priority})*\n`;
      }
    });
    md += '\n';
  }

  // ─── Milestones Preview ─────────────────────────────────────────
  const milestones = taskDef.execution_strategy?.milestones || [];
  if (milestones.length > 0) {
    md += `## Milestone Plan\n\n`;
    milestones.forEach(m => {
      md += `### Phase ${m.phase}: ${m.name}\n\n`;
      m.tasks.forEach(t => {
        md += `- [ ] ${t}\n`;
      });
      md += '\n';
    });
  }

  md += `---\n\n`;
  md += `*This prompt was generated from a MindMapper mind map. Copy the JSON task definition above and paste it into Claude Code to execute the workflow.*\n`;

  return md;
}

/**
 * Generate ONLY the raw JSON task definition (no markdown wrapping)
 * Useful for direct API integration or clipboard copy of just the JSON
 */
export function generateTaskJSON(data, options = {}) {
  const model = options.model || 'claude-4.6';
  const mode = options.mode || 'planning';
  const stack = options.stack || _inferStack(data);

  return _buildTaskDefinition(data, { model, mode, stack, ...options });
}
