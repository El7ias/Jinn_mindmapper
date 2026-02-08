# MindMapper — Changelog

All notable changes to this project are documented here.

---

## Phase 6 — Agent Organizational Structure & Communication Protocol (2026-02-08)

### 🏢 Expanded Agent Roster (10 → 15 Roles)

- **3 New Agents Added:**
  - 📚 **Deep Researcher / Knowledge Architect** — Front-loads project knowledge by reading current API docs, SDKs, and patterns. Produces structured reference material in `/docs/knowledge/`. Routes agent-specific documentation packages to each team member individually (frontend gets UI framework docs, backend gets API docs, etc.). Replaced the lightweight Research Agent with this expanded scope.
  - 🚀 **DevOps / Infrastructure Agent** — Owns CI/CD pipelines, Dockerfiles, deployment configs, environment management, monitoring setup. Reports deployment readiness to COO at every milestone. No milestone closes without infrastructure green.
  - 🧪 **QA / Test Agent** — Owns the full test strategy from unit to end-to-end. Tests written alongside features, not after. Reports coverage to COO. Works with Sentinel for security-focused tests.

- **1 New Sub-Role Added:**
  - 📊 **Project Auditor** (under Auditors) — Leads structured retrospectives after every milestone and at project completion. Reports findings to the full executive suite (COO + CTO + CFO) for debate and action planning.

- **NodeManager.js** — Added `devops`, `qa-tester`, and `deep-researcher` to `AGENT_ROLES` constant for node assignment UI

### 📊 Formal Organizational Chart & Reporting Lines

- **Explicit `reports_to` metadata** added to every agent role definition in `WorkflowPromptGenerator.js`
- **Explicit `receives_reports_from` metadata** added to hub roles (COO, CTO)

**Reporting structure established:**

```
                     CEO (Human)
                        │
                     COO (Hub)
               ┌────┬───┼───┬──────────┐
               │    │   │   │          │
            Devil's DevOps QA   Documenter
           Advocate              │
               │                 │ retrospective
               ▼                 ▼ findings
     COO creates         ┌─────────────┐
     agent-specific      │     CTO     │
     task lists          │  (Tech Hub) │
                         ├──┬──────┬───┤
                         │  │      │
                       CFO Sentinel Deep
                         │         Researcher
                    ┌────┤
                    │    │
              Token  API Cost
              Auditor Auditor
                    │
              Project Auditor → Executive Suite
```

### 🔄 Inter-Agent Communication Protocol

- **All agents communicate continuously** — not just at checkpoints. Active, real-time collaboration is mandated.
- **Backend changes API? Frontend hears immediately.** Cross-team communication happens as decisions are made.
- **Agents TALK to each other** during the Active Build phase — DevOps coordinates with Backend on infrastructure, QA writes tests alongside Frontend, etc.
- **Communication artifacts** tracked in `/docs/conversations.md` for key inter-agent discussions

### 😈 Strengthened Devil's Advocate

- **Expanded from passive reviewer to relentless quality champion**
- **Reports ALL findings to COO** — COO creates agent-specific task lists routing each finding to the responsible agent
- **Challenges METHODS AND RESULTS** at every milestone, not just code review
  - Methods: "Is this the best approach? Why X over Y?"
  - Results: "Is the UX genuinely good or just functional? Does it handle edge cases?"
  - Quality: "Can we make this great, not just acceptable?"
- **Quality improvement push** across ALL aspects: code, design, architecture, security, performance, documentation
- **Quality standards enforced:**
  - Code: Clean, readable, maintainable, well-structured
  - Design: Meets Creative Director standards, accessible, responsive
  - Architecture: Scalable, testable, well-separated
  - Performance: Fast load, no unnecessary re-renders, efficient queries
  - Documentation: Complete, accurate, onboarding-ready

### 💰 Strengthened CFO — Creative Cost Optimizer

- **Philosophy codified:** "High quality, low cost — always. These are NOT opposing forces."
- **Reports budget refinements to CTO** — CTO validates that cost optimizations don't compromise quality
- **Creative cost strategies embedded:**
  - Batch similar operations
  - Cache aggressively
  - Reuse patterns across milestones
  - Front-load research to prevent expensive rework
  - Test early to catch bugs cheaply
  - Prefer open-source when free alternative quality matches
  - Right-size model tiers (Flash for boilerplate, Opus ONLY for novel architecture)
