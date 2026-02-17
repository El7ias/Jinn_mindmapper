/**
 * MindMapper — Main Application Entry Point
 *
 * Initializes all modules, binds global keyboard shortcuts,
 * and coordinates save/load operations.
 */

import { EventBus } from './core/EventBus.js';
import { History } from './core/History.js';
import { Viewport } from './viewport/Viewport.js';
import { NodeManager } from './nodes/NodeManager.js';
import { ConnectionManager } from './connections/ConnectionManager.js';
import { ContextMenu } from './ui/ContextMenu.js';
import { PropertyPanel } from './ui/PropertyPanel.js';
import { MiniMap } from './ui/MiniMap.js';
import { Storage } from './storage/Storage.js';
import { PresetManager } from './presets/PresetManager.js';
import { PresetModal } from './ui/PresetModal.js';
import { FileManager } from './storage/FileManager.js';
import { FileMenu } from './ui/FileMenu.js';

// Phase 3 — Agent Orchestration
import { AgentPanel } from './ui/AgentPanel.js';
import { validateMindMap } from './validation/MindMapValidator.js';
import { PromptExportModal } from './ui/PromptExportModal.js';
import { IdeaInputModal } from './ui/IdeaInputModal.js';
import { computeLayout } from './ai/IdeaGenerator.js';
import { WorkspaceSettingsModal } from './ui/WorkspaceSettingsModal.js';

// Phase 8 — Commerce Nodes
import { CommerceNodeConfig } from './ui/CommerceNodeConfig.js';
import { CredentialVault } from './security/CredentialVault.js';

// Phase 4 — Desktop & Browser Orchestration
import { OrchestrationEngine } from './orchestration/OrchestrationEngine.js';
import { EnvironmentDetector } from './orchestration/EnvironmentDetector.js';
import { serializeMindMap } from './export/MindMapSerializer.js';
import { generateWorkflowPrompt } from './export/WorkflowPromptGenerator.js';
import { MCPConfigGenerator } from './integrations/MCPConfigGenerator.js';
import { ConnectionTester } from './integrations/ConnectionTester.js';

// Sprint 5 — Agent Framework + COO Agent
import { ExecutionEngine } from './agents/ExecutionEngine.js';
import { COOAgent } from './agents/COOAgent.js';
import { ContextManager } from './agents/ContextManager.js';

// Report prompt templates (extracted from main.js for clarity)
import { buildReportPrompt, summarizeMap } from './prompts/ReportPrompts.js';

