# MindMapper — Tech Journal

Chronological log of design decisions, trade-offs, and resolutions.

---

## 2026-02-09 — Agent Roster Alignment

### Decision: Merge Creative Director into Frontend UI/UX

**Context**: The codebase had two separate agents — Creative Director (design authority: visual system, typography, branding) and Frontend Developer (implementation: code, components, responsive). In practice, separating "design" from "implementation" created coordination overhead and blurred ownership. When a task like "build a login page" arrived, it was unclear whether it was a design task (Creative Director) or an implementation task (Frontend) — and the handoff between them was a redundant hop.
**Decision**: Merge the Creative Director role into the Frontend agent, creating a single **Frontend UI/UX** agent that owns both design authority and implementation.
**Rationale**: In real teams, "design-implement" handoffs are the #1 source of fidelity loss. A merged role ensures the agent who designs the visual system is the same agent who implements it — no translation layer, no lost nuance. The merged agent still has dedicated design prompts (color palette, font stack, spacing scale, motion specs) but can also produce code in the same turn.
**Trade-off**: A single agent covering both design and code may produce less specialized output than two dedicated agents. Acceptable because: (a) the prompt still explicitly includes both design and implementation instructions, and (b) the tier (standard) gives enough reasoning capacity for both concerns.
**Alternative rejected**: Keeping Creative Director as a separate "advisory" role. This was rejected because advisory-only agents add tokens without clear accountability — their recommendations could be ignored by the Frontend agent with no feedback loop.

### Decision: CEO is human, not an AI agent

**Context**: The `DEFAULT_TIER_MAP` in `AgentBase.js` included a `'ceo': 'opus'` entry, implying the CEO was an AI agent. In reality, the CEO is always the human user — the person sitting at the keyboard making decisions.
**Decision**: Remove `ceo` from the tier map and all AI agent configurations. The CEO exists only as a label in the reporting hierarchy (the top of the org chart), not as an executable agent.
**Rationale**: An AI "CEO" has no authority to make product decisions — that's the human's job. Keeping a CEO agent entry creates confusion about who approves milestones and makes strategic calls. By explicitly excluding CEO from AI agent config, the system correctly models the human-in-the-loop architecture.

### Decision: Formalize `reportsTo` in code (not just prompt metadata)

**Context**: Reporting lines existed as prompt-level metadata (`reports_to` in `WorkflowPromptGenerator`), but the actual agent classes (`AgentBase`, `SpecialistAgents`) had no `reportsTo` property. The `AgentRegistry.ROLE_CONFIG` had `reportsTo` for routing, but SpecialistAgents didn't expose it.
**Decision**: Add a `reportsTo` getter to `AgentBase` (returns `null` by default), override it in specific specialist agents (`TokenAuditorAgent → 'cfo'`, `ApiCostAuditorAgent → 'cfo'`, `ProjectAuditorAgent → 'coo'`), and fix a bug where `ProjectAuditor.reportsTo` was incorrectly set to `'cfo'` in `AgentRegistry`.
**Rationale**: Having `reportsTo` in both the prompt layer AND the code layer ensures consistency. The code-level property enables future features like automatic report routing in `MessageBus` and hierarchical status displays in the UI. The prompt-level metadata tells the executing agent about the hierarchy; the code-level property tells our orchestration engine.
**Bug fixed**: `AgentRegistry.ROLE_CONFIG['project-auditor'].reportsTo` was `'cfo'` but should be `'coo'` — the Project Auditor reports operational findings to the COO, not financial findings to the CFO.

---

## 2026-02-08 — Agent Organizational Structure & Communication Protocol

### Decision: Formal org chart metadata on every agent role

**Context**: The virtual team had 10+ agent roles, but no explicit reporting lines. Agents knew their responsibilities but not who they reported to or who reported to them. Communication was implied, not structured.
**Decision**: Add `reports_to`, `receives_reports_from`, `distributes_to`, and `reporting_mandate` metadata to every agent role definition in `WorkflowPromptGenerator.js`.
**Rationale**: Explicit reporting lines create accountability. When Devil's Advocate finds a quality issue, the prompt now explicitly says "report to COO" — and the COO's role explicitly says "receive DA findings and create agent-specific task lists." This bidirectional wiring ensures the executing agent (Claude Code) doesn't silently drop quality feedback.
**Trade-off**: More metadata in the generated prompt means more tokens consumed. Acceptable because the reporting structure is essential context that directly affects output quality.

### Decision: Replace Research Agent with Deep Researcher / Knowledge Architect

