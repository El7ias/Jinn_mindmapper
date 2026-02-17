/**
 * BrowserAgentBridge — Browser-mode agent execution via AI APIs.
 *
 * When the app runs in a browser (no Tauri), this bridge calls the
 * Anthropic Messages API (or OpenAI Chat Completions) directly via fetch()
 * with streaming, emitting the same EventBus events as ClaudeCodeBridge.
 *
 * Event contract (same as ClaudeCodeBridge):
 *   orchestration:started   { sessionId, pid }
 *   orchestration:progress  { type, content, sessionId }
 *   orchestration:error     { message, sessionId }
 *   orchestration:complete  { sessionId, exitCode }
 */

const BRIDGE_STATUS = {
  IDLE:     'idle',
  STARTING: 'starting',
  RUNNING:  'running',
  CANCELLING: 'cancelling',
  DONE:     'done',
  ERROR:    'error',
};

const PROVIDER = {
  ANTHROPIC: 'anthropic',
  OPENAI:    'openai',
};

// Default models per provider
const DEFAULT_MODELS = {
  [PROVIDER.ANTHROPIC]: 'claude-sonnet-4-5',
  [PROVIDER.OPENAI]:    'gpt-4o',
};

// API endpoints
const ENDPOINTS = {
  [PROVIDER.ANTHROPIC]: 'https://api.anthropic.com/v1/messages',
  [PROVIDER.OPENAI]:    'https://api.openai.com/v1/chat/completions',
};

