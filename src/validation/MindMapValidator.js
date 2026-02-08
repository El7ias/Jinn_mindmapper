/**
 * MindMapValidator — Validates mind map structure and metadata enrichment
 * 
 * Phase 3.2 — Node Metadata System
 * 
 * Validates that a mind map is ready for agent processing:
 * - Has sufficient nodes
 * - Nodes have meaningful text
 * - Required metadata is set (types, priorities)
 * - Connectivity requirements are met
 * - CEO context is provided
 */

import { NODE_TYPES, PRIORITY_LEVELS, AGENT_STATUS_MAP } from '../nodes/NodeManager.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the mind map passes validation
 * @property {string[]} errors - Blocking issues that prevent agent processing
 * @property {string[]} warnings - Non-blocking issues that may affect quality
 * @property {Object} stats - Mind map statistics
 */

/**
 * Validate a mind map for agent processing readiness
 * 
 * @param {object[]} nodes - Serialized node array
 * @param {object[]} connections - Serialized connection array
 * @param {object} ceoContext - CEO context object
 * @returns {ValidationResult}
 */
export function validateMindMap(nodes, connections, ceoContext = {}) {
  const errors = [];
  const warnings = [];

  // ─── Node count ─────────────────────────────────────────────────────
  if (!nodes || nodes.length === 0) {
    errors.push('Mind map has no nodes. Add at least 2 nodes to define your project.');
  } else if (nodes.length < 2) {
    errors.push('Mind map has only 1 node. Add more nodes to define your project structure.');
  } else if (nodes.length < 3) {
    warnings.push('Mind map has very few nodes. Consider adding more detail for better agent results.');
  }

  // ─── Text content ──────────────────────────────────────────────────
  if (nodes) {
    const emptyNodes = nodes.filter(n => !n.text || n.text.trim().length === 0);
    if (emptyNodes.length > 0) {
      warnings.push(`${emptyNodes.length} node(s) have no text. Give them labels for agents to understand your intent.`);
    }

    const shortNodes = nodes.filter(n => n.text && n.text.trim().length > 0 && n.text.trim().length < 3);
    if (shortNodes.length > 0) {
      warnings.push(`${shortNodes.length} node(s) have very short labels. More descriptive text helps agents.`);
    }
  }

  // ─── Node types ────────────────────────────────────────────────────
  if (nodes && nodes.length >= 2) {
    const typedNodes = nodes.filter(n => n.nodeType && n.nodeType !== 'general');
    if (typedNodes.length === 0) {
      warnings.push('No nodes have a type set. Categorizing nodes (feature, constraint, risk, etc.) helps agents prioritize.');
    }
  }

  // ─── Priority ──────────────────────────────────────────────────────
  if (nodes && nodes.length >= 3) {
    const prioritizedNodes = nodes.filter(n => n.priority && n.priority !== 'medium');
    if (prioritizedNodes.length === 0) {
      warnings.push('All nodes are default priority. Setting priorities helps agents focus on critical items.');
    }
  }

  // ─── Connectivity ──────────────────────────────────────────────────
  if (connections && nodes && nodes.length >= 2) {
    if (connections.length === 0) {
      warnings.push('No connections between nodes. Connecting related nodes helps agents understand relationships.');
    } else {
      // Check for orphan nodes (no connections)
      const connectedIds = new Set();
      connections.forEach(c => {
        connectedIds.add(c.sourceId);
        connectedIds.add(c.targetId);
      });
      const orphans = nodes.filter(n => !connectedIds.has(n.id));
      if (orphans.length > 0 && orphans.length < nodes.length) {
        warnings.push(`${orphans.length} node(s) are not connected to anything. Connect them to show relationships.`);
      }
    }
  }

  // ─── CEO Context ───────────────────────────────────────────────────
  if (!ceoContext || (!ceoContext.concept && (!ceoContext.goals || ceoContext.goals.length === 0))) {
    warnings.push('No CEO context provided. Describing your concept and goals gives agents better direction.');
  }

  // ─── Stats ─────────────────────────────────────────────────────────
  const stats = computeStats(nodes || [], connections || []);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Compute statistics about the mind map
 */
export function computeStats(nodes, connections) {
  const nodesByType = {};
  const nodesByPriority = {};
  const nodesByStatus = {};

  NODE_TYPES.forEach(t => nodesByType[t.id] = 0);
  PRIORITY_LEVELS.forEach(p => nodesByPriority[p.id] = 0);
  Object.keys(AGENT_STATUS_MAP).forEach(s => nodesByStatus[s] = 0);

  nodes.forEach(n => {
    const type = n.nodeType || 'general';
    const priority = n.priority || 'medium';
    const status = n.agentStatus || 'unassigned';
    nodesByType[type] = (nodesByType[type] || 0) + 1;
    nodesByPriority[priority] = (nodesByPriority[priority] || 0) + 1;
    nodesByStatus[status] = (nodesByStatus[status] || 0) + 1;
  });

  return {
    totalNodes: nodes.length,
    totalConnections: connections.length,
    nodesByType,
    nodesByPriority,
    nodesByStatus,
    nodesWithText: nodes.filter(n => n.text && n.text.trim().length > 0).length,
    nodesAssigned: nodes.filter(n => n.assignedAgent).length,
  };
}
