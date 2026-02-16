/**
 * COOAgent — The Chief Operating Officer agent.
 *
 * This is the FIRST real agent implementation in the MindMapper framework.
 * The COO is the operational command center that:
 *
 *   1. Reads the serialized mind map
 *   2. Creates a structured phase plan (phases → milestones → tasks)
 *   3. Assigns tasks to the most appropriate agent roles
 *   4. Routes sub-tasks to cost-efficient model tiers
 *   5. Manages round transitions and reviews
 *
 * The COO operates on the STANDARD tier — it needs good reasoning
 * but doesn't require the deep analysis of opus-tier agents.
 */

import { AgentBase, AGENT_STATE } from './AgentBase.js';

export class COOAgent extends AgentBase {

  get roleId() { return 'coo'; }
  get displayName() { return 'COO / Orchestrator'; }

  /**
   * Override model tier — COO uses standard for cost balance.
   */
  get modelTier() { return 'standard'; }

  /**
   * Build a COO-specific task prompt.
   * Injects mind map data structure and planning instructions.
   */
  buildTaskPrompt(task) {
    let prompt = `## Operational Task: ${task.title}\n\n`;
    prompt += `${task.description || ''}\n\n`;

    // Add team roster awareness
    prompt += `### Available Agent Team\n`;
    prompt += `You have the following agents available for task assignment:\n`;
    prompt += `- **CTO** (opus tier) — Architecture, tech stack decisions\n`;
    prompt += `- **CFO** (standard tier) — Budget tracking, cost optimization\n`;
    prompt += `  - Token Auditor (flash tier) — reports to CFO\n`;
    prompt += `  - API Cost Auditor (flash tier) — reports to CFO\n`;
    prompt += `- **Frontend UI/UX** (standard tier) — UI/UX design + implementation\n`;
    prompt += `- **Backend Developer** (standard tier) — API, data, auth\n`;
    prompt += `- **DevOps Architect** (standard tier) — CI/CD, deployment, infra\n`;
    prompt += `- **Deep Researcher** (standard tier) — Research and documentation\n`;
    prompt += `- **QA / Test Engineer** (standard tier) — Testing\n`;
    prompt += `- **Devil's Advocate** (standard tier) — Quality review, challenges assumptions\n`;
    prompt += `- **Sentinel** (opus tier) — Security audit, prompt injection defense\n`;
    prompt += `- **Documenter** (flash tier) — Documentation\n`;
    prompt += `- **Project Auditor** (flash tier) — reports to COO\n\n`;

    prompt += `### Instructions\n`;
    prompt += `1. Analyze the provided data thoroughly.\n`;
    prompt += `2. Create a structured execution plan with clear phases.\n`;
    prompt += `3. Assign EVERY task to a specific agent by their role ID.\n`;
    prompt += `4. Use the most cost-efficient tier for each task.\n`;
    prompt += `5. Sequence work logically: architecture → backend → frontend → integration → QA → security.\n`;
    prompt += `6. Return ONLY the JSON plan — no commentary.\n\n`;

    prompt += `### Expected Output Format\n`;
    prompt += '```json\n';
    prompt += `{\n`;
    prompt += `  "phases": [\n`;
    prompt += `    {\n`;
    prompt += `      "id": "phase-1",\n`;
    prompt += `      "name": "Phase Name",\n`;
    prompt += `      "milestones": [\n`;
    prompt += `        {\n`;
    prompt += `          "id": "m1",\n`;
    prompt += `          "title": "Milestone Title",\n`;
    prompt += `          "tasks": [\n`;
    prompt += `            {\n`;
    prompt += `              "id": "t1",\n`;
    prompt += `              "title": "Task Title",\n`;
    prompt += `              "assignedTo": "backend",\n`;
    prompt += `              "tier": "standard",\n`;
    prompt += `              "description": "What needs to be done"\n`;
    prompt += `            }\n`;
    prompt += `          ]\n`;
    prompt += `        }\n`;
    prompt += `      ]\n`;
    prompt += `    }\n`;
    prompt += `  ],\n`;
    prompt += `  "summary": "Plan summary",\n`;
    prompt += `  "estimatedRounds": 3\n`;
    prompt += `}\n`;
    prompt += '```\n';

    return prompt;
  }