- **Budget targets:**
  - 70% Flash / 25% Standard / 5% Opus by call volume
  - Alert if Opus exceeds 20% of total calls
  - "Never sacrifice quality to save cost — find a DIFFERENT way"
- **Cost efficiency score** presented every milestone: quality delivered per token spent
- **Participates in executive suite retrospective debates** to shape financial improvements

### 📚 Deep Researcher — Targeted Knowledge Distribution

- **Distribution mandate:** Routes task-specific documentation to EACH agent individually
  - Frontend → UI framework docs
  - Backend → API/SDK docs
  - DevOps → Infrastructure docs
  - QA → Testing framework docs
  - Sentinel → Security docs
  - Creative → Design system references
- **Not just a folder-publisher** — actively ensures each agent becomes an expert in THEIR task
- **Reports to CTO** with evidence-based tech briefings and cost/benefit analysis

### 🔁 Retrospective / Continuous Improvement System

- **5th milestone step added:** `RETROSPECTIVE` — runs after every milestone sign-off
- **Project Auditor leads the retrospective**, assessing:
  - Milestone completion rate (planned vs. actual)
  - Tech debt accumulation
  - Documentation coverage
  - Team efficiency patterns
  - Process bottlenecks and handoff delays
  - Cost efficiency trends
- **Executive suite debate process:**
  1. Project Auditor presents findings to COO + CTO + CFO simultaneously
  2. COO evaluates operational impact
  3. CTO evaluates technical implications
  4. CFO evaluates cost impact
  5. Executives debate openly and decide which improvements to implement
  6. New plans and tasks incorporate improvements into the next milestone
- **Retrospective artifacts** maintained in `/docs/retrospective.md`

### 🛡️ Sentinel Reporting Line

- **reports_to: CTO** — Security advisories flow to CTO for architecture-level decisions
- **Veto power preserved** — No role can override a Sentinel security flag

### 📋 5-Step Milestone Workflow (Updated from 4)

1. **KICKOFF BRIEFING** — Full team plans. Deep Researcher distributes docs. DevOps confirms infra. QA defines test strategy.
2. **ACTIVE BUILD** — Engineers execute in parallel. All agents communicate continuously. QA writes tests alongside features.
3. **CROSS-ROLE REVIEW** — Devil's Advocate challenges everything. Reports to COO. COO creates agent-specific task lists.
4. **SIGN-OFF** — COO, CTO, Sentinel, CFO, QA, DevOps, Documenter all confirm. CTO approves CFO budget refinements.
5. **RETROSPECTIVE** — Project Auditor presents to executive suite. Debate. Implement improvements for next cycle.

### 📁 New Documentation Artifacts

| Artifact                 | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `/docs/decisions.md`     | Technical decisions log maintained by COO                 |
| `/docs/conversations.md` | Key inter-agent discussion records                        |
| `/docs/retrospective.md` | Milestone retrospectives with improvement actions         |
| `/docs/budget-report.md` | Running cost tracking maintained by CFO                   |
| `/docs/deployment.md`    | Infrastructure architecture and runbooks                  |
| `/docs/tech-journal.md`  | Chronological decisions log maintained by Deep Researcher |
| `/docs/knowledge/`       | Deep Researcher's structured reference material           |

### 🧪 Verification

- Syntax validation: `node -c WorkflowPromptGenerator.js` — ✅ pass
- All new roles registered in `AGENT_ROLES` constant — ✅
- Collaboration protocol updated for full team engagement — ✅
- Reporting lines metadata on every agent role — ✅

---

## Phase 5 — Workspace Settings & GitHub Auth (2026-02-07)

### ⚙️ Workspace Settings Panel

- **WorkspaceSettings engine** (`src/settings/WorkspaceSettings.js`) — Persistent user preferences via localStorage, transforms to prompt-ready JSON via `toWorkspaceInstructions()`
- **WorkspaceSettingsModal UI** (`src/ui/WorkspaceSettingsModal.js`) — Two-column modal with 6 sections: Project Location, Git & GitHub, Security, Tech Stack, Coding Conventions, Deployment
- **Toolbar integration** — Gear icon button (`btn-workspace-settings`) added to toolbar in `index.html`
- **Prompt pipeline wiring** — `PromptExportModal` accepts settings modal, injects workspace instructions into `generateWorkflowPrompt()` and `generateTaskJSON()`
- **Generator fallback** — `_buildTaskDefinition()` uses settings when available, falls back to hardcoded `_buildWorkspaceInstructions()` for backward compatibility
- **CSS** — ~170 lines for modal layout, info boxes, save indicators, field hints