**Context**: The original Research Agent was a lightweight "quick question" role — "should we use library X or Y?" It ran reactively when agents hit blocks, and its output was verbal/inline (not persisted).
**Decision**: Replace with a Deep Researcher who front-loads knowledge before each milestone, produces structured reference docs in `/docs/knowledge/`, and routes agent-specific documentation packages to each team member.
**Rationale**: AI agents work from training data, which is inherently stale. A Deep Researcher that reads current API docs, changelogs, and migration guides gives the team an "unfair advantage" — they're working from current, verified information, not stale assumptions. Front-loaded research prevents the most expensive kind of rework: building on incorrect assumptions about an API's behavior.
**Key innovation**: The "distribution mandate" — Deep Researcher doesn't just publish to a folder, they actively route specific docs to specific agents. Frontend gets UI framework docs, backend gets API docs, DevOps gets infrastructure docs. Each agent becomes an expert in their specific task.

### Decision: Executive suite retrospective debate (not top-down mandates)

**Context**: The Project Auditor needed a reporting target for retrospective findings. Options: report to COO only, report to CTO only, or report to the full executive suite.
**Decision**: Project Auditor presents findings to ALL THREE executives (COO + CTO + CFO) simultaneously. They debate in the open — COO evaluates operational impact, CTO evaluates technical implications, CFO evaluates cost impact. Together they decide which suggestions are strongest.
**Rationale**: Top-down mandates from a single executive create blind spots. The COO might implement a process change that the CTO knows is technically infeasible. The CTO might propose a technical improvement that the CFO knows is cost-prohibitive. Three-way debate surfaces conflicts BEFORE they become problems. This mirrors real executive team dynamics where cross-functional decisions require multi-perspective input.
**Alternative rejected**: Having Project Auditor report only to COO. This would miss the CTO's technical perspective and the CFO's cost perspective on improvement proposals.

### Decision: Devil's Advocate as active quality champion (not passive reviewer)

**Context**: The original Devil's Advocate ran "after milestones" — a post-hoc review. Quality issues were found late and required expensive rework.
**Decision**: Expand DA to actively challenge methods AND results throughout the build cycle. DA observes during Active Build, raises concerns in real-time, and produces structured quality findings that flow to COO → agent-specific task lists.
**Rationale**: The DA → COO → Agent pipeline ensures no quality finding is lost. The COO acts as a dispatcher, routing each finding to the specific agent responsible. This is more effective than a "general quality report" that no one agent owns. Additionally, challenging METHODS (not just results) catches architectural mistakes early — before they're baked into the codebase.
**Quality bar**: The DA's mandate now explicitly says: "If something is 'good enough', ask: 'How do we make it great?'" This pushes the quality ceiling higher than simple defect detection.

### Decision: CFO as creative cost optimizer (not just budget tracker)

**Context**: The original CFO tracked costs and flagged overruns. This is reactive — by the time you flag an overrun, the money is already spent.
**Decision**: Reframe CFO as a creative strategist whose philosophy is "High quality, low cost — always. These are NOT opposing forces." Embed specific cost reduction strategies (batching, caching, pattern reuse, front-loaded research, right-sized tiers) as first-class instructions.
**Rationale**: The best cost optimization is not cutting corners — it's finding cleverer ways to achieve the same quality. A CFO who proposes "skip testing to save tokens" is bad. A CFO who proposes "reuse the component pattern from milestone 1 instead of designing from scratch" is invaluable. The embedded strategies give the executing agent concrete tactics rather than abstract "reduce costs" directives.
**Reporting chain**: CFO → CTO ensures cost optimizations are validated for technical soundness before implementation. This prevents the scenario where cost cuts silently degrade quality.

### Decision: Mandatory inter-agent communication during Active Build

**Context**: In earlier versions, agents worked independently during the Build phase and only communicated at review checkpoints. This created "silent handoff" problems — the backend agent would change an API signature, and the frontend agent wouldn't know until the review revealed a mismatch.
**Decision**: Mandate continuous inter-agent communication during Active Build. "Backend changes API? Frontend hears immediately." Agents must actively coordinate, share decisions, and flag dependencies in real-time.
**Rationale**: Real-time communication is cheaper than rework. If the backend agent decides to change an endpoint signature and communicates it immediately, the frontend agent adapts in-flight (cheap). If the frontend agent builds against the old signature and discovers the mismatch at review, they have to rewrite components (expensive). Key inter-agent discussions are tracked in `/docs/conversations.md`.
**Trade-off**: More "conversation" tokens spent during the build phase. This is a net positive investment — the rework prevention far exceeds the communication cost.

### Decision: 5-step milestone workflow (added Retrospective)

