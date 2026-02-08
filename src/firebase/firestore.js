/**
 * Firestore Data Layer — CRUD Operations for Projects, Messages, Artifacts, and Cost Ledger
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * All Firestore operations for the agent orchestration system.
 * Collection structure:
 *   /projects/{projectId}
 *   /projects/{projectId}/messages/{messageId}
 *   /projects/{projectId}/artifacts/{artifactId}
 *   /projects/{projectId}/costLedger  (single doc)
 *   /users/{userId}
 */

import { db } from './config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

// ─── Projects ───────────────────────────────────────────────────────────────

/**
 * Create a new project in Firestore
 * @param {string} ownerId - Firebase Auth UID of the CEO
 * @param {object} projectData - Partial project data
 * @returns {Promise<string>} The new project ID
 */
export async function createProject(ownerId, projectData) {
  const projectRef = await addDoc(collection(db, 'projects'), {
    ownerId,
    name: projectData.name || 'Untitled Project',
    status: 'draft',
    mindMap: projectData.mindMap || { nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 } },
    orchestration: {
      currentPhase: 0,
      currentRound: 0,
      activeAgents: [],
      turnOrder: [],
      status: 'idle',
    },
    ceoContext: projectData.ceoContext || {
      concept: '',
      goals: [],
      constraints: [],
      designReferences: [],
      preferences: { style: '', targetPlatform: '', priorityAxis: '' },
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return projectRef.id;
}

/**
 * Get a project by ID
 * @param {string} projectId
 * @returns {Promise<object | null>}
 */
export async function getProject(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Get all projects for a user
 * @param {string} ownerId
 * @returns {Promise<object[]>}
 */
export async function getUserProjects(ownerId) {
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', ownerId),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Update a project
 * @param {string} projectId
 * @param {object} updates
 */
export async function updateProject(projectId, updates) {
  await updateDoc(doc(db, 'projects', projectId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a project and all its subcollections
 * @param {string} projectId
 */
export async function deleteProject(projectId) {
  // Delete subcollections first
  const messageSnap = await getDocs(collection(db, 'projects', projectId, 'messages'));
  for (const msgDoc of messageSnap.docs) await deleteDoc(msgDoc.ref);

  const artifactSnap = await getDocs(collection(db, 'projects', projectId, 'artifacts'));
  for (const artDoc of artifactSnap.docs) await deleteDoc(artDoc.ref);

  // Delete cost ledger
  const costRef = doc(db, 'projects', projectId, 'costLedger', 'current');
  const costSnap = await getDoc(costRef);
  if (costSnap.exists()) await deleteDoc(costRef);

  // Delete project
  await deleteDoc(doc(db, 'projects', projectId));
}

// ─── Messages ───────────────────────────────────────────────────────────────

/**
 * Get messages for a project, optionally filtered
 * @param {string} projectId
 * @param {{ round?: number, phase?: number, agentRole?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function getMessages(projectId, filters = {}) {
  let q = query(
    collection(db, 'projects', projectId, 'messages'),
    orderBy('timestamp', 'asc')
  );

  // Apply filters by re-building query with constraints
  const constraints = [orderBy('timestamp', 'asc')];
  if (filters.round !== undefined) constraints.push(where('round', '==', filters.round));
  if (filters.phase !== undefined) constraints.push(where('phase', '==', filters.phase));
  if (filters.agentRole) constraints.push(where('agentRole', '==', filters.agentRole));

  q = query(collection(db, 'projects', projectId, 'messages'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single message by ID
 * @param {string} projectId
 * @param {string} messageId
 * @returns {Promise<object | null>}
 */
export async function getMessage(projectId, messageId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'messages', messageId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Update CEO decision on a message
 * @param {string} projectId
 * @param {string} messageId
 * @param {'approved' | 'revised' | 'rejected'} decision
 * @param {string | null} comment
 */
export async function setCEODecision(projectId, messageId, decision, comment = null) {
  await updateDoc(doc(db, 'projects', projectId, 'messages', messageId), {
    ceoDecision: decision,
    ceoComment: comment,
  });
}

// ─── Artifacts ──────────────────────────────────────────────────────────────

/**
 * Get all artifacts for a project
 * @param {string} projectId
 * @returns {Promise<object[]>}
 */
export async function getArtifacts(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'artifacts'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single artifact
 * @param {string} projectId
 * @param {string} artifactId
 * @returns {Promise<object | null>}
 */
export async function getArtifact(projectId, artifactId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'artifacts', artifactId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ─── Cost Ledger ────────────────────────────────────────────────────────────

/**
 * Get the cost ledger for a project
 * @param {string} projectId
 * @returns {Promise<object | null>}
 */
export async function getCostLedger(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'costLedger', 'current'));
  return snap.exists() ? snap.data() : null;
}

// ─── User Profile ───────────────────────────────────────────────────────────

/**
 * Create or update user profile
 * @param {string} userId
 * @param {{ displayName: string, email: string, photoURL: string | null }} profile
 */
export async function saveUserProfile(userId, profile) {
  await setDoc(doc(db, 'users', userId), {
    ...profile,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Get user profile
 * @param {string} userId
 * @returns {Promise<object | null>}
 */
export async function getUserProfile(userId) {
  const snap = await getDoc(doc(db, 'users', userId));
  return snap.exists() ? snap.data() : null;
}