### 🔐 Auth-Aware Git Instructions

- **Auth method selector** — Users select their local git auth method (GitHub CLI, SSH, Credential Manager, or "Not set up")
- **Method-specific prompt output** — Generated prompts include correct remote URLs and commands per auth method
- **Safety guard** — When auth is "Not set up", prompt explicitly tells agents NOT to attempt remote operations
- **Info box** — Git section includes prerequisite explanation: MindMapper → prompt → Claude Code → your terminal → your auth
- **No credentials stored** — MindMapper never handles tokens, keys, or passwords

### 🛠️ GitHub CLI Setup

- **Installation** — `winget install GitHub.cli`
- **Authentication** — `gh auth login --web --git-protocol https` → device code flow
- **Verified** — Account `El7ias`, HTTPS protocol, scopes: `gist`, `read:org`, `repo`

### 🧪 Testing

- Settings panel opens and auto-saves ✅
- Settings appear in generated prompt JSON ✅
- Full project test with real agent execution — extremely promising ✅
- Rate-limited at ~1:50 AM, pending completion at 6 AM ⏳

---

## Phase 3 — v3.0.0 (WIP)

### 🔥 Phase 3.0 — Infrastructure Foundation

- **Firebase Configuration** (`src/firebase/config.js`) — SDK initialization with environment variable support, emulator auto-connection for dev mode
- **Authentication Module** (`src/firebase/auth.js`) — Google Sign-In, session management, reactive auth state via `onAuthStateChanged`
- **Firestore Data Layer** (`src/firebase/firestore.js`) — Full CRUD operations for projects, messages, artifacts, cost ledger, user profiles
- **Real-time Listeners** (`src/firebase/listeners.js`) — Firestore `onSnapshot` for live streaming of agent messages, project state, artifacts, and cost data
- **Data Migration** (`src/firebase/migration.js`) — One-way localStorage → Firestore migration with Phase 3 metadata defaults
- **LLM Gateway** (`src/firebase/gateway.js`) — Client-side adapter routing all AI calls through Cloud Functions with auth tokens and mock mode
- **Firestore Security Rules** (`firestore.rules`) — Owner-only project access, Cloud Functions write restriction for messages/artifacts/cost
- **Cloud Functions Scaffold** (`functions/src/index.js`) — Authenticated `orchestrate` and `estimateCost` endpoints with project ownership verification
- **Firebase Project Config** (`firebase.json`, `.firebaserc`) — Emulator configuration (Auth:9099, Functions:5001, Firestore:8080)
- **Environment Template** (`.env.example`) — All Firebase and Cloud Functions configuration variables

### 📋 Phase 3.2 — Node Metadata System

- **Enhanced NodeManager** (`src/nodes/NodeManager.js`) — Added metadata fields: `nodeType`, `priority`, `phase`, `assignedAgent`, `agentStatus`, `agentNotes`
- **Constants** — `NODE_TYPES` (8 types: general, feature, constraint, risk, question, milestone, dependency, note), `PRIORITY_LEVELS` (4), `AGENT_STATUS_MAP` (6 statuses), `AGENT_ROLES` (5 roles)
- **Metadata Methods** — `setNodeType()`, `setPriority()`, `setPhase()`, `setAssignedAgent()`, `setAgentStatus()`, `setAgentNotes()`
- **Visual Overlays** — Status badges (top-right corner dots), priority rings (pulsing border glow for critical), agent assignment chips, phase/priority meta text
- **Backward Compatibility** — Serialize/deserialize handles missing metadata gracefully with defaults
- **Context Menu Enhancement** (`src/ui/ContextMenu.js`) — Node Type, Priority, and Agent Assignment submenus with active-state highlighting
- **CSS Overlays** — 540+ lines of Phase 3 styles: status badges, priority rings, agent chips, meta text indicators

### 🤖 Phase 3.3 — Agent Panel (Client-side)

- **Agent Panel** (`src/ui/AgentPanel.js`) — Collapsible side panel with:
  - Message thread view with markdown rendering (via `marked`)
  - CEO text input area (Enter to send, Shift+Enter for newline)
  - Agent status indicator (idle/active/error)
  - Mind map readiness indicator (errors/warnings/ready)
  - Cost and token counter footer
  - Slide-in/out animation with canvas resize
