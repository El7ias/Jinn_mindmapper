/**
 * Cloud Functions — Entry Point
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * Exports all Cloud Functions for the MindMapper agent orchestration system.
 * Functions are deployed to Firebase Functions (Node 18).
 * 
 * Current functions:
 *   - orchestrate: Receives CEO messages and dispatches to agents
 *   - estimateCost: Returns estimated cost for a planned operation
 * 
 * Future functions (Phase 3.1+):
 *   - agentExecute: Runs individual agent tasks
 *   - sentinelScan: Security scanning of inputs/outputs
 */

import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
initializeApp();
const db = getFirestore();

/**
 * Orchestrate — Main entry point for CEO → Agent communication
 * 
 * Receives a CEO message, validates auth, writes to Firestore,
 * and triggers the agent orchestration pipeline.
 * 
 * POST /orchestrate
 * Body: { projectId, content, type, mentions?, context? }
 * Headers: Authorization: Bearer <idToken>
 */
export const orchestrate = onRequest({
  cors: true,
  region: 'us-central1',
  maxInstances: 10,
}, async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  let uid;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (err) {
    res.status(401).json({ error: 'Invalid auth token' });
    return;
  }

  const { projectId, content, type = 'initial', mentions = [], context = {} } = req.body;

  if (!projectId || !content) {
    res.status(400).json({ error: 'Missing projectId or content' });
    return;
  }

  // Verify project ownership
  const projectRef = db.doc(`projects/${projectId}`);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists || projectSnap.data().ownerId !== uid) {
    res.status(403).json({ error: 'Access denied to this project' });
    return;
  }

  try {
    // Write CEO message to Firestore
    const messageRef = await db.collection(`projects/${projectId}/messages`).add({
      role: 'ceo',
      content,
      type,
      mentions,
      context,
      timestamp: FieldValue.serverTimestamp(),
      round: projectSnap.data().orchestration?.currentRound || 0,
      phase: projectSnap.data().orchestration?.currentPhase || 0,
      ceoDecision: null,
      ceoComment: null,
    });

    // Update project orchestration status
    await projectRef.update({
      'orchestration.status': 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // TODO Phase 3.1: Trigger agent execution pipeline here
    // For now, respond with success and the message will be processed
    // when the agent framework is implemented

    res.status(200).json({
      success: true,
      messageId: messageRef.id,
    });

  } catch (err) {
    console.error('[orchestrate] Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * EstimateCost — Returns estimated token usage and cost for a planned operation
 * 
 * POST /estimateCost
 * Body: { projectId, operation }
 */
export const estimateCost = onRequest({
  cors: true,
  region: 'us-central1',
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const idToken = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(idToken);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // TODO Phase 3.1: Implement actual cost estimation based on operation type
  // For now, return a placeholder estimate
  const { operation = {} } = req.body;

  res.status(200).json({
    estimatedCost: 0.003,
    estimatedTokens: 750,
    model: 'gpt-4o-mini',
    breakdown: {
      inputTokens: 500,
      outputTokens: 250,
      inputCostPer1k: 0.00015,
      outputCostPer1k: 0.0006,
    },
  });
});
