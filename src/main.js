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

// Phase 4 — Desktop Orchestration
import { OrchestrationEngine } from './orchestration/OrchestrationEngine.js';
import { EnvironmentDetector } from './orchestration/EnvironmentDetector.js';

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
    });
    this.fileMenu = new FileMenu(this.fileManager);

    // Phase 3 — Agent Panel
    this.agentPanel = new AgentPanel(this.bus);

    // Phase 4 — Orchestration Engine (desktop only)
    this.orchestrationEngine = new OrchestrationEngine(this.bus, {
      nodeManager: this.nodeManager,
      connectionManager: this.connectionManager,
    });

    // Phase 5 — Workspace Settings Modal
    this.workspaceSettingsModal = new WorkspaceSettingsModal(this.bus);

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

    // Toolbar: Generate Prompt button
    document.getElementById('btn-generate-prompt')?.addEventListener('click', () => this.promptExportModal.show());

    // Toolbar: AI Generate Mind Map button
    document.getElementById('btn-ai-generate')?.addEventListener('click', () => this.ideaInputModal.show());

    // Toolbar: Workspace Settings button
    document.getElementById('btn-workspace-settings')?.addEventListener('click', () => this.workspaceSettingsModal.show());

    // Toolbar: Run Agents button (Phase 4)
    document.getElementById('btn-run-agents')?.addEventListener('click', () => this._runAgents());

    // Toolbar: Clean Layout button
    document.getElementById('btn-clean-layout')?.addEventListener('click', () => this._cleanLayout());

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

    // Push initial history state
    this.history.push(this._getState());

    console.log('%c⚡ MindMapper initialized', 'color: #00e5ff; font-weight: bold; font-size: 14px;');
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
        const result = validateMindMap(
          this.nodeManager.serialize(),
          this.connectionManager.serialize()
        );
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
      viewport: this.viewport.getState()
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
   * Phase 4 — Launch Claude Code orchestration session.
   * Validates readiness, prompts for output dir, starts the engine.
   */
  async _runAgents() {
    // Guard: desktop only
    if (!EnvironmentDetector.isTauri) {
      alert(
        'Run Agents requires the MindMapper desktop app.\n\n' +
        'Use "Generate Prompt" to copy the workflow prompt and paste it into Claude Code manually.'
      );
      return;
    }

    // Validate mind map readiness
    const validation = validateMindMap(
      this.nodeManager.serialize(),
      this.connectionManager.serialize()
    );
    if (!validation.valid) {
      const issues = validation.errors.map(e => `• ${e}`).join('\n');
      alert(`Mind map is not ready:\n\n${issues}\n\nFix these issues before running agents.`);
      return;
    }

    // Prompt for output directory
    const outputDir = prompt(
      'Enter the output directory for Claude Code:\n(This is where generated files will go)',
      '.'
    );
    if (!outputDir) return; // User cancelled

    // Get hands-off preference from AgentPanel
    const handsOff = this.agentPanel.handsOff;

    try {
      await this.orchestrationEngine.startSession({
        outputDir,
        handsOff,
      });
    } catch (err) {
      console.error('Failed to start orchestration session:', err);
    }
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
