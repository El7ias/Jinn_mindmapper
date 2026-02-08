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

  const taskDef = _buildTaskDefinition(data, { model, mode, stack, ...options });
  const markdown = _formatAsMarkdown(taskDef, data);

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
    virtual_team: _buildVirtualTeam(data),
    project_context: _buildProjectContext(data),
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

// ─── Virtual Team Builder ──────────────────────────────────────────────
// Full roster mirrors AGENT_ROLES in NodeManager.js.
// Each role carries internal routing hints consumed by the executing agent;
// these are opaque to the MindMapper end user.

function _buildVirtualTeam(data) {
  const team = {};

  // ── Team Collaboration Protocol ─────────────────────────────────────
  // Defines HOW the team works together — not just individual roles.
  team._collaboration_protocol = {
    principle: "This is a full executive-managed project. The CEO (user) has delegated execution to this virtual team. Every role must be engaged and in active discussion from project kickoff through final deliverable. No silent handoffs.",
    per_milestone_workflow: [
      "1. KICKOFF BRIEFING — COO presents the milestone plan. CTO approves technical approach. CFO confirms budget is aligned. Creative Director sets design direction. Sentinel flags security considerations upfront.",
      "2. ACTIVE BUILD — Front-end, backend, and research agents execute. Creative Director reviews every UI decision in real-time. Sentinel audits every auth flow, endpoint, and data path AS it is built — not after.",
      "3. CROSS-ROLE REVIEW — All roles participate. CTO reviews architecture. Creative Director reviews visual quality. Sentinel reviews security. CFO checks cost efficiency. Devil's Advocate challenges everything.",
      "4. SIGN-OFF — COO summarizes outcomes. CTO confirms technical soundness. Sentinel confirms no security regressions. CFO confirms budget health. Documenter updates all artifacts. Only then does the milestone close."
    ],
    communication_rules: [
      "Every role must voice their perspective at each milestone — silence is not consent.",
      "Disagreements are resolved by escalation: Team → CTO/CFO → COO → CEO (user).",
      "Sentinel has veto power on any security concern — no role can override a security flag.",
      "Creative Director has final say on all visual/UX decisions — developers implement, not redesign.",
      "CFO can pause any initiative if costs exceed projected budgets by >30%."
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
    role: "Chief Operating Officer — operational command. Translates the CEO's vision into executed reality.",
    _routing: 'standard',
    responsibilities: [
      "Translate the CEO's mind map into concrete milestones, task groups, and sprint targets.",
      "Assign every task to the appropriate virtual role and maintain a living task board.",
      "Route each sub-task to the most cost-efficient model tier that can handle it correctly.",
      "Sequence work: architecture → backend contracts → frontend → integration → QA/security.",
      "Run daily stand-ups: gather status from all roles, identify blockers, redistribute work.",
      "Prepare concise executive summaries for the CEO at each milestone checkpoint.",
      "Coordinate cross-role handoffs — ensure the backend agent's API contracts reach the front-end agent before UI work begins.",
      "Use Flash tier for: heartbeat pings, status checks, task board updates, progress log entries.",
      "Escalate to Opus ONLY for: cross-cutting architecture decisions, unresolvable conflicts, novel problem-solving."
    ]
  };

  // ── CTO ────────────────────────────────────────────────────────────
  team.cto = {
    role: "Chief Technology Officer — architecture, technical strategy, and engineering excellence.",
    _routing: 'opus',
    responsibilities: [
      "Define and own the system architecture: module boundaries, data flow, communication patterns, technology choices.",
      "Make final calls on framework selection, infrastructure decisions, and build tooling.",
      "Evaluate technical trade-offs (performance vs. complexity, build vs. buy, monolith vs. micro).",
      "Review all cross-cutting concerns: caching, error handling patterns, logging, observability.",
      "Approve the technical design of each milestone BEFORE the team begins implementation.",
      "Participate in every cross-role review — technical soundness is non-negotiable.",
      "Mentor and review code from front-end and backend agents for quality and consistency.",
      "Maintain /docs/architecture.md as the living system design document."
    ]
  };

  // ── CFO ────────────────────────────────────────────────────────────
  team.cfo = {
    role: "Chief Financial Officer — budget oversight, cost optimization, and resource efficiency.",
    _routing: 'standard',
    responsibilities: [
      "Own the project budget: track token usage, API costs, and compute expenses across all roles.",
      "Set per-milestone cost targets and flag overruns before they compound.",
      "Conduct cost-benefit analysis on technology choices (e.g., managed service vs. self-hosted, premium API vs. open-source).",
      "Review model tier routing efficiency — ensure Flash tier is used for 70%+ of calls.",
      "Advise on build-vs-buy decisions from a financial perspective.",
      "Approve any expenditure that exceeds the per-task budget threshold.",
      "Produce a final cost report with breakdown by role, phase, and model tier.",
      "Coordinate with auditors on financial health metrics.",
      "Maintain /docs/budget-report.md with running cost tracking."
    ],
    budget_targets: {
      model_tier_allocation: "70% Flash, 25% Standard, 5% Opus by call volume",
      alert_threshold: "Flag if Tier 3 (Opus) usage exceeds 20% of total calls",
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

  // ── Research Agent ─────────────────────────────────────────────────
  team.research_agent = {
    role: "Technology analyst and research specialist — the team's knowledge base.",
    _routing: 'standard',
    responsibilities: [
      "Investigate best practices, patterns, and libraries relevant to the chosen stack.",
      "When encountering an implementation hurdle, pause to research options and summarize trade-offs BEFORE coding.",
      "Evaluate third-party dependencies for security, maintenance status, and license compatibility.",
      "Maintain /docs/tech-journal.md as a chronological log of decisions, rejected ideas, blockers, and resolutions.",
      "Cross-link to external documentation in comments and docs where helpful.",
      "Brief the CTO and CFO on technology choices with cost/benefit analysis."
    ]
  };

  if (data.reference.length > 0) {
    team.research_agent.research_items = data.reference.map(r => r.text);
  }

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
    role: "QA lead and architecture challenger — the team's critical thinker.",
    _routing: 'opus',
    responsibilities: [
      "After EVERY major milestone, run a comprehensive review pass.",
      "Challenge assumptions: performance, scalability, privacy, DX, long-term maintainability.",
      "Question architecture decisions — propose alternatives and stress-test trade-offs.",
      "Review for over-engineering — is the team building what the CEO asked for, or gold-plating?",
      "File concrete improvement tasks (code changes, tests, docs) and loop them back to the COO's plan.",
      "No milestone is complete until Devil's Advocate has reviewed AND the team has addressed findings."
    ],
    constraints: [
      "Zero tolerance for committed secrets, API keys, or sensitive identifiers in code, logs, or docs.",
      "Prefer explicit configuration and validation over hidden magic.",
      "Challenge scope creep — keep the team focused on the CEO's vision."
    ]
  };

  if (data.risk.length > 0) {
    team.devils_advocate.known_risks = data.risk.map(r => ({
      risk: r.text,
      priority: r.priority,
    }));
  }

  // ── Auditors (Token · API Cost · Project Health) ───────────────────
  team.auditors = {
    role: "Audit team — reports to CFO on token usage, API costs, and project health metrics.",
    _routing: 'flash',
    sub_roles: {
      token_auditor: "Track token consumption per task and per agent role. Flag excessive usage to CFO.",
      api_cost_auditor: "Monitor API call costs across providers. Alert CFO when spend exceeds expected budgets.",
      project_auditor: "Assess overall project health: milestone completion rate, tech debt accumulation, documentation coverage."
    },
    responsibilities: [
      "Maintain running cost and token logs after each major operation.",
      "Generate periodic efficiency reports: tokens spent vs. output value.",
      "Flag any role or task that is consuming disproportionate resources.",
      "Recommend model tier adjustments based on observed task complexity.",
      "Report to CFO at every milestone checkpoint."
    ]
  };

  return team;
}

// ─── Project Context ───────────────────────────────────────────────────

function _buildProjectContext(data) {
  const context = {
    product_name: data.projectName,
  };

  if (data.ceoVision) {
    context.ceo_vision = data.ceoVision;
  }

  // Features list
  if (data.feature.length > 0) {
    context.features = data.feature.map(f => ({
      name: f.text,
      priority: f.priority,
      ...(f.agentNotes ? { notes: f.agentNotes } : {}),
    }));
  }

  // Constraints
  if (data.constraint.length > 0) {
    context.constraints = data.constraint.map(c => ({
      constraint: c.text,
      priority: c.priority,
    }));
  }

  // Technical notes
  if (data.techNote.length > 0) {
    context.technical_notes = data.techNote.map(t => t.text);
  }

  // Dependency graph
  if (data.dependencies.length > 0) {
    context.dependency_graph = data.dependencies.map(d => ({
      from: d.from.text,
      to: d.to.text,
      relationship: d.type,
    }));
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

function _formatAsMarkdown(taskDef, data) {
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
      md += `- ${f.text}${pri}\n`;
    });
    md += '\n';
  }

  if (data.constraint.length > 0) {
    md += `### Constraints (${data.constraint.length})\n\n`;
    data.constraint.forEach(c => {
      md += `- 🔒 ${c.text}\n`;
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
      md += `- 🔧 ${t.text}\n`;
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
