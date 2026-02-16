/**
 * ConnectionTester — Validates commerce node credentials by making
 * lightweight authenticated API calls to each service.
 *
 * P2.1: Each adapter makes the simplest possible authenticated request
 * to verify the credentials. Results are cached on the node as
 * `connectionStatus: 'verified' | 'failed' | 'untested'`.
 *
 * Environment-aware:
 *   - Tauri desktop: uses HTTP plugin (no CORS)
 *   - Browser: fetch() works for some APIs (GitHub, Firebase),
 *     shows informative CORS message for blocked services (Stripe, Shopify)
 */

const CORS_BLOCKED_MSG = '⚠️ Cannot test from browser — use desktop app or verify credentials manually';

/**
 * Detect if we're running inside a Tauri shell
 */
function isTauri() {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ != null;
}

export class ConnectionTester {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   * @param {import('../security/CredentialVault.js').CredentialVault} [vault]
   */
  constructor(bus, vault = null) {
    this._bus = bus;
    this._vault = vault;
    this._cache = new Map(); // nodeId → { status, latency, message, timestamp }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Test credentials for a commerce node.
   *
   * @param {string} nodeId
   * @param {string} commerceType  — e.g. 'stripe', 'github-repo', 'shopify'
   * @param {object} credentials   — key/value pairs from the config panel
   * @returns {Promise<{ status: 'verified'|'failed'|'cors-blocked'|'error', latency: number, message: string }>}
   */
  async test(nodeId, commerceType, credentials) {
    const start = performance.now();

    try {
      const result = await this._dispatch(commerceType, credentials);
      const latency = Math.round(performance.now() - start);

      const entry = {
        status: result.ok ? 'verified' : 'failed',
        latency,
        message: result.ok
          ? `✅ Connected — ${latency}ms${result.detail ? ` · ${result.detail}` : ''}`
          : `❌ ${result.detail || 'Connection failed'}`,
        timestamp: Date.now(),
      };

      this._cache.set(nodeId, entry);
      this._bus.emit('connection:tested', { nodeId, ...entry });
      return entry;

    } catch (err) {
      const latency = Math.round(performance.now() - start);

      // Detect CORS errors (browser throws TypeError for network errors)
      if (this._isCorsError(err)) {
        const entry = {
          status: 'cors-blocked',
          latency,
          message: CORS_BLOCKED_MSG,
          timestamp: Date.now(),
        };
        this._cache.set(nodeId, entry);
        this._bus.emit('connection:tested', { nodeId, ...entry });
        return entry;
      }

      const entry = {
        status: 'error',
        latency,
        message: `❌ Error: ${err.message || 'Unknown failure'}`,
        timestamp: Date.now(),
      };
      this._cache.set(nodeId, entry);
      this._bus.emit('connection:tested', { nodeId, ...entry });
      return entry;
    }
  }

  /**
   * Get cached test result for a node
   * @param {string} nodeId
   * @returns {{ status: string, latency: number, message: string, timestamp: number } | null}
   */
  getCachedResult(nodeId) {
    return this._cache.get(nodeId) || null;
  }

  /**
   * Clear cached result for a node
   */
  clearCache(nodeId) {
    this._cache.delete(nodeId);
  }

  // ─── Dispatcher ──────────────────────────────────────────────────────────

  /**
   * Route to the correct per-service adapter
   * @returns {Promise<{ ok: boolean, detail: string }>}
   */
  async _dispatch(commerceType, creds) {
    switch (commerceType) {
      case 'stripe':        return this._testStripe(creds);
      case 'shopify':       return this._testShopify(creds);
      case 'github-repo':   return this._testGitHub(creds);
      case 'firebase':      return this._testFirebase(creds);
      case 'paypal':        return this._testPayPal(creds);
      case 'hubspot':       return this._testHubSpot(creds);
      case 'salesforce':    return this._testSalesforce(creds);
      case 'discord':       return this._testDiscord(creds);
      case 'youtube':       return this._testYouTube(creds);
      case 'api-credential':return this._testGenericApi(creds);
      default:              return this._testFallback(commerceType, creds);
    }
  }

  // ─── Per-Service Adapters ────────────────────────────────────────────────

  /**
   * Stripe — GET /v1/balance  (requires sk_ key)
   */
  async _testStripe(creds) {
    const key = creds.secretKey;
    if (!key) return { ok: false, detail: 'Missing Secret Key' };

    const res = await this._safeFetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${key}` },
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      const data = await res.json();
      const currency = data.available?.[0]?.currency?.toUpperCase() || '';
      return { ok: true, detail: currency ? `Account: ${currency}` : 'Authenticated' };
    }
    return { ok: false, detail: await this._extractError(res, 'Stripe') };
  }

  /**
   * Shopify — GET /admin/api/2024-01/shop.json
   */
  async _testShopify(creds) {
    const store = creds.storeUrl;
    const token = creds.accessToken;
    if (!store || !token) return { ok: false, detail: 'Missing Store URL or Access Token' };

    // Normalize store URL
    const host = store.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${host}/admin/api/2024-01/shop.json`;

    const res = await this._safeFetch(url, {
      headers: { 'X-Shopify-Access-Token': token },
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      const data = await res.json();
      return { ok: true, detail: data.shop?.name || 'Connected' };
    }
    return { ok: false, detail: await this._extractError(res, 'Shopify') };
  }

  /**
   * GitHub — GET /user  (requires PAT)
   */
  async _testGitHub(creds) {
    const pat = creds.pat;
    if (!pat) return { ok: false, detail: 'Missing Personal Access Token' };

    const res = await this._safeFetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JinnMindMapper',
      },
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      const data = await res.json();
      return { ok: true, detail: `@${data.login}` };
    }
    return { ok: false, detail: await this._extractError(res, 'GitHub') };
  }