**Context**: The previous 4-step workflow was: Kickoff → Build → Review → Sign-off. There was no structured mechanism for the team to learn from each milestone and improve the process for the next one.
**Decision**: Add a 5th step: RETROSPECTIVE. After sign-off, the Project Auditor reviews milestone performance, and the executive suite debates improvements.
**Rationale**: Without retrospectives, the team repeats the same mistakes across milestones. With retrospectives, each milestone actively improves on the previous one. The output of the retrospective is not just a document — it's concrete changes to the next milestone's approach, tasks, and targets. This creates a compounding quality improvement curve.

---

## 2026-02-07 — Project Kickoff & Architecture Decisions

### Decision: Vite + Vanilla JS over React/Vue

**Context**: Need a node-based mind mapping UI. Considered React, Vue, Svelte, and vanilla JS.
**Decision**: Vanilla ES6 modules with Vite bundler.
**Rationale**:

- No framework overhead — direct DOM control is critical for drag/drop, SVG manipulation, and canvas transforms
- Vite provides fast HMR without framework lock-in
- Simpler mental model for custom interaction-heavy UI
- Easy to add a framework later if complexity demands it

**Trade-off**: No component lifecycle management, need to manually handle DOM cleanup

### Decision: DOM Nodes + SVG Connections (Hybrid Rendering)

**Context**: Could use Canvas2D, full SVG, or DOM elements for rendering.
**Decision**: DOM elements for nodes, SVG for connection traces.
**Rationale**:

- DOM nodes are easier to style (CSS), interact with (events), and make accessible
- SVG paths are ideal for circuit-trace connections (bezier/polyline paths, glow filters)
- Canvas2D would be faster at scale but harder to style and interact with

**Trade-off**: Performance ceiling ~500 nodes (sufficient for Phase 1)

### Decision: Circuit Board (PCB) Aesthetic

**Context**: User requested "connects idea flows like a circuit board."
**Decision**: Dark mode PCB theme with neon accents, orthogonal connection routing, solder-point endpoints, grid background.
**Rationale**: Directly maps to the circuit board metaphor. Dark backgrounds with neon traces create a striking visual identity.
**References**: [PCB design tools](https://www.kicad.org/), [circuit board aesthetics in UI](https://dribbble.com/search/circuit-board-ui)

### Decision: localStorage for Phase 1 Persistence

**Context**: Orchestrator specifies Firebase backend, but Phase 1 is frontend-focused.
**Decision**: Use localStorage with a clean Storage interface that can be swapped to Firebase in Phase 2.
**Rationale**: Zero setup, instant feedback, no auth complexity. The Storage module exports the same API regardless of backend.
**Trade-off**: No cross-device sync, 5–10MB storage limit, single user only

### Decision: EventBus for Component Communication

**Context**: Multiple independent modules (nodes, connections, toolbar, minimap) need to communicate.
**Decision**: Central pub/sub EventBus.
**Rationale**: Decouples all modules. Any module can subscribe to events without direct imports. Simplifies testing and future refactoring.
**Alternative rejected**: Direct method calls between modules — creates tight coupling and circular dependencies.

---

## 2026-02-07 — QoL: Drag-to-Create & Detach/Rewire

### Decision: Auto-create node on port drag to empty space

**Context**: User needs a fast way to build idea flows without separate create + connect steps.
**Decision**: When dragging from a port and releasing on empty canvas space, automatically create a new node at the drop position and connect it to the source.
**Rationale**: This is the fastest way to build linear idea flows — just keep dragging from ports. The new node's port is automatically the opposite direction (e.g. drag from `right` → new node's `left` port connects).

### Decision: Drag solder dots to detach/rewire

**Context**: User wants to break connections by "detaching" without right-click menus.
**Decision**: Make solder dots (connection endpoints) draggable. Drag to empty space = break connection. Drag to another port = rewire.
**Rationale**: Direct manipulation is more intuitive than menus for spatial actions. Solder dots already visually indicate connection endpoints, so making them draggable is natural.
**Visual cue**: Dots now glow and scale on hover with a `grab` cursor.

### Decision: Smart port auto-detection

**Context**: Requiring exact port targeting (tiny 10px dots) was frustrating during connections.
**Decision**: When dropping on a node body (not directly on a port), auto-detect the best port based on the relative position of the source node.
**Algorithm**: Compare node center positions. If the source is to the right of the target, use target's `right` port (facing the source). Same logic for all 4 directions.

### Decision: Pointer-events layering fix

**Context**: The `.nodes-layer` div was sitting on top of the SVG connections, intercepting all mouse events. Double-click on wires was creating nodes instead of deleting wires.
**Decision**: Set `pointer-events: none` on .nodes-layer, `pointer-events: auto` on individual .mind-node, and `pointer-events: stroke` / `pointer-events: all` on SVG hit areas / solder dots.
**Rationale**: This allows clicks on empty areas to pass through the DOM layer to the SVG connections below, while nodes still capture their own events.
**Key learning**: SVG and DOM layers in the same container require explicit pointer-events layering to avoid event interception.

