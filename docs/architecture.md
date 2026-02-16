# MindMapper — System Architecture

## Overview

MindMapper is a node-based mind mapping web application with a circuit board aesthetic. Users create idea nodes, connect them with PCB-style traces, and organize thoughts on an infinite pannable/zoomable canvas.

**Phase 1** established the core canvas, nodes, and connections. **Phase 1.1** added splice-on-wire, jump arcs, bidirectional arrows, and node shapes. **Phase 2** added file management and project template presets. **Phase 3** introduces the AI pipeline: multi-provider idea generation, node metadata enrichment, a full agent orchestration workflow, and a tiered model routing strategy.

## Tech Stack

| Layer              | Technology                                  | Rationale                                  |
| ------------------ | ------------------------------------------- | ------------------------------------------ |
| Bundler            | Vite 6.x                                    | Fast HMR, zero-config ES module dev server |
| Language           | Vanilla ES6+ JS                             | No framework overhead, full control        |
| Rendering          | DOM (nodes) + SVG (connections)             | Styleable, accessible, interactive         |
| Styling            | Vanilla CSS + Custom Properties             | Design token system, no dependencies       |
| Fonts              | Google Fonts (JetBrains Mono, Inter)        | Tech + clean aesthetic                     |
| Persistence        | localStorage + Firebase Firestore (Phase 3) | Phase 1 local; Phase 3 cloud sync          |
| AI - Gen           | Google Gemini, OpenAI GPT, Anthropic Claude | Multi-provider idea generation             |
| AI - Orchestration | Claude Code (Opus 4.6)                      | Agent execution target                     |
| Security           | CSP + DOMPurify                             | XSS prevention, content sanitization       |

## Component Diagram

```
┌─────────────────────────────────────────────────────┐
│                    index.html                       │
│  ┌───────────────────────────────────────────────┐  │
│  │  Toolbar: Brand · Title  | File ▾ | +Node |      │  │
│  │          Templates | Delete | Undo/Redo | Zoom  │  │
│  │          💡 Generate | 📋 Export Prompt          │  │
│  ├───────────────────────────────────────────────┤  │
│  │                                               │  │
│  │   ┌────────────────────────────┐ ┌──────────┐│  │
│  │   │      Canvas Viewport      │ │  Agent   ││  │
│  │   │  ┌──────────────────────┐ │ │  Panel   ││  │
│  │   │  │ SVG Layer            │ │ │  ───── ││  │
│  │   │  │  - Circuit traces    │ │ │  Thread  ││  │
│  │   │  │  - Solder dots       │ │ │  Status  ││  │
│  │   │  │  - Arrowheads        │ │ │  Cost    ││  │
│  │   │  └──────────────────────┘ │ │          ││  │
│  │   │  ┌──────────────────────┐ │ └──────────┘│  │
│  │   │  │ Node Layer (DOM)     │ │             │  │
│  │   │  └──────────────────────┘ │             │  │
│  │   └────────────────────────────┘ ┌────────┐ │  │
│  │                                  │MiniMap │ │  │
│  │                                  └────────┘ │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Modals: IdeaInput | PromptExport | Presets   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Pointer Events Layering

The SVG connections layer sits below the DOM nodes layer. The nodes layer uses `pointer-events: none` so clicks on empty areas pass through to the SVG. Individual `.mind-node` elements use `pointer-events: auto` to remain interactive. This allows both node interactions and connection interactions (click, dblclick, right-click) to work on the same canvas.

## Module Architecture

```
main.js ─── initializes ──┬── EventBus (pub/sub)
                          ├── History (undo/redo)
                          ├── Sanitize (escapeHtml, sanitizeHtml, escapeAttr)
                          ├── Viewport (pan/zoom/grid)
                          ├── NodeManager → Node + metadata + agent roles
                          ├── ConnectionManager → Connection
                          ├── Toolbar (inline in HTML)
                          ├── ContextMenu (canvas / node / connection)
                          ├── MiniMap
                          ├── PropertyPanel
                          ├── Storage (localStorage)
                          ├── PresetManager + builtinPresets
                          ├── PresetModal
                          ├── FileManager (→ ReferenceImporter)
                          ├── FileMenu
                          ├── AgentPanel (sidebar, with destroy() cleanup)
                          ├── AgentStatusDisplay (roster readout)
                          ├── CommerceNodeConfig (commerce credential UI)
                          ├── IdeaInputModal (→ IdeaGenerator)
                          ├── PromptExportModal (→ MindMapSerializer → WorkflowPromptGenerator)
                          ├── MindMapValidator
                          ├── OrchestrationEngine → session lifecycle + bridge management
                          │     ├── BrowserAgentBridge → browser-mode AI API streaming
                          │     ├── ClaudeCodeBridge → desktop-mode Claude Code CLI
                          │     ├── EnvironmentDetector → Tauri vs. browser detection
                          │     └── SessionStore → session persistence
                          ├── ExecutionEngine → round-based multi-agent coordination
                          │     (wraps OrchestrationEngine; manages COO planning,
                          │      agent task assignment, CEO approval gates)
                          ├── COOAgent + SpecialistAgents + AgentRegistry
                          ├── ReportPrompts → CEO report prompt templates
                          ├── CredentialVault → AES-GCM encrypted key storage
                          ├── ConnectionTester + MCPConfigGenerator (integrations)
                          └── WorkspaceSettings (settings persistence)
