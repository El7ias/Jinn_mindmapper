/**
 * IdeaGenerator — AI-powered mind map generation from a high-concept idea.
 * 
 * ═══════════════════════════════════════════════════════════════════
 * MODEL TIER: FLASH (Tier 1)
 * This is a STRUCTURED JSON decomposition task — no deep reasoning needed.
 * Default to the cheapest/fastest models available.
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Takes a user's concept description and calls an LLM to produce a structured
 * mind map with typed nodes, priorities, and connections. Supports multiple
 * LLM providers (OpenAI, Anthropic, Google) via direct client-side API calls,
 * with Cloud Functions gateway support for production SaaS mode.
 * 
 * Pipeline:
 *   User concept → System prompt + concept → LLM API → JSON → Canvas render
 * 
 * Cost per generation: ~$0.001 with Flash-tier models
 */

// ─── System Prompt ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert product strategist and systems architect. 
Given a high-level product concept, you will decompose it into a structured mind map.

Your output must be a valid JSON object (no markdown, no code fences, just raw JSON) with this exact structure:

{
  "projectName": "Short project name",
  "nodes": [
    {
      "text": "Node label text",
      "type": "general|feature|constraint|risk|reference|techNote",
      "priority": "critical|high|medium|low"
    }
  ],
  "connections": [
    { "from": 0, "to": 1, "directed": true }
  ]
}

Rules:
1. The FIRST node (index 0) should be the project's core concept — type "general", priority "critical".
2. Generate 12-20 nodes that thoroughly decompose the concept.
3. Use ALL node types thoughtfully:
   - "feature" — Core capabilities and user-facing functionality
   - "constraint" — Technical limitations, business rules, must-haves
   - "risk" — Potential problems, pitfalls, security concerns
   - "reference" — External services, APIs, technologies to research
   - "techNote" — Architecture decisions, implementation notes
   - "general" — Grouping concepts, categories, themes
4. Assign priorities realistically: only 1-3 items should be "critical", most should be "high" or "medium".
5. CONNECTIONS MUST FORM A TREE — each non-root node must have EXACTLY ONE parent connection pointing TO it.
   The root node (index 0) should connect to 3-6 top-level category nodes. Those category nodes connect to their children, and so on.
   Do NOT create cross-connections, cycles, or multiple parents for a single node.
   Set "directed": true and always use "from": parent, "to": child.
6. Total connections should equal (number of nodes − 1), forming a clean hierarchy.
7. Keep node text concise (2-6 words typically, max 10 words).
8. Think like a startup CTO planning the architecture and a product manager defining the roadmap.
   Organize into 3-6 top-level branches (e.g. "Core Features", "Security", "Integration", "UX", "Infrastructure").

