/**
 * Agent Framework — Barrel export.
 *
 * Re-exports all agent framework modules for easy consumption.
 *
 * Usage:
 *   import { ExecutionEngine, COOAgent, AgentRegistry } from './agents/index.js';
 */

export { AgentBase, AGENT_STATE } from './AgentBase.js';
export { AgentRegistry } from './AgentRegistry.js';
export { MessageBus, MSG_TYPE } from './MessageBus.js';
export { ContextManager } from './ContextManager.js';
export { CostTracker } from './CostTracker.js';
export { ExecutionEngine, ENGINE_STATE } from './ExecutionEngine.js';
export { COOAgent } from './COOAgent.js';
export { AGENT_PROMPTS, getAgentPrompt } from './prompts/AgentPrompts.js';
export {
  createAgent, SPECIALIST_ROLES,
  CTOAgent, CFOAgent, FrontendAgent,
  BackendAgent, DevOpsAgent, QAAgent, ResearcherAgent,
  DevilsAdvocateAgent, SentinelAgent, DocumenterAgent,
  TokenAuditorAgent, ApiCostAuditorAgent, ProjectAuditorAgent,
} from './SpecialistAgents.js';

