/**
 * LLMGateway — Client-side adapter for calling the Cloud Functions LLM gateway
 * 
 * Phase 3.0 — Infrastructure Foundation
 * 
 * Routes LLM calls through Cloud Functions, which handle:
 * - API key management (server-side only)
 * - Token counting and cost tracking
 * - Multi-model routing (OpenAI, Anthropic, Google AI)
 * - Rate limiting and retry logic
 * - Sentinel security scanning
 * 
 * The client never touches LLM API keys directly.
 */

import { getIdToken } from '../firebase/auth.js';
import { isFirebaseConfigured } from '../firebase/config.js';

// Cloud Function endpoint (set via environment variable or default)
const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL 
  || 'https://us-central1-YOUR_PROJECT.cloudfunctions.net';

/**
 * Send a message to the agent orchestration system via Cloud Functions
 * 
 * @param {string} projectId - The Firestore project ID
 * @param {object} payload - The message payload
 * @param {string} payload.content - The CEO's message text
 * @param {string} payload.type - Message type: 'initial' | 'revision' | 'approval' | 'question'
 * @param {string[]} [payload.mentions] - Agent roles to mention (e.g., ['cto', 'creative'])
 * @param {object} [payload.context] - Additional context (mind map state, etc.)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendToOrchestrator(projectId, payload) {
  if (!isFirebaseConfigured()) {
    console.warn('[LLMGateway] Firebase not configured — using mock mode');
    return _mockResponse(payload);
  }

  const token = await getIdToken();
  if (!token) {
    throw new Error('Not authenticated. Sign in before sending messages.');
  }

  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        ...payload,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[LLMGateway] Orchestration call failed:', err);
    throw err;
  }
}

/**
 * Get cost estimate for a planned operation
 * 
 * @param {string} projectId
 * @param {object} operation - The planned operation details
 * @returns {Promise<{estimatedCost: number, estimatedTokens: number, model: string}>}
 */
export async function getCostEstimate(projectId, operation) {
  if (!isFirebaseConfigured()) {
    return { estimatedCost: 0.002, estimatedTokens: 500, model: 'mock' };
  }

  const token = await getIdToken();
  if (!token) throw new Error('Not authenticated.');

  const response = await fetch(`${FUNCTIONS_BASE_URL}/estimateCost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, operation }),
  });

  return await response.json();
}

/**
 * Mock response for development when Firebase is not configured
 */
function _mockResponse(payload) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        success: true,
        messageId: `mock_${Date.now()}`,
        mock: true,
        debug: 'Firebase not configured — this is a mock response',
      });
    }, 300);
  });
}