// Token pricing per 1M tokens (USD) — updated Feb 2026
const MODEL_PRICING = {
  'claude-sonnet-4-5':          { input: 3.00,  output: 15.00 },
  'claude-opus-4-6':            { input: 15.00, output: 75.00 },
  'claude-haiku-4-5':           { input: 0.80,  output: 4.00  },
  'claude-sonnet-4-20250514':   { input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku-20241022':  { input: 0.80,  output: 4.00  },
  'claude-3-haiku-20240307':    { input: 0.25,  output: 1.25  },
  'gpt-4o':                     { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':                { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':                { input: 10.00, output: 30.00 },
  // Fallback for unknown models
  '_default':                   { input: 3.00,  output: 15.00 },
};

const COST_HISTORY_KEY = 'mindmapper_cost_history';

/**
 * Generate a short session ID for browser sessions.
 */
function generateSessionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `browser-${ts}-${rand}`;
}

export class BrowserAgentBridge {

  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this._bus = bus;
    this._status = BRIDGE_STATUS.IDLE;
    this._abortController = null;
    this._sessionId = null;
    this._provider = PROVIDER.ANTHROPIC;

    // Credential vault + in-memory key cache (SEC-01)
    this._vault = null;
    this._apiKeyCache = {};

    // Cost tracking
    this._sessionUsage = { inputTokens: 0, outputTokens: 0, model: null };
    this._costHistory = this._loadCostHistory();

    // Load encrypted keys whenever the vault unlocks
    this._bus.on('vault:unlocked', () => this._loadKeysFromVault());
  }

  /* ─── Public API (mirrors ClaudeCodeBridge) ────────────────────── */

  get status() { return this._status; }
  get isRunning() { return this._status === BRIDGE_STATUS.RUNNING; }

  /**
   * Detect which provider has a stored API key.
   * @returns {Promise<{ available: boolean, provider: string|null, hasKey: boolean }>}
   */
  async detect() {
    const anthropicKey = this._getApiKey(PROVIDER.ANTHROPIC);
    const openaiKey    = this._getApiKey(PROVIDER.OPENAI);

    if (anthropicKey) {
      this._provider = PROVIDER.ANTHROPIC;
      return { available: true, provider: PROVIDER.ANTHROPIC, hasKey: true };
    }
    if (openaiKey) {
      this._provider = PROVIDER.OPENAI;
      return { available: true, provider: PROVIDER.OPENAI, hasKey: true };
    }

    return { available: false, provider: null, hasKey: false };
  }

  /**
   * Execute a prompt via the configured AI provider.
   *
   * @param {string} prompt   — The full workflow prompt
   * @param {object} options
   * @param {string} [options.model]     — model override
   * @param {string} [options.provider]  — 'anthropic' or 'openai'
   * @returns {Promise<{ sessionId: string, pid: number }>}
   */
  async execute(prompt, options = {}) {
    if (this._status === BRIDGE_STATUS.RUNNING) {
      throw new Error('A session is already running. Cancel it first.');
    }

    const provider = options.provider || this._provider || PROVIDER.ANTHROPIC;
    const model    = options.model || DEFAULT_MODELS[provider];
    const apiKey   = this._getApiKey(provider);

    if (!apiKey) {
      throw new Error(
        `No API key found for ${provider}. ` +
        `Please set your ${provider === PROVIDER.ANTHROPIC ? 'Anthropic' : 'OpenAI'} API key in Workspace Settings.`
      );
    }

    this._status = BRIDGE_STATUS.STARTING;
    this._sessionId = generateSessionId();
    this._abortController = new AbortController();

    this._bus.emit('orchestration:started', {
      sessionId: this._sessionId,
      pid: 0, // No real PID in browser mode
    });

    // Reset session usage
    this._status = BRIDGE_STATUS.RUNNING;
    this._sessionUsage = { inputTokens: 0, outputTokens: 0, model: model };

    // Run the streaming call in the background
    this._streamResponse(prompt, provider, model, apiKey)
      .then(() => {
        if (this._status === BRIDGE_STATUS.CANCELLING) return;
        this._status = BRIDGE_STATUS.DONE;
        this._finalizeSessionCost();
        this._bus.emit('orchestration:complete', {
          sessionId: this._sessionId,
          exitCode: 0,
        });
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          this._status = BRIDGE_STATUS.DONE;
          this._bus.emit('orchestration:complete', {
            sessionId: this._sessionId,
            exitCode: -1,
          });
          return;
        }
        this._status = BRIDGE_STATUS.ERROR;
        this._bus.emit('orchestration:error', {
          message: err.message,
          sessionId: this._sessionId,
        });
        this._bus.emit('orchestration:complete', {
          sessionId: this._sessionId,
          exitCode: 1,
        });
      });

    return { sessionId: this._sessionId, pid: 0 };
  }

  /**
   * Cancel the running session.
   */
  async cancel() {
    if (this._abortController) {
      this._status = BRIDGE_STATUS.CANCELLING;
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /**
   * Associate a CredentialVault instance for encrypted key storage.
   */
  setVault(vault) {
    this._vault = vault;
  }

  /**
   * Store an API key for a provider.
   * Uses the CredentialVault (AES-GCM) when unlocked; falls back to localStorage.
   */
  async setApiKey(provider, key) {
    this._apiKeyCache[provider] = key;
    if (this._vault?.isUnlocked) {
      await this._vault.store(`ai_key_${provider}`, { key });
      localStorage.removeItem(`mindmapper_api_key_${provider}`);
    } else {
      localStorage.setItem(`mindmapper_api_key_${provider}`, key);
    }
  }

  /**
   * Get the stored API key for a provider.
   */
  getApiKey(provider) {
    return this._getApiKey(provider || this._provider);
  }

  /**
   * Check if an API key is configured for any provider.
   */
  hasAnyApiKey() {
    return !!(this._getApiKey(PROVIDER.ANTHROPIC) || this._getApiKey(PROVIDER.OPENAI));
  }

  /* ─── Private ──────────────────────────────────────────────────── */

  _getApiKey(provider) {
    // Check in-memory cache first (populated by vault or setApiKey)
    if (this._apiKeyCache[provider]) return this._apiKeyCache[provider];

    // Fallback: check localStorage (plaintext, pre-vault keys)
    const bridgeKey = localStorage.getItem(`mindmapper_api_key_${provider}`);
    if (bridgeKey) return bridgeKey;

    // Fallback: check the IdeaInputModal key format (mm_ai_key_)
    const ideaKey = localStorage.getItem(`mm_ai_key_${provider}`);
    if (ideaKey) {
      // Migrate into cache so future lookups are fast
      this._apiKeyCache[provider] = ideaKey;
      return ideaKey;
    }

    return '';
  }

  /**
   * Load API keys from vault into the in-memory cache, and remove plaintext copies.
   * Called automatically when vault:unlocked is emitted.
   */
  async _loadKeysFromVault() {
    if (!this._vault?.isUnlocked) return;
    for (const provider of [PROVIDER.ANTHROPIC, PROVIDER.OPENAI]) {
      const creds = await this._vault.retrieve(`ai_key_${provider}`);
      if (creds?.key) {
        this._apiKeyCache[provider] = creds.key;
        localStorage.removeItem(`mindmapper_api_key_${provider}`);
      }
    }
  }

  /**
   * Stream the response from the selected AI provider.
   */
  async _streamResponse(prompt, provider, model, apiKey) {
    if (provider === PROVIDER.ANTHROPIC) {
      return this._streamAnthropic(prompt, model, apiKey);
    } else {
      return this._streamOpenAI(prompt, model, apiKey);
    }
  }

  /**
   * Stream from Anthropic Messages API.
   */
  async _streamAnthropic(prompt, model, apiKey) {
    const response = await fetch(ENDPOINTS[PROVIDER.ANTHROPIC], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16384,
        stream: true,
        system: `You are an expert software architect, full-stack developer, and technical writer. Execute the workflow prompt precisely. Structure your response as a professional, comprehensive walkthrough document using well-organized markdown:

- Use clear ## and ### headings to organize sections
- Use bullet points, numbered lists, and tables for data
- Use **bold** for key terms and emphasis
- Use code blocks with language tags for code snippets
- Include executive summaries and actionable recommendations
- Write in a clear, direct, analytical tone
- Produce a single cohesive document, not fragmented notes

Your output should read like a polished audit report or technical walkthrough — logical, legible, and thorough.

ANTI-HALLUCINATION RULES:
- NEVER fabricate numbers, dollar amounts, dates, percentages, or metrics not provided in the prompt.
- If data is insufficient for an analysis, explicitly state what’s missing. Do NOT fill gaps with invented figures.
- Distinguish clearly between FACTS (from the data) and INFERENCES (your analysis).
- This project uses AI agents, not human developers. Do not estimate human labor costs or timelines.

CRITICAL: If the prompt mentions actionable recommendations, you MUST end your response with a fenced code block tagged exactly as \`\`\`json:actions containing a JSON array of action objects. This is a machine-parsed block — the tag MUST be exactly json:actions (not json, not actions, not anything else).`,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
      signal: this._abortController?.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const event = JSON.parse(data);

          // Capture token usage from Anthropic events
          if (event.type === 'message_start' && event.message?.usage) {
            this._sessionUsage.inputTokens += event.message.usage.input_tokens || 0;
            this._sessionUsage.outputTokens += event.message.usage.output_tokens || 0;
          } else if (event.type === 'message_delta' && event.usage) {
            this._sessionUsage.outputTokens += event.usage.output_tokens || 0;
          }

          if (event.type === 'content_block_delta' && event.delta?.text) {
            this._bus.emit('orchestration:progress', {
              type: 'text',
              content: event.delta.text,
              sessionId: this._sessionId,
            });
            // Emit live cost update
            this._emitCostUpdate();
          } else if (event.type === 'message_stop') {
            return;
          } else if (event.type === 'error') {
            throw new Error(event.error?.message || 'Anthropic stream error');
          }
        } catch (parseErr) {
          if (parseErr.message.includes('Anthropic')) throw parseErr;
          // Skip non-JSON lines
        }
      }
    }
  }

  /**
   * Stream from OpenAI Chat Completions API.
   */
  async _streamOpenAI(prompt, model, apiKey) {
    const response = await fetch(ENDPOINTS[PROVIDER.OPENAI], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: `You are an expert software architect, full-stack developer, and technical writer. Execute the workflow prompt precisely. Structure your response as a professional, comprehensive walkthrough document using well-organized markdown. Use clear headings, bullet points, tables, bold emphasis, and code blocks. Write in a clear, direct, analytical tone. Produce a single cohesive document, not fragmented notes. ANTI-HALLUCINATION: NEVER fabricate numbers, dollar amounts, timelines, or metrics not provided in the prompt. If data is insufficient, state what's missing. This project uses AI agents, not human developers. CRITICAL: If the prompt mentions actionable recommendations, you MUST end your response with a fenced code block tagged exactly as \`\`\`json:actions containing a JSON array of action objects.`,
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: this._abortController?.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const event = JSON.parse(data);

          // Capture usage from OpenAI (some models include it in stream chunks)
          if (event.usage) {
            this._sessionUsage.inputTokens = event.usage.prompt_tokens || this._sessionUsage.inputTokens;
            this._sessionUsage.outputTokens = event.usage.completion_tokens || this._sessionUsage.outputTokens;
          }

          const delta = event.choices?.[0]?.delta?.content;
          if (delta) {
            this._bus.emit('orchestration:progress', {
              type: 'text',
              content: delta,
              sessionId: this._sessionId,
            });
            this._emitCostUpdate();
          }

          if (event.choices?.[0]?.finish_reason === 'stop') {
            return;
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }

  /* ─── Cost Tracking ─────────────────────────────────────────────── */

  /**
   * Calculate current session cost from token usage.
   */
  _calculateCost() {
    const pricing = MODEL_PRICING[this._sessionUsage.model] || MODEL_PRICING['_default'];
    const inputCost  = (this._sessionUsage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (this._sessionUsage.outputTokens / 1_000_000) * pricing.output;
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      inputTokens: this._sessionUsage.inputTokens,
      outputTokens: this._sessionUsage.outputTokens,
      totalTokens: this._sessionUsage.inputTokens + this._sessionUsage.outputTokens,
      model: this._sessionUsage.model,
    };
  }

  /**
   * Emit a live cost update to the bus.
   */
  _emitCostUpdate() {
    const cost = this._calculateCost();
    this._bus.emit('orchestration:cost', cost);
  }

  /**
   * Finalize session cost and save to history.
   */
  _finalizeSessionCost() {
    const cost = this._calculateCost();
    cost.timestamp = Date.now();
    cost.sessionId = this._sessionId;

    // Save to history
    this._costHistory.push(cost);
    // Keep last 100 sessions
    if (this._costHistory.length > 100) {
      this._costHistory = this._costHistory.slice(-100);
    }
    try {
      localStorage.setItem(COST_HISTORY_KEY, JSON.stringify(this._costHistory));
    } catch { /* quota exceeded — ignore */ }

    // Emit final cost
    this._bus.emit('orchestration:cost', cost);
  }

  /**
   * Load cost history from localStorage.
   */
  _loadCostHistory() {
    try {
      const raw = localStorage.getItem(COST_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get the cost history for reports.
   * @returns {Array} — array of session cost records
   */
  getCostHistory() {
    return [...this._costHistory];
  }

  /**
   * Get the current session cost.
   * @returns {object}
   */
  getSessionCost() {
    return this._calculateCost();
  }
}

export { BRIDGE_STATUS, PROVIDER, DEFAULT_MODELS, MODEL_PRICING };