Respond with ONLY the JSON object, nothing else.`;

// ─── Provider Configurations ─────────────────────────────────────────
// Defaults are the fastest/most-efficient models for this task.
// Higher-capability models remain available for users who prefer them.

const PROVIDERS = {
  google: {
    name: 'Google',
    models: [
      'gemini-2.0-flash-lite',     // Cheapest — great for this task
      'gemini-2.5-flash-lite',     // Fast + cost-efficient
      'gemini-2.0-flash',          // Fast multimodal
      'gemini-2.5-flash',          // Next-gen fast
      'gemini-3-flash',            // Latest gen flash
      'gemini-2.5-pro',            // High-capability reasoning
      'gemini-3-pro',              // Most capable
    ],
    defaultModel: 'gemini-2.0-flash-lite',
    buildRequest: (apiKey, model, concept) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\nProduct concept: ${concept}` }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        },
      }),
    }),
    parseResponse: (data) => {
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('No response content from Google');
      return JSON.parse(content);
    },
  },

  openai: {
    name: 'OpenAI',
    models: [
      'gpt-4o-mini',               // Budget-friendly
      'gpt-4.1-mini',              // Newer mini
      'gpt-4o',                    // Solid all-rounder
      'gpt-4.1',                   // Latest GPT-4 class
      'o3-mini',                   // Reasoning (cost-efficient)
      'o4-mini',                   // Latest reasoning mini
      'o3',                        // Full reasoning
      'gpt-5',                     // Frontier
    ],
    defaultModel: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    buildRequest: (apiKey, model, concept) => ({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Product concept: ${concept}` },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    }),
    parseResponse: (data) => {
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No response content from OpenAI');
      return JSON.parse(content);
    },
  },

  anthropic: {
    name: 'Anthropic',
    models: [
      'claude-3-haiku-20240307',         // Budget (Claude 3)
      'claude-3-5-haiku-20241022',       // Fast + smart
      'claude-haiku-4-5-20251001',       // Latest Haiku
      'claude-3-5-sonnet-20241022',      // Strong all-rounder
      'claude-sonnet-4-20250514',        // Claude 4 Sonnet
      'claude-sonnet-4-5-20250929',      // Sonnet 4.5
      'claude-opus-4-20250514',          // Claude Opus 4
      'claude-opus-4-1-20250805',        // Opus 4.1
      'claude-opus-4-6',                 // Latest & most capable
    ],
    defaultModel: 'claude-3-haiku-20240307',
    endpoint: 'https://api.anthropic.com/v1/messages',
    buildRequest: (apiKey, model, concept) => ({
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Product concept: ${concept}` },
        ],
      }),
    }),
    parseResponse: (data) => {
      const content = data.content?.[0]?.text;
      if (!content) throw new Error('No response content from Anthropic');
      return JSON.parse(content);
    },
  },
};

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate a mind map structure from a concept description
 * 
 * @param {string} concept - The high-level product concept
 * @param {object} options
 * @param {string} options.provider - 'openai' | 'anthropic' | 'google'
 * @param {string} options.apiKey - The API key for the selected provider
 * @param {string} [options.model] - Override the default model
 * @returns {Promise<{projectName: string, nodes: object[], connections: object[]}>}
 */
export async function generateMindMap(concept, options = {}) {
  const { provider: providerKey, apiKey, model } = options;

  if (!concept?.trim()) throw new Error('Please enter a product concept.');
  if (!apiKey?.trim()) throw new Error('Please enter your API key.');

  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`Unknown provider: ${providerKey}`);

  const selectedModel = model || provider.defaultModel;
  const request = provider.buildRequest(apiKey, selectedModel, concept.trim());

  // Make the API call
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    let parsed;
    try { parsed = JSON.parse(errorText); } catch { parsed = null; }
    const msg = parsed?.error?.message || errorText;
    throw new Error(`API error (${response.status}): ${msg}`);
  }

  const data = await response.json();
  const mindMap = provider.parseResponse(data);

  // Validate and normalize the response
  return _validateAndNormalize(mindMap);
}

/**
 * Get provider info for the UI
 */
export function getProviders() {
  return Object.entries(PROVIDERS).map(([key, p]) => ({
    key,
    name: p.name,
    models: p.models,
    defaultModel: p.defaultModel,
  }));
}

// ─── Validation & Normalization ──────────────────────────────────────

function _validateAndNormalize(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid response: not an object');
  }

  const projectName = raw.projectName || 'Generated Project';

  // Validate nodes
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    throw new Error('Invalid response: missing or empty nodes array');
  }

  const validTypes = new Set(['general', 'feature', 'constraint', 'risk', 'reference', 'techNote']);
  const validPriorities = new Set(['critical', 'high', 'medium', 'low']);

  const nodes = raw.nodes.map((n, i) => ({
    text: String(n.text || `Node ${i + 1}`).trim(),
    type: validTypes.has(n.type) ? n.type : 'general',
    priority: validPriorities.has(n.priority) ? n.priority : 'medium',
  }));

  // Validate connections
  const connections = [];
  if (Array.isArray(raw.connections)) {
    raw.connections.forEach(c => {
      const from = parseInt(c.from, 10);
      const to = parseInt(c.to, 10);
      if (
        !isNaN(from) && !isNaN(to) &&
        from >= 0 && from < nodes.length &&
        to >= 0 && to < nodes.length &&
        from !== to
      ) {
        connections.push({
          from,
          to,
          directed: c.directed !== false, // default to directed
        });
      }
    });
  }

  return { projectName, nodes, connections };
}

