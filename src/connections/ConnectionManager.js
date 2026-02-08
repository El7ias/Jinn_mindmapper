/**
 * ConnectionManager — Creates, renders, and manages SVG circuit-trace connections between node ports.
 */

let _connIdCounter = 0;
function generateConnId() {
  return `conn_${Date.now().toString(36)}_${(++_connIdCounter).toString(36)}`;
}

export class ConnectionManager {
  constructor(bus, nodeManager) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.svgLayer = document.getElementById('connections-layer');
    this.container = document.getElementById('canvas-container');

    /** @type {Map<string, {id,sourceId,sourcePort,targetId,targetPort,group}>} */
    this.connections = new Map();
    this.selectedConnection = null;

    // Drag-to-connect state
    this._connecting = false;
    this._connSource = null;
    this._previewLine = null;

    // Drag-to-detach state
    this._detaching = false;
    this._detachConn = null;      // connection being detached
    this._detachEnd = null;       // 'source' or 'target'
    this._detachAnchor = null;    // the fixed end's port info
    this._detachPreview = null;   // SVG preview path

    this._bindEvents();

    // Re-render connections when nodes move
    this.bus.on('node:moved', () => this._renderAll());
    this.bus.on('node:deleted', ({ id }) => this._removeConnectionsForNode(id));
  }

  _bindEvents() {
    // Port mousedown → start connecting
    this.container.addEventListener('mousedown', (e) => {
      const port = e.target.closest('.node-port');
      if (!port || e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      this._connecting = true;
      this._connSource = {
        nodeId: port.dataset.nodeId,
        port: port.dataset.port
      };

      // Create preview line
      this._previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._previewLine.classList.add('connection-preview');
      this.svgLayer.appendChild(this._previewLine);
    });

    // Solder-dot mousedown → start detaching
    this.svgLayer.addEventListener('mousedown', (e) => {
      const dot = e.target.closest('.connection-dot');
      if (!dot || e.button !== 0) return;
      const group = dot.closest('.connection-group');
      if (!group) return;

      e.stopPropagation();
      e.preventDefault();

      const connId = group.dataset.connectionId;
      const conn = this.connections.get(connId);
      if (!conn) return;

      // Determine which end is being dragged (compare dot to dot1/dot2)
      const isDot1 = (dot === conn.dot1);
      this._detaching = true;
      this._detachConn = conn;
      this._detachEnd = isDot1 ? 'source' : 'target';
      // The anchor is the OTHER end (the one that stays fixed)
      this._detachAnchor = isDot1
        ? { nodeId: conn.targetId, port: conn.targetPort }
        : { nodeId: conn.sourceId, port: conn.sourcePort };

      // Hide the existing connection visually
      conn.group.style.opacity = '0.2';

      // Create a preview line from the anchor
      this._detachPreview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this._detachPreview.classList.add('connection-preview');
      this.svgLayer.appendChild(this._detachPreview);
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.container.getBoundingClientRect();
      const vp = this.nodeManager.viewport;
      const mouseWorld = vp.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

      // --- New connection preview ---
      if (this._connecting && this._connSource) {
        const sourcePos = this.nodeManager.getPortPosition(this._connSource.nodeId, this._connSource.port);
        if (!sourcePos) return;
        const path = this._computePath(sourcePos.x, sourcePos.y, mouseWorld.x, mouseWorld.y);
        this._previewLine.setAttribute('d', path);
      }

      // --- Detach preview ---
      if (this._detaching && this._detachAnchor) {
        const anchorPos = this.nodeManager.getPortPosition(this._detachAnchor.nodeId, this._detachAnchor.port);
        if (!anchorPos) return;
        const path = this._computePath(anchorPos.x, anchorPos.y, mouseWorld.x, mouseWorld.y);
        this._detachPreview.setAttribute('d', path);
      }
    });

    window.addEventListener('mouseup', (e) => {
      // --- Handle new connection drop ---
      if (this._connecting) {
        // Check if released on a port directly
        const port = e.target.closest('.node-port');
        // Check if released on a node body (smart port detection)
        const nodeEl = e.target.closest('.mind-node');

        if (port && this._connSource) {
          const targetNodeId = port.dataset.nodeId;
          const targetPort = port.dataset.port;

          if (targetNodeId !== this._connSource.nodeId) {
            const exists = this._connectionExists(
              this._connSource.nodeId, this._connSource.port,
              targetNodeId, targetPort
            );
            if (!exists) {
              this.createConnection(
                this._connSource.nodeId, this._connSource.port,
                targetNodeId, targetPort
              );
            }
          }
        } else if (nodeEl && this._connSource) {
          // Dropped on a node body → auto-detect nearest port
          const targetNodeId = nodeEl.dataset.nodeId;
          if (targetNodeId && targetNodeId !== this._connSource.nodeId) {
            const bestPort = this._findBestPort(this._connSource.nodeId, targetNodeId);
            const exists = this._connectionExists(
              this._connSource.nodeId, this._connSource.port,
              targetNodeId, bestPort
            );
            if (!exists) {
              this.createConnection(
                this._connSource.nodeId, this._connSource.port,
                targetNodeId, bestPort
              );
            }
          }
        } else if (this._connSource && !port && !nodeEl) {
          // DROPPED ON EMPTY SPACE → auto-create a new node and connect
          const rect = this.container.getBoundingClientRect();
          const vp = this.nodeManager.viewport;
          const world = vp.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

          const oppositePort = this._oppositePort(this._connSource.port);
          const newNode = this.nodeManager.createNode(world.x - 70, world.y - 20);
          this.createConnection(
            this._connSource.nodeId, this._connSource.port,
            newNode.id, oppositePort
          );
        }

        // Cleanup preview
        if (this._previewLine) {
          this._previewLine.remove();
          this._previewLine = null;
        }
        this._connecting = false;
        this._connSource = null;
      }

      // --- Handle detach drop ---
      if (this._detaching) {
        const port = e.target.closest('.node-port');
        const nodeEl = e.target.closest('.mind-node');

        if (port) {
          // Dropped on a port → rewire the connection
          const newNodeId = port.dataset.nodeId;
          const newPort = port.dataset.port;

          if (newNodeId !== this._detachAnchor.nodeId) {
            const oldId = this._detachConn.id;
            this._detachConn.group.style.opacity = '';
            this.deleteConnection(oldId);

            this.createConnection(
              this._detachAnchor.nodeId, this._detachAnchor.port,
              newNodeId, newPort
            );
          } else {
            this._detachConn.group.style.opacity = '';
          }
        } else if (nodeEl) {
          // Dropped on a node body → auto-detect nearest port and rewire
          const newNodeId = nodeEl.dataset.nodeId;
          if (newNodeId && newNodeId !== this._detachAnchor.nodeId) {
            const bestPort = this._findBestPort(this._detachAnchor.nodeId, newNodeId);
            const oldId = this._detachConn.id;
            this._detachConn.group.style.opacity = '';
            this.deleteConnection(oldId);

            this.createConnection(
              this._detachAnchor.nodeId, this._detachAnchor.port,
              newNodeId, bestPort
            );
          } else {
            this._detachConn.group.style.opacity = '';
          }
        } else {
          // Dropped on empty space → delete the connection (detach)
          this._detachConn.group.style.opacity = '';
          this.deleteConnection(this._detachConn.id);
          this.bus.emit('state:changed');
        }

        // Cleanup detach preview
        if (this._detachPreview) {
          this._detachPreview.remove();
          this._detachPreview = null;
        }
        this._detaching = false;
        this._detachConn = null;
        this._detachEnd = null;
        this._detachAnchor = null;
      }
    });

    // Double-click on connection → delete it
    // Mark event so NodeManager can ignore it
    const handleConnDblClick = (e) => {
      const group = e.target.closest('.connection-group');
      if (!group) return;
      e.stopPropagation();
      e.preventDefault();
      e._connectionHandled = true;
      const connId = group.dataset.connectionId;
      if (connId) {
        this.deleteConnection(connId);
        this.bus.emit('state:changed');
      }
    };
    this.svgLayer.addEventListener('dblclick', handleConnDblClick);
    // Backup: also listen on container in case event doesn't bubble from SVG
    this.container.addEventListener('dblclick', (e) => {
      const group = e.target.closest('.connection-group');
      if (!group || e._connectionHandled) return;
      e.stopPropagation();
      const connId = group.dataset.connectionId;
      if (connId) {
        this.deleteConnection(connId);
        this.bus.emit('state:changed');
      }
    });

    // Click on canvas → deselect connection
    this.container.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.connection-group') && this.selectedConnection) {
        this.deselectConnection();
      }
    });
  }

  /** Returns the opposite port direction for natural connection layout */
  _oppositePort(port) {
    switch (port) {
      case 'top': return 'bottom';
      case 'bottom': return 'top';
      case 'left': return 'right';
      case 'right': return 'left';
      default: return 'top';
    }
  }

  createConnection(sourceId, sourcePort, targetId, targetPort, opts = {}) {
    const id = opts.id || generateConnId();

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('connection-group');
    group.dataset.connectionId = id;

    // Hit area (invisible, wider for easier clicking)
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitArea.classList.add('connection-hit-area');

    // Visible path
    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.classList.add('connection-path');

    // Endpoint dots (solder points)
    const dot1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot1.classList.add('connection-dot');
    dot1.setAttribute('r', '3.5');

    const dot2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot2.classList.add('connection-dot');
    dot2.setAttribute('r', '3.5');

    group.appendChild(hitArea);
    group.appendChild(pathEl);
    group.appendChild(dot1);
    group.appendChild(dot2);

    // Click to select
    group.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.selectConnection(id);
    });

    this.svgLayer.appendChild(group);

    const directed = opts.directed || false;
    // Normalize directed: boolean → string tri-state ('none' | 'forward' | 'both')
    const directedState = directed === true ? 'forward'
                        : directed === 'forward' || directed === 'both' ? directed
                        : 'none';
    const connData = { id, sourceId, sourcePort, targetId, targetPort, directed: directedState, group, pathEl, hitArea, dot1, dot2 };
    this.connections.set(id, connData);

    // Apply arrowheads
    if (directedState !== 'none') {
      this._applyArrow(connData);
    }

    this._renderConnection(connData);

    this.bus.emit('connection:created', connData);
    this.bus.emit('state:changed');

    return connData;
  }

  /** Cycle arrow state: none → forward → both → none */
  toggleArrow(connId) {
    const conn = this.connections.get(connId);
    if (!conn) return;
    const cycle = { 'none': 'forward', 'forward': 'both', 'both': 'none' };
    conn.directed = cycle[conn.directed] || 'forward';
    this._applyArrow(conn);
    this.bus.emit('state:changed');
  }

  /** Set arrow state: 'none', 'forward', or 'both' */
  setArrow(connId, directed) {
    const conn = this.connections.get(connId);
    if (!conn) return;
    conn.directed = directed;
    this._applyArrow(conn);
    this.bus.emit('state:changed');
  }

  /** Apply SVG arrowhead markers based on directed state */
  _applyArrow(conn) {
    const isSelected = conn.group.classList.contains('selected');
    const color = isSelected ? 'magenta' : 'cyan';

    if (conn.directed === 'forward' || conn.directed === 'both') {
      conn.pathEl.setAttribute('marker-end', `url(#arrowhead-${color})`);
    } else {
      conn.pathEl.removeAttribute('marker-end');
    }

    if (conn.directed === 'both') {
      conn.pathEl.setAttribute('marker-start', `url(#arrowhead-start-${color})`);
    } else {
      conn.pathEl.removeAttribute('marker-start');
    }
  }

  _renderConnection(conn) {
    const sp = this.nodeManager.getPortPosition(conn.sourceId, conn.sourcePort);
    const tp = this.nodeManager.getPortPosition(conn.targetId, conn.targetPort);
    if (!sp || !tp) return;

    const d = this._computeSmartPath(
      sp.x, sp.y, conn.sourcePort,
      tp.x, tp.y, conn.targetPort
    );
    // Store the clean base path (no jumps) — used for intersection detection
    conn._basePathD = d;
    conn.pathEl.setAttribute('d', d);
    conn.hitArea.setAttribute('d', d);

    conn.dot1.setAttribute('cx', sp.x);
    conn.dot1.setAttribute('cy', sp.y);
    conn.dot2.setAttribute('cx', tp.x);
    conn.dot2.setAttribute('cy', tp.y);

    // Schedule jump recalculation (batched per frame)
    this._scheduleJumpUpdate();
  }

  _renderAll() {
    this.connections.forEach(conn => this._renderConnection(conn));
  }

  /** Batch jump updates into a single animation frame */
  _scheduleJumpUpdate() {
    cancelAnimationFrame(this._jumpFrame);
    this._jumpFrame = requestAnimationFrame(() => this._applyAllJumps());
  }

  /** Compute simple orthogonal path for preview (no port info) */
  _computePath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const midX = x1 + dx / 2;
    const midY = y1 + dy / 2;

    if (Math.abs(dx) > Math.abs(dy)) {
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }

  /** Smart orthogonal routing that extends outward from ports before turning */
  _computeSmartPath(x1, y1, port1, x2, y2, port2) {
    const OFFSET = 30; // minimum distance to extend from port before turning

    // Get the direction vector for each port
    const dir1 = this._portDirection(port1);
    const dir2 = this._portDirection(port2);

    // Extend from each port
    const ex1 = x1 + dir1.dx * OFFSET;
    const ey1 = y1 + dir1.dy * OFFSET;
    const ex2 = x2 + dir2.dx * OFFSET;
    const ey2 = y2 + dir2.dy * OFFSET;

    // Build path: port1 → extension1 → (elbow turns) → extension2 → port2
    // Use at most 2 intermediate elbow segments between extensions
    const segments = [`M ${x1} ${y1}`, `L ${ex1} ${ey1}`];

    // Route from ex1,ey1 to ex2,ey2 with orthogonal segments
    const dx = ex2 - ex1;
    const dy = ey2 - ey1;

    // Horizontal then vertical, or vertical then horizontal
    if ((dir1.dx !== 0 && dir2.dy !== 0) || (dir1.dx !== 0 && dir2.dx !== 0 && Math.abs(dx) > Math.abs(dy))) {
      // Go horizontal first, then vertical
      segments.push(`L ${ex2} ${ey1}`);
      segments.push(`L ${ex2} ${ey2}`);
    } else if ((dir1.dy !== 0 && dir2.dx !== 0) || (dir1.dy !== 0 && dir2.dy !== 0)) {
      // Go vertical first, then horizontal
      segments.push(`L ${ex1} ${ey2}`);
      segments.push(`L ${ex2} ${ey2}`);
    } else {
      // Default: midpoint routing
      const midX = ex1 + dx / 2;
      const midY = ey1 + dy / 2;
      if (Math.abs(dx) > Math.abs(dy)) {
        segments.push(`L ${midX} ${ey1}`);
        segments.push(`L ${midX} ${ey2}`);
      } else {
        segments.push(`L ${ex1} ${midY}`);
        segments.push(`L ${ex2} ${midY}`);
      }
      segments.push(`L ${ex2} ${ey2}`);
    }

    segments.push(`L ${x2} ${y2}`);
    return segments.join(' ');
  }

  /** Get the outward direction vector for a port */
  _portDirection(port) {
    switch (port) {
      case 'top':    return { dx: 0, dy: -1 };
      case 'bottom': return { dx: 0, dy: 1 };
      case 'left':   return { dx: -1, dy: 0 };
      case 'right':  return { dx: 1, dy: 0 };
      default:       return { dx: 0, dy: -1 };
    }
  }

  // ── Wire Jump System ──────────────────────────────────────────────

  /** Parse an SVG path's M/L commands into an array of {x, y} points */
  _parsePathPoints(d) {
    const points = [];
    const regex = /[ML]\s*([-\d.]+)\s+([-\d.]+)/g;
    let match;
    while ((match = regex.exec(d)) !== null) {
      points.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
    }
    return points;
  }

  /** Find crossing points between two sets of orthogonal path segments.
   *  Returns array of { x, y, segIndex } where segIndex is the segment index in pointsA. */
  _findSegmentCrossings(pointsA, pointsB) {
    const crossings = [];
    const R = 6; // arc radius — crossing must be this far from segment ends

    for (let i = 0; i < pointsA.length - 1; i++) {
      const a1 = pointsA[i], a2 = pointsA[i + 1];
      const aHoriz = Math.abs(a2.y - a1.y) < 0.5;
      const aVert  = Math.abs(a2.x - a1.x) < 0.5;
      if (!aHoriz && !aVert) continue; // skip diagonals

      for (let j = 0; j < pointsB.length - 1; j++) {
        const b1 = pointsB[j], b2 = pointsB[j + 1];
        const bHoriz = Math.abs(b2.y - b1.y) < 0.5;
        const bVert  = Math.abs(b2.x - b1.x) < 0.5;
        if (!bHoriz && !bVert) continue;

        // Only H-V or V-H pairs can cross
        if (aHoriz === bHoriz) continue;

        let ix, iy;
        if (aHoriz && bVert) {
          iy = a1.y;
          ix = b1.x;
        } else {
          ix = a1.x;
          iy = b1.y;
        }

        // Verify intersection falls within BOTH segments
        // Margin R is only needed along each segment's LENGTH, not across it
        const aMinX = Math.min(a1.x, a2.x), aMaxX = Math.max(a1.x, a2.x);
        const aMinY = Math.min(a1.y, a2.y), aMaxY = Math.max(a1.y, a2.y);
        const bMinX = Math.min(b1.x, b2.x), bMaxX = Math.max(b1.x, b2.x);
        const bMinY = Math.min(b1.y, b2.y), bMaxY = Math.max(b1.y, b2.y);

        if (aHoriz) {
          // Segment A is horizontal: check ix is within A's X range (with margin),
          // and iy matches A's Y (exact match)
          if (ix <= aMinX + R || ix >= aMaxX - R) continue;
          if (Math.abs(iy - a1.y) > 0.5) continue;
        } else {
          // Segment A is vertical: check iy is within A's Y range (with margin),
          // and ix matches A's X (exact match)
          if (iy <= aMinY + R || iy >= aMaxY - R) continue;
          if (Math.abs(ix - a1.x) > 0.5) continue;
        }

        if (bHoriz) {
          if (ix <= bMinX + R || ix >= bMaxX - R) continue;
          if (Math.abs(iy - b1.y) > 0.5) continue;
        } else {
          if (iy <= bMinY + R || iy >= bMaxY - R) continue;
          if (Math.abs(ix - b1.x) > 0.5) continue;
        }

        crossings.push({ x: ix, y: iy, segIndex: i });
      }
    }
    return crossings;
  }

  /** Build an SVG path string with semicircle jump arcs at crossing points */
  _buildPathWithJumps(points, jumps) {
    if (jumps.length === 0) return null;
    const R = 6; // jump arc radius
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Get jumps for this segment
      const segJumps = jumps.filter(j => j.segIndex === i - 1);

      if (segJumps.length === 0) {
        d += ` L ${curr.x} ${curr.y}`;
        continue;
      }

      const isHoriz = Math.abs(curr.y - prev.y) < 0.5;

      if (isHoriz) {
        const goingRight = curr.x > prev.x;
        segJumps.sort((a, b) => goingRight ? a.x - b.x : b.x - a.x);
        for (const j of segJumps) {
          const sign = goingRight ? 1 : -1;
          d += ` L ${j.x - R * sign} ${j.y}`;
          // Semicircle arc jumping over the crossing wire
          d += ` A ${R} ${R} 0 0 ${goingRight ? 0 : 1} ${j.x + R * sign} ${j.y}`;
        }
      } else {
        const goingDown = curr.y > prev.y;
        segJumps.sort((a, b) => goingDown ? a.y - b.y : b.y - a.y);
        for (const j of segJumps) {
          const sign = goingDown ? 1 : -1;
          d += ` L ${j.x} ${j.y - R * sign}`;
          d += ` A ${R} ${R} 0 0 ${goingDown ? 1 : 0} ${j.x} ${j.y + R * sign}`;
        }
      }
      d += ` L ${curr.x} ${curr.y}`;
    }
    return d;
  }

  /** Recalculate and render jump arcs for ALL connections */
  _applyAllJumps() {
    // 1. Parse base paths into point arrays
    const entries = [];
    for (const conn of this.connections.values()) {
      const d = conn._basePathD;
      if (!d) continue;
      const pts = this._parsePathPoints(d);
      conn._pathPoints = pts;
      entries.push({ conn, pts });
    }

    // 2. For each connection, find crossings with all unconnected wires
    for (const { conn, pts } of entries) {
      const allJumps = [];

      for (const { conn: other, pts: otherPts } of entries) {
        if (other.id === conn.id) continue;

        const crossings = this._findSegmentCrossings(pts, otherPts);
        allJumps.push(...crossings);
      }

      if (allJumps.length > 0) {
        const jumpPath = this._buildPathWithJumps(pts, allJumps);
        if (jumpPath) {
          conn.pathEl.setAttribute('d', jumpPath);
          // Hit area keeps the base path for reliable click detection
        }
      } else {
        // Reset to base path (remove any stale jumps)
        conn.pathEl.setAttribute('d', conn._basePathD);
      }
    }
  }

  /** Auto-detect the best port on the target node based on relative position to the source node */
  _findBestPort(sourceNodeId, targetNodeId) {
    const src = this.nodeManager.getNode(sourceNodeId);
    const tgt = this.nodeManager.getNode(targetNodeId);
    if (!src || !tgt) return 'left';

    // Get node centers
    const srcEl = src.el;
    const tgtEl = tgt.el;
    const srcCx = src.x + srcEl.offsetWidth / 2;
    const srcCy = src.y + srcEl.offsetHeight / 2;
    const tgtCx = tgt.x + tgtEl.offsetWidth / 2;
    const tgtCy = tgt.y + tgtEl.offsetHeight / 2;

    const dx = srcCx - tgtCx; // positive = source is to the right
    const dy = srcCy - tgtCy; // positive = source is below

    // Pick the port that faces the source node
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'bottom' : 'top';
  }

  selectConnection(id) {
    this.deselectConnection();
    const conn = this.connections.get(id);
    if (conn) {
      conn.group.classList.add('selected');
      this.selectedConnection = id;
      // Switch arrowhead to magenta when selected
      if (conn.directed !== 'none') this._applyArrow(conn);
      // Also deselect any nodes
      this.nodeManager.deselectAll();
      this.bus.emit('connection:selected', conn);
    }
  }

  deselectConnection() {
    if (this.selectedConnection) {
      const conn = this.connections.get(this.selectedConnection);
      if (conn) {
        conn.group.classList.remove('selected');
        // Switch arrowhead back to cyan
        if (conn.directed !== 'none') this._applyArrow(conn);
      }
      this.selectedConnection = null;
    }
  }

  deleteConnection(id) {
    const conn = this.connections.get(id);
    if (!conn) return;
    conn.group.remove();
    this.connections.delete(id);
    if (this.selectedConnection === id) this.selectedConnection = null;
    this.bus.emit('connection:deleted', { id });
  }

  deleteSelectedConnection() {
    if (this.selectedConnection) {
      this.deleteConnection(this.selectedConnection);
      this.bus.emit('state:changed');
    }
  }

  _removeConnectionsForNode(nodeId) {
    const toRemove = [];
    this.connections.forEach((conn, id) => {
      if (conn.sourceId === nodeId || conn.targetId === nodeId) {
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => this.deleteConnection(id));
  }

  /** Get all connections attached to a node */
  getConnectionsForNode(nodeId) {
    const result = [];
    this.connections.forEach(conn => {
      if (conn.sourceId === nodeId || conn.targetId === nodeId) {
        result.push(conn);
      }
    });
    return result;
  }

  /** Disconnect all connections from a specific node */
  disconnectAll(nodeId) {
    const conns = this.getConnectionsForNode(nodeId);
    conns.forEach(c => this.deleteConnection(c.id));
    if (conns.length > 0) this.bus.emit('state:changed');
    return conns.length;
  }

  /** Find a connection whose path is near a world-coordinate point.
   *  Excludes connections that already involve the given node. */
  findConnectionAtPoint(worldX, worldY, excludeNodeId = null) {
    const point = new DOMPoint(worldX, worldY);
    for (const conn of this.connections.values()) {
      // Don't match wires already attached to this node
      if (excludeNodeId && (conn.sourceId === excludeNodeId || conn.targetId === excludeNodeId)) continue;
      try {
        if (conn.hitArea.isPointInStroke(point)) {
          return conn;
        }
      } catch (_) {
        // isPointInStroke may throw if path data is empty
      }
    }
    return null;
  }

  /** Splice a node into an existing connection — replaces one wire with two.
   *  source ──wire──> target  becomes  source ──> node ──> target */
  spliceNodeIntoConnection(connId, nodeId) {
    const conn = this.connections.get(connId);
    if (!conn) return false;

    const { sourceId, sourcePort, targetId, targetPort, directed } = conn;

    // Determine which ports on the spliced node face the source and target
    const inPort = this._findBestPort(sourceId, nodeId);   // port on nodeId facing source
    const outPort = this._findBestPort(targetId, nodeId);  // port on nodeId facing target

    // If both ports resolve to the same direction, offset one
    const usedOutPort = (outPort === inPort) ? this._oppositePort(inPort) : outPort;

    // Remove the original connection
    this.deleteConnection(connId);

    // Create source → new node
    this.createConnection(sourceId, sourcePort, nodeId, inPort, { directed });

    // Create new node → target
    this.createConnection(nodeId, usedOutPort, targetId, targetPort, { directed });

    this.bus.emit('state:changed');
    return true;
  }

  /** Highlight a connection as a splice target during node drag */
  highlightSpliceTarget(worldX, worldY, excludeNodeId) {
    // Clear any previous highlight
    this.clearSpliceHighlight();

    const conn = this.findConnectionAtPoint(worldX, worldY, excludeNodeId);
    if (conn) {
      conn.group.classList.add('splice-target');
      this._spliceHighlight = conn.id;
    }
    return conn;
  }

  /** Remove splice highlight */
  clearSpliceHighlight() {
    if (this._spliceHighlight) {
      const conn = this.connections.get(this._spliceHighlight);
      if (conn) conn.group.classList.remove('splice-target');
      this._spliceHighlight = null;
    }
  }

  _connectionExists(srcId, srcPort, tgtId, tgtPort) {
    for (const conn of this.connections.values()) {
      if (
        (conn.sourceId === srcId && conn.sourcePort === srcPort && conn.targetId === tgtId && conn.targetPort === tgtPort) ||
        (conn.sourceId === tgtId && conn.sourcePort === tgtPort && conn.targetId === srcId && conn.targetPort === srcPort)
      ) {
        return true;
      }
    }
    return false;
  }

  serialize() {
    const arr = [];
    this.connections.forEach(c => {
      arr.push({ id: c.id, sourceId: c.sourceId, sourcePort: c.sourcePort, targetId: c.targetId, targetPort: c.targetPort, directed: c.directed || 'none' });
    });
    return arr;
  }

  deserialize(data) {
    // Clear existing
    this.connections.forEach(c => c.group.remove());
    this.connections.clear();
    this.selectedConnection = null;

    if (!data) return;
    data.forEach(d => {
      // Only create if both nodes exist
      if (this.nodeManager.getNode(d.sourceId) && this.nodeManager.getNode(d.targetId)) {
        this.createConnection(d.sourceId, d.sourcePort, d.targetId, d.targetPort, { id: d.id, directed: d.directed || 'none' });
      }
    });
  }
}
