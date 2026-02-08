/**
 * ContextMenu — Right-click context menus for canvas, nodes, and connections.
 * 
 * Phase 3.2 Enhancement: Added node type, priority, and agent assignment
 * submenus to the node context menu.
 */
import { NODE_SHAPES, NODE_TYPES, PRIORITY_LEVELS, AGENT_ROLES } from '../nodes/NodeManager.js';

export class ContextMenu {
  constructor(bus, nodeManager, connectionManager, viewport) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.connectionManager = connectionManager;
    this.viewport = viewport;

    this.el = document.getElementById('context-menu');
    this.itemsEl = document.getElementById('context-menu-items');
    this.container = document.getElementById('canvas-container');

    this._visible = false;
    this._clickWorld = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      this._clickWorld = this.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      // Check connection first (SVG elements)
      const connGroup = e.target.closest('.connection-group');
      if (connGroup) {
        const connId = connGroup.dataset.connectionId;
        if (connId) {
          this._showConnectionMenu(e.clientX, e.clientY, connId);
          return;
        }
      }

      const node = e.target.closest('.mind-node');
      if (node) {
        this._showNodeMenu(e.clientX, e.clientY, node.dataset.nodeId);
      } else {
        this._showCanvasMenu(e.clientX, e.clientY);
      }
    });

    // Hide on click anywhere
    window.addEventListener('mousedown', (e) => {
      if (this._visible && !this.el.contains(e.target)) {
        this.hide();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  _showCanvasMenu(x, y) {
    this._buildMenu([
      { label: 'Add Node', shortcut: 'Dbl-Click', action: () => {
        this.nodeManager.createNode(this._clickWorld.x - 70, this._clickWorld.y - 20);
      }},
      { type: 'divider' },
      { label: 'Zoom to Fit', action: () => this.bus.emit('viewport:fit-request') },
      { label: 'Reset Zoom', shortcut: '100%', action: () => {
        this.viewport.zoom = 1;
        this.viewport._applyTransform();
        this.bus.emit('viewport:changed', this.viewport.getState());
      }},
    ]);
    this._show(x, y);
  }

  _showNodeMenu(x, y, nodeId) {
    const node = this.nodeManager.getNode(nodeId);
    if (!node) return;

    // Select the node if not selected
    if (!this.nodeManager.selected.has(nodeId)) {
      this.nodeManager.deselectAll();
      this.nodeManager._select(nodeId);
    }

    const connCount = this.connectionManager.getConnectionsForNode(nodeId).length;

    const menuItems = [
      { label: 'Edit Text', action: () => {
        const textEl = node.el.querySelector('.node-text');
        this.nodeManager._startEditing(nodeId, textEl);
      }},
      { type: 'divider' },

      // ─── Shape submenu ───
      { label: 'Shape', type: 'header' },
      ...NODE_SHAPES.map(s => ({
        label: `${s.icon} ${s.label}`,
        shortcut: s.meaning,
        className: node.shape === s.id ? 'menu-active' : '',
        action: () => this.nodeManager.setShape(nodeId, s.id)
      })),
      { type: 'divider' },

      // ─── Phase 3.2: Node Type submenu ───
      { label: 'Node Type', type: 'header' },
      ...NODE_TYPES.map(t => ({
        label: `${t.icon} ${t.label}`,
        className: node.nodeType === t.id ? 'menu-active' : '',
        action: () => this.nodeManager.setNodeType(nodeId, t.id)
      })),
      { type: 'divider' },

      // ─── Phase 3.2: Priority submenu ───
      { label: 'Priority', type: 'header' },
      ...PRIORITY_LEVELS.map(p => ({
        label: `${p.icon} ${p.label}`,
        className: node.priority === p.id ? 'menu-active' : '',
        action: () => this.nodeManager.setPriority(nodeId, p.id)
      })),
      { type: 'divider' },

      // ─── Phase 3.2: Agent Assignment submenu ───
      { label: 'Assign Agent', type: 'header' },
      { label: '⚪ Unassigned', 
        className: !node.assignedAgent ? 'menu-active' : '',
        action: () => {
          this.nodeManager.setAssignedAgent(nodeId, null);
          this.nodeManager.setAgentStatus(nodeId, 'unassigned');
        }
      },
      ...AGENT_ROLES.map(a => ({
        label: `${a.icon} ${a.label}`,
        className: node.assignedAgent === a.id ? 'menu-active' : '',
        action: () => this.nodeManager.setAssignedAgent(nodeId, a.id)
      })),
      { type: 'divider' },

      // ─── Standard actions ───
      { label: 'Duplicate', action: () => {
        this.nodeManager.createNode(node.x + 30, node.y + 30, { 
          text: node.text, color: node.color, shape: node.shape,
          nodeType: node.nodeType, priority: node.priority 
        });
      }},
    ];

    if (connCount > 0) {
      menuItems.push({ type: 'divider' });
      menuItems.push({
        label: `Disconnect All`, shortcut: `${connCount}`,
        action: () => {
          this.connectionManager.disconnectAll(nodeId);
        }
      });
    }

    menuItems.push({ type: 'divider' });
    menuItems.push({
      label: 'Delete', shortcut: 'Del', action: () => {
        this.nodeManager.deleteNode(nodeId);
        this.bus.emit('state:changed');
      }
    });

    this._buildMenu(menuItems);
    this._show(x, y);
  }

  _showConnectionMenu(x, y, connId) {
    const conn = this.connectionManager.connections.get(connId);
    if (!conn) return;

    // Select the connection
    this.connectionManager.selectConnection(connId);

    const state = conn.directed; // 'none', 'forward', or 'both'
    const menuItems = [];

    if (state === 'none') {
      menuItems.push({
        label: '→ Add Arrow',
        action: () => this.connectionManager.setArrow(connId, 'forward')
      });
      menuItems.push({
        label: '⇆ Add Bidirectional',
        action: () => this.connectionManager.setArrow(connId, 'both')
      });
    } else if (state === 'forward') {
      menuItems.push({
        label: '⇆ Make Bidirectional',
        action: () => this.connectionManager.setArrow(connId, 'both')
      });
      menuItems.push({
        label: '↔ Reverse Direction',
        action: () => {
          const { sourceId, sourcePort, targetId, targetPort, directed } = conn;
          this.connectionManager.deleteConnection(connId);
          this.connectionManager.createConnection(
            targetId, targetPort, sourceId, sourcePort,
            { directed }
          );
        }
      });
      menuItems.push({
        label: '✕ Remove Arrow',
        action: () => this.connectionManager.setArrow(connId, 'none')
      });
    } else if (state === 'both') {
      menuItems.push({
        label: '→ Make One-way',
        action: () => this.connectionManager.setArrow(connId, 'forward')
      });
      menuItems.push({
        label: '✕ Remove Arrows',
        action: () => this.connectionManager.setArrow(connId, 'none')
      });
    }

    menuItems.push({ type: 'divider' });
    menuItems.push({
      label: 'Delete Connection', shortcut: 'Del',
      action: () => {
        this.connectionManager.deleteConnection(connId);
        this.bus.emit('state:changed');
      }
    });

    this._buildMenu(menuItems);
    this._show(x, y);
  }

  _buildMenu(items) {
    this.itemsEl.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      if (item.type === 'divider') {
        li.className = 'menu-divider';
      } else if (item.type === 'header') {
        li.className = 'menu-header';
        li.textContent = item.label;
      } else {
        li.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
        if (item.className) li.classList.add(item.className);
        li.addEventListener('click', () => {
          this.hide();
          item.action?.();
        });
      }
      this.itemsEl.appendChild(li);
    });
  }

  _show(x, y) {
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.display = 'block';
    this._visible = true;

    // Adjust if off-screen
    requestAnimationFrame(() => {
      const rect = this.el.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        this.el.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        this.el.style.top = `${y - rect.height}px`;
      }
    });
  }

  hide() {
    this.el.style.display = 'none';
    this._visible = false;
  }
}
