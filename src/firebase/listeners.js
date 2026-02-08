/**
 * Real-time Firestore Listeners
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * Provides onSnapshot listeners for live agent message streaming,
 * project state updates, and cost ledger changes.
 * The client subscribes to these for real-time UI updates.
 */

import { db } from './config.js';
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';

/**
 * Listen to all messages in a project (real-time)
 * Messages appear in the Agent Panel as agents generate them.
 * 
 * @param {string} projectId
 * @param {(messages: object[]) => void} callback - Called with full message array on each update
 * @returns {() => void} Unsubscribe function
 */
export function onMessagesChange(projectId, callback) {
  const q = query(
    collection(db, 'projects', projectId, 'messages'),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  }, (err) => {
    console.error('[Listeners] Messages listener error:', err);
  });
}

/**
 * Listen to messages for a specific round (real-time)
 * 
 * @param {string} projectId
 * @param {number} round
 * @param {(messages: object[]) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onRoundMessagesChange(projectId, round, callback) {
  const q = query(
    collection(db, 'projects', projectId, 'messages'),
    where('round', '==', round),
    orderBy('timestamp', 'asc')
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
  });
}

/**
 * Listen to project state changes (real-time)
 * Tracks orchestration status, active agents, current phase/round.
 * 
 * @param {string} projectId
 * @param {(project: object) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onProjectChange(projectId, callback) {
  return onSnapshot(doc(db, 'projects', projectId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    }
  }, (err) => {
    console.error('[Listeners] Project listener error:', err);
  });
}

/**
 * Listen to artifacts changes (real-time)
 * 
 * @param {string} projectId
 * @param {(artifacts: object[]) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onArtifactsChange(projectId, callback) {
  const q = query(
    collection(db, 'projects', projectId, 'artifacts'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const artifacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(artifacts);
  });
}

/**
 * Listen to cost ledger changes (real-time)
 * Powers the cost dashboard in the Agent Panel.
 * 
 * @param {string} projectId
 * @param {(ledger: object | null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onCostLedgerChange(projectId, callback) {
  return onSnapshot(doc(db, 'projects', projectId, 'costLedger', 'current'), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}