- **Mind Map Validator** (`src/validation/MindMapValidator.js`) — Validates readiness: node count, text content, metadata enrichment, connectivity, CEO context
- **Main.js Integration** — Agent Panel initialized on startup, readiness validation runs on every state change

### 💡 Phase 3.4 — AI Idea Generation

- **IdeaGenerator** (`src/ai/IdeaGenerator.js`) — Multi-provider LLM client for concept → mind map generation:
  - **Google Gemini** — `gemini-2.0-flash-lite` (default), `gemini-2.0-flash`
  - **OpenAI GPT** — `gpt-4o-mini` (default), `gpt-4o`
  - **Anthropic Claude** — `claude-haiku-3` (default), `claude-sonnet-4`
  - Provider-agnostic request/response normalization
  - Structured JSON output parsing with fallback content extraction
  - Auto-layout: grid and Reingold-Tilford-style tree positioning
  - Provider names are clean and neutral — no tier/cost labels exposed to end users
- **IdeaInputModal** (`src/ui/IdeaInputModal.js`) — Full-featured generation UI:
  - Concept text input with example placeholders
  - Provider and model selection dropdowns
  - API key input with localStorage persistence (per-provider)
  - Real-time generation status and error display
  - Example concept buttons for quick experimentation

### 📋 Phase 3.5 — Mind Map Serializer + Workflow Prompt Generator

- **MindMapSerializer** (`src/export/MindMapSerializer.js`) — Extracts structured data from any mind map:
  - Classifies nodes by type (feature, constraint, risk, tech note, etc.)
  - Builds dependency graph from connections
  - Computes topological execution order (respecting priorities)
  - Extracts CEO vision (from root/milestone nodes)
  - Generates summary statistics
- **WorkflowPromptGenerator** (`src/export/WorkflowPromptGenerator.js`) — Transforms serialized data into Claude Code orchestration prompts:
  - JSON task definition with goal, virtual team, milestones, deliverables, constraints
  - Markdown wrapper with mind map summary, feature lists, dependency graphs
  - Stack inference from feature/constraint/tech note text
  - Auto-derived milestone plan from feature priorities
- **PromptExportModal** (`src/ui/PromptExportModal.js`) — Preview and export UI:
  - Tabbed view: JSON task definition vs. full Markdown
  - Copy-to-clipboard for both formats
  - Download as `.json` or `.md` file
  - Syntax-highlighted preview

### 🧠 Phase 3.6 — Model Tier Configuration

- **ModelTierConfig** (`src/ai/ModelTierConfig.js`) — Defines the three-tier model routing strategy:
  - **Efficient tier** — mechanical tasks (scaffolding, formatting, logs)
  - **Standard tier** — analytical work (feature implementation, design)
  - **Deep-reasoning tier** — architecture, security, novel problem-solving
  - Strategy embedded in generated prompts via `generateModelRoutingPrompt()`
  - Philosophy: "Never bring a bazooka to a pillow fight"
  - Routing metadata is consumed by the executing agent, invisible to MindMapper users

### 👥 Phase 3.7 — Full 15-Role Virtual Team + Invisible Routing

- **Virtual Team Expansion** — `_buildVirtualTeam()` now generates 15 agent roles (expanded from original 5):
  - 👔 **Orchestrator (COO)** — task board, milestone sequencing (standard routing)
  - 🏗️ **CTO** — architecture decisions, framework selection (deep-reasoning routing)
  - 💰 **CFO** — budget strategy, creative cost optimization (standard routing)
  - 🎨 **Creative Director / Art Department** — visual identity, design system, branding, accessibility (standard routing)
  - 🖥️ **Front-End Agent** — UI implementation, user journeys, responsive layout (standard routing)
  - ⚙️ **Backend Agent** — APIs, data models, security rules (standard routing)
  - 🚀 **DevOps Agent** — CI/CD, deployment, infrastructure-as-code (standard routing)
  - 🧪 **QA / Test Agent** — test strategy, unit/integration/e2e tests (standard routing)
  - 📚 **Deep Researcher / Knowledge Architect** — API docs, reference material, knowledge base (standard routing)
  - 🛡️ **Sentinel** — dedicated security specialist, OWASP, threat modeling (deep-reasoning routing)
  - 😈 **Devil's Advocate** — QA challenger, architecture stress-testing, quality champion (deep-reasoning routing)
  - 📝 **Documenter** — README, API docs, changelogs, migration guides (standard routing)
  - 🔢 **Auditors** — token/API cost tracking, project health, retrospective (efficient routing)
