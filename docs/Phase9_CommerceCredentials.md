# Phase 9 — Commerce Credential Pipeline

> **Goal**: Transform commerce nodes from passive credential storage into an
> active runtime bridge — where a user maps their integrations visually,
> enters credentials once, and the orchestrating agent can securely use
> those services during autonomous execution.

---

## Phase 9.1 — Visual Credential Status _(Quick Win)_

**What**: Show at-a-glance credential health directly on each commerce node.

**Steps**:

1. Add a credential status indicator to the commerce badge (colored ring/dot):
   - 🔴 `unconfigured` — no credentials entered
   - 🟡 `partial` — some required fields filled, others missing
   - 🟢 `ready` — all required fields populated
   - 🔵 `vault-secured` — all fields populated AND stored in encrypted vault
2. Compute status in `NodeManager._refreshNodeOverlays()` by checking
   `node.credentials` against the commerce type's `fields` array.
3. Add CSS for `.commerce-status-dot` with animated pulse for `unconfigured`
   state to draw attention to nodes that still need setup.
4. Update status reactively when credentials are saved from the config panel.

**Files touched**: `NodeManager.js`, `CommerceNodeConfig.js`, `main.css`
**Effort**: ~1 session

---

## Phase 9.2 — Guided Setup & Help Tooltips _(Quick Win)_

**What**: Help users find their API keys without leaving the app.

**Steps**:

1. Add a `helpUrl` and `helpHint` property to each field definition in
   `COMMERCE_NODE_TYPES`:
   ```js
   {
     key: 'secretKey',
     label: 'Secret Key',
     type: 'password',
     helpHint: 'Stripe Dashboard → Developers → API Keys → Secret key',
     helpUrl: 'https://dashboard.stripe.com/apikeys'
   }
   ```
2. Render a `?` icon button next to each field label in the config panel.
3. On hover/click, show a tooltip with the `helpHint` text.
4. If `helpUrl` is set, include a "Open Dashboard →" link that opens in
   a new tab.
5. For the Tauri desktop build, use `shell.open()` instead of `window.open()`.

**Files touched**: `NodeManager.js` (field definitions), `CommerceNodeConfig.js`, `main.css`
**Effort**: ~1 session

---

## Phase 9.3 — Smart Node Labels _(Quick Win)_

**What**: After configuring credentials, update the node's display text to
show meaningful context instead of just "Stripe".

**Steps**:

1. After saving credentials, auto-generate a descriptive label:
   - Stripe → `Stripe: sk_live_...3xF` (masked last 4 chars)
   - Shopify → `Shopify: mystore.myshopify.com`
   - GitHub → `GitHub: owner/repo`
2. Add a `displayKey` property to each commerce type definition indicating
   which field should be used for the label (e.g., `storeUrl`, `owner/repo`).
3. Mask password-type fields to show only the last 4 characters.
4. User can always override by manually editing the node text.

**Files touched**: `CommerceNodeConfig.js`, `NodeManager.js` (field defs)
**Effort**: ~30 min (partially implemented already in `_save()`)

---

## Phase 9.4 — Connection Test & Validation _(Medium)_

**What**: Verify credentials actually work before saving.

**Steps**:

1. Add a "Test Connection" button to the config panel footer (next to Save).
2. Create `src/integrations/ConnectionTester.js` with per-service test
   adapters:
   ```
   stripe   → GET https://api.stripe.com/v1/balance (auth: Bearer sk_...)
   shopify  → GET https://{store}.myshopify.com/admin/api/2024-01/shop.json
   github   → GET https://api.github.com/user (auth: token)
   firebase → check project exists via REST
   ```
3. Each adapter returns `{ success: boolean, message: string, latencyMs }`.
4. Display result inline:
   - ✅ "Connected — 142ms" (green flash)
   - ❌ "Authentication failed — check your Secret Key" (red flash)
5. CORS consideration: browser-based API calls will hit CORS on many
   services. Options:
   - **Tauri build**: use Tauri's HTTP plugin (no CORS restrictions)
   - **Web build**: proxy through a lightweight serverless function, OR
     skip test and show "Test available in desktop app" message
6. Cache test result on the node: `node.connectionStatus = 'verified' | 'failed' | 'untested'`
7. Feed connection status into Phase 9.1's visual indicator.

**Files touched**: new `ConnectionTester.js`, `CommerceNodeConfig.js`, `main.css`
**Effort**: ~2 sessions

---

## Phase 9.5 — Credential → Agent Runtime Bridge _(Critical Path)_