---

## 2026-02-07 — Smart Routing & Arrowheads

### Decision: Port-aware orthogonal routing

**Context**: The original routing algorithm used a simple midpoint turn. Traces would overlap with node bodies when connecting ports on the same side.
**Decision**: New `_computeSmartPath()` that extends 30px outward from each port's direction before making orthogonal turns.
**Rationale**: Extending from ports before turning prevents traces from cutting through nodes. The 30px offset creates clean, readable circuit-board-style routing.
**Segments**: Port → Extension (30px outward) → Elbow turns → Extension (30px outward) → Port

### Decision: Optional arrowheads for flow direction

**Context**: User wants to indicate idea flow direction on connections.
**Decision**: Add a `directed` boolean property to connections. When `true`, an SVG arrowhead marker appears at the target end.
**Implementation**:

- SVG `<marker>` defs in index.html for both cyan and magenta arrowheads
- `marker-end` attribute applied/removed on the connection path
- Color switches to magenta when connection is selected
- `directed` persisted in localStorage via serialize/deserialize
- Right-click context menu on wires: Add Arrow / Remove Arrow / Reverse Direction / Delete
  **Rationale**: Optional arrows keep the default clean (undirected mind map) while allowing flow-chart-style directed connections when the user needs them.

---

## 2026-02-07 — Splice Node into Wire

### Decision: Drag-to-splice interaction pattern

**Context**: Inserting a node into an existing flow required deleting the original connection, creating two new ones. Very tedious.
**Decision**: Drag a node over a wire and drop it — the system automatically splices the node into the connection, creating two new connections through the spliced node.
**Rationale**: This is the natural intent when a user drags a node onto a wire. It mirrors hardware PCB editing workflows.
**Implementation**:

- `NodeManager._onDragMove()` calls `ConnectionManager.highlightSpliceTarget()` during drag
- `NodeManager._onDragEnd()` calls `ConnectionManager.spliceNodeIntoConnection()` on drop
- Cross-reference established via `nodeManager.setConnectionManager(cm)` in main.js
- Original connection is deleted, two new connections created preserving arrowhead state
- Best ports selected based on wire direction

---

## 2026-02-07 — Wire Jump Arcs

### Decision: PCB-style crossing arcs

**Context**: When wires cross each other, it's unclear whether they're connected or simply overlapping.
**Decision**: Draw 6px-radius semicircle arcs at crossing points, PCB-style. One wire "jumps" over the other.
**Rationale**: This is the standard visual convention in circuit board design and flowcharting tools. It immediately communicates that the wires are independent paths.
**Implementation**:

- `_parsePathPoints()` extracts M/L coordinates from SVG path strings
- `_findSegmentCrossings()` detects H-V/V-H intersections between two sets of segments
- `_buildPathWithJumps()` replaces straight line segments with arc detours at crossing points
- Batched via `requestAnimationFrame` to avoid per-render recalculation
- Hit areas use base path (no arcs) for reliable `isPointInStroke()` detection

### Bug: Perpendicular margin check was impossible

**Problem**: The crossing detection margin check required `iy > aMinY + R AND iy < aMaxY - R` for ALL segments — but horizontal segments have `aMinY == aMaxY`, making this always false.
**Fix**: Margin checks now only apply along the segment's _length_ axis. The perpendicular axis uses an exact-match tolerance (±0.5px).

### Bug: Shared-node skip was too aggressive

**Problem**: The initial logic skipped jump detection between any wires sharing a common node. In a tree layout, almost all connections share a parent node, so zero jumps were rendered.
**Fix**: Removed the shared-node skip entirely. The margin checks already prevent false crossings at shared port origins.

---

## 2026-02-07 — Bidirectional Arrows

### Decision: Tri-state directed property

**Context**: User requested bidirectional arrows for flows that go both ways.
**Decision**: Changed `directed` from boolean to tri-state string: `'none'` → `'forward'` → `'both'`.
**Rationale**: Tri-state cleanly represents all three arrow configurations without breaking backward compatibility. Old `true`/`false` values map to `'forward'`/`'none'`.
**Implementation**:

- New SVG `<marker>` defs with reversed arrow paths (`refX=1`, mirrored diamond shape)
- `_applyArrow()` handles both `marker-end` and `marker-start` application
- Context menu shows state-appropriate options (not a single toggle)
- `toggleArrow()` cycles through all three states

---

## 2026-02-07 — Node Shape System

### Decision: CSS-based shape rendering with clip-path

