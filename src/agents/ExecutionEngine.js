/**
 * ExecutionEngine — Round-based multi-agent execution manager.
 *
 * This is the brain that orchestrates the agent team through
 * structured rounds of planning, implementation, testing, and review.
 *
 * Lifecycle:
 *   1. COO receives the mind map and creates a phase plan
 *   2. For each phase, the Engine executes rounds of tasks
 *   3. Each round: assign tasks → agents execute → COO reviews → next round
 *   4. CEO approval gates between phases (when hands-off is false)
 *
 * State machine:
 *   idle → planning → executing → reviewing → phase-complete
 *                                              → next-phase or session-complete
 *
 * This module wraps the existing OrchestrationEngine for session lifecycle
 * but adds round management, task queuing, and agent coordination.
 */

import { AgentRegistry } from '../agents/AgentRegistry.js';
import { createAgent } from '../agents/SpecialistAgents.js';
import { MessageBus, MSG_TYPE } from '../agents/MessageBus.js';
import { ContextManager } from '../agents/ContextManager.js';
import { CostTracker } from '../agents/CostTracker.js';

// ─── Engine States ──────────────────────────────────────────────────────

export const ENGINE_STATE = Object.freeze({
  IDLE:              'idle',
  PLANNING:          'planning',       // COO is creating phase plan
  EXECUTING:         'executing',      // Agents are working on tasks
  REVIEWING:         'reviewing',      // DA + COO reviewing round output
  AWAITING_APPROVAL: 'awaiting-approval', // CEO gate between phases
  PHASE_COMPLETE:    'phase-complete',
  SESSION_COMPLETE:  'session-complete',
  ERROR:             'error',
  PAUSED:            'paused',
});

// ─── ExecutionEngine ────────────────────────────────────────────────────

