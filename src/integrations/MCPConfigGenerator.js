/**
 * MCPConfigGenerator — Generate MCP server configuration from commerce nodes.
 *
 * Sprint 2 / P1.5 (Phase 9.5)
 *
 * Reads all commerce nodes whose credentials are 'ready' or 'vault-secured',
 * decrypts them via CredentialVault, and produces a JSON config block
 * compatible with Claude Code's MCP server configuration format.
 *
 * Supported service mappings:
 *   shopify       → @anthropic/shopify-admin-mcp
 *   stripe        → stripe env vars
 *   github-repo   → @anthropic/github-mcp (or env token)
 *   firebase      → firebase env vars
 *   mcp-server    → user-defined command/args/env
 *   *             → generic credential block (env vars)
 *
 * Usage:
 *   const generator = new MCPConfigGenerator(nodeManager, credentialVault);
 *   const config = await generator.generate();  // { mcpServers: { ... } }
 *   const json   = generator.toJSON(config);     // prettified JSON string
 */

import { COMMERCE_NODE_TYPES, getCredentialStatus } from '../nodes/NodeManager.js';

// ─── Service → MCP server mapping ──────────────────────────────────────

const MCP_MAPPINGS = {
  shopify: {
    serverKey: 'shopify-admin',
    command: 'npx',
    args: ['-y', '@anthropic/shopify-admin-mcp'],
    envMap: {
      accessToken: 'SHOPIFY_ACCESS_TOKEN',
      storeUrl:    'SHOPIFY_STORE_URL',
      apiKey:      'SHOPIFY_API_KEY',
    },
  },
  stripe: {
    serverKey: 'stripe',
    command: 'npx',
    args: ['-y', '@anthropic/stripe-mcp'],
    envMap: {
      secretKey:      'STRIPE_SECRET_KEY',
      publishableKey: 'STRIPE_PUBLISHABLE_KEY',
    },
  },
  'github-repo': {
    serverKey: 'github',
    command: 'npx',
    args: ['-y', '@anthropic/github-mcp-server'],
    envMap: {
      pat:   'GITHUB_PERSONAL_ACCESS_TOKEN',
      owner: 'GITHUB_OWNER',
      repo:  'GITHUB_REPO',
    },
  },
  firebase: {
    serverKey: 'firebase',
    command: 'npx',
    args: ['-y', 'firebase-mcp-server'],
    envMap: {
      projectId:         'FIREBASE_PROJECT_ID',
      serviceAccountKey: 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    },
  },
  paypal: {
    serverKey: 'paypal',
    command: null, // generic env-only
    envMap: {
      clientId: 'PAYPAL_CLIENT_ID',
      secret:   'PAYPAL_SECRET',
    },
  },
};


export class MCPConfigGenerator {

  /**
   * @param {import('../nodes/NodeManager.js').NodeManager} nodeManager
   * @param {import('../security/CredentialVault.js').CredentialVault} credentialVault
   */
  constructor(nodeManager, credentialVault) {
    this._nodeManager = nodeManager;
    this._vault = credentialVault;
  }

  /**
   * Generate MCP server configuration from all ready commerce nodes.
   *
   * @returns {Promise<{ mcpServers: object, summary: object }>}
   *   mcpServers — Claude Code-compatible MCP config object
   *   summary    — { total, included, skipped, errors }
   */
  async generate() {
    const allNodes = [...this._nodeManager.nodes.values()];
    const commerceNodes = allNodes.filter(n => n.commerceType);

    const mcpServers = {};
    const summary = { total: commerceNodes.length, included: 0, skipped: 0, errors: [] };

    if (commerceNodes.length === 0) {
      return { mcpServers, summary };
    }

    // Bulk decrypt credentials if vault is unlocked
    let decryptedMap = new Map();
    if (this._vault.isUnlocked()) {
      try {
        decryptedMap = await this._vault.retrieveAll();
      } catch (err) {
        summary.errors.push(`Vault decrypt failed: ${err.message}`);
      }
    }

    for (const node of commerceNodes) {
      try {
        const status = getCredentialStatus(node, this._vault.isUnlocked());

        // Only include nodes with all fields configured
        if (status.status !== 'ready' && status.status !== 'vault-secured') {
          summary.skipped++;
          continue;
        }

        // Prefer vault-decrypted credentials, fall back to node.credentials
        const creds = decryptedMap.get(node.id) || node.credentials || {};

        const serverConfig = this._buildServerConfig(node, creds);
        if (serverConfig) {
          // Deduplicate with a unique key
          const key = serverConfig._key;
          delete serverConfig._key;
          mcpServers[key] = serverConfig;
          summary.included++;
        } else {
          summary.skipped++;
        }
      } catch (err) {
        summary.errors.push(`Node "${node.text}" (${node.id}): ${err.message}`);
        summary.skipped++;
      }
    }

    return { mcpServers, summary };
  }