class MindMapperApp {
  constructor() {
    // Core systems
    this.bus = new EventBus();
    this.history = new History(this.bus);
    this.viewport = new Viewport(this.bus);
    this.storage = new Storage(this.bus);

    // Domain managers
    this.nodeManager = new NodeManager(this.bus, this.viewport);
    this.connectionManager = new ConnectionManager(this.bus, this.nodeManager);
    this.nodeManager.setConnectionManager(this.connectionManager);

    // UI components
    this.contextMenu = new ContextMenu(this.bus, this.nodeManager, this.connectionManager, this.viewport);
    this.propertyPanel = new PropertyPanel(this.bus, this.nodeManager);
    this.miniMap = new MiniMap(this.bus, this.nodeManager, this.viewport);

    // Preset system
    this.presetManager = new PresetManager();
    this.presetModal = new PresetModal(
      this.presetManager,
      (data) => this._loadPreset(data),
      () => ({ nodes: this.nodeManager.serialize(), connections: this.connectionManager.serialize() })
    );

    // File management
    this.fileManager = new FileManager({
      getState: () => this._getState(),
      loadState: (data) => this._loadPreset(data),
      clearState: () => {
        this.history.pause();
        this.nodeManager.deserialize([]);
        this.connectionManager.deserialize([]);
        this.history.resume();
        this.bus.emit('state:loaded');
        this.bus.emit('state:changed');
      },
      fitToContent: () => this._fitToContent(),
      getNodeManager: () => this.nodeManager,
      getConnectionManager: () => this.connectionManager,
      bus: this.bus,
    });
    this.fileMenu = new FileMenu(this.fileManager);

    // ─── Orchestration Engine (session lifecycle + bridge management) ───
    // Owns the session state machine, bridge selection (Tauri vs browser),
    // prompt serialization, and session persistence via SessionStore.
    this.orchestrationEngine = new OrchestrationEngine(this.bus, {
      nodeManager: this.nodeManager,
      connectionManager: this.connectionManager,
    });

    // ─── Execution Engine (round-based multi-agent coordination) ───
    // Builds on top of OrchestrationEngine. Manages the COO planning loop,
    // agent task assignment, round execution, CEO approval gates, and
    // cost tracking. Uses the browser bridge from OrchestrationEngine.
    this.executionEngine = new ExecutionEngine(
      this.bus,
      this.orchestrationEngine.browserBridge,
      {} // projectContext populated at runtime
    );

    // Phase 3 — Agent Panel (with engine reference for CEO commands)
    this.agentPanel = new AgentPanel(this.bus, this.orchestrationEngine);

    // Phase 5 — Workspace Settings Modal
    this.workspaceSettingsModal = new WorkspaceSettingsModal(this.bus);

    // Phase 8 — Credential Vault + Commerce Node Config Panel + Connection Tester
    this.credentialVault = new CredentialVault(this.bus);
    this.orchestrationEngine.browserBridge.setVault(this.credentialVault);
    this.connectionTester = new ConnectionTester(this.bus, this.credentialVault);
    this.commerceNodeConfig = new CommerceNodeConfig(this.bus, this.nodeManager, this.credentialVault, this.connectionTester);

    // Phase 3 — Prompt Export Modal (core feature)
    this.promptExportModal = new PromptExportModal(
      this.bus,
      () => this.nodeManager.serialize(),
      () => this.connectionManager.serialize(),
      this.workspaceSettingsModal
    );

    // Phase 3 — AI Idea Input Modal
    this.ideaInputModal = new IdeaInputModal(
      this.bus,
      this.nodeManager,
      this.connectionManager
    );

    // Toolbar: Templates button
    document.getElementById('btn-presets')?.addEventListener('click', () => this.presetModal.show());

    // Toolbar: AI Generate Mind Map button
    document.getElementById('btn-ai-generate')?.addEventListener('click', () => this.ideaInputModal.show());

    // Toolbar: Workspace Settings button
    document.getElementById('btn-workspace-settings')?.addEventListener('click', () => this.workspaceSettingsModal.show());

    // Toolbar: Clean Layout button
    document.getElementById('btn-clean-layout')?.addEventListener('click', () => this._cleanLayout());

    // Agent Panel bus events — Generate Prompt & Agent Config (moved from toolbar)
    this.bus.on('ceo:generate-prompt-request', () => this.promptExportModal.show());
    this.bus.on('ceo:agent-config-request', () => this._generateAgentConfig());

    // Orchestration control events from AgentPanel
    this.bus.on('orchestration:pause-request', () => {
      try { this.orchestrationEngine.pauseSession(); }
      catch (e) { console.warn('Pause failed:', e.message); }
    });
    this.bus.on('orchestration:resume-request', () => {
      try { this.orchestrationEngine.resumeSession(); }
      catch (e) { console.warn('Resume failed:', e.message); }
    });
    this.bus.on('orchestration:cancel-request', async () => {
      try { await this.orchestrationEngine.cancelSession(); }
      catch (e) { console.warn('Cancel failed:', e.message); }
    });

    // ─── P1.6 — CEO Command Bar Events ──────────────────────────────
    this.bus.on('ceo:launch-request', () => this._runAgents());

    // Sprint 5 — Multi-Agent Orchestration (preview)
    this.bus.on('ceo:multi-agent-request', () => this._runMultiAgentPreview());

    this.bus.on('ceo:retry-request', async () => {
      if (!this.orchestrationEngine.lastPrompt) {
        console.warn('No previous session to retry.');
        return;
      }
      this.agentPanel.open();
      try {
        await this.orchestrationEngine.startSession(
          this.orchestrationEngine.lastOptions || {}
        );
      } catch (err) {
        console.error('Retry failed:', err);
      }
    });

    this.bus.on('ceo:copy-prompt-request', () => {
      // Generate prompt from current mind map and copy to clipboard
      try {
        const nodes = this.nodeManager.serialize();
        const connections = this.connectionManager.serialize();
        const serialized = serializeMindMap(nodes, connections, {});
        const prompt = generateWorkflowPrompt(serialized, {});
        navigator.clipboard.writeText(prompt);
      } catch (err) {
        console.warn('Copy prompt failed — use the Generate Prompt modal instead.', err);
      }
    });

    // ─── P1.6 — CEO Report Buttons (role-specific agent jobs) ──────
    this.bus.on('ceo:report-request', async ({ type, label }) => {
      try {
        // Pre-check for API key in browser mode
        if (!EnvironmentDetector.isTauri) {
          const hasKey = this.orchestrationEngine.hasBrowserApiKey();
          if (!hasKey) {
            const key = await this._promptSecureInput(
              `Running "<b>${label}</b>" requires an Anthropic API key.` +
              '<br><br>Get one at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>' +
              '<br>Your key is stored securely and never sent to our servers.',
              'sk-ant-...'
            );
            if (!key) return;
            await this.orchestrationEngine.browserBridge.setApiKey('anthropic', key.trim());
          }
        }

        const nodes = this.nodeManager.serialize();
        const connections = this.connectionManager.serialize();
        const serialized = serializeMindMap(nodes, connections, {});

        const reportPrompt = this._buildReportPrompt(type, label, serialized);
        if (!reportPrompt) {
          alert(`Unknown report type: ${type}`);
          return;
        }

        this.agentPanel.open();

        // Use the orchestration engine to run the report
        await this.orchestrationEngine.startSession({
          customPrompt: reportPrompt,
          reportType: type,
          reportLabel: label,
          handsOff: this.agentPanel.handsOff,
        });
      } catch (err) {
        console.error(`Report "${label}" failed:`, err);
        alert(`Failed to start ${label}: ${err.message}`);
      }
    });

    // ─── Implement Recommendations — Create nodes from AI audit actions ───
    this.bus.on('ceo:implement-recommendations', ({ actions, mode }) => {
      if (!actions || actions.length === 0) return;

      const isAll = mode === 'all';
      const toImplement = isAll ? actions : [actions[0]];
      const existingNodes = this.nodeManager.serialize();

      // Find rightmost edge for new node placement
      let maxX = 0;
      let baseY = 200;
      for (const n of existingNodes) {
        if (n.x > maxX) { maxX = n.x; baseY = n.y; }
      }
      const startX = maxX + 300;

      const created = [];
      const PRIORITY_COLORS = {
        critical: '#ff2d78',
        high: '#ff6e40',
        medium: '#ffc107',
        low: '#00ff88',
      };

      // Create nodes for each recommendation
      for (let i = 0; i < toImplement.length; i++) {
        const action = toImplement[i];
        const y = baseY + (i * 140) - ((toImplement.length - 1) * 70);
        const color = PRIORITY_COLORS[action.priority] || '#00e5ff';

        const nodeData = this.nodeManager.createNode(startX, y, {
          text: action.title,
          color,
          nodeType: action.nodeType || 'feature',
          priority: action.priority || 'medium',
          phase: action.phase ?? null,
          agentNotes: action.description || '',
        });
        created.push({ nodeData, action });
      }

      // Connect to parent nodes (match by text, case-insensitive)
      for (const { nodeData, action } of created) {
        if (!action.parent) continue;
        const parentText = action.parent.toLowerCase().trim();

        // Search existing nodes for a text match
        let parentNode = null;
        this.nodeManager.nodes.forEach(n => {
          if (n.text && n.text.toLowerCase().trim() === parentText) {
            parentNode = n;
          }
        });

        if (parentNode) {
          // Find best ports for the connection
          try {
            this.connectionManager.createConnection(
              parentNode.id, 'right',
              nodeData.id, 'left',
              { directed: 'forward' }
            );
          } catch (e) {
            console.warn(`Could not connect ${action.title} to ${action.parent}:`, e.message);
          }
        }
      }

      // Auto-layout after adding nodes
      setTimeout(() => {
        this._cleanLayout();
        this.bus.emit('state:changed');
      }, 200);

      // Notify the agent panel
      this.bus.emit('orchestration:progress', {
        type: 'text',
        content: `\n\n✅ **${created.length} node(s) implemented on canvas.**\n`,
      });
    });

    // Bind global shortcuts
    this._bindKeyboard();

    // Save/load coordination
    this._bindSaveLoad();

    // Viewport fit
    this.bus.on('viewport:fit-request', () => this._fitToContent());

    // Phase 3 — Readiness validation on state changes
    this._bindReadinessValidation();

    // Load saved state
    this._loadState();

    // App initialized
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Ignore when editing text
      if (document.activeElement?.isContentEditable || document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
        return;
      }

      // Ctrl+Z — Undo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        const state = this.history.undo();
        if (state) this._restoreState(state);
      }