```

All core modules communicate via the **EventBus** — no direct coupling between systems.

## AI Pipeline Architecture

The AI pipeline transforms a user's mind map into both (a) AI-generated idea expansions and (b) complete agent orchestration prompts.

### Pipeline 1: Idea Generation

```
User types concept
    → IdeaInputModal (UI)
        → IdeaGenerator (multi-provider LLM)
            → Provider (Google / OpenAI / Anthropic)
                → JSON response
                    → Nodes + connections rendered on canvas
```

**Provider Configuration**: Each provider specifies `name`, `models`, `defaultModel`, and a `buildRequest()` function. Defaults use the most efficient model per provider. The UI exposes provider names and model choices without revealing internal routing metadata.

### Pipeline 2: Agent Orchestration (Mind Map → Claude Code Prompt)

```
Mind map canvas
    → MindMapSerializer.serialize()
        → Structured data: features, constraints, risks,
          tech notes, references, dependencies, CEO vision,
          topological execution order, statistics
    → WorkflowPromptGenerator.generateWorkflowPrompt()
        → JSON task definition:
            - Goal (from CEO vision + mind map summary)
            - Virtual team (15 roles)
            - Model routing strategy (from ModelTierConfig)
            - Milestones (auto-derived from feature priorities)
            - Deliverables, constraints, workspace instructions
        → Markdown wrapper with mind map summary
    → PromptExportModal (UI)
        → Preview / Copy / Download (JSON or Markdown)