  /**
   * Firebase — Check project existence via REST API
   */
  async _testFirebase(creds) {
    const projectId = creds.projectId;
    if (!projectId) return { ok: false, detail: 'Missing Project ID' };

    // Use the public Firebase REST API endpoint to check project existence
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
    const res = await this._safeFetch(url, {});

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    // 200 = project exists; 404 = not found; 403 = exists but no access
    if (res.ok || res.status === 403) {
      return { ok: true, detail: `Project: ${projectId}` };
    }
    if (res.status === 404) {
      return { ok: false, detail: `Project "${projectId}" not found` };
    }
    return { ok: false, detail: await this._extractError(res, 'Firebase') };
  }

  /**
   * PayPal — POST /v1/oauth2/token  (client credentials grant)
   */
  async _testPayPal(creds) {
    const clientId = creds.clientId;
    const secret = creds.secret;
    if (!clientId || !secret) return { ok: false, detail: 'Missing Client ID or Secret' };

    const res = await this._safeFetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${clientId}:${secret}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      return { ok: true, detail: 'OAuth token obtained' };
    }
    return { ok: false, detail: await this._extractError(res, 'PayPal') };
  }

  /**
   * HubSpot — GET /crm/v3/objects/contacts?limit=1
   */
  async _testHubSpot(creds) {
    const apiKey = creds.apiKey;
    if (!apiKey) return { ok: false, detail: 'Missing API Key' };

    const res = await this._safeFetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      return { ok: true, detail: 'API key valid' };
    }
    return { ok: false, detail: await this._extractError(res, 'HubSpot') };
  }

  /**
   * Salesforce — GET /services/data  (validates access token)
   */
  async _testSalesforce(creds) {
    const instanceUrl = creds.instanceUrl;
    const token = creds.accessToken;
    if (!instanceUrl || !token) return { ok: false, detail: 'Missing Instance URL or Access Token' };

    const host = instanceUrl.replace(/\/$/, '');
    const res = await this._safeFetch(`${host}/services/data/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      return { ok: true, detail: 'Salesforce token valid' };
    }
    return { ok: false, detail: await this._extractError(res, 'Salesforce') };
  }

  /**
   * Discord — GET /api/v10/users/@me  (validates bot token)
   */
  async _testDiscord(creds) {
    const token = creds.botToken;
    if (!token) return { ok: false, detail: 'Missing Bot Token' };

    const res = await this._safeFetch('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bot ${token}` },
    });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      const data = await res.json();
      return { ok: true, detail: `Bot: ${data.username}#${data.discriminator}` };
    }
    return { ok: false, detail: await this._extractError(res, 'Discord') };
  }

  /**
   * YouTube — GET /youtube/v3/channels?part=snippet&mine=true  (validates API key)
   */
  async _testYouTube(creds) {
    const apiKey = creds.apiKey;
    const channelId = creds.channelId;
    if (!apiKey) return { ok: false, detail: 'Missing API Key' };

    const params = channelId
      ? `part=snippet&id=${encodeURIComponent(channelId)}&key=${encodeURIComponent(apiKey)}`
      : `part=snippet&mine=true&key=${encodeURIComponent(apiKey)}`;

    const res = await this._safeFetch(`https://www.googleapis.com/youtube/v3/channels?${params}`, {});

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      const data = await res.json();
      const title = data.items?.[0]?.snippet?.title;
      return { ok: true, detail: title ? `Channel: ${title}` : 'API key valid' };
    }
    return { ok: false, detail: await this._extractError(res, 'YouTube') };
  }

  /**
   * Generic API Credential — GET <baseUrl> with Authorization header
   */
  async _testGenericApi(creds) {
    const baseUrl = creds.baseUrl;
    const apiKey = creds.apiKey;
    if (!baseUrl) return { ok: false, detail: 'Missing Base URL' };

    const headers = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    // Parse custom headers if provided
    if (creds.headers) {
      try {
        const custom = JSON.parse(creds.headers);
        Object.assign(headers, custom);
      } catch { /* ignore parse errors */ }
    }

    const res = await this._safeFetch(baseUrl, { headers });

    if (res.corsBlocked) return { ok: false, detail: CORS_BLOCKED_MSG };
    if (res.ok) {
      return { ok: true, detail: `${res.status} OK` };
    }
    return { ok: false, detail: `HTTP ${res.status}: ${res.statusText}` };
  }

  /**
   * Fallback for unsupported service types — report that testing isn't available
   */
  _testFallback(commerceType, creds) {
    // Check if at least some credentials are filled
    const filledKeys = Object.keys(creds).filter(k => creds[k]?.length > 0);
    if (filledKeys.length === 0) {
      return Promise.resolve({ ok: false, detail: 'No credentials configured' });
    }
    return Promise.resolve({
      ok: false,
      detail: `Connection testing not available for ${commerceType} — save credentials and test manually`,
    });
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  /**
   * Environment-aware fetch wrapper.
   * In Tauri, uses the HTTP plugin (no CORS).
   * In browser, uses native fetch.
   * Returns a Response-like object or { corsBlocked: true }
   */
  async _safeFetch(url, options = {}) {
    try {
      if (isTauri() && window.__TAURI_INTERNALS__?.invoke) {
        // Tauri HTTP plugin — no CORS restrictions
        // Use a variable so Rollup/Vite won't statically resolve this import
        const tauriHttpModule = '@tauri-apps/plugin-http';
        try {
          const mod = await import(/* @vite-ignore */ tauriHttpModule);
          return await mod.fetch(url, options);
        } catch {
          // Tauri plugin not available — fall through to browser fetch
        }
      }

      // Browser fetch
      return await fetch(url, {
        ...options,
        mode: 'cors',
      });
    } catch (err) {
      if (this._isCorsError(err)) {
        return { corsBlocked: true };
      }
      throw err;
    }
  }

  /**
   * Detect CORS-related errors from fetch
   */
  _isCorsError(err) {
    if (err instanceof TypeError) {
      const msg = err.message.toLowerCase();
      return msg.includes('failed to fetch') ||
             msg.includes('network') ||
             msg.includes('cors') ||
             msg.includes('blocked');
    }
    return false;
  }

  /**
   * Extract a human-readable error message from a failed response
   */
  async _extractError(res, serviceName) {
    try {
      const text = await res.text();
      // Try JSON parse for structured error messages
      try {
        const json = JSON.parse(text);
        const msg = json.error?.message || json.message || json.errors?.[0]?.message || json.error;
        if (msg) return `${serviceName}: ${msg}`;
      } catch { /* not JSON */ }

      // Fallback to status
      return `${serviceName}: HTTP ${res.status} ${res.statusText}`;
    } catch {
      return `${serviceName}: HTTP ${res.status}`;
    }
  }
}