      // Ctrl+Y — Redo
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        const state = this.history.redo();
        if (state) this._restoreState(state);
      }

      // Ctrl+S — Auto-save to localStorage
      if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        this.storage.save(this._getState());
      }

      // Delete/Backspace — Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (this.connectionManager.selectedConnection) {
          this.connectionManager.deleteSelectedConnection();
        } else {
          this.nodeManager.deleteSelected();
        }
      }

      // Ctrl+Shift+G — Generate Prompt
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        this.promptExportModal.show();
      }

      // Ctrl+Shift+I — AI Generate Mind Map
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        this.ideaInputModal.show();
      }

      // Escape — Deselect all
      if (e.key === 'Escape') {
        this.nodeManager.deselectAll();
        this.connectionManager.deselectConnection();
        this.bus.emit('selection:changed', []);
      }
    });
  }

  _bindSaveLoad() {
    // Auto-save on state change
    let stateChangeTimer = null;
    this.bus.on('state:changed', () => {
      // Push to history
      clearTimeout(stateChangeTimer);
      stateChangeTimer = setTimeout(() => {
        this.history.push(this._getState());
      }, 300);
    });

    // Save request from Storage's debounce
    this.bus.on('state:save-request', () => {
      this.storage.save(this._getState());
    });
  }

  /**
   * Phase 3 — Validate mind map readiness and emit result to Agent Panel
   */
  _bindReadinessValidation() {
    let readinessTimer = null;
    const check = () => {
      clearTimeout(readinessTimer);
      readinessTimer = setTimeout(() => {
        const nodes = this.nodeManager.serialize();
        const result = validateMindMap(
          nodes,
          this.connectionManager.serialize()
        );
        result.nodeCount = nodes.length;
        this.bus.emit('agent:readiness', result);
      }, 500);
    };
    this.bus.on('state:changed', check);
    this.bus.on('state:loaded', check);
  }

  _getState() {
    return {
      nodes: this.nodeManager.serialize(),
      connections: this.connectionManager.serialize(),
      viewport: this.viewport.getState(),
      projectMeta: this.fileManager ? this.fileManager.getProjectMeta() : undefined,
    };
  }

  _restoreState(state) {
    this.history.pause();
    this.nodeManager.deserialize(state.nodes);
    this.connectionManager.deserialize(state.connections);
    this.viewport.setState(state.viewport);
    this.history.resume();
    this.bus.emit('state:loaded');
  }

  _loadState() {
    const saved = this.storage.load();
    if (saved) {
      this.history.pause();
      this.nodeManager.deserialize(saved.nodes);
      this.connectionManager.deserialize(saved.connections);
      this.viewport.setState(saved.viewport);
      // Restore project title/description
      if (saved.projectMeta && this.fileManager) {
        this.fileManager.setProjectMeta(saved.projectMeta);
      }
      this.history.resume();
      this.bus.emit('state:loaded');
      // Hide help hint if there are nodes
      if (saved.nodes && saved.nodes.length > 0) {
        const hint = document.getElementById('help-hint');
        if (hint) hint.classList.add('hidden');
      }
    }
  }

  _fitToContent() {
    const bounds = this.nodeManager.getBounds();
    if (!bounds) return;

    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    const padding = 100;

    const scaleX = rect.width / (bounds.width + padding * 2);
    const scaleY = rect.height / (bounds.height + padding * 2);
    const zoom = Math.min(scaleX, scaleY, 1.5);

    const cx = bounds.minX + bounds.width / 2;
    const cy = bounds.minY + bounds.height / 2;

    this.viewport.zoom = zoom;
    this.viewport.x = rect.width / 2 - cx * zoom;
    this.viewport.y = rect.height / 2 - cy * zoom;
    this.viewport._applyTransform();
    this.bus.emit('viewport:changed', this.viewport.getState());
  }

  /**
   * Load a preset template onto the canvas.
   * Clears current state, deserializes preset data, fits viewport.
   */
  _loadPreset(data) {
    this.history.pause();
    // Clear existing
    this.nodeManager.deserialize([]);
    this.connectionManager.deserialize([]);
    // Load preset
    this.nodeManager.deserialize(data.nodes || []);
    this.connectionManager.deserialize(data.connections || []);
    this.history.resume();
    this.bus.emit('state:loaded');

    // Fit viewport after a tick so DOM has laid out
    requestAnimationFrame(() => {
      this._fitToContent();
      this.history.push(this._getState());
      this.bus.emit('state:changed');
    });

    // Hide help hint
    const hint = document.getElementById('help-hint');
    if (hint) hint.classList.add('hidden');
  }

  /**
   * Phase 4+5 — Launch agent execution via the COO agent pipeline.
   *
   * Flow: CEO clicks Launch → validate → create COO → ExecutionEngine.startSession →
   *       COO.execute(task) → BrowserAgentBridge API call → stream to AgentPanel →
   *       COO parses plan → plan stored → agent roster populated
   */
  async _runAgents() {
    // ── Pre-flight: API key ───────────────────────────────────────────
    if (!EnvironmentDetector.isTauri) {
      const hasKey = this.orchestrationEngine.hasBrowserApiKey();
      if (!hasKey) {
        const key = await this._promptSecureInput(
          'Enter your Anthropic API key to run agents from the browser.' +
          '<br><br>Get one at <a href="https://console.anthropic.com" target="_blank">console.anthropic.com</a>' +
          '<br>Your key is stored securely and never sent to our servers.',
          'sk-ant-...'
        );
        if (!key) return;
        await this.orchestrationEngine.browserBridge.setApiKey('anthropic', key.trim());
      }
    }

    // ── Pre-flight: mind map readiness ─────────────────────────────────
    const nodes = this.nodeManager.serialize();
    const connections = this.connectionManager.serialize();
    const validation = validateMindMap(nodes, connections);

    if (!validation.valid) {
      const issues = validation.errors.map(e => `• ${e}`).join('\n');
      alert(`Mind map is not ready:\n\n${issues}\n\nFix these issues before running agents.`);
      return;
    }

    // ── Serialize the mind map ─────────────────────────────────────────
    const projectName = this.fileManager?.currentFileName || 'Untitled';
    const serialized = serializeMindMap(nodes, connections, { projectName });

    // Build project context for the COO
    const projectContext = {
      projectName: serialized.projectName || projectName,
      stack: serialized.stack || '',
      features: serialized.nodes?.filter(n => n.type === 'feature' || n.type === 'requirement').map(n => n.label || n.text) || [],
      constraints: serialized.nodes?.filter(n => n.type === 'constraint').map(n => n.label || n.text) || [],
    };

    // ── Create the COO agent with the bridge ───────────────────────────
    const bridge = this.orchestrationEngine.browserBridge;
    const cooAgent = new COOAgent({
      bus: this.bus,
      bridge,
      projectContext,
    });

    // Update the execution engine's project context
    this.executionEngine._projectContext = projectContext;
    this.executionEngine._contextManager = new ContextManager(projectContext);

    // ── Open the Agent Panel ───────────────────────────────────────────
    this.agentPanel.open();

    // ── Register the agent roster ─────────────────────────────────────
    const statusDisplay = this.agentPanel.agentStatusDisplay;
    statusDisplay.clear();

    const displayNames = {
      cto: 'CTO / Architect', cfo: 'CFO / Budget',
      frontend: 'Frontend UI/UX', backend: 'Backend Dev', devops: 'DevOps Architect',
      qa: 'QA Engineer', researcher: 'Deep Researcher', da: "Devil's Advocate",
      sentinel: 'Sentinel', documenter: 'Documenter', coo: 'COO',
      'token-auditor': 'Token Auditor', 'api-cost-auditor': 'Cost Auditor',
      'project-auditor': 'Project Auditor',
    };

    // Show COO as active
    statusDisplay.registerAgent('coo', 'COO / Orchestrator', 'standard');
    statusDisplay.updateStatus('coo', 'thinking');

    // Show the full team
    const registry = this.executionEngine?.registry;
    if (registry) {
      for (const entry of registry.getAll()) {
        const id = entry.role?.id;
        if (!id || entry.config?.isHuman) continue;
        if (!statusDisplay._agents.has(id)) {
          const name = displayNames[id] || entry.role?.label || id;
          const tier = entry.config?.tier || 'standard';
          statusDisplay.registerAgent(id, name, tier);
        }
      }
    }
    statusDisplay.show();

    // ── Execute via ExecutionEngine + COO ──────────────────────────────
    try {
      const { plan } = await this.executionEngine.startSession({
        mindMapData: serialized,
        handsOff: this.agentPanel.handsOff,
        cooAgent,
      });

      // Update COO status
      statusDisplay.updateStatus('coo', 'done');

      // Register plan tasks in the roster
      if (plan?.phases) {
        const allTasks = plan.phases.flatMap(p =>
          p.milestones?.flatMap(m => m.tasks || []) || []
        );
        statusDisplay.registerFromPlan(allTasks, displayNames);
      }

      // Emit plan summary as a system message for the panel
      if (plan?.phases) {
        const planSummary = [
          `\n\n---\n## 📋 Execution Plan Ready`,
          `**${plan.phases.length} phases** | **${plan.estimatedRounds || '?'} estimated rounds**`,
          '',
          ...plan.phases.map(p => {
            const tasks = p.milestones?.flatMap(m => m.tasks || []) || [];
            const taskList = tasks.map(t => `  - \`${t.assignedTo}\` → ${t.title} *(${t.tier})*`).join('\n');
            return `### ${p.name}\n${tasks.length} tasks:\n${taskList}`;
          }),
          '',
          `> **Summary:** ${plan.summary || 'Plan created successfully.'}`,
          '',
          `*Plan generated by COO agent. Click Launch again to execute the next phase.*`,
        ].join('\n');

        this.bus.emit('orchestration:progress', {
          type: 'text',
          content: planSummary,
        });
      }

      console.log('[Agent Execution] COO plan generated:', plan);

    } catch (err) {
      console.error('[Agent Execution] COO planning failed:', err);
      statusDisplay.updateStatus('coo', 'error');

      // Fallback: offer local plan generation
      this.bus.emit('orchestration:progress', {
        type: 'text',
        content: `\n\n⚠️ **COO agent planning failed:** ${err.message}\n\n` +
          `Generating a local fallback plan from your mind map...\n`,
      });

      // Generate local plan as fallback
      try {
        const fallbackPlan = cooAgent.createLocalPlan(serialized, {
          projectName: projectContext.projectName,
          stack: projectContext.stack,
        });
        this.executionEngine._currentPlan = fallbackPlan;

        const allTasks = fallbackPlan.phases.flatMap(p =>
          p.milestones?.flatMap(m => m.tasks || []) || []
        );
        statusDisplay.registerFromPlan(allTasks, displayNames);
        statusDisplay.updateStatus('coo', 'done');

        this.bus.emit('orchestration:progress', {
          type: 'text',
          content: `✅ **Local fallback plan created:** ${fallbackPlan.phases.length} phases, ` +
            `${fallbackPlan.estimatedRounds} rounds.\n\n` +
            `> This plan was generated locally without an API call. ` +
            `Set your API key in Workspace Settings for AI-powered planning.\n`,
        });
      } catch (fallbackErr) {
        console.error('[Agent Execution] Fallback plan also failed:', fallbackErr);
      }
    }
  }

  /**
   * Sprint 5 — Multi-Agent Orchestration Preview.
   * Uses the COO agent's local planner to generate a structured
   * phase plan from the current mind map, displayed in the Agent Panel.
   */
  async _runMultiAgentPreview() {
    // Serialize the mind map
    const nodes = this.nodeManager.serialize();
    const connections = this.connectionManager.serialize();
    const serialized = serializeMindMap(nodes, connections, {
      projectName: this.fileManager?.currentFileName || 'Untitled',
    });

    // Create a COO agent (no bridge needed for local planning)
    const cooAgent = new COOAgent({
      bus: this.bus,
      bridge: this.orchestrationEngine.browserBridge,
      projectContext: {
        projectName: serialized.projectName || 'Untitled',
        stack: serialized.stack || '',
        features: serialized.nodes?.filter(n => n.type === 'feature').map(n => n.label) || [],
        constraints: serialized.nodes?.filter(n => n.type === 'constraint').map(n => n.label) || [],
      },
    });

    // Generate local plan (no API call)
    const plan = cooAgent.createLocalPlan(serialized, {
      projectName: serialized.projectName || 'Untitled',
      stack: serialized.stack || '',
    });

    // Display the plan in the agent panel
    this.agentPanel.open();

    // Emit plan as a system message for display
    const planSummary = [
      `## 🧠 Multi-Agent Execution Plan`,
      `**${plan.phases.length} phases** | **${plan.estimatedRounds} estimated rounds**`,
      '',
      ...plan.phases.map(p => {
        const taskCount = p.milestones.reduce((sum, m) => sum + (m.tasks?.length || 0), 0);
        const tasks = p.milestones.flatMap(m => m.tasks || []);
        const taskList = tasks.map(t => `  - \`${t.assignedTo}\` → ${t.title} *(${t.tier})*`).join('\n');
        return `### ${p.name}\n${taskCount} tasks:\n${taskList}`;
      }),
      '',
      `> **Summary:** ${plan.summary}`,
      '',
      `*This is a local preview. Click "Launch" to execute with AI agents.*`,
    ].join('\n');

    this.bus.emit('orchestration:progress', {
      type: 'text',
      content: planSummary,
    });

    // Store the plan on the execution engine
    this.executionEngine._currentPlan = plan;

    // Sprint 5 — Register agents in the status display grid
    const allTasks = plan.phases.flatMap(p =>
      p.milestones.flatMap(m => m.tasks || [])
    );
    const statusDisplay = this.agentPanel.agentStatusDisplay;
    statusDisplay.clear();

    // Agent display names lookup
    const displayNames = {
      cto: 'CTO / Architect', cfo: 'CFO / Budget',
      frontend: 'Frontend UI/UX', backend: 'Backend Dev', devops: 'DevOps Architect',
      qa: 'QA Engineer', researcher: 'Deep Researcher', da: "Devil's Advocate",
      sentinel: 'Sentinel', documenter: 'Documenter', coo: 'COO',
      'token-auditor': 'Token Auditor', 'api-cost-auditor': 'Cost Auditor',
      'project-auditor': 'Project Auditor', 'qa-tester': 'QA Engineer',
      'devils-advocate': "Devil's Advocate", 'deep-researcher': 'Deep Researcher',
    };

    statusDisplay.registerFromPlan(allTasks, displayNames);

    // Ensure the full team is visible, even agents without current tasks.
    // AgentRegistry.getAll() returns every registered role; skip the human CEO.
    const registry = this.executionEngine?.registry;
    if (registry) {
      for (const entry of registry.getAll()) {
        const id = entry.role?.id;
        if (!id || entry.config?.isHuman) continue;          // skip CEO
        if (!statusDisplay._agents.has(id)) {
          const name = displayNames[id] || entry.role.label || id;
          const tier = entry.config?.tier || 'standard';
          statusDisplay.registerAgent(id, name, tier);
        }
      }
    }

    statusDisplay.show();

    console.log('[Sprint 5] Multi-agent plan generated:', plan);
  }

  /**
   * P1.5 — Generate Agent Config: export MCP server config from commerce nodes.
   */
  async _generateAgentConfig() {
    // Check for commerce nodes
    const allNodes = [...this.nodeManager.nodes.values()];
    const commerceNodes = allNodes.filter(n => n.commerceType);

    if (commerceNodes.length === 0) {
      this.bus.emit('agent:message', {
        role: 'agent',
        content:
          '## ⚙️ Agent Config — No Commerce Nodes Found\n\n' +
          'This button exports your **commerce integration nodes** ' +
          '(Stripe, Shopify, SuperHive, etc.) into an **MCP server config file** ' +
          'that AI agents can use as tools.\n\n' +
          '### How to use it:\n' +
          '1. **Right-click** on the canvas\n' +
          '2. Select **Add Commerce Node**\n' +
          '3. Choose an integration (Stripe, Shopify, GitHub, etc.)\n' +
          '4. Optionally configure credentials via the node\'s settings\n' +
          '5. Click **⚙ Agent Config** again to export\n\n' +
          '> 💡 Regular text nodes labeled "Stripe" won\'t work — ' +
          'they must be created as **commerce-typed nodes** from the context menu.',
        timestamp: Date.now(),
      });
      return;
    }

    // Prompt to unlock vault if needed
    if (!this.credentialVault.isUnlocked && this.credentialVault.hasVault) {
      const passphrase = await this._promptSecureInput(
        'Your credential vault is locked.' +
        '<br>Enter your vault passphrase to decrypt credentials for the config export.',
        'Passphrase…'
      );
      if (passphrase) {
        const ok = await this.credentialVault.unlock(passphrase);
        if (!ok) {
          this.bus.emit('agent:message', {
            role: 'agent',
            content: '## ⚙️ Agent Config — Vault Locked\n\n' +
              '❌ Failed to unlock credential vault. Check your passphrase and try again.\n\n' +
              '> The config can still be exported without credentials — ' +
              'it will use placeholder values.',
            timestamp: Date.now(),
          });
          return;
        }
      }
    }

    const generator = new MCPConfigGenerator(this.nodeManager, this.credentialVault);
    const { json, summaryText } = await generator.export();

    // Copy to clipboard
    let clipboardOk = false;
    try {
      await navigator.clipboard.writeText(json);
      clipboardOk = true;
    } catch { /* clipboard may be blocked */ }

    // Offer download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Show success in agent panel
    this.bus.emit('agent:message', {
      role: 'agent',
      content:
        '## ✅ Agent Config — Export Complete\n\n' +
        `${summaryText}\n\n` +
        `- ${clipboardOk ? '✅' : '⚠️'} ${clipboardOk ? 'Copied to clipboard' : 'Clipboard access blocked — use the downloaded file'}\n` +
        '- 📥 Config file downloaded\n\n' +
        '### Next step:\n' +
        'Paste the config into your **Claude Code MCP server settings** ' +
        'or import the downloaded JSON file into your AI agent platform.',
      timestamp: Date.now(),
    });
  }

  /**
   * Show a secure password-input modal instead of window.prompt() for sensitive values.
   * @param {string} message  — HTML message to display above the input
   * @param {string} [placeholder]
   * @returns {Promise<string|null>} — the entered value, or null if cancelled
   */
  _promptSecureInput(message, placeholder = '') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div style="background:#0d1117;border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:24px;width:420px;max-width:90vw;box-shadow:0 24px 64px rgba(0,0,0,.8);">
          <p style="margin:0 0 16px;color:#e6edf3;font-size:13px;line-height:1.55;">${message}</p>
          <input type="password" id="_sec-input" style="width:100%;box-sizing:border-box;padding:10px 12px;background:#0a0a14;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:#e6edf3;font-size:13px;outline:none;" placeholder="${placeholder}" autocomplete="off" />
          <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
            <button id="_sec-cancel" style="padding:8px 16px;background:transparent;border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#8b949e;cursor:pointer;font-size:13px;">Cancel</button>
            <button id="_sec-ok" style="padding:8px 16px;background:#00e5ff;border:none;border-radius:6px;color:#0d1117;cursor:pointer;font-size:13px;font-weight:600;">OK</button>
          </div>
        </div>`;

      const input = overlay.querySelector('#_sec-input');
      const finish = (value) => { overlay.remove(); resolve(value); };

      overlay.querySelector('#_sec-ok').addEventListener('click', () => finish(input.value.trim() || null));
      overlay.querySelector('#_sec-cancel').addEventListener('click', () => finish(null));
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.stopPropagation(); finish(input.value.trim() || null); }
        if (e.key === 'Escape') { e.stopPropagation(); finish(null); }
      });

      document.body.appendChild(overlay);
      requestAnimationFrame(() => input.focus());
    });
  }

  /**
   * Build a role-specific report prompt.
   * Delegates to the extracted ReportPrompts module.
   */
  _buildReportPrompt(type, label, serialized) {
    return buildReportPrompt(type, label, serialized);
  }

  /**
   * Clean Layout — re-arrange all existing nodes using the balanced tree layout.
   * Works on human-made or AI-generated mind maps.
   */
  _cleanLayout() {
    const nodeData = this.nodeManager.serialize();
    const connData = this.connectionManager.serialize();

    if (nodeData.length === 0) {
      alert('No nodes on the canvas to arrange.');
      return;
    }

    // Build index-based arrays for computeLayout
    const idToIndex = new Map();
    const layoutNodes = nodeData.map((n, i) => {
      idToIndex.set(n.id, i);
      return { text: n.text, type: n.nodeType || 'general', priority: n.priority || 'medium' };
    });

    const layoutConns = [];
    connData.forEach(c => {
      const fromIdx = idToIndex.get(c.sourceId);
      const toIdx = idToIndex.get(c.targetId);
      if (fromIdx !== undefined && toIdx !== undefined) {
        layoutConns.push({
          from: fromIdx,
          to: toIdx,
          directed: c.directed === 'forward',
        });
      }
    });

    // Compute viewport center
    const container = document.getElementById('canvas-container');
    const rect = container?.getBoundingClientRect() || { width: 1200, height: 800 };
    const center = this.viewport.screenToWorld(rect.width / 2, rect.height / 2);

    // Run the balanced tree layout
    const positioned = computeLayout(layoutNodes, layoutConns, center.x, center.y);

    // Move each node and re-assign optimal connection ports FIRST (before animation)
    // so the wires render correctly from the start
    connData.forEach(c => {
      const conn = this.connectionManager.connections.get(c.id);
      if (!conn) return;

      const srcIdx = idToIndex.get(c.sourceId);
      const tgtIdx = idToIndex.get(c.targetId);
      if (srcIdx === undefined || tgtIdx === undefined) return;

      const dx = positioned[tgtIdx].x - positioned[srcIdx].x;
      const dy = positioned[tgtIdx].y - positioned[srcIdx].y;

      if (Math.abs(dx) > Math.abs(dy)) {
        conn.sourcePort = dx > 0 ? 'right' : 'left';
        conn.targetPort = dx > 0 ? 'left' : 'right';
      } else {
        conn.sourcePort = dy > 0 ? 'bottom' : 'top';
        conn.targetPort = dy > 0 ? 'top' : 'bottom';
      }
    });

    // Animate nodes to new positions
    nodeData.forEach((nData, i) => {
      const node = this.nodeManager.getNode(nData.id);
      if (!node) return;

      const newX = Math.round(positioned[i].x - 70);
      const newY = Math.round(positioned[i].y - 20);

      // Smooth CSS transition
      node.el.style.transition = 'left 0.5s cubic-bezier(0.4, 0, 0.2, 1), top 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      node.x = newX;
      node.y = newY;
      node.el.style.left = `${newX}px`;
      node.el.style.top = `${newY}px`;

      setTimeout(() => { node.el.style.transition = ''; }, 550);
    });

    // Re-render all connection wires during the animation
    const renderWires = () => this.connectionManager._renderAll();
    [0, 50, 100, 200, 300, 400, 500, 550].forEach(ms => setTimeout(renderWires, ms));

    // Final cleanup
    setTimeout(() => {
      renderWires();
      this.bus.emit('state:changed');
      this.bus.emit('viewport:fit-request');
    }, 560);
  }
}


// Boot
window.addEventListener('DOMContentLoaded', () => {
  window.mindMapper = new MindMapperApp();
});