**Context**: User wants flowchart-style semantic shapes (diamond for decisions, etc.).
**Decision**: 7 shapes applied via CSS classes on `.mind-node`, using `border-radius` for simple curves and `clip-path: polygon()` for complex shapes.
**Rationale**: CSS-only approach requires no SVG rework for nodes. Shapes are purely visual — the underlying DOM box model, port positions, and interaction logic remain unchanged.
**Trade-off**: `clip-path` clips CSS `border` and `box-shadow`, so clipped shapes use `filter: drop-shadow()` for border/glow effects instead. This works because `drop-shadow` follows the clip-path contour.
**Shapes**:

| Shape         | Meaning         | CSS Technique               |
| ------------- | --------------- | --------------------------- |
| Rectangle     | Process / Task  | Default (no overrides)      |
| Rounded       | Start / End     | `border-radius: 20px`       |
| Pill          | Terminal        | `border-radius: 999px`      |
| Diamond       | Decision        | `clip-path` + extra padding |
| Parallelogram | Input / Output  | `clip-path` (skewed)        |
| Hexagon       | Preparation     | `clip-path` (6-point)       |
| Circle        | Event / Trigger | `border-radius: 50%`        |

---

## 2026-02-07 — File Management System

### Decision: .mindmap file format

**Context**: Need a custom save/load format that preserves the full project state.
**Decision**: JSON files with `.mindmap` extension containing `{ version, name, nodes, connections, viewport }`.
**Rationale**: JSON is human-readable, easily extensible, and natively supported in browsers. The `version` field enables forward-compatible schema migrations. Viewport state (pan/zoom position) is preserved so the user comes back to exactly where they left off.
**Trade-off**: No binary compression — large projects may produce bigger files. Acceptable for Phase 2 scope.

### Decision: SVG path translation for exports

**Context**: PNG and SVG exports need to re-position all connection paths relative to the export bounding box (normalizing to 0,0 origin). The original `_translatePath` only handled `M` and `L` commands.
**Decision**: Built a full SVG path command tokenizer that handles all absolute commands (M, L, H, V, C, S, Q, T, A) and passes relative commands through unchanged.
**Rationale**: The wire jump arc system generates `A` (arc) commands at crossing points. Without proper arc handling, exports would have broken connection paths. The tokenizer approach is more robust than regex replacement.
**Key detail**: Arc commands (`A rx ry rotation large-arc sweep x y`) have 7 parameters but only the last 2 (x, y) are coordinates that need translation.

### Decision: Export rendered paths (not base paths) by default

**Context**: Each connection has both a `_basePathD` (clean straight segments) and a rendered path on `pathEl` (which may include jump arcs).
**Decision**: PNG and SVG export prefer `pathEl.getAttribute('d')` (rendered path), falling back to `_basePathD`.
**Rationale**: Users expect the export to match what they see on screen, including the PCB-style jump arcs at wire crossings. Exporting base paths would produce a different visual than the canvas.

### Decision: Ctrl+S = localStorage auto-save only (not file download)

**Context**: Ctrl+S could trigger a file download (save to disk) or just the localStorage auto-save (save in browser).
**Decision**: Ctrl+S only triggers localStorage auto-save. File download (Save) is accessed through the File menu.
**Rationale**: Triggering a browser file download on every Ctrl+S is disruptive — the user gets a download dialog/toast on every save. Auto-save to localStorage is instant and silent, which is the expected UX for a web app. Downloads are intentional actions from the File menu.

---

## 2026-02-07 — Reference File Import

### Decision: Auto-layout algorithm for imported hierarchies

**Context**: Imported markdown/text files produce hierarchical tree data that needs spatial positioning.
**Decision**: Reingold-Tilford-style tree layout with configurable horizontal gap (200px) and vertical gap (80px).
**Rationale**: Reingold-Tilford produces compact, readable tree layouts that minimize wasted space and crossing edges. The algorithm is simple to implement (first-pass assigns positions, second-pass shifts subtrees to avoid overlap).
**Enhancement**: Nodes are color-coded by depth level (root=cyan, L1=magenta, L2=green, L3=orange, L4+=purple) and shape-coded (root=rounded, L1=rectangle, L2=diamond, L3+=circle) for visual hierarchy.

### Decision: Best-effort document import

**Context**: `.doc` and `.docx` files have complex binary formats. Full parsing requires libraries like `mammoth.js` or `docx`.
**Decision**: Attempt basic text extraction from the raw file content. If extraction yields minimal text (<50 chars), fall back to creating a reference node with file metadata.
**Rationale**: Adding a full docx parsing library would increase bundle size significantly for a feature with limited ROI. The fallback ensures the user always gets something useful. Better docx support can be added later if demand exists.

---

## 2026-02-07 — Project Template Presets

### Decision: Built-in vs custom preset architecture

