# Jinn MindMapper — Master Task List

> **Last updated:** 2026-02-10
> **Source:** Consolidated from `Jinn_mindmapper-RoadMap..md`, `phase3_plan.md`,
> `Phase9_CommerceCredentials.md`, `changelog.md`, and session notes.
>
> Tasks are ordered by priority within each tier. Check them off as completed.

---

## ✅ COMPLETED — Shipped & Verified

These are done. Listed for reference and to show momentum.

- [x] **Phase 1.0** — Project foundation (Vite, EventBus, History, Viewport, NodeManager, ConnectionManager, ContextMenu, PropertyPanel, MiniMap, Storage)
- [x] **Phase 1.1** — Splice-into-wire, jump arcs, bidirectional arrows, 7 node shapes
- [x] **Phase 2.0** — File management (New/Open/Save/SaveAs/Export PNG/SVG/JSON), reference import, 6 project templates, File menu dropdown
- [x] **Phase 3.0** — Firebase infrastructure (config, auth, Firestore CRUD, listeners, migration, LLM gateway, security rules, Cloud Functions scaffold)
- [x] **Phase 3.2** — Node metadata system (nodeType, priority, phase, assignedAgent, agentStatus, status badges, priority rings, agent chips, context menu submenus)
- [x] **Phase 3.3** — Agent Panel UI (sidebar, message thread, CEO input, readiness indicator, cost footer, mind map validator)
- [x] **Phase 3.4** — AI Idea Generation (IdeaGenerator multi-provider: Gemini, GPT, Claude; IdeaInputModal with provider/model selection)
- [x] **Phase 3.5** — MindMapSerializer + WorkflowPromptGenerator + PromptExportModal (serialize mind map → structured prompt → copy/download)
- [x] **Phase 3.6** — ModelTierConfig (3-tier routing: efficient/standard/deep-reasoning with embedded strategy)
- [x] **Phase 3.7** — Full 14-role virtual team in prompt generator with invisible routing metadata
- [x] **Phase 3.8** — Security hardening (Sanitize.js, XSS fixes, API key to headers, CSP meta tag, DOMPurify)
- [x] **Phase 5** — Workspace Settings (dev folder, GitHub, tech stack, coding conventions, deployment preferences, auth-aware git instructions)
- [x] **Phase 6** — Agent organizational structure (14 roles, org chart, reporting lines, Creative Director merged into Frontend UI/UX, Devil's Advocate strengthened, CFO strengthened, retrospective system, 5-step milestone workflow)
- [x] **Phase 8** — Commerce nodes (COMMERCE_NODE_TYPES, commerce badge, double-click → config panel, CredentialVault AES-GCM encryption, credential save/load, serializer integration)
- [x] **Phase 8 fix** — Connection routing for commerce nodes (DOM-based getPortPosition, obstacle avoidance anchor segment protection)
- [x] **Phase 9.1** — Commerce credential status indicators (🔴🟡🟢🔵 dots on badges, pulse animation for unconfigured)
- [x] **Phase 9.2** — Commerce help tooltips (helpHint + helpUrl on all fields, ? icon in config panel)
- [x] **Phase 9.3** — Smart node labels (displayKey per type, password masking, auto-update on save)
- [x] **P1.1** — Map title header upgrade (larger, bolder, more visible in toolbar)
- [x] **P1.5** — Agent Runtime Bridge (MCPConfigGenerator reads commerce nodes + CredentialVault → MCP config JSON; "Agent Config" toolbar button; vault unlock prompt; clipboard + download export)
- [x] **P1.5 bonus** — BrowserAgentBridge (direct AI API calls in browser, environment auto-detect in OrchestrationEngine)
- [x] **P1.6** — CEO Command Buttons (Bug Audit, Project Audit, CFO Report, COO Report, CTO Report in Agent Panel command bar; role-specific structured prompts; customPrompt support in OrchestrationEngine)
- [x] **P1.6 bonus** — Session controls (Launch, Pause/Resume, Stop, Retry, Copy Prompt, Export Log in CEO Command Bar)
- [x] **P2.1** — Connection Test & Validation (ConnectionTester.js with 7 service adapters: Stripe, Shopify, GitHub, Firebase, PayPal, HubSpot, Generic API; CORS-aware env detection; Test Connection button in config panel; node overlay verification badges; status persistence)
- [x] **P2.2** — Deep Code Audit (storage key mismatch fix, event listener leak mitigation via AbortController, debug console.log cleanup, architecture.md updates, audit-report.md created)
- [x] **P2.3** — Prompt Streamlining (compact mode toggle in export modal; compact virtual team builder compresses ~530 lines → ~30 lines; lazy credential injection replaces raw values with status-only references; node description truncation at 150 chars; token budget badge with green/yellow/red thresholds at 10k/20k tokens)
- [x] **P3.1** — Expanded Commerce Node Types (8 new individual social platform nodes: X/Twitter, Discord, TikTok, YouTube, WhatsApp Business, Facebook Pages, Google Sheets, Salesforce CRM; Google Ads expanded with OAuth Client ID/Secret/Refresh Token fields; new 'data' category; ConnectionTester adapters for Discord, YouTube, Salesforce; generic social-channel replaced with per-platform nodes)

---

## 🔥 PRIORITY 1 — High Impact, Unblocks Agent Workflow

These items directly enable the core vision: user draws mind map → agents
build the application.

### ~~P1.1 — Map Title Header in UI~~ ✅ DONE

> Upgraded to 14px bold white text with letter-spacing. Already editable,
> persisted, and included in serialized output.

### ~~P1.2 — Commerce Credential Status Indicators~~ ✅ DONE

> Status dots (🔴🟡🟢🔵) on commerce badges via `getCredentialStatus()`.
> Animated pulse on unconfigured nodes. Computed from node.credentials.

### ~~P1.3 — Commerce Help Tooltips & Setup Guides~~ ✅ DONE

> `helpHint` + `helpUrl` on all 70+ fields across 27 commerce types.
> `?` icon in config panel; hover shows hint, click opens helpUrl.

### ~~P1.4 — Smart Node Labels After Config~~ ✅ DONE

> `displayKey` per commerce type. Password masking (•••xxxx).
> Auto-updates on save; user text override takes priority.

### ~~P1.5 — Credential → Agent Runtime Bridge~~ ✅ DONE _(Phase 9.5)_

> `MCPConfigGenerator.js` reads all ready/vault-secured commerce nodes,
> decrypts credentials, and generates Claude Code-compatible MCP server
> config JSON. Supports Shopify, Stripe, GitHub, Firebase, custom MCP,
> and generic credential blocks. "Agent Config" toolbar button exports
> config to clipboard + downloadable `.json` file. Vault unlock prompt
> if credentials are encrypted.
>
> **Bonus:** `BrowserAgentBridge.js` enables direct AI API calls in
> browser; `OrchestrationEngine` auto-detects desktop vs. browser.

- [x] Create `src/integrations/MCPConfigGenerator.js`
- [x] Read all commerce nodes with `connectionStatus === 'ready'`
- [x] Generate MCP server config blocks per service type:
  - Shopify → `@anthropic/shopify-admin-mcp` with env vars
  - Stripe → API key in env
  - GitHub → token in env
  - Custom → generic credential block
- [x] Vault must be unlocked to generate configs (secrets needed)
- [x] "Generate Agent Config" button in export toolbar
- [x] Export as `.json` for user to paste into MCP config
- **Effort:** Medium (~2-3 sessions)

### ~~P1.6 — CEO Command Buttons~~ ✅ DONE

> CEO Report command row in Agent Panel with 5 role-specific buttons:
> Bug Audit (Devil's Advocate + QA), Project Audit, CFO Report,
> COO Report, CTO Report. Each emits `ceo:report-request` with
> a structured role-specific prompt via `_buildReportPrompt()`.
> `OrchestrationEngine.startSession()` supports `customPrompt`
> option to bypass standard serialization.
>
> **Bonus:** Session controls (Launch, Pause/Resume, Stop, Retry,
> Copy Prompt, Export Log) in the CEO Command Bar with state-aware
> visibility management.

- [x] Add a CEO action toolbar/dropdown to the Agent Panel
- [x] Button: "🔍 Bug Audit & Report" — triggers Devil's Advocate + QA
- [x] Button: "📋 Project Audit" — triggers Project Auditor
- [x] Button: "💰 CFO Report" — triggers CFO cost/budget summary
- [x] Button: "📊 COO Report" — triggers COO status summary
- [x] Button: "🏗️ CTO Report" — triggers CTO architecture summary
- [x] Each button emits a job request through the agent pipeline
- **Effort:** Medium (~2 sessions, depends on agent execution backend)

---

## ⚡ PRIORITY 2 — Quality & Confidence

These build trust in the system and improve daily usability.

### ~~P2.1 — Connection Test & Validation~~ ✅ DONE _(Phase 9.4)_

> `ConnectionTester.js` with 7 per-service adapters (Stripe, Shopify,
> GitHub, Firebase, PayPal, HubSpot, Generic API). Environment-aware
> fetch: Tauri HTTP plugin (no CORS) or browser fetch with graceful
> CORS detection. "🔌 Test" button in config panel footer with inline
> status display (✅ verified, ❌ failed, ⚠️ CORS-blocked). Results
> cached on node as `connectionStatus`, persisted through serialize/
> deserialize, and reflected in node overlay badges.

- [x] "Test Connection" button in commerce config panel
- [x] Create `src/integrations/ConnectionTester.js` with per-service adapters:
  - Stripe → `GET /v1/balance`
  - Shopify → `GET /admin/api/2024-01/shop.json`
  - GitHub → `GET /user`
  - Firebase → project existence check
  - PayPal → OAuth2 client credentials grant
  - HubSpot → `GET /crm/v3/objects/contacts?limit=1`
  - Generic API → configurable URL + Bearer token
- [x] CORS handling:
  - Tauri build: use HTTP plugin (no CORS)
  - Web build: graceful CORS detection with informative message
- [x] Display inline result: ✅ "Connected — 142ms" or ❌ "Auth failed"
- [x] Cache test result: `node.connectionStatus = 'verified'|'failed'|'untested'`
- [x] Feed status into P1.2 visual indicators
- **Effort:** Medium (~2 sessions)

### ~~P2.2 — Deep Code Audit & Optimization~~ ✅ DONE

> 5 findings identified and resolved: storage key mismatch bug fix
> (`migration.js` → `mindmapper_state`), event listener leak mitigation
> (AgentPanel `destroy()` via `AbortController`), debug `console.log`
> cleanup (7 removed, 2 promoted to `console.info`), `architecture.md`
> corrections (15 roles, Tauri, removed phantom InputGuard.js, added
> missing modules). Full report in `docs/audit-report.md`.

- [x] Run full static analysis pass on all `src/` files
- [x] Identify and remove dead code (unreachable functions, unused imports)
- [x] Flag ghost code (commented-out blocks, TODO remnants)
- [x] Performance audit: unnecessary DOM queries, event listener leaks
- [x] Document findings in `docs/audit-report.md`
- **Effort:** Medium (~2 sessions)

### P2.3 — Prompt Streamlining

> _From roadmap: "Project master prompt streamlining should optimize for
> best performance at all times, let MindMapper be a go-to resource for
> further instructions when needed."_

- [x] Audit generated prompt size for typical 20-node maps
- [x] Implement context compression: summarize verbose node descriptions
- [x] Lazy credential injection: don't overload prompt with all data —
      reference them so the agent can query as needed
- [x] Add a "Prompt Size" indicator to the export modal (estimated tokens)
- [x] Set a recommended token budget warning threshold
- **Effort:** Medium (~2 sessions)

---

## 🔮 PRIORITY 3 — Platform Expansion

These expand MindMapper from a tool into a platform.

### P3.1 — Expanded Commerce Node Types

> _From roadmap: All of these should be available as commerce integrations._

- [x] Meta / Facebook Ads — fields: App ID, App Secret, Access Token
- [x] Google Ads — fields: Developer Token, Client ID, Client Secret, Refresh Token
- [x] Google Drive — fields: OAuth Client ID, Client Secret (or service account JSON)
- [x] Community platforms:
  - [x] X (Twitter) — API Key, API Secret, Bearer Token
  - [x] Facebook Pages — Page ID, Access Token
  - [x] Discord — Bot Token, Server ID
  - [x] TikTok — App ID, App Secret
  - [x] YouTube — API Key, OAuth credentials
  - [x] WhatsApp Business — Phone Number ID, Access Token
- [x] Customer demographic tools:
  - [x] Google Sheets — Service Account JSON or OAuth
  - [ ] Campaign engine (generic) — custom fields
- [x] MCP servers (generic) — command, args, env vars
- **Effort:** Medium (~2 sessions for definitions; testing per-service is ongoing)

### P3.2 — OAuth Flows _(Phase 9.6)_

> _Premium UX: "Connect with Shopify" button instead of pasting keys._

- [ ] Add `oauthConfig` to commerce types that support OAuth
- [ ] Config panel shows "Connect with [Service]" button
- [ ] Tauri: open in system browser, listen for redirect callback
- [ ] Web: redirect-based flow with PKCE
- [ ] Initial services: Shopify, Google, GitHub, Meta
- [ ] Fallback to manual key entry for non-OAuth services
- **Effort:** Large (~4-5 sessions)

### P3.3 — Claude Code Integration Layer

> _From roadmap: "Make top layer of ui/ux of Claude Code so mindMapper
> apps work directly with agent teams."_

- [ ] Design the bridge UI: how MindMapper triggers Claude Code
- [ ] Options to evaluate:
  - A) MindMapper generates a prompt → user pastes into Claude Code (current)
  - B) MindMapper calls Claude Code API directly (if/when available)
  - C) MindMapper wraps Claude Code in a Tauri shell
