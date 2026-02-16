/**
 * SpecialistAgents — All concrete agent implementations beyond COO.
 *
 * Each agent extends AgentBase with:
 *   - roleId / displayName identity
 *   - Custom parseResponse() for role-specific output
 *   - Optional buildTaskPrompt() overrides for specialized instructions
 *
 * Agents follow the tier map from AgentBase.DEFAULT_TIER_MAP:
 *   opus    → CTO, Sentinel (deep reasoning)
 *   standard → CFO, Frontend, Backend, DevOps, QA, Researcher, Devil's Advocate
 *   flash   → Documenter, Token Auditor, API Cost Auditor, Project Auditor
 */

import { AgentBase } from './AgentBase.js';

// ─── Helper ──────────────────────────────────────────────────────────────

/**
 * Robust response parser. Tries JSON first, then markdown code blocks,
 * then raw braces, then falls back to structured text extraction.
 */
function smartParse(rawResponse, fallbackLabel = 'Unstructured') {
  // 1. Direct JSON
  try { return JSON.parse(rawResponse); } catch { /* nope */ }

  // 2. JSON in code block
  const codeBlock = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch { /* nope */ }
  }

  // 3. Bare JSON object
  const braces = rawResponse.match(/\{[\s\S]*\}/);
  if (braces) {
    try { return JSON.parse(braces[0]); } catch { /* nope */ }
  }

  // 4. Fallback: extract markdown sections
  const sections = [];
  const headings = rawResponse.matchAll(/^#{1,3}\s+(.+)$/gm);
  let lastIdx = 0;
  for (const m of headings) {
    if (sections.length > 0) {
      sections[sections.length - 1].content = rawResponse.substring(lastIdx, m.index).trim();
    }
    sections.push({ title: m[1], content: '' });
    lastIdx = m.index + m[0].length;
  }
  if (sections.length > 0) {
    sections[sections.length - 1].content = rawResponse.substring(lastIdx).trim();
    return { label: fallbackLabel, sections, _raw: rawResponse };
  }

  return { label: fallbackLabel, text: rawResponse };
}


// ═════════════════════════════════════════════════════════════════════════
// CTO Agent — Architecture, technical decisions
// ═════════════════════════════════════════════════════════════════════════

export class CTOAgent extends AgentBase {
  get roleId() { return 'cto'; }
  get displayName() { return 'CTO / Architect'; }

