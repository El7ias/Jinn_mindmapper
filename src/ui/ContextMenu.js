/**
 * ContextMenu — Right-click context menus for canvas, nodes, and connections.
 *
 * Best-practice implementation:
 *  • Canvas menu adds a title header so you know it's for the canvas
 *  • Node menu shows a truncated node label so you know which node
 *  • "Add Integration" uses a JS-positioned floating panel (not nested inside
 *    the scrolling UL, which would clip it via overflow)
 *  • Hover bridge with delay so the submenu doesn't close when crossing a gap
 */
import { NODE_SHAPES, NODE_TYPES, PRIORITY_LEVELS, AGENT_ROLES, COMMERCE_NODE_TYPES, COMMERCE_CATEGORIES } from '../nodes/NodeManager.js';

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

    // Floating submenu panel (rendered outside the scrolling UL)
    this._submenuEl = null;
    this._submenuTimeout = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();

      const rect = this.container.getBoundingClientRect();
      this._clickWorld = this.viewport.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

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

    window.addEventListener('mousedown', (e) => {
      if (this._visible && !this.el.contains(e.target) &&
          !(this._submenuEl && this._submenuEl.contains(e.target))) {
        this.hide();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  // ─── Canvas Menu ─────────────────────────────────────────────────────

  _showCanvasMenu(x, y) {
    this._buildMenu([
      { label: 'Canvas', type: 'title' },
      { label: 'Add Node', shortcut: 'Dbl-Click', action: () => {
        this.nodeManager.createNode(this._clickWorld.x - 70, this._clickWorld.y - 20);
      }},
      { type: 'divider' },

      // Shaped nodes — each shape has a flowchart meaning
      { label: 'Add Shaped Node', type: 'header' },
      ...NODE_SHAPES.map(s => ({
        label: `${s.icon} ${s.label}`,
        shortcut: s.meaning,
        action: () => {
          this.nodeManager.createNode(this._clickWorld.x - 70, this._clickWorld.y - 20, {
            shape: s.id,
            text: s.meaning,
          });
        },
      })),
      { type: 'divider' },

      { label: '🔌 Add Integration', chevron: true, submenuId: 'commerce' },
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

  // ─── Node Menu ───────────────────────────────────────────────────────

  _showNodeMenu(x, y, nodeId) {
    const node = this.nodeManager.getNode(nodeId);
    if (!node) return;

    if (!this.nodeManager.selected.has(nodeId)) {
      this.nodeManager.deselectAll();
      this.nodeManager._select(nodeId);
    }

    const connCount = this.connectionManager.getConnectionsForNode(nodeId).length;
    const label = (node.text || 'Node').length > 22
      ? (node.text || 'Node').slice(0, 20) + '…'
      : (node.text || 'Node');

    const menuItems = [
      { label, type: 'title' },
      { label: 'Edit Text', action: () => {
        const textEl = node.el.querySelector('.node-text');
        this.nodeManager._startEditing(nodeId, textEl);
      }},
      { label: 'Duplicate', action: () => {
        this.nodeManager.createNode(node.x + 30, node.y + 30, {
          text: node.text, color: node.color, shape: node.shape,
          nodeType: node.nodeType, priority: node.priority,
        });
      }},
      { type: 'divider' },

      // Shape
      { label: 'Shape', type: 'header' },
      ...NODE_SHAPES.map(s => ({
        label: `${s.icon} ${s.label}`,
        shortcut: s.meaning,
        className: node.shape === s.id ? 'menu-active' : '',
        action: () => this.nodeManager.setShape(nodeId, s.id),
      })),
      { type: 'divider' },

      // Node Type
      { label: 'Node Type', type: 'header' },
      ...NODE_TYPES.map(t => ({
        label: `${t.icon} ${t.label}`,
        className: node.nodeType === t.id ? 'menu-active' : '',
        action: () => this.nodeManager.setNodeType(nodeId, t.id),
      })),
      { type: 'divider' },

      // Priority
      { label: 'Priority', type: 'header' },
      ...PRIORITY_LEVELS.map(p => ({
        label: `${p.icon} ${p.label}`,
        className: node.priority === p.id ? 'menu-active' : '',
        action: () => this.nodeManager.setPriority(nodeId, p.id),
      })),
      { type: 'divider' },

      // Agent Assignment
      { label: 'Assign Agent', type: 'header' },
      { label: '⚪ Unassigned',
        className: !node.assignedAgent ? 'menu-active' : '',
        action: () => {
          this.nodeManager.setAssignedAgent(nodeId, null);
          this.nodeManager.setAgentStatus(nodeId, 'unassigned');
        },
      },
      ...AGENT_ROLES.map(a => ({
        label: `${a.icon} ${a.label}`,
        className: node.assignedAgent === a.id ? 'menu-active' : '',
        action: () => this.nodeManager.setAssignedAgent(nodeId, a.id),
      })),
    ];

    if (connCount > 0) {
      menuItems.push({ type: 'divider' });
      menuItems.push({
        label: 'Disconnect All', shortcut: `${connCount}`,
        action: () => this.connectionManager.disconnectAll(nodeId),
      });
    }

    menuItems.push({ type: 'divider' });
    menuItems.push({
      label: 'Delete', shortcut: 'Del', className: 'menu-danger',
      action: () => {
        this.nodeManager.deleteNode(nodeId);
        this.bus.emit('state:changed');
      },
    });

    this._buildMenu(menuItems);
    this._show(x, y);
  }

  // ─── Connection Menu ─────────────────────────────────────────────────

  _showConnectionMenu(x, y, connId) {
    const conn = this.connectionManager.connections.get(connId);
    if (!conn) return;

    this.connectionManager.selectConnection(connId);
    const state = conn.directed;
    const menuItems = [
      { label: 'Connection', type: 'title' },
    ];

    if (state === 'none') {
      menuItems.push({ label: '→ Add Arrow',         action: () => this.connectionManager.setArrow(connId, 'forward') });
      menuItems.push({ label: '⇆ Add Bidirectional', action: () => this.connectionManager.setArrow(connId, 'both') });
    } else if (state === 'forward') {
      menuItems.push({ label: '⇆ Make Bidirectional', action: () => this.connectionManager.setArrow(connId, 'both') });
      menuItems.push({ label: '↔ Reverse Direction', action: () => {
        const { sourceId, sourcePort, targetId, targetPort, directed } = conn;
        this.connectionManager.deleteConnection(connId);
        this.connectionManager.createConnection(targetId, targetPort, sourceId, sourcePort, { directed });
      }});
      menuItems.push({ label: '✕ Remove Arrow', action: () => this.connectionManager.setArrow(connId, 'none') });
    } else if (state === 'both') {
      menuItems.push({ label: '→ Make One-way',   action: () => this.connectionManager.setArrow(connId, 'forward') });
      menuItems.push({ label: '✕ Remove Arrows', action: () => this.connectionManager.setArrow(connId, 'none') });
    }

    menuItems.push({ type: 'divider' });
    menuItems.push({
      label: 'Delete Connection', shortcut: 'Del', className: 'menu-danger',
      action: () => {
        this.connectionManager.deleteConnection(connId);
        this.bus.emit('state:changed');
      },
    });

    this._buildMenu(menuItems);
    this._show(x, y);
  }

  // ─── Build Menu DOM ──────────────────────────────────────────────────

  _buildMenu(items) {
    this.itemsEl.innerHTML = '';
    this._hideSubmenu();

    items.forEach(item => {
      this.itemsEl.appendChild(this._createMenuItem(item));
    });
  }

  _createMenuItem(item) {
    const li = document.createElement('li');

    // ─── Divider ───
    if (item.type === 'divider') {
      li.className = 'menu-divider';
      return li;
    }

    // ─── Section title (top of menu — tells you WHAT you right-clicked) ───
    if (item.type === 'title') {
      li.className = 'menu-title';
      li.textContent = item.label;
      return li;
    }

    // ─── Section header (Shape, Priority, etc.) ───
    if (item.type === 'header') {
      li.className = 'menu-header';
      li.textContent = item.label;
      return li;
    }

    // ─── Submenu trigger (opens a floating panel on hover) ───
    if (item.chevron && item.submenuId) {
      li.className = 'menu-submenu-trigger';
      li.innerHTML = `<span>${item.label}</span><span class="submenu-arrow">›</span>`;

      li.addEventListener('mouseenter', () => {
        this._cancelSubmenuClose();
        this._showSubmenu(item.submenuId, li);
      });

      li.addEventListener('mouseleave', () => {
        this._scheduleSubmenuClose();
      });

      return li;
    }

    // ─── Normal clickable item ───
    li.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
    if (item.className) li.classList.add(item.className);

    li.addEventListener('click', () => {
      this.hide();
      item.action?.();
    });

    return li;
  }

  // ─── Floating Submenu Panel ──────────────────────────────────────────
  // Rendered OUTSIDE the scrolling <ul> so it's never clipped by overflow.

  _showSubmenu(id, parentLi) {
    this._hideSubmenu();

    if (id === 'commerce') {
      this._submenuEl = this._buildCommercePanel();
    } else {
      return;
    }

    document.body.appendChild(this._submenuEl);

    // Position next to the parent <li>
    const liRect = parentLi.getBoundingClientRect();
    let left = liRect.right + 4;
    let top = liRect.top - 6;

    // Flip left if it would overflow the right edge
    requestAnimationFrame(() => {
      const subRect = this._submenuEl.getBoundingClientRect();
      if (left + subRect.width > window.innerWidth - 8) {
        left = liRect.left - subRect.width - 4;
      }
      if (top + subRect.height > window.innerHeight - 8) {
        top = window.innerHeight - subRect.height - 8;
      }
      this._submenuEl.style.left = `${left}px`;
      this._submenuEl.style.top = `${top}px`;
      this._submenuEl.classList.add('visible');
    });

    this._submenuEl.style.left = `${left}px`;
    this._submenuEl.style.top = `${top}px`;

    // Keep open while hovering the panel itself
    this._submenuEl.addEventListener('mouseenter', () => {
      this._cancelSubmenuClose();
    });

    this._submenuEl.addEventListener('mouseleave', () => {
      this._scheduleSubmenuClose();
    });
  }

  _buildCommercePanel() {
    const panel = document.createElement('div');
    panel.className = 'context-submenu-panel glass-panel';

    const ul = document.createElement('ul');

    COMMERCE_CATEGORIES.forEach(cat => {
      const types = COMMERCE_NODE_TYPES.filter(t => t.category === cat.id);
      if (types.length === 0) return;

      // Category header
      const header = document.createElement('li');
      header.className = 'menu-header';
      header.textContent = cat.label;
      ul.appendChild(header);

      types.forEach(t => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${t.icon} ${t.label}</span>`;
        li.addEventListener('click', () => {
          this.hide();
          this.nodeManager.createNode(this._clickWorld.x - 70, this._clickWorld.y - 20, {
            commerceType: t.id,
            text: t.label,
            shape: 'rounded',
          });
        });
        ul.appendChild(li);
      });
    });

    panel.appendChild(ul);
    return panel;
  }

  _hideSubmenu() {
    this._cancelSubmenuClose();
    if (this._submenuEl) {
      this._submenuEl.remove();
      this._submenuEl = null;
    }
  }

  _scheduleSubmenuClose() {
    this._submenuTimeout = setTimeout(() => this._hideSubmenu(), 150);
  }

  _cancelSubmenuClose() {
    if (this._submenuTimeout) {
      clearTimeout(this._submenuTimeout);
      this._submenuTimeout = null;
    }
  }

  // ─── Position & Visibility ───────────────────────────────────────────

  _show(x, y) {
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.display = 'block';
    this._visible = true;

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
    this._hideSubmenu();
  }
}
