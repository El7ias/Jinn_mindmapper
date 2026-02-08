/**
 * NodeManager — Creates, selects, drags, edits, and deletes mind map nodes.
 *
 * Phase 3.2 Enhancement: Nodes now carry orchestration metadata —
 * nodeType, priority, phase, assignedAgent, agentStatus, and agentNotes.
 * Visual overlays include status badges, priority rings, and agent chips.
 */

import { escapeHtml, escapeAttr } from '../core/Sanitize.js';

let _idCounter = 0;
function generateId() {
  return `node_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

const NODE_COLORS = ['#00e5ff', '#ff2d78', '#00ff88', '#ffc107', '#7c4dff', '#ff6e40', '#e6edf3'];

export const NODE_SHAPES = [
  { id: 'rectangle',     icon: '▬', label: 'Rectangle',     meaning: 'Process / Task' },
  { id: 'rounded',       icon: '▢', label: 'Rounded',       meaning: 'Start / End' },
  { id: 'diamond',       icon: '◇', label: 'Diamond',       meaning: 'Decision' },
  { id: 'parallelogram', icon: '▱', label: 'Parallelogram', meaning: 'Input / Output' },
  { id: 'hexagon',       icon: '⬡', label: 'Hexagon',       meaning: 'Preparation' },
  { id: 'circle',        icon: '●', label: 'Circle',        meaning: 'Event / Trigger' },
  { id: 'pill',          icon: '▭', label: 'Pill',          meaning: 'Terminal' },
];

// Phase 3.2: Node type definitions for the agentic system
export const NODE_TYPES = [
  { id: 'general',    icon: '📄', label: 'General',    color: '#7d8590' },
  { id: 'feature',    icon: '⚡', label: 'Feature',    color: '#00e5ff' },
  { id: 'constraint', icon: '🔒', label: 'Constraint', color: '#ffc107' },
  { id: 'reference',  icon: '📎', label: 'Reference',  color: '#7c4dff' },
  { id: 'risk',       icon: '⚠️', label: 'Risk',       color: '#ff2d78' },
  { id: 'techNote',   icon: '🔧', label: 'Tech Note',  color: '#00ff88' },
];

export const PRIORITY_LEVELS = [
  { id: 'critical', icon: '🔴', label: 'Critical', color: '#ff2d78', ring: '#ff2d78' },
  { id: 'high',     icon: '🟠', label: 'High',     color: '#ff6e40', ring: '#ff6e40' },
  { id: 'medium',   icon: '🟡', label: 'Medium',   color: '#ffc107', ring: '#ffc107' },
  { id: 'low',      icon: '🟢', label: 'Low',      color: '#00ff88', ring: '#00ff88' },
];

export const AGENT_STATUS_MAP = {
  unassigned:  { icon: '⚪', label: 'Unassigned', color: '#7d8590' },
  planning:    { icon: '🔵', label: 'Planning',   color: '#00e5ff' },
  'in-review': { icon: '🟡', label: 'In Review',  color: '#ffc107' },
  approved:    { icon: '🟢', label: 'Approved',   color: '#00ff88' },
  blocked:     { icon: '🔴', label: 'Blocked',    color: '#ff2d78' },
};

export const AGENT_ROLES = [
  { id: 'coo',       icon: '👔', label: 'COO' },
  { id: 'cto',       icon: '🏗️', label: 'CTO' },
  { id: 'cfo',       icon: '💰', label: 'CFO' },
  { id: 'creative',  icon: '🎨', label: 'Creative' },
  { id: 'frontend',  icon: '🖥️', label: 'Frontend' },
  { id: 'backend',   icon: '⚙️', label: 'Backend' },
  { id: 'devils-advocate', icon: '😈', label: "Devil's Advocate" },
  { id: 'sentinel',  icon: '🛡️', label: 'Sentinel' },
  { id: 'documenter', icon: '📝', label: 'Documenter' },
  { id: 'token-auditor', icon: '🔢', label: 'Token Auditor' },
  { id: 'api-cost-auditor', icon: '💵', label: 'API Cost Auditor' },
  { id: 'project-auditor', icon: '📊', label: 'Project Auditor' },
];

export class NodeManager {
  constructor(bus, viewport) {
    this.bus = bus;
    this.viewport = viewport;
    this.nodesLayer = document.getElementById('nodes-layer');
    this.container = document.getElementById('canvas-container');

    /** @type {Map<string, object>} */
    this.nodes = new Map();
    this.selected = new Set();

    this._dragging = null;
    this._dragOffsets = new Map();
    this.connectionManager = null; // set via setConnectionManager()

    this._bindEvents();
  }

  /** Allow NodeManager to reference ConnectionManager for splice-on-drop */
  setConnectionManager(cm) {
    this.connectionManager = cm;
  }

  _bindEvents() {
    // Double-click canvas → create node
    this.container.addEventListener('dblclick', (e) => {
      // Ignore if clicking on a node, port, or connection wire
      if (e.target.closest('.mind-node') || e.target.closest('.node-port')) return;
      if (e.target.closest('.connection-group') || e.target.closest('.connection-hit-area')) return;

      const rect = this.container.getBoundingClientRect();
      const world = this.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.createNode(world.x - 70, world.y - 20);
    });

    // Click canvas → deselect all
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.viewport.isSpaceDown) return;
      if (!e.target.closest('.mind-node') && !e.target.closest('.toolbar') && !e.target.closest('.property-panel') && !e.target.closest('.context-menu')) {
        this.deselectAll();
        this.bus.emit('selection:changed', []);
      }
    });

    // Global mouse events for dragging
    window.addEventListener('mousemove', (e) => this._onDragMove(e));
    window.addEventListener('mouseup', (e) => this._onDragEnd(e));

    // Toolbar add button
    document.getElementById('btn-add-node')?.addEventListener('click', () => {
      const rect = this.container.getBoundingClientRect();
      const world = this.viewport.screenToWorld(rect.width / 2, rect.height / 2);
      this.createNode(world.x - 70, world.y - 20);
    });

    // Toolbar delete button
    document.getElementById('btn-delete')?.addEventListener('click', () => {
      this.deleteSelected();
    });
  }

  createNode(x, y, opts = {}) {
    const id = opts.id || generateId();
    const text = opts.text || '';
    const color = opts.color || NODE_COLORS[this.nodes.size % NODE_COLORS.length];
    const shape = opts.shape || 'rectangle';

    // Phase 3.2 metadata defaults
    const nodeType = opts.nodeType || 'general';
    const priority = opts.priority || 'medium';
    const phase = opts.phase ?? null;
    const assignedAgent = opts.assignedAgent || null;
    const agentStatus = opts.agentStatus || 'unassigned';
    const agentNotes = opts.agentNotes || null;

    const el = document.createElement('div');
    el.className = `mind-node appearing shape-${shape}`;
    if (priority !== 'medium') {
      el.classList.add(`priority-${priority}`);
    }
    el.dataset.nodeId = id;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    // Build inner HTML with Phase 3.2 overlays
    el.innerHTML = this._buildNodeHTML(id, text, color, nodeType, priority, phase, assignedAgent, agentStatus);

    // Remove animation class after it plays
    el.addEventListener('animationend', () => el.classList.remove('appearing'), { once: true });

    // Click to select
    el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('node-port')) return; // ports handled by ConnectionManager
      if (e.button !== 0) return;
      if (this.viewport.isSpaceDown) return;
      e.stopPropagation();

      if (e.shiftKey) {
        this._toggleSelect(id);
      } else if (!this.selected.has(id)) {
        this.deselectAll();
        this._select(id);
      }

      this._startDrag(e, id);
    });

    // Double-click to edit text
    const textEl = el.querySelector('.node-text');
    textEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._startEditing(id, textEl);
    });

    this.nodesLayer.appendChild(el);

    const nodeData = { 
      id, text, x, y, color, shape, el,
      // Phase 3.2 metadata
      nodeType, priority, phase, assignedAgent, agentStatus, agentNotes,
    };
    this.nodes.set(id, nodeData);

    this.deselectAll();
    this._select(id);

    this.bus.emit('node:created', nodeData);
    this.bus.emit('state:changed');

    // Hide help hint after first node
    const hint = document.getElementById('help-hint');
    if (hint) hint.classList.add('hidden');

    return nodeData;
  }

  /**
   * Build the inner HTML for a node element, including Phase 3.2 overlays
   */
  _buildNodeHTML(id, text, color, nodeType, priority, phase, assignedAgent, agentStatus) {
    const statusInfo = AGENT_STATUS_MAP[agentStatus] || AGENT_STATUS_MAP.unassigned;
    const typeInfo = NODE_TYPES.find(t => t.id === nodeType);
    const agentInfo = assignedAgent ? AGENT_ROLES.find(a => a.id === assignedAgent) : null;
    
    // Status badge (only when assigned to an agent)
    const statusBadge = agentStatus !== 'unassigned' 
      ? `<span class="node-status-badge" title="${escapeAttr(statusInfo.label)}" style="background:${statusInfo.color}">${statusInfo.icon}</span>` 
      : '';

    // Agent assignment chip
    const agentChip = agentInfo 
      ? `<span class="node-agent-chip" title="${escapeAttr(agentInfo.label)}">${agentInfo.icon} ${escapeHtml(agentInfo.label)}</span>`
      : '';

    // Phase & priority meta line
    const metaParts = [];
    if (phase !== null && phase !== undefined) metaParts.push(`Phase ${phase}`);
    if (nodeType !== 'general') metaParts.push(`${typeInfo?.icon || ''} ${escapeHtml(typeInfo?.label || nodeType)}`);
    const metaLine = metaParts.length > 0 || agentChip
      ? `<div class="node-meta">${agentChip}${metaParts.length > 0 ? `<span class="node-meta-text">${metaParts.join(' · ')}</span>` : ''}</div>`
      : '';

    return `
      <div class="node-color-bar" style="background:${color}"></div>
      ${statusBadge}
      <div class="node-text" spellcheck="false">${escapeHtml(text || '')}</div>
      ${metaLine}
      <div class="node-port port-top" data-port="top" data-node-id="${id}"></div>
      <div class="node-port port-right" data-port="right" data-node-id="${id}"></div>
      <div class="node-port port-bottom" data-port="bottom" data-node-id="${id}"></div>
      <div class="node-port port-left" data-port="left" data-node-id="${id}"></div>
    `;
  }

  /**
   * Update the visual overlays on a node to reflect metadata changes
   */
  _refreshNodeOverlays(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    const el = node.el;
    const textEl = el.querySelector('.node-text');
    const currentText = textEl?.textContent || node.text;

    // Rebuild HTML
    el.innerHTML = this._buildNodeHTML(
      node.id, currentText, node.color,
      node.nodeType, node.priority, node.phase,
      node.assignedAgent, node.agentStatus
    );

    // Update priority ring class
    PRIORITY_LEVELS.forEach(p => el.classList.remove(`priority-${p.id}`));
    if (node.priority !== 'medium') {
      el.classList.add(`priority-${node.priority}`);
    }

    // Rebind double-click on the new text element
    const newTextEl = el.querySelector('.node-text');
    newTextEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._startEditing(node.id, newTextEl);
    });
  }

  // ─── Phase 3.2 Metadata Setters ──────────────────────────────────────────

  /**
   * Set the node type (feature, constraint, risk, etc.)
   */
  setNodeType(nodeId, typeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.nodeType = typeId;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the priority level (critical, high, medium, low)
   */
  setPriority(nodeId, priorityId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.priority = priorityId;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the development phase number
   */
  setPhase(nodeId, phaseNum) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.phase = phaseNum;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the assigned agent role
   */
  setAssignedAgent(nodeId, agentRole) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.assignedAgent = agentRole;
    if (agentRole && node.agentStatus === 'unassigned') {
      node.agentStatus = 'planning';
    }
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set the agent status
   */
  setAgentStatus(nodeId, status) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.agentStatus = status;
    this._refreshNodeOverlays(nodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /**
   * Set agent notes on a node
   */
  setAgentNotes(nodeId, notes) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.agentNotes = notes;
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  // ─── Original methods (unchanged) ────────────────────────────────────────

  _startEditing(id, textEl) {
    textEl.contentEditable = 'true';
    textEl.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      textEl.contentEditable = 'false';
      const node = this.nodes.get(id);
      if (node) {
        node.text = textEl.textContent.trim();
        this.bus.emit('node:updated', node);
        this.bus.emit('state:changed');
      }
      textEl.removeEventListener('blur', finish);
      textEl.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        textEl.blur();
      }
      if (e.key === 'Escape') {
        textEl.blur();
      }
      e.stopPropagation(); // prevent global shortcuts while editing
    };

    textEl.addEventListener('blur', finish);
    textEl.addEventListener('keydown', onKey);
  }

  _select(id) {
    this.selected.add(id);
    const node = this.nodes.get(id);
    if (node) node.el.classList.add('selected');
    this.bus.emit('selection:changed', [...this.selected]);
  }

  _toggleSelect(id) {
    if (this.selected.has(id)) {
      this.selected.delete(id);
      const node = this.nodes.get(id);
      if (node) node.el.classList.remove('selected');
    } else {
      this._select(id);
    }
    this.bus.emit('selection:changed', [...this.selected]);
  }

  deselectAll() {
    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      if (node) node.el.classList.remove('selected');
    });
    this.selected.clear();
  }

  _startDrag(e, clickedId) {
    this._dragging = clickedId;
    this._dragOffsets.clear();

    const startWorld = this.viewport.screenToWorld(e.clientX, e.clientY);

    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      if (node) {
        node.el.classList.add('dragging');
        this._dragOffsets.set(id, {
          dx: node.x - startWorld.x,
          dy: node.y - startWorld.y
        });
      }
    });
  }

  _onDragMove(e) {
    if (!this._dragging) return;

    const world = this.viewport.screenToWorld(e.clientX, e.clientY);

    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      const offset = this._dragOffsets.get(id);
      if (node && offset) {
        node.x = world.x + offset.dx;
        node.y = world.y + offset.dy;
        node.el.style.left = `${node.x}px`;
        node.el.style.top = `${node.y}px`;
        this.bus.emit('node:moved', node);
      }
    });

    // Splice preview: highlight wire under a single dragged node
    if (this.selected.size === 1 && this.connectionManager) {
      const nodeId = [...this.selected][0];
      const node = this.nodes.get(nodeId);
      if (node) {
        const cx = node.x + node.el.offsetWidth / 2;
        const cy = node.y + node.el.offsetHeight / 2;
        this.connectionManager.highlightSpliceTarget(cx, cy, nodeId);
      }
    }
  }

  _onDragEnd(e) {
    if (!this._dragging) return;

    // Check for wire splice (single node dropped on a wire)
    if (this.selected.size === 1 && this.connectionManager) {
      const nodeId = [...this.selected][0];
      const node = this.nodes.get(nodeId);
      if (node) {
        const cx = node.x + node.el.offsetWidth / 2;
        const cy = node.y + node.el.offsetHeight / 2;
        const conn = this.connectionManager.findConnectionAtPoint(cx, cy, nodeId);
        if (conn) {
          this.connectionManager.clearSpliceHighlight();
          this.connectionManager.spliceNodeIntoConnection(conn.id, nodeId);
        }
      }
      this.connectionManager.clearSpliceHighlight();
    }

    this.selected.forEach(id => {
      const node = this.nodes.get(id);
      if (node) node.el.classList.remove('dragging');
    });

    this._dragging = null;
    this._dragOffsets.clear();
    this.bus.emit('state:changed');
  }

  deleteSelected() {
    if (this.selected.size === 0) return;
    const ids = [...this.selected];
    ids.forEach(id => this.deleteNode(id));
    this.bus.emit('state:changed');
  }

  deleteNode(id) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.el.remove();
    this.nodes.delete(id);
    this.selected.delete(id);
    this.bus.emit('node:deleted', { id });
    this.bus.emit('selection:changed', [...this.selected]);
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  /** Change the shape of a node */
  setShape(nodeId, shapeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    // Remove old shape class, add new one
    NODE_SHAPES.forEach(s => node.el.classList.remove(`shape-${s.id}`));
    node.el.classList.add(`shape-${shapeId}`);
    node.shape = shapeId;
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');
  }

  /** Get port center position in world coordinates */
  getPortPosition(nodeId, port) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const el = node.el;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    switch (port) {
      case 'top':    return { x: node.x + w / 2, y: node.y };
      case 'right':  return { x: node.x + w,     y: node.y + h / 2 };
      case 'bottom': return { x: node.x + w / 2, y: node.y + h };
      case 'left':   return { x: node.x,         y: node.y + h / 2 };
      default:       return { x: node.x + w / 2, y: node.y + h / 2 };
    }
  }

  /** Serialize all nodes — includes Phase 3.2 metadata */
  serialize() {
    const arr = [];
    this.nodes.forEach(n => {
      arr.push({
        id: n.id, text: n.text, x: n.x, y: n.y, color: n.color,
        shape: n.shape || 'rectangle',
        // Phase 3.2 metadata
        nodeType: n.nodeType || 'general',
        priority: n.priority || 'medium',
        phase: n.phase ?? null,
        assignedAgent: n.assignedAgent || null,
        agentStatus: n.agentStatus || 'unassigned',
        agentNotes: n.agentNotes || null,
      });
    });
    return arr;
  }

  /** Load nodes from serialized data — handles Phase 3.2 metadata */
  deserialize(data) {
    // Clear existing
    this.nodes.forEach(n => n.el.remove());
    this.nodes.clear();
    this.selected.clear();

    if (!data) return;
    data.forEach(d => {
      this.createNode(d.x, d.y, {
        id: d.id, text: d.text, color: d.color,
        shape: d.shape || 'rectangle',
        // Phase 3.2 metadata (backward compatible — defaults for old data)
        nodeType: d.nodeType || 'general',
        priority: d.priority || 'medium',
        phase: d.phase ?? null,
        assignedAgent: d.assignedAgent || null,
        agentStatus: d.agentStatus || 'unassigned',
        agentNotes: d.agentNotes || null,
      });
    });
    this.deselectAll();
  }

  /** Get bounding box of all nodes in world coords */
  getBounds() {
    if (this.nodes.size === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.nodes.forEach(n => {
      const w = n.el.offsetWidth;
      const h = n.el.offsetHeight;
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + w > maxX) maxX = n.x + w;
      if (n.y + h > maxY) maxY = n.y + h;
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }
}