- [ ] One-click "Run in Claude Code" flow from Export modal
- [ ] Agent status feedback loop: Claude Code progress → MindMapper UI
- **Effort:** Large (~5+ sessions, depends on Claude Code API availability)

### P3.4 — Credential Sync & Portability _(Phase 9.7)_

> _Encrypted vault sync across devices._

- [ ] Store encrypted vault blob in Firestore under user account
- [ ] On login from new device, pull vault → prompt for passphrase
- [ ] Conflict resolution: last-write-wins per node ID with timestamp
- [ ] Export/import vault as encrypted `.vault` file for offline backup
- **Effort:** Medium (~2-3 sessions)

### P3.5 — Phase 3.1: Agent Framework Backend

> _From phase3_plan.md — the execution engine that actually runs agents._

- [ ] `AgentBase` abstract class (execute, systemPrompt, modelTier)
- [ ] Agent Registry (role → config map)
- [ ] MessageBus (Firestore-backed pub/sub with @mention routing)
- [ ] ContextManager (agent-specific context, Sentinel visibility rules)
- [ ] ExecutionEngine (COO-defined order, round management, approvals)
- [ ] CostTracker (per-message token counting, budget enforcement)
- [ ] Prompt templates for all 15 roles
- [ ] Mind map serializer (cloud functions version)
- **Effort:** Large (~2 weeks, ~2,000 LOC)

