/**
 * Migration — localStorage → Firestore
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * Migrates existing localStorage projects to Firestore when a user signs in.
 * This is a one-way migration: localStorage data is uploaded to the cloud,
 * and the local copy is kept as a cache/backup.
 */

import { createProject, updateProject, getUserProjects } from './firestore.js';

const LOCAL_STORAGE_KEY = 'mindmapper-state';
const MIGRATION_FLAG_KEY = 'mindmapper-migrated';

/**
 * Check if there is local data that has not been migrated
 * @returns {boolean}
 */
export function hasUnmigratedData() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  const migrated = localStorage.getItem(MIGRATION_FLAG_KEY);
  return raw !== null && migrated !== 'true';
}

/**
 * Migrate the current localStorage state to Firestore
 * Creates a new project from the local mind map data.
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<string | null>} The new Firestore project ID, or null if nothing to migrate
 */
export async function migrateLocalToFirestore(userId) {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;

  try {
    const state = JSON.parse(raw);
    if (!state.nodes || state.nodes.length === 0) {
      // Nothing meaningful to migrate
      localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
      return null;
    }

    // Create a Firestore project from the local state
    const projectId = await createProject(userId, {
      name: 'Migrated Project',
      mindMap: {
        nodes: state.nodes.map(n => ({
          ...n,
          // Add Phase 3 metadata defaults
          nodeType: n.nodeType || 'general',
          priority: n.priority || 'medium',
          phase: n.phase ?? null,
          assignedAgent: n.assignedAgent || null,
          agentStatus: n.agentStatus || 'unassigned',
          agentNotes: n.agentNotes || null,
        })),
        connections: state.connections.map(c => ({
          ...c,
          edgeType: c.edgeType || 'general',
        })),
        viewport: state.viewport || { x: 0, y: 0, zoom: 1 },
      },
    });

    // Mark as migrated
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    console.log(`[Migration] localStorage migrated → Firestore project ${projectId}`);
    return projectId;

  } catch (err) {
    console.error('[Migration] Failed to migrate localStorage to Firestore:', err);
    return null;
  }
}

/**
 * Reset migration flag (for testing/debugging)
 */
export function resetMigrationFlag() {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
}