// ─── Auto-Layout Algorithm ───────────────────────────────────────────

/**
 * Balanced Mind Map Layout — root center, branches left + right.
 *
 * Creates the classic mind map look:
 *   ┌── Feature A
 *   │    └── Sub-feature
 *   ├── Feature B         Root ──── Feature C
 *   │                               └── Risk
 *   └── Constraint                  └── TechNote
 *
 * Algorithm:
 *   1. BFS spanning tree from root (index 0)
 *   2. Split root's children into LEFT vs RIGHT halves
 *   3. Recursively compute subtree heights (Reingold-Tilford style)
 *   4. Place each subtree with generous vertical spacing
 *   5. Disconnected nodes go in a neat row below
 *
 * @param {object[]} nodes - Node array from LLM response
 * @param {object[]} connections - Connection array from LLM response
 * @param {number} centerX - Center X position on canvas
 * @param {number} centerY - Center Y position on canvas
 * @returns {object[]} Nodes with x, y positions added
 */
export function computeLayout(nodes, connections, centerX = 0, centerY = 0) {
  if (nodes.length === 0) return nodes;

  const N = nodes.length;
  const positioned = nodes.map(n => ({ ...n, x: 0, y: 0 }));

  // ── 1. Build adjacency (undirected) ────────────────────────────────
  const adj = new Map();
  nodes.forEach((_, i) => adj.set(i, new Set()));
  connections.forEach(c => {
    adj.get(c.from)?.add(c.to);
    adj.get(c.to)?.add(c.from);
  });

  // ── 2. BFS spanning tree from root ─────────────────────────────────
  const children = new Map();  // parent → [children]
  const visited = new Set();
  const queue = [0];
  visited.add(0);
  children.set(0, []);

  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nb of adj.get(cur) || []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        if (!children.has(cur)) children.set(cur, []);
        children.get(cur).push(nb);
        if (!children.has(nb)) children.set(nb, []);
        queue.push(nb);
      }
    }
  }

  // Sort children by type for visual grouping
  const TYPE_ORDER = { general: 0, feature: 1, techNote: 2, constraint: 3, reference: 4, risk: 5 };
  for (const [, kids] of children) {
    kids.sort((a, b) => (TYPE_ORDER[nodes[a].type] ?? 6) - (TYPE_ORDER[nodes[b].type] ?? 6));
  }

  // ── 3. Compute subtree height (number of leaves) ──────────────────
  const subtreeLeaves = new Map();
  function countLeaves(node) {
    const kids = children.get(node) || [];
    if (kids.length === 0) { subtreeLeaves.set(node, 1); return 1; }
    let total = 0;
    for (const kid of kids) total += countLeaves(kid);
    subtreeLeaves.set(node, total);
    return total;
  }
  countLeaves(0);

  // ── 4. Layout constants ───────────────────────────────────────────
  const H_GAP = 320;   // horizontal gap between depth levels
  const V_GAP = 90;   // vertical gap between sibling nodes (leaf units)
  const NODE_H = 56;    // approximate node height in px

  // ── 5. Split root children → left half, right half ────────────────
  const rootKids = children.get(0) || [];
  const leftKids = [];
  const rightKids = [];

  // Balanced split: alternate by subtree size for even distribution
  const sorted = [...rootKids].sort((a, b) => (subtreeLeaves.get(b) || 0) - (subtreeLeaves.get(a) || 0));
  let leftWeight = 0, rightWeight = 0;
  for (const kid of sorted) {
    const w = subtreeLeaves.get(kid) || 1;
    if (leftWeight <= rightWeight) {
      leftKids.push(kid);
      leftWeight += w;
    } else {
      rightKids.push(kid);
      rightWeight += w;
    }
  }
  // Restore original order within each side
  leftKids.sort((a, b) => rootKids.indexOf(a) - rootKids.indexOf(b));
  rightKids.sort((a, b) => rootKids.indexOf(a) - rootKids.indexOf(b));

  // ── 6. Recursive placement ────────────────────────────────────────
  //  Places a subtree rooted at `node` starting at (startX, startY).
  //  direction: +1 = rightward, -1 = leftward
  //  Returns the total vertical extent used.

  function placeSubtree(node, startX, startY, direction) {
    const kids = children.get(node) || [];

    if (kids.length === 0) {
      // Leaf node
      positioned[node].x = startX;
      positioned[node].y = startY;
      return NODE_H + V_GAP;
    }

    // Place children first to compute vertical extent
    const childX = startX + direction * H_GAP;
    let cursorY = startY;
    const childPositions = [];

    for (const kid of kids) {
      const extent = placeSubtree(kid, childX, cursorY, direction);
      childPositions.push({ y: positioned[kid].y, extent });
      cursorY += extent;
    }

    // Place this node vertically centered relative to its children
    const firstChildY = childPositions[0].y;
    const lastChildY = childPositions[childPositions.length - 1].y;
    positioned[node].x = startX;
    positioned[node].y = (firstChildY + lastChildY) / 2;

    return cursorY - startY;
  }

  // ── 7. Place left subtrees ────────────────────────────────────────
  const leftTotalLeaves = leftKids.reduce((s, k) => s + (subtreeLeaves.get(k) || 1), 0);
  const leftTotalHeight = leftTotalLeaves * (NODE_H + V_GAP);
  let leftStartY = centerY - leftTotalHeight / 2;

  for (const kid of leftKids) {
    const extent = placeSubtree(kid, centerX - H_GAP, leftStartY, -1);
    leftStartY += extent;
  }

  // ── 8. Place right subtrees ───────────────────────────────────────
  const rightTotalLeaves = rightKids.reduce((s, k) => s + (subtreeLeaves.get(k) || 1), 0);
  const rightTotalHeight = rightTotalLeaves * (NODE_H + V_GAP);
  let rightStartY = centerY - rightTotalHeight / 2;

  for (const kid of rightKids) {
    const extent = placeSubtree(kid, centerX + H_GAP, rightStartY, -1 * -1);
    rightStartY += extent;
  }

  // ── 9. Place root at center ───────────────────────────────────────
  positioned[0].x = centerX;
  positioned[0].y = centerY;

  // ── 10. Handle disconnected nodes → neat row below ────────────────
  const disconnected = [];
  for (let i = 0; i < N; i++) {
    if (!visited.has(i)) disconnected.push(i);
  }

  if (disconnected.length > 0) {
    const allYs = positioned.filter((_, i) => visited.has(i)).map(p => p.y);
    const bottomY = Math.max(...allYs) + 200;
    const rowWidth = disconnected.length * 240;
    const startX = centerX - rowWidth / 2;

    disconnected.forEach((idx, i) => {
      positioned[idx].x = startX + i * 240 + 120;
      positioned[idx].y = bottomY;
    });
  }

  return positioned;
}

// ─── Example Concepts ────────────────────────────────────────────────

export const EXAMPLE_CONCEPTS = [
  "An AI-powered personal finance app that learns spending habits and automates savings",
  "A collaborative whiteboard tool for remote teams with real-time AI suggestions",
  "A sustainability tracking platform for small businesses to measure carbon footprint",
  "An AR-powered interior design app that lets you visualize furniture before buying",
  "A micro-learning platform that creates custom 5-minute daily lessons from any textbook",
  "A neighborhood safety app with community alerts and AI-analyzed incident patterns",
  "An AI code review tool that learns your team's coding standards and enforces them",
  "A health & wellness marketplace connecting users with verified holistic practitioners",
];