```

### Model Tier Configuration

The system defines a three-tier model routing strategy in `ModelTierConfig.js`:

| Processing Level | Purpose                            | Typical Use                    |
| ---------------- | ---------------------------------- | ------------------------------ |
| Efficient        | Mechanical, deterministic tasks    | Scaffolding, formatting, logs  |
| Standard         | Analytical, multi-step work        | Feature implementation, design |
| Deep-Reasoning   | Architecture, security, novel work | Reviews, threat modeling, CTO  |

This strategy is embedded in the generated prompt for the executing agent (Claude Code) to follow. The MindMapper end user sees none of this — routing metadata is internal and opaque.

## Security Architecture

Security is enforced at three layers:

### Layer 1: Content Security Policy (CSP)

A `<meta http-equiv="Content-Security-Policy">` tag in `index.html` enforces:

| Directive     | Value                                   | Purpose                                     |
| ------------- | --------------------------------------- | ------------------------------------------- |
| `script-src`  | `'self'`                                | Blocks inline scripts, `eval()`, XSS        |
| `connect-src` | `'self'` + 3 whitelisted API domains    | Prevents data exfiltration to unknown hosts |
| `object-src`  | `'none'`                                | Blocks Flash/plugin-based attacks           |
| `style-src`   | `'self' 'unsafe-inline'` + Google Fonts | Required for dynamic node color styling     |
| `base-uri`    | `'self'`                                | Prevents `<base>` tag hijacking             |

### Layer 2: HTML Sanitization (`src/core/Sanitize.js`)

All user-provided and AI-generated content is sanitized before DOM injection:

| Function         | Input                          | Output                             | Used By                 |
| ---------------- | ------------------------------ | ---------------------------------- | ----------------------- |
| `escapeHtml()`   | Plain text (node labels, etc.) | HTML-entity-escaped string         | NodeManager             |
| `sanitizeHtml()` | Rendered HTML (markdown)       | DOMPurify-cleaned HTML             | AgentPanel              |
| `escapeAttr()`   | Attribute values               | Quote/angle-bracket-escaped string | NodeManager, AgentPanel |

### Layer 3: API Key Handling

| Platform        | Strategy                                                            |
| --------------- | ------------------------------------------------------------------- |
| Web (current)   | Header-based auth (`x-goog-api-key`); CSP mitigates XSS-based theft |
| Desktop (Tauri) | `CredentialVault.js` with AES-GCM encryption via Web Crypto API     |
| SaaS (future)   | Server-side key management via Firebase Cloud Functions             |
| Mobile (future) | Platform-specific secure storage (Keychain / Keystore)              |

### Virtual Team (14 Roles — 13 AI + 1 Human)

The `WorkflowPromptGenerator._buildVirtualTeam()` function generates role definitions for:

| Role               | Focus Area                                         | Processing Level | Reports To |
| ------------------ | -------------------------------------------------- | ---------------- | ---------- |
| CEO (User)         | Product visionary, decision authority              | Human            | —          |
| COO (Orchestrator) | Task sequencing, milestone tracking                | Standard         | CEO        |
| CTO                | Architecture, framework, technical strategy        | Deep-Reasoning   | CEO        |
| CFO                | Cost/budget tracking, ROI analysis                 | Standard         | CTO        |
| Frontend UI/UX     | Visual identity, design system + UI implementation | Standard         | COO        |
| Backend Agent      | APIs, data models, security rules                  | Standard         | CTO        |
| DevOps Architect   | CI/CD, deployment, infrastructure                  | Standard         | COO        |
| Deep Researcher    | In-depth investigation, evidence gathering         | Standard         | CTO        |
| QA / Test Engineer | Testing, validation, regression checks             | Standard         | COO        |
| Devil's Advocate   | Quality champion, challenges methods & results     | Standard         | COO        |
| Sentinel           | Security specialist, OWASP, threat modeling        | Deep-Reasoning   | CTO        |
| Documenter         | README, API docs, changelogs                       | Efficient        | COO        |
| Token Auditor      | Per-message token counting                         | Efficient        | CFO        |
| API Cost Auditor   | API cost tracking, budget enforcement              | Efficient        | CFO        |
| Project Auditor    | Retrospectives, project health                     | Efficient        | COO        |

Each role carries an internal `_routing` hint in the generated prompt. The underscore prefix signals that this is agent-internal metadata, not user-facing information.

## Data Models

### Node

```js
{
  id: string,           // Generated ID (node_<timestamp>_<counter>)
  text: string,         // Display text (inline editable)
  x: number,            // World X position (top-left corner)
  y: number,            // World Y position (top-left corner)
  color: string,        // Hex color for accent bar
  shape: string,        // 'rectangle' | 'rounded' | 'diamond' | 'parallelogram' | 'hexagon' | 'circle' | 'pill'
  // Phase 3 metadata:
  nodeType: string,     // 'general' | 'feature' | 'constraint' | 'risk' | 'question' | 'milestone' | 'dependency' | 'note'
  priority: string,     // 'critical' | 'high' | 'medium' | 'low'
  phase: number,        // Development phase number
  assignedAgent: string,// Agent role key
  agentStatus: string,  // 'pending' | 'in-progress' | 'review' | 'complete' | 'blocked' | 'deferred'
  agentNotes: string    // Free-text notes from agent or user
}
```

### Connection

```js
{
  id: string,         // Generated ID (conn_<timestamp>_<counter>)
  sourceId: string,   // Source node ID
  sourcePort: string, // 'top' | 'right' | 'bottom' | 'left'
  targetId: string,   // Target node ID
  targetPort: string, // 'top' | 'right' | 'bottom' | 'left'
  directed: string    // 'none' | 'forward' | 'both' (arrow state)
}
```

### App State (serialized to localStorage)

```js
{
  nodes: Node[],
  connections: Connection[],
  viewport: { x: number, y: number, zoom: number }
}
```

### .mindmap File Format (saved/loaded by FileManager)

```js
{
  version: '1.1',               // Schema version
  name: string,                  // Project name
  nodes: Node[],
  connections: Connection[],
  viewport: { x, y, zoom }      // Viewport state at save time
}
```

### Serialized Mind Map (MindMapSerializer output)

```js
{
  projectName: string,
  ceoVision: string,              // CEO's high-level directive
  feature: [{ text, priority, connections }],
  constraint: [{ text, priority }],
  risk: [{ text, priority }],
  techNote: [{ text }],
  reference: [{ text }],
  dependencies: [{ from, to, directed }],
  executionOrder: [{ text, type, priority }],  // Topological sort
  stats: { totalNodes, totalConnections, featureCount, constraintCount, riskCount }
}
```

### Preset Template

```js
{
  id: string,          // Unique preset ID
  name: string,        // Display name
  category: string,    // 'mobile' | 'desktop' | 'web' | 'saas' | 'custom'
  nodes: Node[],       // Pre-positioned nodes with shapes/colors
  connections: Connection[]
}
```

## Interaction Flows

| Action              | Trigger                          | Result                                     |
| ------------------- | -------------------------------- | ------------------------------------------ |
| Create node         | Double-click canvas              | New node at click position                 |
| Create node (quick) | Drag from port to empty space    | New node + auto-connected at drop position |
| Edit node text      | Double-click node                | Inline text editor activates               |
| Move node           | Click + drag node                | Node follows cursor, connections update    |
| Select node         | Click node                       | Selection ring, property panel opens       |
| Multi-select        | Shift + click nodes              | Multiple nodes selected                    |
| Change shape        | Right-click node → Shape picker  | Node changes to selected shape             |
| Set node type       | Right-click node → Node Type     | Metadata type assigned                     |
| Set priority        | Right-click node → Priority      | Priority level assigned                    |
| Assign agent        | Right-click node → Agent         | Agent role assigned                        |
| Connect nodes       | Drag from port to port           | SVG circuit trace created                  |
| Connect (smart)     | Drag from port to node body      | Auto-detects nearest port, connects        |
| Detach connection   | Drag solder dot to empty space   | Connection deleted                         |
| Rewire connection   | Drag solder dot to another port  | Connection re-routed to new port           |
| Splice node         | Drag node over wire              | Node inserted into connection flow         |
| Add arrowhead       | Right-click wire → Add Arrow     | Forward arrowhead shows flow direction     |
| Bidirectional       | Right-click wire → Bidirectional | Arrowheads at both ends                    |
| Reverse arrow       | Right-click wire → Reverse       | Swaps source ↔ target direction            |
| Delete wire (dbl)   | Double-click connection wire     | Connection deleted                         |
| Disconnect all      | Right-click node → Disconnect    | All connections to node removed            |
| Delete              | Select + Delete key              | Remove node/connection                     |
| Pan canvas          | Space + drag / middle-click drag | Viewport translates                        |
| Zoom                | Scroll wheel                     | Viewport scales (0.1x–3x)                  |
| Undo / Redo         | Ctrl+Z / Ctrl+Y                  | State rollback/forward                     |
| Auto-save           | Debounced on state change        | State serialized to localStorage           |
| **File Operations** |                                  |                                            |
| New project         | Ctrl+N / File menu               | Clear canvas (with discard confirm)        |
| Open file           | Ctrl+O / File menu               | Load .mindmap/.json via file picker        |
| Save file           | File → Save                      | Download .mindmap file                     |
| Save As             | Ctrl+Shift+S / File menu         | Prompt name, download .mindmap             |
| Export PNG          | File → Export as PNG             | Canvas-rendered PNG download               |
| Export JSON         | File → Export as JSON            | Pretty-printed JSON download               |
| Export SVG          | File → Export as SVG             | Scalable vector graphic download           |
| Import reference    | File → Import Reference          | Convert .md/.txt/.img/.doc to mind map     |
| **AI Features**     |                                  |                                            |
| Generate mind map   | 💡 toolbar button                | AI generates nodes from a concept          |
| Export prompt       | 📋 toolbar button                | Serialize + generate workflow prompt       |
| **Templates**       |                                  |                                            |
| Open presets        | Templates toolbar button         | Preset modal with category filters         |
| Load preset         | Click preset card                | Load template onto canvas                  |
| Save as template    | Preset modal → Save button       | Save current canvas as custom preset       |

## SVG Architecture

### Connection Rendering

Each connection consists of an SVG `<g>` group containing:

1. **Hit area** (`<path>`) — invisible 14px-wide stroke for click targeting
2. **Visible path** (`<path>`) — 2px cyan stroke with glow filter, orthogonal routing
3. **Source dot** (`<circle>`) — 3.5r solder point at source, draggable for detach/rewire
4. **Target dot** (`<circle>`) — 3.5r solder point at target, draggable for detach/rewire

### Smart Routing

Connections use port-aware orthogonal routing:

1. Path extends 30px outward from each port's direction (prevents overlap with node body)
2. Intermediate segments connect the two extensions with right-angle turns
3. Routing direction is chosen based on port orientations (horizontal → vertical or vice versa)

### Wire Jump Arcs

When two unconnected wires cross, a semicircle arc (6px radius) is drawn at the crossing point:

1. Each connection stores its base path (`_basePathD`) for intersection detection
2. All connections are parsed into point arrays via `_parsePathPoints()`
3. `_findSegmentCrossings()` detects H-V / V-H segment intersections with margin checks
4. `_buildPathWithJumps()` generates the final SVG path with `A` (arc) commands at crossing points
5. Jump recalculation is batched via `requestAnimationFrame` for performance
6. Hit areas always use the base path (no arcs) for reliable click detection

### Arrowhead Markers

SVG `<marker>` definitions in `<defs>`:

**Forward markers** (`marker-end`):

- `arrowhead-cyan` — default state
- `arrowhead-magenta` — selected state

**Reverse markers** (`marker-start`):

- `arrowhead-start-cyan` — default state (reversed arrow path)
- `arrowhead-start-magenta` — selected state (reversed arrow path)

Applied based on the tri-state `directed` property:

- `'none'` — no markers
- `'forward'` — `marker-end` only
- `'both'` — `marker-end` + `marker-start`

### Node Shapes

Shapes are applied via CSS classes (`shape-<id>`) on `.mind-node` elements:

| Shape         | CSS Technique          | Notes                                  |
| ------------- | ---------------------- | -------------------------------------- |
| Rectangle     | Default                | Base `.mind-node` styles               |
| Rounded       | `border-radius: 20px`  | Color bar radius matches               |
| Pill          | `border-radius: 999px` | Full capsule shape                     |
| Diamond       | `clip-path: polygon()` | Extra padding for text, `drop-shadow`  |
| Parallelogram | `clip-path: polygon()` | Skewed shape, `drop-shadow` for border |
| Hexagon       | `clip-path: polygon()` | 6-point polygon, `drop-shadow`         |
| Circle        | `border-radius: 50%`   | `aspect-ratio: 1` forced               |

## Design Tokens

| Token              | Value                 | Usage                   |
| ------------------ | --------------------- | ----------------------- |
| `--bg-primary`     | `#06060f`             | Canvas background       |
| `--bg-surface`     | `#0d1117`             | Node surface            |
| `--accent-cyan`    | `#00e5ff`             | Connections, highlights |
| `--accent-magenta` | `#ff2d78`             | Warnings, secondary     |
| `--accent-green`   | `#00ff88`             | Success states          |
| `--text-primary`   | `#e6edf3`             | Primary text            |
| `--text-secondary` | `#7d8590`             | Muted text              |
| `--grid-line`      | `#111827`             | PCB grid lines          |
| `--glass-bg`       | `rgba(13,17,23,0.85)` | Glassmorphism panels    |