- **Invisible Routing Metadata** — All tier-specific fields renamed:
  - `model_tier` → `_routing` (underscore-prefixed internal convention)
  - `tier_rationale` → `_rationale`
  - Provider labels cleaned: `Google (Cheapest)` → `Google`
  - All `costNote` and `tier` properties removed from provider configs
  - Zero tier/cost language in any UI component (`src/ui/` directory)
  - Routing metadata embedded in output JSON for Claude Code consumption only

### 🔒 Phase 3.8 — Security Hardening

- **Sanitize Utility** (`src/core/Sanitize.js`) — Shared HTML sanitization layer:
  - `escapeHtml()` — escapes plain text for safe innerHTML injection
  - `sanitizeHtml()` — DOMPurify-based sanitizer for rendered HTML (markdown, agent output)
  - `escapeAttr()` — escapes values for HTML attribute contexts
- **XSS Fix: NodeManager** — Node text now passes through `escapeHtml()` before innerHTML injection in `_buildNodeHTML()`; attribute values use `escapeAttr()` for titles/tooltips
- **XSS Fix: AgentPanel** — Agent markdown rendered via `marked.parse()` is now sanitized through `DOMPurify.sanitize()` via `sanitizeHtml()`; CEO text uses `escapeHtml()`; local `_escapeHtml` replaced with shared utility
- **API Key Security** — Google Gemini API key moved from URL query parameter (`?key=`) to `x-goog-api-key` request header in `IdeaGenerator.js`
- **Content Security Policy** — CSP meta tag added to `index.html`:
  - `script-src 'self'` — blocks inline scripts and eval
  - `connect-src` — whitelists only known API endpoints (Google, OpenAI, Anthropic)
  - `object-src 'none'` — blocks plugin-based attacks
  - `style-src 'unsafe-inline'` — required for dynamic node color styling
- **Dependency Cleanup** — Removed dead `diff` package; added `dompurify` (~23 kB gzipped)
- **Build Verification** — Clean build (0 errors, 0 vulnerabilities)

---

## Phase 1 — v1.0.0 (2026-02-07)

### 🏗️ Project Foundation

- **Project scaffolding** — Vite 6.x + Vanilla ES6 modules, JetBrains Mono + Inter fonts
- **Design system** (`src/styles/main.css`) — 775 lines of circuit-board-themed CSS:
  - Dark background (`#06060f`) with neon accents (cyan `#00e5ff`, magenta `#ff2d78`)
  - PCB grid background that scales with zoom
  - Glassmorphism UI panels with backdrop blur
  - CSS custom properties for all design tokens
  - Full responsive layout, scrollbar styling, animations
- **HTML shell** (`index.html`) — Toolbar, canvas, SVG layer with filter defs, context menu, property panel, minimap

### ⚡ Core Systems

- **EventBus** (`src/core/EventBus.js`) — Lightweight pub/sub for decoupled module communication
- **History** (`src/core/History.js`) — Undo/redo stack with deep-clone state snapshots, pause/resume
- **Viewport** (`src/viewport/Viewport.js`) — Infinite canvas with:
  - Pan: Space + drag, middle-click drag
  - Zoom: Scroll wheel, toolbar +/- buttons, fit-to-content
  - Coordinate transforms: screen ↔ world space
  - Dynamic grid scaling

### 📦 Node Management

- **NodeManager** (`src/nodes/NodeManager.js`) — Full node lifecycle:
  - Create nodes: double-click canvas, toolbar button, drag-from-port (auto-creates)
  - Inline text editing: double-click node → contentEditable, Enter to commit, Esc to cancel
  - Drag & drop: single and multi-select node dragging
  - Selection: click, Shift+click for multi-select, click canvas to deselect
  - Color-coded accent bars with 7 preset colors
  - 4 connection ports per node (top, right, bottom, left) — visible on hover/select
  - Serialization/deserialization for persistence

### 🔌 Connection System

- **ConnectionManager** (`src/connections/ConnectionManager.js`) — Full-featured connection wiring:
  - **Create connections**: Drag from port to port
  - **Smart wiring**: Drag from port to node body → auto-detects nearest port based on relative position
  - **Drag-to-create**: Drag from port to empty space → creates new node + auto-connects
  - **Detach**: Drag solder dot (endpoint) to empty space → breaks connection
  - **Rewire**: Drag solder dot to another port → re-routes connection
  - **Arrowheads**: Optional directional arrows to indicate flow (right-click → Add Arrow)
  - **Reverse direction**: Swap source ↔ target via right-click menu
  - **Delete**: Double-click wire, or select + Delete key, or right-click → Delete
  - **Smart orthogonal routing**: Port-aware algorithm with 30px extension offsets
  - **Visual design**: Cyan glowing traces, solder-point endpoints, magenta when selected
  - **SVG architecture**: Hit area (14px wide invisible stroke) + visible path + 2 solder dots per connection
  - **Duplicate prevention**: Same source+target port pair cannot be connected twice
  - Serialization/deserialization with `directed` state preserved