export class ExecutionEngine {

  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('../orchestration/BrowserAgentBridge.js').BrowserAgentBridge} bridge
   * @param {object} projectContext — { projectName, stack, features, constraints }
   */
  constructor(bus, bridge, projectContext = {}) {
    this._bus = bus;
    this._bridge = bridge;
    this._projectContext = projectContext;

    // Core framework components
    this._registry = new AgentRegistry();
    this._messageBus = new MessageBus();
    this._contextManager = new ContextManager(projectContext);
    this._costTracker = new CostTracker(bus);

    // State
    this._state = ENGINE_STATE.IDLE;
    this._currentPlan = null;      // from COO
    this._currentPhase = null;     // active phase
    this._currentRound = 0;
    this._taskQueue = [];          // tasks for current round
    this._completedTasks = [];
    this._roundResults = [];
    this._sessionId = null;
    this._handsOff = false;

    this._unlisteners = [];
    this._attachListeners();
  }

  /* ─── Public API ───────────────────────────────────────── */

  get state() { return this._state; }
  static get STATE() { return ENGINE_STATE; }
  get registry() { return this._registry; }
  get messageBus() { return this._messageBus; }
  get contextManager() { return this._contextManager; }
  get costTracker() { return this._costTracker; }
  get currentPlan() { return this._currentPlan; }
  get currentPhase() { return this._currentPhase; }
  get currentRound() { return this._currentRound; }

  /**
   * Start a new execution session.
   *
   * @param {object}   opts
   * @param {object}   opts.mindMapData — serialized mind map
   * @param {boolean}  [opts.handsOff]  — skip CEO approval gates
   * @param {Function} [opts.cooAgent]  — injected COO agent instance
   * @returns {Promise<{ sessionId: string, plan: object }>}
   */
  async startSession(opts) {
    if (this._state !== ENGINE_STATE.IDLE && this._state !== ENGINE_STATE.SESSION_COMPLETE) {
      throw new Error(`Cannot start session in state "${this._state}".`);
    }

    this._transition(ENGINE_STATE.PLANNING);
    this._handsOff = opts.handsOff || false;
    this._sessionId = `exec_${Date.now().toString(36)}`;
    this._currentRound = 0;
    this._completedTasks = [];
    this._roundResults = [];

    // Clear previous session data
    this._messageBus.clear();
    this._costTracker.reset();

    // Instantiate all specialist agents into the registry
    this._instantiateAgents();

    try {
      // Phase 1: COO creates the execution plan
      this._bus.emit('execution:planning-started', { sessionId: this._sessionId });

      let plan;
      if (opts.cooAgent) {
        // Use injected COO agent to create plan
        const result = await opts.cooAgent.execute({
          title: 'Create Execution Plan',
          description: `Analyze the mind map and create a structured phase plan.\n\nMind Map Data:\n${JSON.stringify(opts.mindMapData, null, 2)}`,
          context: JSON.stringify(this._projectContext),
        });
        plan = result.parsed;
      } else {
        // Fallback: create a simple default plan
        plan = this._createDefaultPlan(opts.mindMapData);
      }

      this._currentPlan = plan;

      // Broadcast plan to all agents
      this._messageBus.broadcast('coo', `Execution plan created: ${plan.phases?.length || 0} phases, estimated ${plan.estimatedRounds || 1} rounds.`, {
        type: MSG_TYPE.TASK,
        data: plan,
      });

      this._bus.emit('execution:plan-ready', {
        sessionId: this._sessionId,
        plan,
      });

      return { sessionId: this._sessionId, plan };

    } catch (err) {
      this._transition(ENGINE_STATE.ERROR);
      this._bus.emit('execution:error', { error: err.message });
      throw err;
    }
  }

  /**
   * Execute the next phase of the plan.
   * @returns {Promise<object>} — phase results
   */
  async executeNextPhase() {
    if (!this._currentPlan?.phases?.length) {
      throw new Error('No plan loaded. Call startSession first.');
    }

    const phases = this._currentPlan.phases;
    const phaseIndex = this._currentPhase
      ? phases.findIndex(p => p.id === this._currentPhase.id) + 1
      : 0;

    if (phaseIndex >= phases.length) {
      this._transition(ENGINE_STATE.SESSION_COMPLETE);
      const finalReport = this._costTracker.finalize();
      this._bus.emit('execution:session-complete', {
        sessionId: this._sessionId,
        cost: finalReport,
      });
      return { complete: true, report: finalReport };
    }

    this._currentPhase = phases[phaseIndex];
    this._currentRound = 0;

    this._bus.emit('execution:phase-started', {
      sessionId: this._sessionId,
      phase: this._currentPhase,
      phaseIndex,
      totalPhases: phases.length,
    });

    // Execute rounds within the phase
    const milestones = this._currentPhase.milestones || [];
    for (const milestone of milestones) {
      this._currentRound++;
      await this._executeRound(milestone);
    }

    this._transition(ENGINE_STATE.PHASE_COMPLETE);

    this._bus.emit('execution:phase-complete', {
      sessionId: this._sessionId,
      phase: this._currentPhase,
      results: this._roundResults,
    });

    // CEO approval gate (unless hands-off)
    if (!this._handsOff) {
      this._transition(ENGINE_STATE.AWAITING_APPROVAL);
      this._bus.emit('execution:approval-needed', {
        sessionId: this._sessionId,
        phase: this._currentPhase,
        message: `Phase "${this._currentPhase.name}" complete. Approve to proceed to next phase.`,
      });
    }

    return {
      complete: false,
      phase: this._currentPhase,
      results: this._roundResults,
    };
  }

  /**
   * CEO approves current phase, allowing progression.
   */
  approveCurrent() {
    if (this._state !== ENGINE_STATE.AWAITING_APPROVAL) {
      console.warn('[ExecutionEngine] Not awaiting approval.');
      return;
    }
    this._messageBus.broadcast('ceo', `Phase "${this._currentPhase.name}" approved. Proceeding.`, {
      type: MSG_TYPE.APPROVAL,
    });
    this._transition(ENGINE_STATE.IDLE);
  }

  /**
   * Pause execution.
   */
  pause() {
    if (this._state === ENGINE_STATE.EXECUTING || this._state === ENGINE_STATE.REVIEWING) {
      this._transition(ENGINE_STATE.PAUSED);
      this._bus.emit('execution:paused', { sessionId: this._sessionId });
    }
  }

  /**
   * Resume from pause.
   */
  resume() {
    if (this._state === ENGINE_STATE.PAUSED) {
      this._transition(ENGINE_STATE.EXECUTING);
      this._bus.emit('execution:resumed', { sessionId: this._sessionId });
    }
  }

  /**
   * Get a summary of execution stats.
   */
  getSummary() {
    return {
      state: this._state,
      sessionId: this._sessionId,
      currentPhase: this._currentPhase?.name || null,
      currentRound: this._currentRound,
      totalPhases: this._currentPlan?.phases?.length || 0,
      completedTasks: this._completedTasks.length,
      cost: this._costTracker.getSnapshot(),
      messages: this._messageBus.count,
      threads: this._messageBus.threadCount,
    };
  }

  /**
   * Clean up.
   */
  destroy() {
    this._unlisteners.forEach(fn => fn());
    this._unlisteners = [];
  }

  /* ─── Internal: Round Execution ────────────────────────── */

  /**
   * Execute a single milestone round.
   * @param {object} milestone — { id, title, tasks[] }
   */
  async _executeRound(milestone) {
    this._transition(ENGINE_STATE.EXECUTING);
    this._taskQueue = [...(milestone.tasks || [])];

    this._bus.emit('execution:round-started', {
      sessionId: this._sessionId,
      round: this._currentRound,
      milestone: milestone.title,
      taskCount: this._taskQueue.length,
    });

    // Log to MessageBus
    this._messageBus.send('coo', '@all', `Round ${this._currentRound}: ${milestone.title} — ${this._taskQueue.length} tasks.`, {
      type: MSG_TYPE.TASK,
    });

    const roundResults = [];

    // Execute tasks sequentially (future: parallel by dependency)
    for (const task of this._taskQueue) {
      const roleId = task.assignedTo;
      const agentEntry = this._registry.get(roleId);

      if (!agentEntry) {
        console.warn(`[ExecutionEngine] No agent for role "${roleId}", skipping task "${task.title}".`);
        roundResults.push({ task, status: 'skipped', reason: 'no agent' });
        continue;
      }

      const agentInstance = agentEntry.instance;
      if (!agentInstance) {
        // No live agent instance — record as pending
        roundResults.push({ task, status: 'pending', reason: 'agent not instantiated' });

        // Notify via MessageBus
        this._messageBus.send('coo', `@${roleId}`, `Task assigned: ${task.title}`, {
          type: MSG_TYPE.TASK,
          data: task,
        });
        continue;
      }

      try {
        // Build context for this agent
        const context = this._contextManager.buildContext(
          roleId,
          agentEntry.config.tier,
          task,
          this._messageBus.getAll()
        );

        // Execute via agent (merge ContextManager output into task)
        const taskWithContext = { ...task, context: context.systemContext };
        const result = await agentInstance.execute(taskWithContext, this._messageBus.getAll());

        // Record cost
        this._costTracker.record(roleId, agentEntry.config.tier, 'claude-sonnet-4-20250514', result.tokens || { input: 0, output: 0 });

        // Add to context for other agents
        this._contextManager.addAgentContext(roleId, `Completed: ${task.title}`, 'decision');

        // Post result to MessageBus
        this._messageBus.send(roleId, '@coo', `Task completed: ${task.title}`, {
          type: MSG_TYPE.RESPONSE,
          data: result.parsed,
        });

        roundResults.push({ task, status: 'completed', result });
        this._completedTasks.push({ ...task, result });

      } catch (err) {
        roundResults.push({ task, status: 'failed', error: err.message });
        this._messageBus.send(roleId, '@coo', `Task failed: ${task.title} — ${err.message}`, {
          type: MSG_TYPE.ESCALATION,
        });
      }
    }

    // Round review
    this._transition(ENGINE_STATE.REVIEWING);
    this._roundResults = roundResults;

    this._bus.emit('execution:round-complete', {
      sessionId: this._sessionId,
      round: this._currentRound,
      results: roundResults,
    });

    return roundResults;
  }

  /**
   * Instantiate all specialist agents and register them in the registry.
   * Called at the start of each session to ensure all agents are ready.
   */
  _instantiateAgents() {
    const deps = {
      bus: this._bus,
      bridge: this._bridge,
      projectContext: this._projectContext,
    };
    for (const entry of this._registry.getExecutable()) {
      const roleId = entry.role.id;
      if (roleId === 'coo') continue; // COO is handled via startSession opts
      const instance = createAgent(roleId, deps);
      if (instance) {
        this._registry.registerInstance(roleId, instance);
      }
    }
  }

  /**
   * Create a default plan when no COO agent is available.
   * Extracts features from mind map and creates a simple 2-phase plan.
   */
  _createDefaultPlan(mindMapData) {
    const features = mindMapData?.nodes
      ?.filter(n => n.type === 'feature' || n.type === 'requirement')
      ?.map(n => n.label || n.text) || ['Core feature'];

    return {
      phases: [
        {
          id: 'phase-1',
          name: 'Foundation & Architecture',
          milestones: [{
            id: 'm1',
            title: 'Project Setup & Architecture',
            tasks: [
              { id: 't1_1', title: 'Define architecture', assignedTo: 'cto', tier: 'opus', description: 'Define system architecture based on requirements.' },
              { id: 't1_2', title: 'Research stack', assignedTo: 'deep-researcher', tier: 'standard', description: 'Research best practices for the chosen stack.' },
              { id: 't1_3', title: 'Security audit plan', assignedTo: 'sentinel', tier: 'opus', description: 'Define security requirements and audit plan.' },
            ],
          }],
        },
        {
          id: 'phase-2',
          name: 'Implementation',
          milestones: [{
            id: 'm2',
            title: 'Core Feature Build',
            tasks: features.map((f, i) => ({
              id: `t2_${i + 1}`,
              title: `Implement: ${f}`,
              assignedTo: 'backend',
              tier: 'standard',
              description: `Implement the feature: ${f}`,
            })),
          }],
        },
      ],
      summary: `Auto-generated plan with ${features.length} features across 2 phases.`,
      estimatedRounds: 2,
    };
  }

  /* ─── Event Listeners ──────────────────────────────────── */

  _attachListeners() {
    const on = (event, handler) => {
      this._unlisteners.push(this._bus.on(event, handler));
    };

    // Listen for CEO approval
    on('ceo:approval', (data) => {
      if (data.decision === 'approve') {
        this.approveCurrent();
      }
    });

    // Listen for cost alerts
    on('cost:alert', (data) => {
      this._messageBus.send('cfo', '@coo', `⚠️ ${data.message}`, {
        type: MSG_TYPE.ESCALATION,
      });
    });
  }

  /**
   * Map ExecutionEngine states → OrchestrationEngine-compatible states
   * so the AgentPanel can react to ExecutionEngine transitions.
   */
  static _stateMap = {
    [ENGINE_STATE.IDLE]:              'idle',
    [ENGINE_STATE.PLANNING]:          'initializing',
    [ENGINE_STATE.EXECUTING]:         'executing',
    [ENGINE_STATE.REVIEWING]:         'monitoring',
    [ENGINE_STATE.AWAITING_APPROVAL]: 'paused',
    [ENGINE_STATE.PHASE_COMPLETE]:    'monitoring',
    [ENGINE_STATE.SESSION_COMPLETE]:  'completed',
    [ENGINE_STATE.ERROR]:             'failed',
    [ENGINE_STATE.PAUSED]:            'paused',
  };

  /**
   * Transition state and emit.
   * Emits both execution:state-change and orchestration:state-change
   * so the AgentPanel (which listens to orchestration:*) stays in sync.
   */
  _transition(newState) {
    const prev = this._state;
    this._state = newState;
    this._bus.emit('execution:state-change', {
      previous: prev,
      current: newState,
      sessionId: this._sessionId,
    });
    // Bridge to orchestration events for AgentPanel compatibility
    const mappedState = ExecutionEngine._stateMap[newState] || 'idle';
    const mappedPrev = ExecutionEngine._stateMap[prev] || 'idle';
    this._bus.emit('orchestration:state-change', {
      previous: mappedPrev,
      current: mappedState,
      sessionId: this._sessionId,
    });
  }
}