**Context**: Users want quick-start templates, but also the ability to save their own layouts.
**Decision**: Separate built-in presets (hardcoded in `builtinPresets.js`) from custom presets (stored in `localStorage` under a distinct key).
**Rationale**: Built-in presets are always available and don't clutter the user's storage. Custom presets survive canvas clears and project changes because they use a separate localStorage key from the main project state. Users can delete custom presets but not built-in ones.

### Decision: File menu dropdown (not ribbon or menu bar)

**Context**: The toolbar already has a horizontal button layout. Need to add 10+ file operations without cluttering the toolbar.
**Decision**: Single "File" dropdown button that opens a glassmorphism dropdown panel with categorized items, icons, and keyboard shortcut hints.
**Rationale**: Consistent with modern desktop-style UX (VS Code, Figma). The dropdown is compact, discoverable, and doesn't consume toolbar space. Section headers and dividers organize the items logically. Keyboard shortcuts are displayed but not the primary interaction path.

---

## 2026-02-07 — Phase 3 Architecture Planning

### Decision: Three-layer architecture (Client → Firebase → Agent Runtime)

**Context**: Phase 3 transforms MindMapper into a multi-agent orchestration platform. Need to decide where agents run and how the system scales.
**Decision**: Three distinct layers — the existing browser client, a Firebase backend (Auth + Firestore + Cloud Functions), and an agent runtime that executes within Cloud Functions.
**Rationale**: Firebase provides real-time listeners (Firestore `onSnapshot`) for live agent message streaming, managed auth, and serverless compute. Cloud Functions can call LLM APIs without exposing API keys to the client. The existing vanilla JS client stays lightweight — it just listens to Firestore for updates. No WebSocket server to manage.
**Trade-off**: Cloud Functions have cold start latency (~2-5s). Mitigated by keep-alive pings and batched execution. If latency becomes unacceptable, migration to Cloud Run is straightforward.

### Decision: Agent communication via Firestore documents (not WebSockets or queues)

**Context**: 13 agents need to pass messages to each other, and the CEO (browser client) needs to see messages in real-time.
**Decision**: Each `AgentMessage` is a Firestore document in `/projects/{id}/messages/`. The client uses `onSnapshot()` for real-time updates. Agents write messages via Cloud Functions.
**Rationale**: Firestore real-time listeners are built-in, require no additional infrastructure, and automatically handle reconnection. Messages are persisted and queryable (filter by agent, round, phase). The CEO can leave and return — all messages are durable. The `onSnapshot` pattern is simpler than managing WebSocket connections.
**Trade-off**: Firestore reads cost money at scale. Mitigated by pagination, client-side caching, and batched queries. For the expected volume (~50-200 messages per planning cycle), costs are negligible.

### Decision: Multi-model LLM routing (not single-provider)

**Context**: Different agent tasks have different quality/cost tradeoffs. Using GPT-4 everywhere is expensive; using Haiku everywhere sacrifices quality on hard tasks.
**Decision**: LLM Gateway in Cloud Functions routes tasks to different models based on a routing table: Tier 1 (heavy/expensive) for architecture and security, Tier 2 (medium) for implementation plans and reviews, Tier 3 (light/cheap) for summaries and formatting.
**Rationale**: A 20-node mind map planning cycle costs ~$5 with smart routing vs. ~$25 with all-Tier-1. The CFO agent defines routing rules, and the gateway enforces them. Model selection is table-driven, so adding new models is a config change, not a code change.
**Key insight**: The CFO agent itself runs at Tier 2 — it doesn't need expensive models to decide model routing. Token Auditor and API Cost Auditor run at Tier 3.

### Decision: Sentinel agent with veto power (not advisory-only)

**Context**: The system processes user-provided mind map content and generates outputs via LLM APIs. Need to defend against prompt injection and data leaks.
**Decision**: The Sentinel agent scans all CEO input before it reaches other agents, and scans all agent outputs before they're stored. It has veto power — it can block messages.
**Rationale**: Advisory-only security is security theater. If Sentinel flags an issue but can't stop it, the system is still vulnerable. Veto power means the system fails safely. Blocked messages are shown to the CEO with an explanation, so there's transparency.
**Trade-off**: False positives could block legitimate content. Mitigated by tuning the scanner's sensitivity and allowing CEO override for flagged (but not blocked) content.

### Decision: Agent Panel as collapsible sidebar (not modal or separate page)

**Context**: The CEO needs to see both the mind map canvas and the agent conversation simultaneously.
**Decision**: Collapsible right-side sidebar with drag-to-resize. Shows agent conversation thread, approval buttons, and cost dashboard. The mind map canvas resizes to accommodate the panel.
**Rationale**: Side-by-side layout keeps the CEO in context — they can see a node on the canvas and its related agent discussion at the same time. Collapsing the panel gives full canvas width when agents aren't running. This matches the VS Code / Figma pattern of inspectors panels.
**Alternative rejected**: Separate page/tab for agent conversation — breaks the spatial connection between mind map nodes and their agent discussions.