### 🖱️ UI Components

- **ContextMenu** (`src/ui/ContextMenu.js`) — Context-sensitive right-click menus:
  - **Canvas menu**: Add Node, Zoom to Fit, Reset Zoom
  - **Node menu**: Edit Text, Duplicate, Disconnect All (with connection count badge), Delete
  - **Connection menu**: Add/Remove Arrow, Reverse Direction, Delete Connection
  - Smart positioning: auto-adjusts to stay within viewport bounds
- **PropertyPanel** (`src/ui/PropertyPanel.js`) — Side panel for editing node properties:
  - Label (textarea synced with node text)
  - Color picker (7 preset swatches)
  - Metadata display (node ID, position)
  - Slide-in animation
- **MiniMap** (`src/ui/MiniMap.js`) — Bottom-right overview canvas:
  - Renders all nodes as colored dots
  - Shows viewport rectangle
  - Click to navigate to any area

### 💾 Persistence

- **Storage** (`src/storage/Storage.js`) — localStorage adapter:
  - Debounced auto-save (500ms) on any state change
  - Manual save via Ctrl+S
  - Visual save indicator (Saving... / Saved / Error)
  - Clean save/load API designed for future Firebase swap

### ⌨️ Keyboard Shortcuts

| Shortcut        | Action                    |
| --------------- | ------------------------- |
| `Double-click`  | Create new node           |
| `Delete`        | Delete selected node/wire |
| `Escape`        | Deselect all              |
| `Ctrl+Z`        | Undo                      |
| `Ctrl+Y`        | Redo                      |
| `Ctrl+S`        | Force save                |
| `Space + drag`  | Pan canvas                |
| `Scroll wheel`  | Zoom in/out               |
| `Shift + click` | Multi-select nodes        |

### 🎨 Visual Features

- Neon glow filters on connections (SVG `<filter>` with Gaussian blur)
- Node appear animation (scale 0.8 → 1.0, 200ms)
- Context menu fade-in animation (scale 0.95 → 1.0, 150ms)
- Property panel slide-in animation (translateX 20px → 0, 200ms)
- Solder dots scale up on hover with glow effect
- Port dots glow and scale on hover with crosshair cursor
- Glassmorphism effect on toolbar, context menu, property panel, minimap

---

## Phase 1.1 — v1.1.0 (2026-02-07)

### 🔀 Splice Node into Wire

- **Drag-to-splice**: Drag a node over an existing wire to splice it into the flow
- Automatically splits the original connection into two connections routed through the spliced node
- **Visual feedback**: Wire glows green with pulsing animation when a valid splice target is detected
- Intelligently selects best input/output ports on the spliced node based on wire direction
- Preserves arrowhead state from the original connection

### ⤻ Wire Jump Arcs (PCB Crossings)

- **Automatic crossing detection**: Detects when unconnected wires cross each other
- **Semicircle arcs**: Draws 6px-radius PCB-style jump arcs at crossing points
- **Smart filtering**: Only draws jumps between orthogonal segment crossings (H-V or V-H pairs)
- **Batched updates**: Uses `requestAnimationFrame` for efficient recalculation during node dragging
- **Accurate hit areas**: Click detection uses the base path (straight) while rendering shows the arc path

### ⇆ Bidirectional Arrows

- **Tri-state arrow system**: `none` → `forward` → `both` (cycle via right-click toggle)
- **Reverse arrowhead markers**: New `arrowhead-start-cyan` and `arrowhead-start-magenta` SVG markers
- **Context menu options**:
  - No arrow: "→ Add Arrow" / "⇆ Add Bidirectional"
  - One-way: "⇆ Make Bidirectional" / "↔ Reverse Direction" / "✕ Remove Arrow"
  - Both ways: "→ Make One-way" / "✕ Remove Arrows"
- **Backward compatible**: Saved data with boolean `directed` (true/false) maps to `'forward'`/`'none'`

### ◇ Node Shape System