## File Structure

> **55 source files** across **20 directories** under `src/` (as of latest audit).

```
d:\AI_Dev\mindmapper\
├── index.html                           # App shell, toolbar, SVG defs, modals
├── package.json                         # Vite project config
├── vite.config.js                       # Vite dev server config
├── Orchistrator.md                      # Reference: original orchestration prompt
├── src/
│   ├── main.js                          # App entry, keyboard shortcuts, state orchestration (~870 LOC)
│   ├── core/
│   │   ├── EventBus.js                  # Pub/sub for decoupled communication
│   │   ├── History.js                   # Undo/redo with deep-clone snapshots
│   │   └── Sanitize.js                  # escapeHtml, sanitizeHtml, escapeAttr
│   ├── viewport/
│   │   └── Viewport.js                  # Pan, zoom, grid, coordinate transforms
│   ├── nodes/
│   │   └── NodeManager.js               # Create, edit, drag, select, delete + metadata + agent roles
│   ├── connections/
│   │   └── ConnectionManager.js         # SVG circuit traces, smart routing, arrowheads, jump arcs
│   ├── ai/
│   │   ├── IdeaGenerator.js             # Multi-provider LLM: concept → mind map nodes
│   │   └── ModelTierConfig.js           # Tiered model routing strategy definition
│   ├── agents/
│   │   ├── index.js                     # Agent framework barrel export
│   │   ├── AgentBase.js                 # Base class for all agent roles
│   │   ├── AgentRegistry.js             # Role registry (13 AI + 1 human CEO)
│   │   ├── COOAgent.js                  # COO planning & coordination agent
│   │   ├── SpecialistAgents.js          # CTO, CFO, DevOps, QA, etc.
│   │   ├── ExecutionEngine.js           # Round-based multi-agent execution (wraps OrchestrationEngine)
│   │   ├── ContextManager.js            # Shared context across agent rounds
│   │   ├── CostTracker.js               # Per-session and cumulative cost tracking
│   │   ├── MessageBus.js                # Inter-agent message passing
│   │   └── prompts/
│   │       └── AgentPrompts.js          # Agent-specific system prompts
│   ├── export/
│   │   ├── MindMapSerializer.js         # Canvas → structured data extraction
│   │   └── WorkflowPromptGenerator.js   # Structured data → agent orchestration prompt
│   ├── orchestration/
│   │   ├── OrchestrationEngine.js       # Session lifecycle: state machine, bridge selection, persistence
│   │   ├── BrowserAgentBridge.js        # Browser-mode: direct AI API streaming (Anthropic/OpenAI)
│   │   ├── ClaudeCodeBridge.js          # Desktop-mode: Claude Code CLI via Tauri shell
│   │   ├── EnvironmentDetector.js       # Tauri vs. browser environment detection
│   │   └── SessionStore.js              # Session persistence to localStorage/Firestore
│   ├── prompts/
│   │   └── ReportPrompts.js             # CEO report prompt templates + map summarizer
│   ├── security/
│   │   └── CredentialVault.js           # AES-GCM encrypted API key storage
│   ├── validation/
│   │   └── MindMapValidator.js          # Mind map readiness checks
│   ├── integrations/
│   │   ├── ConnectionTester.js          # API connection health checks
│   │   └── MCPConfigGenerator.js        # MCP server configuration generator
│   ├── settings/
│   │   └── WorkspaceSettings.js         # User workspace preferences
│   ├── firebase/
│   │   ├── config.js                    # Firebase SDK initialization + emulator support
│   │   ├── auth.js                      # Google Sign-In + session management
│   │   ├── firestore.js                 # Firestore CRUD operations
│   │   ├── listeners.js                 # Real-time onSnapshot listeners
│   │   ├── migration.js                 # localStorage → Firestore migration
│   │   └── gateway.js                   # LLM Gateway client adapter
│   ├── ui/
│   │   ├── ContextMenu.js               # Right-click menus (canvas/node/connection)
│   │   ├── PropertyPanel.js             # Node property editor panel
│   │   ├── MiniMap.js                   # Overview minimap with click-to-navigate
│   │   ├── FileMenu.js                  # File dropdown menu + keyboard shortcuts
│   │   ├── PresetModal.js               # Template picker modal with previews
│   │   ├── AgentPanel.js                # Collapsible agent conversation sidebar (~1200 LOC)
│   │   ├── AgentStatusDisplay.js        # Agent roster readout panel
│   │   ├── CommerceNodeConfig.js        # Commerce credential configuration UI
│   │   ├── IdeaInputModal.js            # AI idea generation modal (concept input + provider select)
│   │   └── PromptExportModal.js         # Workflow prompt preview, copy, download
│   ├── storage/
│   │   ├── Storage.js                   # localStorage adapter with debounced auto-save
│   │   └── FileManager.js              # File I/O: new/open/save/export/import
│   ├── import/
│   │   └── ReferenceImporter.js         # Convert .md/.txt/.img/.doc → mind map nodes (placeholder)
│   ├── presets/
│   │   ├── PresetManager.js             # Built-in + custom preset management
│   │   └── builtinPresets.js            # 6 project template definitions
│   └── styles/
│       └── main.css                     # Complete design system (PCB/circuit board theme)
└── docs/
    ├── architecture.md                  # This file — system architecture
    ├── audit-report.md                  # Deep code audit findings
    ├── changelog.md                     # Feature changelog
    ├── implementation_plan.md           # Phase 1 implementation plan
    ├── phase3_plan.md                   # Phase 3 detailed plan
    ├── Jinn_mindmapper-RoadMap..md      # Jinn-specific roadmap items
    ├── MASTER_TASK_LIST.md              # Comprehensive task tracker
    └── tech-journal.md                  # Chronological decision log
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