  buildTaskPrompt(task) {
    let prompt = `## Architecture Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Analyze the technical requirements and constraints.\n`;
    prompt += `2. Design a scalable, maintainable architecture.\n`;
    prompt += `3. Specify technology choices with rationale.\n`;
    prompt += `4. Define the folder structure and module boundaries.\n`;
    prompt += `5. Identify technical risks and mitigation strategies.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return a structured architecture document with:\n`;
    prompt += `- **Stack**: chosen technologies with rationale\n`;
    prompt += `- **Architecture**: system design (layers, services, data flow)\n`;
    prompt += `- **Modules**: folder structure and module responsibilities\n`;
    prompt += `- **Risks**: technical risks and mitigations\n`;
    prompt += `- **Decisions**: key ADRs (Architecture Decision Records)\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Architecture Document');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// CFO Agent — Budget tracking, cost optimization
// ═════════════════════════════════════════════════════════════════════════

export class CFOAgent extends AgentBase {
  get roleId() { return 'cfo'; }
  get displayName() { return 'CFO / Budget'; }

  buildTaskPrompt(task) {
    let prompt = `## Financial Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Analyze cost implications of the current plan.\n`;
    prompt += `2. Track token/API usage and project budget.\n`;
    prompt += `3. Flag any cost overruns or inefficient tier usage.\n`;
    prompt += `4. Recommend cost-saving strategies WITHOUT sacrificing quality.\n`;
    prompt += `5. Be assertive about budget discipline.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return a financial summary with:\n`;
    prompt += `- **Budget Status**: current spend vs. estimated total\n`;
    prompt += `- **Tier Analysis**: usage breakdown by flash/standard/opus\n`;
    prompt += `- **Alerts**: any cost overruns or concerning patterns\n`;
    prompt += `- **Recommendations**: specific cost-saving actions\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'CFO Report');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Frontend Developer — UI implementation
// ═════════════════════════════════════════════════════════════════════════

export class FrontendAgent extends AgentBase {
  get roleId() { return 'frontend'; }
  get displayName() { return 'Frontend UI/UX'; }

  buildTaskPrompt(task) {
    let prompt = `## Frontend UI/UX Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `You are the combined UI/UX Designer AND Frontend Developer.\n`;
    prompt += `1. If this is a design task: define the visual system (colors, typography, spacing, animations), component specs, and interaction patterns.\n`;
    prompt += `2. If this is an implementation task: write clean, modular code following the design system.\n`;
    prompt += `3. Design with premium aesthetics — users should be wowed at first glance.\n`;
    prompt += `4. Ensure accessibility (WCAG AA minimum) and responsive behavior.\n`;
    prompt += `5. Consider performance: lazy loading, code splitting, asset optimization.\n`;
    prompt += `6. Think mobile-first, then scale up.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return structured output covering:\n`;
    prompt += `- **Visual System** (if design): color palette, font stack, spacing scale, motion specs\n`;
    prompt += `- **Components**: UI components with states, interactions, and responsive breakpoints\n`;
    prompt += `- **Files**: actual code files to create/modify\n`;
    prompt += `- **Dependencies**: any packages needed\n`;
    prompt += `- **Notes**: design rationale and implementation trade-offs\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Frontend UI/UX');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Backend Developer — API, data, authentication
// ═════════════════════════════════════════════════════════════════════════

export class BackendAgent extends AgentBase {
  get roleId() { return 'backend'; }
  get displayName() { return 'Backend Dev'; }

  buildTaskPrompt(task) {
    let prompt = `## Backend Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Implement the API, data layer, or business logic as specified.\n`;
    prompt += `2. Follow REST/GraphQL conventions and the CTO's architecture.\n`;
    prompt += `3. Include input validation and error handling.\n`;
    prompt += `4. Write secure code: parameterized queries, auth checks, etc.\n`;
    prompt += `5. Design for scalability and maintainability.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return implementation code with:\n`;
    prompt += `- **Files**: the actual code files to create/modify\n`;
    prompt += `- **API Contracts**: endpoint definitions (method, path, body, response)\n`;
    prompt += `- **Data Models**: schema definitions\n`;
    prompt += `- **Notes**: implementation details and trade-offs\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Backend Implementation');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// DevOps Engineer — CI/CD, deployment, infrastructure
// ═════════════════════════════════════════════════════════════════════════

export class DevOpsAgent extends AgentBase {
  get roleId() { return 'devops'; }
  get displayName() { return 'DevOps Engineer'; }

  buildTaskPrompt(task) {
    let prompt = `## DevOps Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Set up CI/CD pipelines, deployment configs, or infrastructure.\n`;
    prompt += `2. Use infrastructure-as-code where possible.\n`;
    prompt += `3. Implement proper environment management (dev/staging/prod).\n`;
    prompt += `4. Include monitoring, logging, and alerting.\n`;
    prompt += `5. Automate everything that can be automated.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return infrastructure specifications:\n`;
    prompt += `- **Config Files**: CI/CD pipelines, Dockerfiles, deployment configs\n`;
    prompt += `- **Environment**: env vars, secrets management approach\n`;
    prompt += `- **Monitoring**: logging and alerting setup\n`;
    prompt += `- **Runbook**: deployment and rollback procedures\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'DevOps Configuration');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// QA / Test Engineer — Testing
// ═════════════════════════════════════════════════════════════════════════

export class QAAgent extends AgentBase {
  get roleId() { return 'qa'; }
  get displayName() { return 'QA Engineer'; }

  buildTaskPrompt(task) {
    let prompt = `## QA Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Write comprehensive test cases for the specified feature.\n`;
    prompt += `2. Cover happy paths, edge cases, and error states.\n`;
    prompt += `3. Include unit tests, integration tests, and E2E test scenarios.\n`;
    prompt += `4. Test accessibility and responsive behavior.\n`;
    prompt += `5. Flag any gaps in testability.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return test specifications:\n`;
    prompt += `- **Test Plan**: overview and strategy\n`;
    prompt += `- **Test Cases**: individual tests with expected results\n`;
    prompt += `- **Code**: test implementation files\n`;
    prompt += `- **Coverage Gaps**: areas that need manual testing\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'QA Report');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Deep Researcher — Research and analysis
// ═════════════════════════════════════════════════════════════════════════

export class ResearcherAgent extends AgentBase {
  get roleId() { return 'researcher'; }
  get displayName() { return 'Deep Researcher'; }

  buildTaskPrompt(task) {
    let prompt = `## Research Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Research the topic thoroughly — best practices, gotchas, alternatives.\n`;
    prompt += `2. Compare options with clear trade-off analysis.\n`;
    prompt += `3. Provide concrete recommendations with evidence.\n`;
    prompt += `4. Include code examples or proof-of-concept where relevant.\n`;
    prompt += `5. Cite sources and document confidence levels.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return a research brief with:\n`;
    prompt += `- **Findings**: key discoveries and insights\n`;
    prompt += `- **Comparison**: options matrix with pros/cons\n`;
    prompt += `- **Recommendation**: clear, defensible recommendation\n`;
    prompt += `- **References**: sources and further reading\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Research Brief');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Devil's Advocate — Quality review, challenge assumptions
// ═════════════════════════════════════════════════════════════════════════

export class DevilsAdvocateAgent extends AgentBase {
  get roleId() { return 'da'; }
  get displayName() { return "Devil's Advocate"; }

  buildTaskPrompt(task) {
    let prompt = `## Review Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Challenge EVERY assumption in the current plan.\n`;
    prompt += `2. Find weaknesses, gaps, and potential failure modes.\n`;
    prompt += `3. Ask the hard questions nobody else is asking.\n`;
    prompt += `4. Identify technical debt that's being created.\n`;
    prompt += `5. Be constructive but unrelenting — better to find problems now.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return a critical review with:\n`;
    prompt += `- **🔴 Critical Issues**: things that will break if not fixed\n`;
    prompt += `- **🟡 Concerns**: things that should be addressed\n`;
    prompt += `- **🟢 Strengths**: things that are well done\n`;
    prompt += `- **Questions**: unanswered questions for the team\n`;
    prompt += `- **Risk Score**: 1-10 overall risk assessment\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Critical Review');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Sentinel — Security audit
// ═════════════════════════════════════════════════════════════════════════

export class SentinelAgent extends AgentBase {
  get roleId() { return 'sentinel'; }
  get displayName() { return 'Sentinel / Security'; }

  buildTaskPrompt(task) {
    let prompt = `## Security Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Audit ALL code and architecture for security vulnerabilities.\n`;
    prompt += `2. Check: authentication, authorization, input validation, XSS, CSRF, injection.\n`;
    prompt += `3. Review data handling: encryption at rest/transit, PII protection, key management.\n`;
    prompt += `4. Verify dependency security (known CVEs).\n`;
    prompt += `5. You have visibility into ALL agent outputs — no blind spots.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return a security audit with:\n`;
    prompt += `- **Vulnerabilities**: CVSS-scored findings (critical/high/medium/low)\n`;
    prompt += `- **Compliance**: OWASP Top 10 checklist status\n`;
    prompt += `- **Remediation**: specific fix instructions per finding\n`;
    prompt += `- **Security Score**: overall security posture (A-F)\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Security Audit');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Documenter — Documentation generation (flash tier)
// ═════════════════════════════════════════════════════════════════════════

export class DocumenterAgent extends AgentBase {
  get roleId() { return 'documenter'; }
  get displayName() { return 'Documenter'; }

  buildTaskPrompt(task) {
    let prompt = `## Documentation Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;
    prompt += `### Instructions\n`;
    prompt += `1. Write clear, concise documentation for the specified topic.\n`;
    prompt += `2. Include setup instructions, API references, and usage examples.\n`;
    prompt += `3. Use proper markdown formatting with headers and code blocks.\n`;
    prompt += `4. Target audience: developers who will maintain this project.\n\n`;
    prompt += `### Expected Output\n`;
    prompt += `Return documentation in markdown format.\n`;
    return prompt;
  }