- **7 semantic shapes** with flowchart meanings:
  - ▬ **Rectangle** — Process / Task (default)
  - ▢ **Rounded** — Start / End
  - ◇ **Diamond** — Decision
  - ▱ **Parallelogram** — Input / Output
  - ⬡ **Hexagon** — Preparation
  - ● **Circle** — Event / Trigger
  - ▭ **Pill** — Terminal
- **Right-click shape picker**: Shows all shapes with icons, names, and semantic meaning
- Active shape highlighted with cyan checkmark styling
- Shapes use `clip-path` (diamond, parallelogram, hexagon) with `drop-shadow` for border glow
- Rounded shapes (rounded, pill, circle) use `border-radius`
- Shape persisted in localStorage; backward-compatible (missing shape defaults to `rectangle`)
- Duplicate preserves source node's shape

### 🔧 Technical Improvements

- `NodeManager` now exports `NODE_SHAPES` constant for use by ContextMenu
- `NodeManager.setShape()` method for programmatic shape changes
- `ConnectionManager` cross-reference set in main.js for splice-on-drop
- Context menu `_buildMenu()` now supports `header` type items and `className` for active styling

---

## Phase 2 — v2.0.0 (2026-02-07)

### 📁 File Management System

- **FileManager** (`src/storage/FileManager.js`) — Complete file I/O lifecycle:
  - **New Project** — Clears canvas with confirmation dialog if content exists
  - **Open File…** — Opens `.mindmap` (JSON) or `.json` files via native file picker
  - **Save** — Downloads current state as `<name>.mindmap` JSON file
  - **Save As…** — Prompts for name, updates project title, downloads `.mindmap`
  - **Export PNG** — Canvas-rendered export with nodes (rounded rects, color bars, text), connections (all SVG path commands including jump arcs), and PCB dark background
  - **Export JSON** — Pretty-printed JSON with version, timestamp, and full state
  - **Export SVG** — Scalable vector graphic with node rectangles, color bars, text elements, and connection paths
  - **Import Reference…** — File picker for `.md`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.doc`, `.docx`
  - Project name tracking with toolbar display
  - SVG path translation supports all command types (M, L, H, V, C, S, Q, T, A) for accurate exports

### 📎 Reference File Import

- **ReferenceImporter** (`src/import/ReferenceImporter.js`) — Auto-converts reference files into mind maps:
  - **Markdown (.md)** — Parses `#` heading hierarchy + `-` list items into tree structure
  - **Plain Text (.txt)** — Indentation-based hierarchy (2-space indent per depth level)
  - **Images (.png, .jpg, .gif, .webp)** — Creates reference node with file metadata
  - **Documents (.doc, .docx)** — Best-effort text extraction; fallback to reference node
  - **Auto-layout** — Reingold-Tilford-style tree layout with color/shape coding by depth
  - Confirmation dialog before replacing existing canvas content

### 🎨 Project Template Presets

- **PresetManager** (`src/presets/PresetManager.js`) — Manages built-in and custom presets:
  - 6 built-in templates: iOS App, Android App, Local Executable, SaaS Platform, Website Wireframe, Website Map
  - Custom presets saved to/loaded from `localStorage`
  - Add/delete custom presets
- **PresetModal** (`src/ui/PresetModal.js`) — Template picker UI:
  - Category filter pills: All, Mobile, Desktop, Web, SaaS, Custom
  - Mini SVG preview for each preset
  - Save-current-canvas-as-template button
  - Confirmation dialog before loading
  - Glassmorphism modal with slide-up animation
- **builtinPresets** (`src/presets/builtinPresets.js`) — 6 predefined templates:
  - Each has 8–12 nodes with semantic shapes, colors, and orthogonal connections
  - Laid out for clean flowchart readability

### 📂 File Menu Dropdown

- **FileMenu** (`src/ui/FileMenu.js`) — Toolbar dropdown with:
  - All file operations (New, Open, Save, Save As, Export ×3, Import)
  - Keyboard shortcut labels displayed inline
  - Icon + label + shortcut layout per menu item
  - Section headers and dividers
  - Glassmorphism dropdown with slide-down animation
  - Close on outside click, Escape key, or selection
  - Caret rotation animation when open/closed

### ⌨️ New Keyboard Shortcuts

| Shortcut       | Action      |
| -------------- | ----------- |
| `Ctrl+N`       | New Project |
| `Ctrl+O`       | Open File   |
| `Ctrl+Shift+S` | Save As     |