  /**
   * Convert config to prettified JSON string.
   * @param {{ mcpServers: object }} config
   * @returns {string}
   */
  toJSON(config) {
    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate and return a complete export bundle (JSON + summary text).
   * @returns {Promise<{ json: string, summaryText: string }>}
   */
  async export() {
    const { mcpServers, summary } = await this.generate();

    const json = this.toJSON({ mcpServers });

    const lines = [
      `MCP Config Export — ${new Date().toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Total commerce nodes:   ${summary.total}`,
      `Included in config:     ${summary.included}`,
      `Skipped (incomplete):   ${summary.skipped}`,
    ];

    if (summary.errors.length > 0) {
      lines.push(`\nErrors:`);
      summary.errors.forEach(e => lines.push(`  ⚠ ${e}`));
    }

    if (summary.included === 0) {
      lines.push(`\n⚠ No ready commerce nodes found.`);
      lines.push(`  Configure credentials on your commerce nodes and ensure the vault is unlocked.`);
    }

    return { json, summaryText: lines.join('\n') };
  }

  // ─── Private ────────────────────────────────────────────────────────

  /**
   * Build a single MCP server config entry for a node.
   * @param {object} node
   * @param {object} creds — decrypted credentials
   * @returns {object|null}
   */
  _buildServerConfig(node, creds) {
    const type = node.commerceType;
    const mapping = MCP_MAPPINGS[type];

    // ── User-defined MCP server node ────────────────────────────────
    if (type === 'mcp-server') {
      return this._buildCustomMCPServer(node, creds);
    }

    // ── Known service with MCP mapping ──────────────────────────────
    if (mapping) {
      return this._buildMappedServer(node, creds, mapping);
    }

    // ── Generic credential block (env vars only) ────────────────────
    return this._buildGenericServer(node, creds);
  }

  /**
   * Build config for user-defined MCP server nodes.
   */
  _buildCustomMCPServer(node, creds) {
    const command = creds.command;
    if (!command) return null;

    let args = [];
    try {
      args = creds.args ? JSON.parse(creds.args) : [];
    } catch { /* invalid JSON, use empty */ }

    let env = {};
    try {
      env = creds.envVars ? JSON.parse(creds.envVars) : {};
    } catch { /* invalid JSON, use empty */ }

    const serverName = creds.serverName || node.text || 'custom-mcp';

    return {
      _key: this._sanitizeKey(serverName),
      command,
      args,
      env,
    };
  }

  /**
   * Build config for services with known MCP server packages.
   */
  _buildMappedServer(node, creds, mapping) {
    const env = {};

    for (const [credKey, envVar] of Object.entries(mapping.envMap)) {
      if (creds[credKey]) {
        env[envVar] = creds[credKey];
      }
    }

    // If no command is specified, it's env-only (e.g. PayPal)
    // Still useful as a credential reference block
    const config = {
      _key: this._uniqueKey(mapping.serverKey, node),
      env,
    };

    if (mapping.command) {
      config.command = mapping.command;
      config.args = [...mapping.args];
    }

    return config;
  }

  /**
   * Build a generic credential block for unmapped services.
   * Exposes all credentials as environment variables with a service prefix.
   */
  _buildGenericServer(node, creds) {
    const commerceDef = COMMERCE_NODE_TYPES.find(c => c.id === node.commerceType);
    if (!commerceDef) return null;

    const prefix = node.commerceType.replace(/-/g, '_').toUpperCase();
    const env = {};

    for (const field of commerceDef.fields) {
      if (creds[field.key]) {
        const envKey = `${prefix}_${field.key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
        env[envKey] = creds[field.key];
      }
    }

    if (Object.keys(env).length === 0) return null;

    const label = commerceDef.label.toLowerCase().replace(/\s+/g, '-');
    return {
      _key: this._uniqueKey(label, node),
      env,
      _comment: `${commerceDef.label} credentials — no dedicated MCP server; use env vars in your agent.`,
    };
  }

  /**
   * Make a unique server key (append suffix if duplicate node IDs exist).
   */
  _uniqueKey(base, node) {
    // Use display text or truncated node ID to disambiguate
    const suffix = node.text && node.text !== ''
      ? `-${this._sanitizeKey(node.text)}`
      : '';
    return `${base}${suffix}`;
  }

  /**
   * Sanitize a string for use as a JSON key.
   */
  _sanitizeKey(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40);
  }
}