  parseResponse(rawResponse) {
    return { label: 'Documentation', content: rawResponse };
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Auditor Agents — Lightweight flash-tier agents
// ═════════════════════════════════════════════════════════════════════════

export class TokenAuditorAgent extends AgentBase {
  get roleId() { return 'token-auditor'; }
  get displayName() { return 'Token Auditor'; }

  /** Reports to: CFO */
  get reportsTo() { return 'cfo'; }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Token Audit');
  }
}

export class ApiCostAuditorAgent extends AgentBase {
  get roleId() { return 'api-cost-auditor'; }
  get displayName() { return 'API Cost Auditor'; }

  /** Reports to: CFO */
  get reportsTo() { return 'cfo'; }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Cost Audit');
  }
}

export class ProjectAuditorAgent extends AgentBase {
  get roleId() { return 'project-auditor'; }
  get displayName() { return 'Project Auditor'; }

  /** Reports to: COO */
  get reportsTo() { return 'coo'; }

  parseResponse(rawResponse) {
    return smartParse(rawResponse, 'Project Audit');
  }
}


// ═════════════════════════════════════════════════════════════════════════
// Factory — Create agents by role ID
// ═════════════════════════════════════════════════════════════════════════

const AGENT_CLASS_MAP = {
  cto:              CTOAgent,
  cfo:              CFOAgent,
  frontend:         FrontendAgent,
  backend:          BackendAgent,
  devops:           DevOpsAgent,
  qa:               QAAgent,
  researcher:       ResearcherAgent,
  da:               DevilsAdvocateAgent,
  sentinel:         SentinelAgent,
  documenter:       DocumenterAgent,
  'token-auditor':  TokenAuditorAgent,
  'api-cost-auditor': ApiCostAuditorAgent,
  'project-auditor':  ProjectAuditorAgent,
};

/**
 * Create an agent instance by role ID.
 * @param {string} roleId
 * @param {object} deps — { bus, bridge, projectContext }
 * @returns {AgentBase|null}
 */
export function createAgent(roleId, deps) {
  const AgentClass = AGENT_CLASS_MAP[roleId];
  if (!AgentClass) {
    console.warn(`[AgentFactory] Unknown role: ${roleId}`);
    return null;
  }
  return new AgentClass(deps);
}

/** Get all available specialist role IDs */
export const SPECIALIST_ROLES = Object.keys(AGENT_CLASS_MAP);