### 🎨 UI Additions

- **Project title** in toolbar — shows current file name next to brand (MindMapper · Untitled)
- **File dropdown button** — hamburger icon + "File" label + animated caret
- **Templates button** — grid icon in toolbar to launch preset modal
- 120+ lines of new CSS for file menu dropdown, project title, preset modal

---

## Module Dependency Map

```
main.js
  ├── EventBus (no deps)
  ├── History (← EventBus)
  ├── Sanitize (no deps, uses DOMPurify)
  ├── Viewport (← EventBus)
  ├── Storage (← EventBus)
  ├── NodeManager (← EventBus, Viewport)
  ├── ConnectionManager (← EventBus, NodeManager)
  ├── ContextMenu (← EventBus, NodeManager, ConnectionManager, Viewport)
  ├── PropertyPanel (← EventBus, NodeManager)
  ├── MiniMap (← EventBus, NodeManager, Viewport)
  ├── PresetManager (no deps)
  ├── PresetModal (← PresetManager)
  ├── FileManager (← NodeManager, ConnectionManager, ReferenceImporter)
  └── FileMenu (← FileManager)
```

## Event Bus Channels

| Event                  | Emitter           | Consumers                  | Payload                    |
| ---------------------- | ----------------- | -------------------------- | -------------------------- |
| `node:created`         | NodeManager       | MiniMap, History           | `{id, text, x, y, color}`  |
| `node:moved`           | NodeManager       | ConnectionManager, MiniMap | `{id, x, y}`               |
| `node:updated`         | NodeManager       | PropertyPanel              | `{id, text, color}`        |
| `node:deleted`         | NodeManager       | ConnectionManager, MiniMap | `{id}`                     |
| `selection:changed`    | NodeManager       | PropertyPanel, ContextMenu | `[...selectedIds]`         |
| `connection:created`   | ConnectionManager | MiniMap                    | `{id, sourceId, targetId}` |
| `connection:deleted`   | ConnectionManager | MiniMap                    | `{id}`                     |
| `connection:selected`  | ConnectionManager | —                          | `{id, ...connData}`        |
| `viewport:changed`     | Viewport          | MiniMap, main.js           | `{x, y, zoom}`             |
| `viewport:fit-request` | ContextMenu       | main.js                    | —                          |
| `state:changed`        | various           | History, Storage           | —                          |
| `state:save-request`   | Storage           | main.js                    | —                          |
| `state:loaded`         | main.js           | MiniMap                    | —                          |

---

## Lines of Code Summary

| File                                   | Lines      | Purpose                                        |
| -------------------------------------- | ---------- | ---------------------------------------------- |
| `index.html`                           | ~545       | HTML shell + SVG defs + toolbar + modals       |
| `src/styles/main.css`                  | ~1,140     | Design system + shapes + file menu + presets   |
| `src/main.js`                          | ~204       | App orchestration + file/preset initialization |
| `src/core/EventBus.js`                 | ~27        | Pub/sub                                        |
| `src/core/History.js`                  | ~43        | Undo/redo                                      |
| `src/core/Sanitize.js`                 | ~80        | HTML sanitization (DOMPurify wrapper)          |
| `src/viewport/Viewport.js`             | ~139       | Pan/zoom/transforms                            |
| `src/nodes/NodeManager.js`             | ~320       | Node lifecycle + shapes                        |
| `src/connections/ConnectionManager.js` | ~717       | Wiring, routing, arrowheads, jump arcs         |
| `src/ui/ContextMenu.js`                | ~207       | Context menus + shape picker                   |
| `src/ui/PropertyPanel.js`              | ~81        | Property editing panel                         |
| `src/ui/MiniMap.js`                    | ~100       | Overview map                                   |
| `src/ui/FileMenu.js`                   | ~119       | File dropdown menu + keyboard shortcuts        |
| `src/ui/PresetModal.js`                | ~200       | Template picker modal                          |
| `src/storage/Storage.js`               | ~46        | localStorage adapter                           |
| `src/storage/FileManager.js`           | ~347       | File I/O: save/open/export/import              |
| `src/import/ReferenceImporter.js`      | ~256       | Reference file → mind map converter            |
| `src/presets/PresetManager.js`         | ~91        | Built-in + custom preset manager               |
| `src/presets/builtinPresets.js`        | ~292       | 6 built-in project templates                   |
| **Total**                              | **~4,874** | **Complete Phase 1 + 1.1 + 2.0 application**   |