  /**
   * Parse the COO's response into a structured plan.
   *
   * The COO should return a JSON plan, but we handle cases where
   * the response includes markdown formatting around the JSON.
   *
   * @param {string} rawResponse
   * @returns {object} — the structured phase plan
   */
  parseResponse(rawResponse) {
    try {
      // Try direct JSON parse first
      return JSON.parse(rawResponse);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = rawResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim());
        } catch (e) {
          console.warn('[COOAgent] Failed to parse extracted JSON:', e.message);
        }
      }

      // Try finding a JSON object in the response
      const braceMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch (e) {
          console.warn('[COOAgent] Failed to parse braced JSON:', e.message);
        }
      }

      // Last resort: return as unstructured
      console.warn('[COOAgent] Could not parse structured plan, returning raw.');
      return {
        phases: [{
          id: 'phase-1',
          name: 'Auto-generated Phase',
          milestones: [{
            id: 'm1',
            title: 'Review COO Output',
            tasks: [{
              id: 't1',
              title: 'Manual review required',
              assignedTo: 'coo',
              tier: 'standard',
              description: rawResponse.substring(0, 500),
            }],
          }],
        }],
        summary: 'COO response could not be parsed into structured plan.',
        estimatedRounds: 1,
        _raw: rawResponse,
      };
    }
  }

  /**
   * Create a plan directly from mind map data WITHOUT calling the AI.
   * This is used as a fast local fallback when no API key is available
   * or for dry-run / preview mode.
   *
   * @param {object} mindMapData — serialized mind map
   * @param {object} projectContext — { projectName, stack, features, constraints }
   * @returns {object} — structured plan
   */
  createLocalPlan(mindMapData, projectContext = {}) {
    const nodes = mindMapData?.nodes || [];
    const features = nodes
      .filter(n => n.type === 'feature' || n.type === 'requirement')
      .map(n => ({
        label: n.label || n.text || 'Unnamed feature',
        priority: n.priority || 'medium',
        description: n.description || '',
      }));

    const integrations = nodes
      .filter(n => n.type?.includes('commerce') || n.type?.includes('social') || n.type?.includes('sheet'))
      .map(n => n.label || n.type);

    // Build phases based on feature count and complexity
    const phases = [];

    // Phase 1: Architecture & Research
    phases.push({
      id: 'phase-1',
      name: 'Architecture & Research',
      milestones: [{
        id: 'm1_1',
        title: 'System Architecture',
        tasks: [
          { id: 't1_1', title: 'Define system architecture', assignedTo: 'cto', tier: 'opus', description: `Design architecture for ${projectContext.projectName || 'the project'} using ${projectContext.stack || 'optimal stack'}.` },
          { id: 't1_2', title: 'Research tech stack', assignedTo: 'deep-researcher', tier: 'standard', description: `Research best practices and gotchas for the chosen stack.` },
          { id: 't1_3', title: 'Security requirements', assignedTo: 'sentinel', tier: 'opus', description: 'Define security requirements, authentication strategy, and data protection plan.' },
          { id: 't1_4', title: 'UI/UX design system', assignedTo: 'frontend', tier: 'standard', description: 'Design the visual system: colors, typography, spacing, component patterns.' },
        ],
      }],
    });

    // Phase 2: Core Implementation
    const coreTasks = features.map((f, i) => ({
      id: `t2_${i + 1}`,
      title: `Implement: ${f.label}`,
      assignedTo: f.label.toLowerCase().includes('ui') || f.label.toLowerCase().includes('page') ? 'frontend' : 'backend',
      tier: 'standard',
      description: f.description || `Implement the ${f.label} feature.`,
    }));

    if (coreTasks.length > 0) {
      phases.push({
        id: 'phase-2',
        name: 'Core Feature Implementation',
        milestones: [{
          id: 'm2_1',
          title: 'Build Core Features',
          tasks: coreTasks,
        }],
      });
    }

    // Phase 3: Integrations (if any)
    if (integrations.length > 0) {
      phases.push({
        id: 'phase-3',
        name: 'Integrations',
        milestones: [{
          id: 'm3_1',
          title: 'Connect External Services',
          tasks: integrations.map((integ, i) => ({
            id: `t3_${i + 1}`,
            title: `Integrate: ${integ}`,
            assignedTo: 'backend',
            tier: 'standard',
            description: `Set up and integrate ${integ}.`,
          })),
        }],
      });
    }

    // Phase 4: Testing & Security Review
    phases.push({
      id: `phase-${phases.length + 1}`,
      name: 'Testing & Security Review',
      milestones: [{
        id: `m${phases.length + 1}_1`,
        title: 'Quality Assurance',
        tasks: [
          { id: `t${phases.length + 1}_1`, title: 'Write unit tests', assignedTo: 'qa-tester', tier: 'standard', description: 'Write comprehensive unit and integration tests.' },
          { id: `t${phases.length + 1}_2`, title: 'Security audit', assignedTo: 'sentinel', tier: 'opus', description: 'Full security audit of implemented features.' },
          { id: `t${phases.length + 1}_3`, title: 'Quality review', assignedTo: 'devils-advocate', tier: 'standard', description: 'Review all agent output for quality and completeness.' },
          { id: `t${phases.length + 1}_4`, title: 'Project documentation', assignedTo: 'documenter', tier: 'flash', description: 'Document all decisions, APIs, and setup instructions.' },
        ],
      }],
    });

    return {
      phases,
      summary: `${phases.length}-phase plan covering ${features.length} features and ${integrations.length} integrations.`,
      estimatedRounds: phases.length,
    };
  }
}