### Decision: Progressive sub-phase ordering for testability

**Context**: Phase 3 has 7 sub-phases. Need to order them so each is independently testable and the system is usable as early as possible.
**Decision**: Foundation → Agent Framework → Node Metadata → COO + UI → Specialist Agents → Review Layer → Full Loop. After Phase 3.3, the CEO can already run one agent (COO) and see results. Each subsequent phase adds more agents.
**Rationale**: "Demo after 3.3" means the system shows value within ~6 weeks instead of waiting 14+ weeks for everything. Progressive deployment also means bugs are caught in simpler contexts before the full 13-agent orchestra runs.

---

## 2026-02-07 — AI Idea Generation (Multi-Provider)

### Decision: Multi-provider LLM with efficient defaults

**Context**: Mind map generation from a text concept requires an LLM call. Different providers have different cost/quality profiles.
**Decision**: Support Google Gemini, OpenAI GPT, and Anthropic Claude. Default each provider to its most efficient model (Flash Lite, GPT-4o-mini, Haiku).
**Rationale**: Mind map generation is a structured output task — it doesn't require deep reasoning or extended thinking. The cheapest models handle it well. Premium models remain available as optional upgrades for users who prefer them.
**Key insight**: This is a "mechanical" task — the user provides a concept, and the model outputs structured JSON nodes. Quality differences between model tiers are minimal for this specific use case.

### Decision: Provider names without cost/tier labels

**Context**: Initial implementation labeled providers as "Google (Cheapest)" and included `tier` and `costNote` metadata in provider configs.
**Decision**: Removed all cost/tier language from provider names and configs. "Google (Cheapest)" → "Google". Removed `tier`, `costNote` properties.
**Rationale**: The intelligence hierarchy should be invisible to the end user. The user selects a provider and model — they don't need to know about internal cost optimization strategies. Clean labels also avoid the negative perception of "cheapest" implying lower quality.

---

## 2026-02-07 — Tiered Model Routing Strategy

### Decision: Three-tier routing embedded in generated prompts

**Context**: Different agent tasks within a build cycle have wildly different complexity. Using the most capable model for everything wastes money; using the cheapest model for everything sacrifices quality on hard tasks.
**Decision**: Define three processing levels in `ModelTierConfig.js` — Efficient (mechanical), Standard (analytical), Deep-Reasoning (architecture/security). Embed the strategy in the generated prompt JSON for the executing agent (Claude Code) to follow.
**Rationale**: A tiered strategy optimizes cost-to-quality ratio per task. The orchestrating agent reads the embedded `model_routing` section and routes each sub-task to the appropriate level. This is a prompt-level instruction, not a runtime enforcement — the executing agent chooses how to apply it.
**Philosophy**: "Never bring a bazooka to a pillow fight."
**Trade-off**: No runtime enforcement — the executing agent may ignore the routing hints. This is acceptable because the hints are advisory, and the executing agent has the best context on actual task complexity.

### Decision: Underscore-prefixed routing metadata (`_routing`, `_rationale`)

**Context**: The previous implementation used `model_tier`, `model_tier_note`, and `tier_rationale` as field names on virtual team members and milestones. These labels were descriptive but drew attention to the tiering strategy in the generated JSON.
**Decision**: Rename to `_routing` and `_rationale` with leading underscores. This follows the convention of marking internal/private fields in JSON.
**Rationale**: The underscore prefix signals to anyone reading the raw JSON (including the executing agent) that these are internal metadata, not user-facing instructions. It also makes the JSON preview in the PromptExportModal cleaner — the routing fields exist but don't dominate the visual hierarchy of the prompt.
**Alternative considered**: Stripping routing metadata from the output entirely and re-injecting it at execution time. Rejected because the generated prompt should be self-contained — a user should be able to copy-paste it and have it work without any additional wrapping.

---

## 2026-02-07 — 10-Role Virtual Team

### Decision: Expand from 5 to 10 virtual agent roles

**Context**: The original Orchestrator.md prompt defined 5 roles: Orchestrator, Front-End, Backend, Research, Devil's Advocate. The `AGENT_ROLES` constant in `NodeManager.js` defined 13 role keys. The mind map enrichment system allowed assigning nodes to roles that didn't exist in the generated prompt.
**Decision**: Expand `_buildVirtualTeam()` to 10 roles: Orchestrator (COO), CTO, Creative Director (Art Department), Front-End, Backend, Sentinel (Security), Research, Documenter, Devil's Advocate, Auditors (Token + API Cost + Project).
**Rationale**: The original 5-role prompt was missing critical functions:

- **CTO**: Architecture decisions were split between Orchestrator and Devil's Advocate. A dedicated CTO role provides clearer ownership of technical strategy.
- **Creative Director / Art Department**: No role owned visual identity, branding, or design systems. UI would be implemented without a coherent visual strategy.
- **Sentinel**: Security was lumped into Devil's Advocate. Dedicated security specialist can run parallel threat modeling without slowing down QA review.
- **Documenter**: Documentation was split across Research Agent and ad-hoc responsibilities. Dedicated ownership ensures docs are maintained, not afterthoughts.
- **Auditors**: Token/cost tracking and project health monitoring were not represented. Auditors provide operational efficiency feedback.

### Decision: Creative Director auto-detects design features from mind map

**Context**: The Creative Director role is most valuable when the project has explicit design/branding features.
**Decision**: `_buildVirtualTeam()` scans the feature list for design-related keywords (design, brand, style, theme, color, font, icon, logo, visual, UX, aesthetic, dark mode). Matching features are attached as `priority_features` on the Creative Director role.
**Rationale**: This makes the generated prompt context-aware. A project with no design features still gets a Creative Director (visual identity is always relevant), but a project with explicit design features gives the Creative Director concrete priorities to address first.

### Decision: Auditors as a single composite role (not 3 separate roles)

**Context**: `AGENT_ROLES` defines Token Auditor, API Cost Auditor, and Project Auditor as separate roles. Could generate 3 separate team members.
**Decision**: Combine into a single `auditors` role with a `sub_roles` map.
**Rationale**: These three functions are closely related (all about monitoring/efficiency) and run at the same processing level (efficient). Combining them reduces token overhead in the prompt and avoids the illusion that 13 separate "agents" are doing work — this is still a single agent simulating roles.

---

## 2026-02-07 — Security Hardening

### Decision: DOMPurify over manual escaping for markdown output

**Context**: `AgentPanel.js` renders agent messages via `marked.parse()` and injects the result via `innerHTML`. The `marked` library does not sanitize HTML by default, so `<script>`, `<img onerror>`, and `javascript:` URIs in agent responses would execute. Manual regex-based stripping is fragile.
**Decision**: Use DOMPurify with an explicit allowlist of safe tags and attributes. Wrap it in a shared `sanitizeHtml()` function in `src/core/Sanitize.js`.
**Rationale**: DOMPurify is the industry standard for DOM-based sanitization (~23 kB gzipped). It handles edge cases (nested encoding, mutation XSS, SVG/MathML) that manual regex cannot. The allowlist approach is safer than a blocklist — unknown tags are stripped by default.
**Trade-off**: +23 kB bundle size. Acceptable given the attack surface it closes.

### Decision: CSP via meta tag (not HTTP header)

**Context**: Content Security Policy can be delivered via HTTP header or HTML `<meta>` tag. MindMapper currently runs as a static file served by Vite's dev server and will be packaged as an Electron app.
**Decision**: Use `<meta http-equiv="Content-Security-Policy">` in `index.html`.
**Rationale**: Static file serving (Vite, Electron) doesn't have a server layer to set HTTP headers. A meta tag works identically for all delivery mechanisms. The only limitation is that `frame-ancestors` and `report-uri` directives don't work in meta tags — both are irrelevant for a desktop app.
**Future**: When the SaaS version ships, CSP headers should be set on the Firebase Hosting config or Cloud Functions for stricter enforcement + `report-uri` for monitoring.

### Decision: API key in header instead of URL query parameter

**Context**: The Google Gemini provider in `IdeaGenerator.js` passed the API key as `?key=` in the URL. This exposes the key in browser history, proxy logs, server access logs, and `Referer` headers.
**Decision**: Move to `x-goog-api-key` request header.
**Rationale**: Headers are not logged by default in most infrastructure. Google's own documentation supports header-based auth for the Generative Language API. This is a one-line change with no behavioral difference.

### Decision: Shared Sanitize.js utility (not per-component sanitization)

**Context**: `AgentPanel.js` had its own `_escapeHtml()` method. `NodeManager.js` had no escaping at all. Future components (Phase 4) will also need sanitization.
**Decision**: Extract all sanitization into `src/core/Sanitize.js` with three exported functions: `escapeHtml()` (plain text), `sanitizeHtml()` (rendered HTML via DOMPurify), `escapeAttr()` (attribute contexts).
**Rationale**: Single source of truth. New components import from one place. If the sanitization strategy changes (e.g., switching from DOMPurify to Trusted Types), only one file needs updating. Also makes auditing easier — grep for `innerHTML` and verify each usage calls a Sanitize function.
