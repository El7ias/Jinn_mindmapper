/**
 * MindMapSerializer — Converts the visual mind map graph into a
 * structured intermediate object ready for prompt generation.
 * 
 * This is the first stage of the pipeline:
 *   Canvas → MindMapSerializer → WorkflowPromptGenerator → Claude Code
 * 
 * It reads nodes + connections from the managers and produces a clean
 * data structure organized by node type, with dependency relationships
 * derived from directed connections and topological ordering.
 */

import { NODE_TYPES } from '../nodes/NodeManager.js';

/**
 * @typedef {Object} SerializedMindMap
 * @property {string} projectName - Derived from the mind map title or root node
 * @property {string} ceoVision - High-level concept description from the user
 * @property {Object[]} features - Feature-typed nodes
 * @property {Object[]} constraints - Constraint-typed nodes
 * @property {Object[]} risks - Risk-typed nodes
 * @property {Object[]} references - Reference/research nodes
 * @property {Object[]} techNotes - Technical note nodes
 * @property {Object[]} general - General/uncategorized nodes
 * @property {Object[]} dependencies - Connection-based dependency graph
 * @property {Object[]} executionOrder - Topologically sorted node sequence
 * @property {Object} stats - Summary statistics
 */

/**
 * Serialize a mind map into a structured intermediate format
 * 
 * @param {object[]} nodes - Serialized nodes from NodeManager.serialize()
 * @param {object[]} connections - Serialized connections from ConnectionManager.serialize()
 * @param {object} options - Additional context
 * @param {string} [options.projectName] - User-provided project name
 * @param {string} [options.ceoVision] - User-provided concept description
 * @returns {SerializedMindMap}
 */
export function serializeMindMap(nodes, connections, options = {}) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  
  // ─── Categorize nodes by type ──────────────────────────────────────
  const categories = {
    feature:    [],
    constraint: [],
    risk:       [],
    reference:  [],
    techNote:   [],
    general:    [],
  };

  nodes.forEach(node => {
    const type = node.nodeType || 'general';
    const entry = {
      id: node.id,
      text: (node.text || '').trim(),
      type,
      priority: node.priority || 'medium',
      assignedAgent: node.assignedAgent || null,
      agentNotes: node.agentNotes || '',
      shape: node.shape || 'rectangle',
    };

    if (categories[type]) {
      categories[type].push(entry);
    } else {
      categories.general.push(entry);
    }
  });

  // ─── Sort each category by priority ────────────────────────────────
  const priorityWeight = { critical: 0, high: 1, medium: 2, low: 3 };
  Object.values(categories).forEach(arr => {
    arr.sort((a, b) => (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2));
  });

  // ─── Build dependency graph from connections ───────────────────────
  const dependencies = [];
  const adjList = new Map(); // nodeId → [dependentNodeIds]
  const inDegree = new Map();

  nodes.forEach(n => {
    adjList.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  connections.forEach(conn => {
    const from = nodeMap.get(conn.sourceId);
    const to = nodeMap.get(conn.targetId);
    if (!from || !to) return;

    const isDirected = conn.directed === 'forward' || conn.directed === 'both';

    dependencies.push({
      from: { id: from.id, text: (from.text || '').trim() },
      to:   { id: to.id, text: (to.text || '').trim() },
      directed: isDirected,
      type: isDirected ? 'depends-on' : 'related-to',
    });

    if (isDirected) {
      // Source → Target means Target depends on Source
      adjList.get(conn.sourceId)?.push(conn.targetId);
      inDegree.set(conn.targetId, (inDegree.get(conn.targetId) || 0) + 1);
    }

    if (conn.directed === 'both') {
      adjList.get(conn.targetId)?.push(conn.sourceId);
      inDegree.set(conn.sourceId, (inDegree.get(conn.sourceId) || 0) + 1);
    }
  });

  // ─── Topological sort for execution order ──────────────────────────
  const executionOrder = _topoSort(nodes, adjList, inDegree, priorityWeight);

  // ─── Detect root nodes (no incoming directed connections) ──────────
  const rootNodes = nodes.filter(n => (inDegree.get(n.id) || 0) === 0 && (n.text || '').trim().length > 0);

  // ─── Derive project name ───────────────────────────────────────────
  let projectName = options.projectName || '';
  if (!projectName && rootNodes.length > 0) {
    // Use the first root node with substantial text as the project name
    const candidate = rootNodes.find(n => (n.text || '').trim().length > 2);
    if (candidate) projectName = candidate.text.trim();
  }
  if (!projectName) projectName = 'Untitled Project';

  // ─── Stats ─────────────────────────────────────────────────────────
  const stats = {
    totalNodes: nodes.length,
    totalConnections: connections.length,
    directedConnections: connections.filter(c => c.directed === 'forward' || c.directed === 'both').length,
    undirectedConnections: connections.filter(c => c.directed === 'none' || !c.directed).length,
    featureCount: categories.feature.length,
    constraintCount: categories.constraint.length,
    riskCount: categories.risk.length,
    referenceCount: categories.reference.length,
    techNoteCount: categories.techNote.length,
    generalCount: categories.general.length,
    criticalCount: nodes.filter(n => n.priority === 'critical').length,
    highCount: nodes.filter(n => n.priority === 'high').length,
  };

  return {
    projectName,
    ceoVision: options.ceoVision || '',
    ...categories,
    dependencies,
    executionOrder,
    rootNodes: rootNodes.map(n => ({ id: n.id, text: (n.text || '').trim() })),
    stats,
  };
}

/**
 * Kahn's algorithm topological sort with priority-aware tie-breaking
 */
function _topoSort(nodes, adjList, inDegree, priorityWeight) {
  const sorted = [];
  const inDeg = new Map(inDegree);

  // Start with nodes that have no incoming edges
  let queue = nodes
    .filter(n => (inDeg.get(n.id) || 0) === 0)
    .sort((a, b) => (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2));

  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push({
      id: node.id,
      text: (node.text || '').trim(),
      type: node.nodeType || 'general',
      priority: node.priority || 'medium',
    });

    const neighbors = adjList.get(node.id) || [];
    const newReady = [];
    for (const neighborId of neighbors) {
      const newDeg = (inDeg.get(neighborId) || 1) - 1;
      inDeg.set(neighborId, newDeg);
      if (newDeg === 0) {
        const neighborNode = nodes.find(n => n.id === neighborId);
        if (neighborNode) newReady.push(neighborNode);
      }
    }
    // Add newly ready nodes, sorted by priority
    newReady.sort((a, b) => (priorityWeight[a.priority] ?? 2) - (priorityWeight[b.priority] ?? 2));
    queue.push(...newReady);
  }

  // Add any remaining nodes not in the sorted list (cycles or disconnected)
  const sortedIds = new Set(sorted.map(s => s.id));
  nodes.forEach(n => {
    if (!sortedIds.has(n.id)) {
      sorted.push({
        id: n.id,
        text: (n.text || '').trim(),
        type: n.nodeType || 'general',
        priority: n.priority || 'medium',
      });
    }
  });

  return sorted;
}