### P3.6 — Phase 3.3 Backend: COO Agent + Orchestration

> _First working agent that uses the Agent Framework._

- [ ] COO agent implementation (reads mind map, produces phase plan)
- [ ] Real-time message listener (Firestore `onSnapshot`)
- [ ] "Run Agents" toolbar button triggers orchestration
- [ ] Agent status updates in Agent Panel
- [ ] Node ↔ agent thread linking
- **Effort:** Large (~2.5 weeks, ~2,500 LOC)

### P3.7 — Phase 3.4-3.6: Full Agent Team + Review Loop

> _All remaining agents and the complete orchestration loop._

- [ ] Specialist agents: CTO, CFO, Frontend UI/UX, Backend, Documenter
- [ ] Review agents: Devil's Advocate, Sentinel, Token/API/Project Auditors
- [ ] Multi-round execution with CEO approval gates
- [ ] Artifact versioning and viewer
- [ ] Export final plan as structured markdown bundle
- [ ] Node auto-annotation from agent outputs
- **Effort:** Very Large (~6+ weeks, ~7,500 LOC)

---

## 🧊 PRIORITY 4 — Future / Nice-to-Have

- [ ] Tauri desktop packaging (native app build)
- [ ] Secure local proxy for credential-backed API calls (Rust IPC)
- [ ] Settings import/export (`.json` portability across machines)
- [ ] Auto-detect GitHub username via `gh api user -q .login` on startup
- [ ] Customer demographic scraper / campaign engine integration
- [ ] Plan diff viewer (round-over-round comparison)
- [ ] Project timeline UI (orchestration history)

---

## Quick Reference — Recommended Sprint Order

| Sprint       | Tasks                     | Theme                                                                              |
| ------------ | ------------------------- | ---------------------------------------------------------------------------------- |
| **Sprint 1** | P1.1 + P1.2 + P1.3 + P1.4 | Quick visual polish — title header, credential status, help tooltips, smart labels |
| **Sprint 2** | P1.5 + P1.6               | Agent bridge — make commerce nodes functional + CEO command buttons                |
| **Sprint 3** | ~~P2.1 + P2.2~~ ✅        | Confidence — connection testing, code audit                                        |
| **Sprint 4** | ~~P2.3 + P3.1~~ ✅        | Scale — prompt optimization, expanded integrations                                 |
| **Sprint 5** | P3.5 + P3.6               | Backend — agent execution engine + COO agent                                       |
| **Sprint 6** | P3.3 + P3.7               | Platform — Claude Code integration + full agent team                               |
| **Sprint 7** | P3.2 + P3.4               | Premium — OAuth flows, credential sync                                             |