**What**: The core architectural piece — make stored credentials available
to the orchestrating Claude agent at execution time.

### Approach A: MCP Server Config Generation

Generate MCP server configuration blocks from commerce node credentials
so the agent gets tool access to each service.

**Steps**:

1. Create `src/integrations/MCPConfigGenerator.js`:
   - Reads all commerce nodes with `connectionStatus === 'ready'`
   - For each supported type, generates an MCP server config:
     ```json
     {
       "shopify-admin-mcp": {
         "command": "npx",
         "args": ["-y", "@anthropic/shopify-admin-mcp"],
         "env": {
           "SHOPIFY_ACCESS_TOKEN": "<decrypted>",
           "SHOPIFY_STORE_URL": "<from node>"
         }
       }
     }
     ```
   - For types without a dedicated MCP server, generate a generic
     `api-credential` config that the agent can reference
2. Vault must be unlocked to generate configs (secrets are needed).
3. Export as `.json` or inject directly into the agent's tool manifest.
4. Add a "Generate Agent Config" button to the export toolbar.

### Approach B: Secure Proxy (Future / Desktop)

For the Tauri desktop build, run a local credential proxy:

1. Tauri backend exposes an IPC command: `invoke('proxy_api_call', { nodeId, endpoint, method, body })`
2. Rust backend retrieves the decrypted credentials from the vault and
   makes the actual HTTP request, returning the response.
3. Agent calls the proxy via a local MCP tool — never sees raw secrets.

**Priority**: Approach A first (simpler, works now). Approach B for the
hardened desktop release.

**Files touched**: new `MCPConfigGenerator.js`, `MindMapSerializer.js`, export UI
**Effort**: ~2-3 sessions

---

## Phase 9.6 — OAuth Flows _(Premium / Future)_

**What**: Replace manual key entry with browser-based OAuth for supported
services.

**Steps**:

1. Add an `oauthConfig` property to commerce types that support OAuth:
   ```js
   {
     id: 'shopify',
     oauthConfig: {
       authUrl: 'https://{store}.myshopify.com/admin/oauth/authorize',
       tokenUrl: 'https://{store}.myshopify.com/admin/oauth/access_token',
       scopes: ['read_products', 'write_products', 'read_orders'],
       clientIdEnv: 'SHOPIFY_CLIENT_ID'  // pulled from .env
     }
   }
   ```
2. Config panel shows a "Connect with Shopify" button instead of raw fields.
3. On click:
   - **Tauri**: open OAuth URL in system browser, listen for redirect on
     a local callback server (Tauri plugin)
   - **Web**: redirect-based flow with PKCE
4. Exchange auth code for access token, store in vault.
5. Supported services (initial):
   - Shopify (Custom App OAuth)
   - Google (Drive, Analytics, Ads)
   - GitHub (OAuth App)
   - Meta/Facebook (Login flow)
6. Services that don't support OAuth keep the manual key entry flow.

**Files touched**: new `OAuthManager.js`, `CommerceNodeConfig.js`, Tauri plugin
**Effort**: ~4-5 sessions (significant)

---

## Phase 9.7 — Credential Sync & Portability _(Future)_

**What**: Sync encrypted credentials across devices via Firebase.

**Steps**:

1. Store the encrypted vault blob in Firestore under the user's account
   (already encrypted client-side, server never sees plaintext).
2. On login from a new device, pull the vault and prompt for passphrase.
3. Conflict resolution: last-write-wins per node ID, with timestamp.
4. Export/import vault as an encrypted `.vault` file for offline backup.

**Files touched**: `CredentialVault.js`, Firebase integration, new sync module
**Effort**: ~2-3 sessions

---

## Execution Order

| Order | Phase                    | Impact                             | Effort |
| ----- | ------------------------ | ---------------------------------- | ------ |
| 1     | 9.1 Visual Status        | High — instant UX clarity          | Small  |
| 2     | 9.2 Help Tooltips        | Medium — reduces friction          | Small  |
| 3     | 9.3 Smart Labels         | Medium — better node readability   | Tiny   |
| 4     | 9.5 Agent Runtime Bridge | **Critical** — makes nodes useful  | Medium |
| 5     | 9.4 Connection Test      | High — confidence before execution | Medium |
| 6     | 9.6 OAuth Flows          | Premium — best-in-class UX         | Large  |
| 7     | 9.7 Credential Sync      | Nice-to-have — multi-device        | Medium |

> **Recommended first sprint**: 9.1 + 9.2 + 9.3 together (visual polish),
> then jump straight to 9.5 (the bridge that makes everything actually
> matter for the agent workflow).
