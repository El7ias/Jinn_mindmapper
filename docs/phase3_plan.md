# MindMapper Phase 3 — Multi-Agent Orchestration Platform

> Transform MindMapper from a mind-mapping tool into an **agentic system** that turns
> a user's concept + mind-map into a full multi-agent workflow and implementation plan
> for building beloved applications.

**Status**: Planning  
**Estimated scope**: ~12 weeks, ~15,000+ new LOC  
**Prerequisite**: Phase 2 complete (file management, presets, import/export)

---

## Vision Summary

The human user is the **CEO**. They draw a mind map of their application idea —
features, flows, risks, tech preferences, constraints. Then they press **▶ Run Agents**.

MindMapper serializes the mind map into structured context, spins up a team of
13 specialized AI agents (COO, CTO, CFO, Creative Department, Frontend Builder,
Backend Builder, Devil's Advocate, Sentinel, Documenter, Token Auditor,
API Cost Auditor, Project Auditor, and the CEO themselves), and orchestrates a
collaborative planning cycle that produces:

1. Application design and UX vision
2. Technical architecture and stack recommendations
3. Frontend and backend implementation plans
4. Cost optimization strategy
5. Security and privacy assessment
6. Structured documentation of all decisions

The CEO watches this unfold in a sidebar panel, approves or revises proposals,
and exports the final plan as actionable documentation.

---

## Architecture Overview

### Three-Layer System

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Client (MindMapper Canvas + Agent Panel)                │
│                                                                     │
│  Existing mind map canvas ────── New agent sidebar panel            │
│  Node metadata overlays  ────── CEO approval flow UI                │
│  Status badges / priority ───── Cost dashboard                      │
│  Project progress bar    ────── Artifact viewer                     │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — Backend Services (Firebase)                             │
│                                                                     │
│  Firestore ─────── projects, agents, messages, plans, approvals    │
│  Cloud Functions ── agent execution orchestrator                    │
│  Auth ──────────── Google Sign-In, role-based access               │
│  LLM Gateway ───── multi-model router (cost-optimized)             │
│  Security ──────── Sentinel rules, prompt sanitization             │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3 — Agent Runtime                                           │
│                                                                     │
│  AgentBase ─────── shared interface for all 13 agents              │
│  MessageBus ────── Firestore-backed pub/sub with @mentions         │
│  ContextManager ── Sentinel-enforced visibility control            │
│  ExecutionEngine ─ sequential/parallel agent orchestration         │
│  CostTracker ──── real-time token + API cost monitoring            │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                    MindMapper Client (Browser)                       │
│                                                                      │
│  ┌────────────────────────────────┬─────────────────────────────┐    │
│  │                                │                             │    │
│  │    Mind Map Canvas             │    Agent Panel               │    │
│  │    ┌─────────────────────┐     │    ┌─────────────────────┐  │    │
│  │    │ Nodes with:         │     │    │ Agent Cards          │  │    │
│  │    │ · Status badges     │     │    │ · Avatar + role      │  │    │
│  │    │ · Agent assignments │     │    │ · Status indicator   │  │    │
│  │    │ · Priority rings    │     │    │ · Message count      │  │    │
│  │    │ · Click → thread    │     │    ├─────────────────────┤  │    │
│  │    └─────────────────────┘     │    │ Conversation Thread  │  │    │
│  │                                │    │ · @mentions          │  │    │
│  │    ┌─────────────────────┐     │    │ · Artifact previews  │  │    │
│  │    │ Connections with:   │     │    │ · References         │  │    │
│  │    │ · Dependency edges  │     │    ├─────────────────────┤  │    │
│  │    │ · Phase grouping    │     │    │ CEO Actions          │  │    │
│  │    │ · Flow direction    │     │    │ [Approve] [Revise]   │  │    │
│  │    └─────────────────────┘     │    │ [Reject]  [Comment]  │  │    │
│  │                                │    ├─────────────────────┤  │    │
│  │    ┌──────────┐ ┌─────────┐    │    │ Cost Dashboard       │  │    │
│  │    │ MiniMap  │ │Progress │    │    │ · Tokens: 12,847     │  │    │
│  │    └──────────┘ │ Bar     │    │    │ · Cost: $0.42        │  │    │
│  │                 └─────────┘    │    │ · Budget: 78% left   │  │    │
│  │                                │    └─────────────────────┘  │    │
│  └────────────────────────────────┴─────────────────────────────┘    │
│                                                                      │
│  Firebase SDK ◄──── Firestore listeners (real-time updates)         │
│                ◄──── Auth state                                      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS / WebSocket
┌───────────────────────────────▼──────────────────────────────────────┐
│                    Firebase Backend                                   │
│                                                                      │
│  Cloud Functions:                                                    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  ExecutionEngine                                             │    │
│  │  ├── COO Agent (orchestrator)                                │    │
│  │  │   ├── reads mind map context                              │    │
│  │  │   ├── creates phase/milestone plan                        │    │
│  │  │   └── coordinates agent turns                             │    │
│  │  ├── CTO Agent (architecture)                                │    │
│  │  ├── CFO Agent (cost strategy)                               │    │
│  │  ├── Creative Agent (UX vision)                              │    │
│  │  ├── Frontend Builder Agent                                  │    │
│  │  ├── Backend Builder Agent                                   │    │
│  │  ├── Devil's Advocate Agent                                  │    │
│  │  ├── Sentinel Agent (security)                               │    │
│  │  ├── Documenter Agent                                        │    │
│  │  ├── Token Auditor Agent                                     │    │
│  │  ├── API Cost Auditor Agent                                  │    │
│  │  └── Project Auditor Agent                                   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  LLM Gateway:                                                        │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐     │    │
│  │  │ OpenAI  │ │ Claude  │ │ Gemini  │ │ Local/Custom  │     │    │
│  │  │ GPT-4o  │ │ Sonnet  │ │ Pro/    │ │ Ollama etc.   │     │    │
│  │  │ GPT-4o  │ │ Haiku   │ │ Flash   │ │               │     │    │
│  │  │  mini   │ │ Opus    │ │ Ultra   │ │               │     │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └───────────────┘     │    │
│  │                                                              │    │
│  │  Router: taskType + budget → model selection                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Firestore:                                                          │
│  ├── /projects/{projectId}                                          │
│  ├── /projects/{projectId}/messages/{messageId}                     │
│  ├── /projects/{projectId}/artifacts/{artifactId}                   │
│  ├── /projects/{projectId}/costLedger                               │
│  └── /users/{userId}                                                │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Project

```js
{
  id: string,                    // Firestore auto-ID
  ownerId: string,               // CEO's Firebase Auth UID
  name: string,                  // Project display name
  status: 'draft' | 'planning' | 'reviewing' | 'approved' | 'archived',

  // The mind map — the CEO's source of truth
  mindMap: {
    nodes: [{
      id: string,
      label: string,
      x: number, y: number,
      color: string,
      shape: string,
      // NEW Phase 3 metadata:
      nodeType: 'feature' | 'constraint' | 'reference' | 'risk' | 'techNote' | 'general',
      priority: 'critical' | 'high' | 'medium' | 'low',
      phase: number | null,           // Which dev phase (1, 2, 3...)
      assignedAgent: string | null,   // 'cto' | 'creative' | 'frontend' | ...
      agentStatus: 'unassigned' | 'planning' | 'in-review' | 'approved' | 'blocked',
      agentNotes: string | null,      // Summary of agent discussion for this node
    }],
    connections: [{
      id: string,
      sourceId: string,
      targetId: string,
      directed: 'none' | 'forward' | 'both',
      // NEW Phase 3 metadata:
      edgeType: 'dependency' | 'grouping' | 'flow' | 'phase-boundary' | 'general',
    }],
    viewport: { x: number, y: number, zoom: number }
  },

  // Agent orchestration state
  orchestration: {
    currentPhase: number,
    currentRound: number,         // Review cycle round
    activeAgents: string[],       // Which agents are currently working
    turnOrder: string[],          // COO-defined execution order
    status: 'idle' | 'running' | 'awaiting-ceo' | 'complete',
  },

  // CEO preferences and constraints
  ceoContext: {
    concept: string,              // High-level idea description
    goals: string[],              // Success criteria
    constraints: string[],        // Budget, timeline, tech constraints
    designReferences: string[],   // URLs or descriptions of inspiration
    preferences: {
      style: string,              // 'minimalist' | 'playful' | 'enterprise' | ...
      targetPlatform: string,     // 'web' | 'mobile' | 'desktop' | 'cross-platform'
      priorityAxis: string,       // 'speed' | 'quality' | 'cost'
    }
  },

  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### AgentMessage

```js
{
  id: string,
  projectId: string,
  agentRole: string,              // 'coo' | 'cto' | 'cfo' | 'creative' | ...

  // Content
  content: string,                // The agent's message (markdown)
  contentType: 'message' | 'proposal' | 'critique' | 'approval-request' | 'artifact',

  // References — agents MUST cite what they're responding to
  references: [{
    type: 'message' | 'node' | 'artifact',
    id: string,                   // ID of referenced message, node, or artifact
    context: string,              // Brief quote or summary of what's being referenced
  }],

  // Mentions — explicit calls to other agents
  mentions: string[],             // ['cto', 'sentinel', ...]

  // Metadata
  round: number,                  // Which review cycle round
  phase: number,                  // Which project phase
  modelUsed: string,              // 'gpt-4o' | 'claude-sonnet' | ...
  tokenCount: { input: number, output: number },
  cost: number,                   // Estimated cost in USD

  // CEO interaction
  requiresApproval: boolean,      // If true, CEO must approve/reject
  ceoDecision: null | 'approved' | 'revised' | 'rejected',
  ceoComment: string | null,

  // Security
  sentinelReview: null | 'passed' | 'flagged' | 'blocked',
  sentinelNotes: string | null,

  timestamp: Timestamp,
}
```

### PlanArtifact

```js
{
  id: string,
  projectId: string,
  createdBy: string,              // Agent role that produced it

  type: 'architecture' | 'ux-journey' | 'api-spec' | 'component-plan' |
        'security-assessment' | 'cost-strategy' | 'implementation-plan' |
        'documentation' | 'executive-summary',

  title: string,
  content: string,                // Markdown content
  version: number,                // Increments on revisions

  status: 'draft' | 'in-review' | 'approved' | 'superseded',
  approvedBy: string | null,      // 'ceo' when approved

  // Traceability
  derivedFrom: string[],          // Message IDs that led to this artifact
  relatedNodes: string[],         // Mind map node IDs this artifact covers

  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

### CostLedger

```js
{
  projectId: string,

  // Budget
  tokenBudget: number,            // Max tokens allowed
  costBudget: number,             // Max USD allowed

  // Current usage
  totalTokens: { input: number, output: number },
  totalCost: number,

  // Per-agent breakdown
  agentUsage: {
    [agentRole: string]: {
      tokens: { input: number, output: number },
      cost: number,
      messageCount: number,
      modelBreakdown: { [model: string]: { tokens: number, cost: number } }
    }
  },

  // Per-tier breakdown
  tierUsage: {
    heavy: { tokens: number, cost: number, percentage: number },
    medium: { tokens: number, cost: number, percentage: number },
    light: { tokens: number, cost: number, percentage: number },
  },

  updatedAt: Timestamp,
}
```

---

## LLM Routing Strategy

The CFO agent defines routing rules. The LLM Gateway enforces them.

### Model Tiers

| Tier                | When Used                                                                       | Models                                  | Budget Share |
| ------------------- | ------------------------------------------------------------------------------- | --------------------------------------- | ------------ |
| **Heavy** (Tier 1)  | Architecture, security review, critical UX decisions, complex technical design  | Claude Opus, GPT-4, Gemini Ultra        | ~30%         |
| **Medium** (Tier 2) | Implementation plans, code structure, API specs, documentation, routine reviews | Claude Sonnet, GPT-4o, Gemini Pro       | ~50%         |
| **Light** (Tier 3)  | Summaries, formatting, status updates, simple classification, cost reports      | Claude Haiku, GPT-4o-mini, Gemini Flash | ~20%         |

### Routing Rules

```
Agent → Task Type → Tier → Model

COO:
  · Initial planning           → Tier 2 (structured planning)
  · Integration & synthesis    → Tier 2 (reading + summarizing)
  · Final CEO summary          → Tier 3 (formatting)

CTO:
  · Architecture design        → Tier 1 (critical decisions)
  · Stack recommendation       → Tier 2 (comparative analysis)
  · Technical review response  → Tier 2 (reasoned response)

CFO:
  · Cost strategy              → Tier 2 (analytical)
  · Token audit analysis       → Tier 3 (numerical)
  · Budget reports             → Tier 3 (formatting)

Creative:
  · UX vision & journeys       → Tier 1 (creative, nuanced)
  · Design refinement          → Tier 2 (iterative)
  · Layout descriptions        → Tier 2 (descriptive)

Frontend Builder:
  · Component planning         → Tier 2 (structured)
  · Screen breakdowns          → Tier 2 (detailed)
  · Accessibility review       → Tier 3 (checklist-based)

Backend Builder:
  · API design                 → Tier 2 (structured)
  · Data modeling              → Tier 2 (analytical)
  · Service boundaries         → Tier 2 (architectural)

Devil's Advocate:
  · Critical review            → Tier 1 (deep analysis)
  · Edge case identification   → Tier 2 (creative thinking)
  · Improvement suggestions    → Tier 2 (constructive)

Sentinel:
  · Security assessment        → Tier 1 (critical safety)
  · Prompt injection check     → Tier 3 (pattern matching)
  · Data access review         → Tier 2 (policy evaluation)

Documenter:
  · Full documentation         → Tier 2 (structured writing)
  · Change log entries         → Tier 3 (concise)
  · Executive summary          → Tier 2 (polished)

Token Auditor:
  · Usage analysis             → Tier 3 (numerical)

API Cost Auditor:
  · Cost analysis              → Tier 3 (numerical)

Project Auditor:
  · Coherence check            → Tier 2 (analytical)
  · Audit report               → Tier 3 (summarization)
```

### Cost Optimization Techniques

1. **Context compression**: Agents receive a summarized view of the mind map, not raw JSON
2. **Shared summaries**: COO publishes round summaries; agents read the summary instead of all individual messages
3. **Incremental context**: On revision rounds, agents only receive the diff, not the full history
4. **Early termination**: If all agents agree, skip remaining review rounds
5. **Caching**: Identical prompts (e.g., repeated security checks) use cached responses
6. **Prompt templates**: Pre-built structured prompts reduce verbosity and token waste

---

## Security Architecture (Sentinel)

### Threat Model

| Threat              | Vector                                          | Mitigation                                             |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Prompt injection    | Malicious text in mind map node labels          | Sentinel scans all CEO input before agent consumption  |
| Data exfiltration   | Agent tries to encode sensitive data in outputs | Sentinel reviews all outbound content                  |
| Unauthorized access | User tries to access another user's project     | Firebase Auth + Firestore security rules               |
| Cost attack         | Crafted input that causes excessive LLM calls   | CFO budget caps, rate limiting                         |
| Model manipulation  | Adversarial prompts that alter agent behavior   | System prompts are hardcoded, user content is isolated |

### Sentinel Enforcement Points

```
CEO Input → [Sentinel: sanitize & classify] → Context for agents
Agent Output → [Sentinel: review for leaks/safety] → Stored in Firestore
Cross-agent Messages → [Sentinel: validate references] → Message Bus
External API Calls → [Sentinel: approve/block] → LLM Gateway
Final Artifacts → [Sentinel: final security scan] → Delivered to CEO
```

### Firestore Security Rules (Sketch)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users
    match /projects/{projectId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.ownerId;

      match /messages/{messageId} {
        allow read: if request.auth != null
                    && get(/databases/$(database)/documents/projects/$(projectId)).data.ownerId == request.auth.uid;
        // Only Cloud Functions can write messages (agents)
        allow write: if false;
      }

      match /artifacts/{artifactId} {
        allow read: if request.auth != null
                    && get(/databases/$(database)/documents/projects/$(projectId)).data.ownerId == request.auth.uid;
        allow write: if false;
      }
    }

    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Agent Communication Protocol

### Message Flow

```
Round 1:
  CEO uploads mind map → triggers orchestration

  COO reads mind map → produces initial plan
    ├── @CTO: "Please review architecture needs"
    ├── @Creative: "Please design UX approach"
    ├── @CFO: "Please define cost strategy"
    └── @Sentinel: "Please review security implications"

  CTO responds → architecture proposal (references COO's plan)
  Creative responds → UX vision (references COO's plan)
  CFO responds → cost strategy (references COO's plan)
  Sentinel responds → security assessment (references COO's plan)

  Devil's Advocate reviews ALL responses → critiques

Round 2:
  COO synthesizes Round 1 → refined plan
    ├── @Frontend: "Build on CTO arch + Creative UX"
    ├── @Backend: "Build on CTO arch + address DA concerns"
    └── @Documenter: "Begin documentation"

  Frontend responds → implementation plan (references CTO + Creative)
  Backend responds → implementation plan (references CTO + Sentinel)
  Documenter responds → draft documentation

  Devil's Advocate reviews → second critique
  Token Auditor → usage report
  API Cost Auditor → cost report
  Project Auditor → coherence check

Round 3:
  COO integrates all → final unified plan
  Documenter → final documentation
  COO → CEO summary + approval request

  CEO reviews → [Approve] / [Revise] / [Reject]
```

### Message Format Rules

1. Every message MUST have at least one `reference` (except COO's initial message)
2. Critique messages MUST include specific, actionable improvements
3. Proposal messages MUST include rationale
4. Approval-request messages MUST include a concise summary
5. All messages are checked by Sentinel before storage

---

## Sub-Phase Implementation Plan

### Phase 3.0 — Infrastructure Foundation

**Goal**: Firebase project setup, auth, base data layer, and dev environment.

**Tasks**:

| #   | Task                      | Details                                                              | New Files                                                     |
| --- | ------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Firebase project creation | Create Firebase project, enable Firestore, Auth, and Cloud Functions | `firebase.json`, `.firebaserc`                                |
| 2   | Firebase SDK integration  | Add `firebase` npm package, create config module                     | `src/firebase/config.js`                                      |
| 3   | Authentication            | Google Sign-In, auth state management, login/logout UI               | `src/firebase/auth.js`, `src/ui/AuthPanel.js`                 |
| 4   | Firestore data layer      | CRUD operations for projects, messages, artifacts                    | `src/firebase/firestore.js`                                   |
| 5   | Cloud Functions scaffold  | Node.js Cloud Functions project with TypeScript                      | `functions/src/index.ts`                                      |
| 6   | LLM Gateway skeleton      | Cloud Function that accepts a task and routes to an LLM API          | `functions/src/llm/gateway.ts`, `functions/src/llm/models.ts` |
| 7   | Environment & secrets     | Firebase env config for API keys (OpenAI, Anthropic, Google AI)      | `functions/.env.example`                                      |
| 8   | Security rules            | Firestore rules per security architecture                            | `firestore.rules`                                             |
| 9   | Project migration         | Existing localStorage projects can be uploaded to Firestore          | `src/firebase/migration.js`                                   |

**Dependencies**: Firebase CLI, Node.js 18+, npm packages: `firebase`, `@google-cloud/functions-framework`

**Estimate**: ~1,200 LOC, ~2 weeks

---

### Phase 3.1 — Agent Framework Core

**Goal**: Build the runtime that executes agents, routes messages, and tracks costs.

**Tasks**:

| #   | Task                | Details                                                                       | New Files                                   |
| --- | ------------------- | ----------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | AgentBase class     | Abstract class with `execute(context, references)`, system prompt, model tier | `functions/src/agents/AgentBase.ts`         |
| 2   | Agent Registry      | Map of role → agent config (system prompt, tier, permissions)                 | `functions/src/agents/registry.ts`          |
| 3   | MessageBus          | Write messages to Firestore, fan out to subscribers, enforce @mention routing | `functions/src/agents/MessageBus.ts`        |
| 4   | ContextManager      | Build agent-specific context from project state, enforce visibility rules     | `functions/src/agents/ContextManager.ts`    |
| 5   | ExecutionEngine     | Run agents in COO-defined order, manage rounds, handle approvals              | `functions/src/agents/ExecutionEngine.ts`   |
| 6   | CostTracker         | Count tokens per message, update cost ledger, enforce budget limits           | `functions/src/agents/CostTracker.ts`       |
| 7   | Prompt templates    | Structured prompt builders for each agent role                                | `functions/src/agents/prompts/`             |
| 8   | Mind map serializer | Convert mind map JSON into structured, token-efficient agent context          | `functions/src/agents/MindMapSerializer.ts` |

**Key design decisions**:

- **AgentBase interface**:

  ```ts
  abstract class AgentBase {
    abstract role: string;
    abstract systemPrompt: string;
    abstract modelTier: "heavy" | "medium" | "light";
    abstract permissions: string[];

    async execute(
      context: AgentContext,
      references: AgentMessage[],
      mentions: string[],
    ): Promise<AgentMessage>;
  }
  ```

- **MessageBus writes to Firestore**: The client listens to real-time updates via
  `onSnapshot()`, so agent messages appear live in the UI as they're generated.

- **ContextManager applies Sentinel rules**: Each agent sees only the data it's
  permitted to access. The `context` object is filtered per-agent.

**Estimate**: ~2,000 LOC, ~2 weeks

---

### Phase 3.2 — Mind Map Node Metadata System

**Goal**: Enhance mind map nodes with Phase 3 metadata (type, priority, status, agent assignment).

**Tasks**:

| #   | Task                     | Details                                                                           | New Files                            |
| --- | ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | Node metadata extensions | Add `nodeType`, `priority`, `phase`, `assignedAgent`, `agentStatus` to node model | Modify `NodeManager.js`              |
| 2   | Edge metadata extensions | Add `edgeType` to connection model                                                | Modify `ConnectionManager.js`        |
| 3   | Status badge overlays    | Visual badges on nodes (🔵 🟡 🟢 🔴) showing agent status                         | Modify `NodeManager.js`, `main.css`  |
| 4   | Priority ring indicators | Colored ring around nodes indicating priority level                               | Modify `main.css`                    |
| 5   | Agent assignment chips   | Small avatar/icon on nodes showing which agent owns it                            | Modify `NodeManager.js`, `main.css`  |
| 6   | Node type selector       | Right-click menu option to set node type (feature, constraint, risk...)           | Modify `ContextMenu.js`              |
| 7   | Priority selector        | Right-click menu option to set priority                                           | Modify `ContextMenu.js`              |
| 8   | Phase assignment         | Right-click menu option to assign node to a development phase                     | Modify `ContextMenu.js`              |
| 9   | CEO context panel        | Modal/panel for CEO to input concept, goals, constraints, preferences             | `src/ui/CEOContextPanel.js`          |
| 10  | Mind map validator       | Ensure mind map has minimum viable structure before agent execution               | `src/validation/MindMapValidator.js` |

**UI mockup — Enhanced node**:

```
    ┌─── Priority ring (red = critical)
    │
    ▼
  ╔══════════════════════════╗
  ║ 🟡 Feature: User Auth    ║ ← Status badge (in review)
  ║ ──────────────────────── ║
  ║ Login, signup, OAuth     ║
  ║                          ║
  ║  🤖 CTO                  ║ ← Agent assignment chip
  ║  Phase 1 · Critical      ║ ← Phase & priority labels
  ╚══════════════════════════╝
```

**Estimate**: ~1,000 LOC, ~1.5 weeks

---

### Phase 3.3 — COO Agent + Agent Panel UI

**Goal**: The first working agent (COO) and the sidebar where the CEO watches/interacts.

**Tasks**:

| #   | Task                       | Details                                                           | New Files                                |
| --- | -------------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| 1   | COO agent implementation   | Reads mind map, produces phase plan, assigns agents to nodes      | `functions/src/agents/roles/COOAgent.ts` |
| 2   | Agent Panel component      | Sidebar UI with agent cards, conversation thread, and controls    | `src/ui/AgentPanel.js`                   |
| 3   | Conversation thread UI     | Scrollable message list with agent avatars, @mentions, timestamps | Part of `AgentPanel.js`                  |
| 4   | CEO approval flow          | Approve / Revise / Reject buttons on proposal messages            | Part of `AgentPanel.js`                  |
| 5   | "Run Agents" button        | Toolbar button that triggers orchestration                        | Modify `index.html`, `main.js`           |
| 6   | Real-time message listener | Firestore `onSnapshot` listener for live message updates          | `src/firebase/listeners.js`              |
| 7   | Agent status cards         | Show which agents are active, idle, or waiting                    | Part of `AgentPanel.js`                  |
| 8   | Progress indicator         | Phase progress bar in the agent panel                             | Part of `AgentPanel.js`                  |
| 9   | Node ↔ thread linking      | Click a node to see its related agent discussion                  | Modify `NodeManager.js`, `AgentPanel.js` |
| 10  | Panel resize/toggle        | Collapsible sidebar with drag-to-resize                           | `src/ui/PanelResizer.js`                 |

**Agent Panel wireframe**:

```
┌───────────────────────────────┐
│  ▶ Agent Orchestration        │
│  Phase 1 of 3 · Round 2      │
│  ████████████░░░░  67%        │
├───────────────────────────────┤
│                               │
│  ┌─ COO ─────────────────┐   │
│  │ I've analyzed the mind │   │
│  │ map and broken it into │   │
│  │ 3 phases:              │   │
│  │ · Phase 1: Core Auth   │   │
│  │ · Phase 2: Dashboard   │   │
│  │ · Phase 3: Analytics   │   │
│  │                        │   │
│  │ @CTO please review     │   │
│  │ the architecture needs │   │
│  │ for Phase 1.           │   │
│  │                        │   │
│  │ 🕐 2m ago · Sonnet     │   │
│  │ 📊 1,247 tokens · $0.01│   │
│  └────────────────────────┘   │
│                               │
│  ┌─ CTO ─────────────────┐   │
│  │ Re: COO's Phase 1 plan │   │
│  │                        │   │
│  │ For the auth system,   │   │
│  │ I recommend Firebase   │   │
│  │ Auth with OAuth 2.0... │   │
│  │                        │   │
│  │ 📎 architecture.md     │   │
│  │ 🕐 1m ago · Opus       │   │
│  │ 📊 2,103 tokens · $0.06│   │
│  └────────────────────────┘   │
│                               │
│  ┌─ Devil's Advocate ────┐   │
│  │ ⚠️ Re: CTO's auth plan │   │
│  │                        │   │
│  │ Have you considered    │   │
│  │ the OAuth edge cases   │   │
│  │ for enterprise SSO?    │   │
│  │                        │   │
│  │ 🕐 30s ago · Sonnet    │   │
│  └────────────────────────┘   │
│                               │
├───────────────────────────────┤
│  💬 Comment for agents...     │
│  [Approve Plan] [Request Rev] │
├───────────────────────────────┤
│  📊 Cost Dashboard            │
│  Tokens: 12,847 / 100,000    │
│  Cost: $0.42 / $5.00 budget  │
│  ████░░░░░░  42%              │
└───────────────────────────────┘
```

**Estimate**: ~2,500 LOC, ~2.5 weeks

---

### Phase 3.4 — Specialist Agents

**Goal**: Implement the remaining core agents that produce actual plans.

**Tasks**:

| #   | Task             | Agent      | Details                                                          |
| --- | ---------------- | ---------- | ---------------------------------------------------------------- |
| 1   | CTO Agent        | CTO        | Architecture, stack choice, module boundaries, API contracts     |
| 2   | CFO Agent        | CFO        | Cost strategy, model routing rules, budget allocation            |
| 3   | Creative Agent   | Creative   | UX vision, user journeys, interaction patterns, visual hierarchy |
| 4   | Frontend Builder | Frontend   | Screen structures, component breakdowns, navigation flows        |
| 5   | Backend Builder  | Backend    | Service boundaries, API definitions, data models                 |
| 6   | Documenter Agent | Documenter | Structured documentation from all agent outputs                  |

**Files**:

```
functions/src/agents/roles/
├── CTOAgent.ts
├── CFOAgent.ts
├── CreativeAgent.ts
├── FrontendBuilderAgent.ts
├── BackendBuilderAgent.ts
└── DocumenterAgent.ts
```

Each agent follows the `AgentBase` contract:

- Receives filtered context + relevant messages as input
- Produces a structured response with references and artifacts
- Tagged with model tier and token count

**The COO coordinates these agents per the collaboration rules**:

- Round 1: COO → CTO, Creative, CFO, Sentinel (parallel)
- Round 2: COO synthesis → Frontend, Backend, Documenter (parallel)
- Round 3: COO → final integration → CEO approval

**Estimate**: ~3,000 LOC, ~2.5 weeks

---

### Phase 3.5 — Review & Cost Layer

**Goal**: Devil's Advocate, Sentinel, auditors, and the cost dashboard.

**Tasks**:

| #   | Task                     | Details                                                            | New Files                           |
| --- | ------------------------ | ------------------------------------------------------------------ | ----------------------------------- |
| 1   | Devil's Advocate Agent   | Reviews all proposals, raises edge cases, suggests improvements    | `DevilsAdvocateAgent.ts`            |
| 2   | Sentinel Agent           | Security review, prompt injection scanning, data access validation | `SentinelAgent.ts`                  |
| 3   | Token Auditor Agent      | Analyzes token usage patterns, recommends optimizations            | `TokenAuditorAgent.ts`              |
| 4   | API Cost Auditor Agent   | Tracks external API costs, suggests caching/alternatives           | `APICostAuditorAgent.ts`            |
| 5   | Project Auditor Agent    | Checks plan coherence against CEO's mind map and goals             | `ProjectAuditorAgent.ts`            |
| 6   | Prompt injection scanner | Pattern-matching service that flags suspicious input               | `functions/src/security/scanner.ts` |
| 7   | Cost dashboard UI        | Real-time token/cost visualizations in agent panel                 | Modify `AgentPanel.js`              |
| 8   | Cost alert system        | Warnings when approaching budget limits                            | Modify `CostTracker.ts`             |
| 9   | Sentinel veto UI         | Shows blocked messages with explanations                           | Modify `AgentPanel.js`              |

**Estimate**: ~2,500 LOC, ~2 weeks

---

### Phase 3.6 — Full Orchestration Loop

**Goal**: Connect everything into the complete multi-round collaboration cycle.

**Tasks**:

| #   | Task                  | Details                                                          | New Files                                    |
| --- | --------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| 1   | Multi-round execution | COO runs multiple rounds until plan is strong enough             | Modify `ExecutionEngine.ts`                  |
| 2   | CEO revision flow     | CEO comments trigger targeted re-evaluation by relevant agents   | Modify `ExecutionEngine.ts`, `AgentPanel.js` |
| 3   | Artifact versioning   | Track versions of plans as they evolve through critique/revision | `functions/src/agents/ArtifactManager.ts`    |
| 4   | Artifact viewer UI    | Expandable cards showing architecture, API specs, etc.           | `src/ui/ArtifactViewer.js`                   |
| 5   | Export final plan     | Export all approved artifacts as structured markdown bundle      | Modify `FileManager.js`                      |
| 6   | Node auto-annotation  | Agents automatically update node metadata (status, notes)        | Modify `NodeManager.js`                      |
| 7   | Plan diff view        | Show what changed between rounds                                 | `src/ui/DiffViewer.js`                       |
| 8   | Project history       | Timeline of all orchestration rounds with expandable details     | `src/ui/ProjectTimeline.js`                  |

**Estimate**: ~2,000 LOC, ~2 weeks

---

## File Structure (Phase 3 Additions)

```
d:\AI_Dev\mindmapper\
├── firebase.json                       # Firebase project config
├── .firebaserc                         # Firebase project alias
├── firestore.rules                     # Firestore security rules
├── firestore.indexes.json              # Firestore composite indexes
│
├── functions/                          # Cloud Functions (TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example                    # API key template
│   └── src/
│       ├── index.ts                    # Cloud Function exports
│       ├── llm/
│       │   ├── gateway.ts              # Multi-model LLM router
│       │   ├── models.ts              # Model configs (pricing, limits)
│       │   └── cache.ts               # Response caching
│       ├── agents/
│       │   ├── AgentBase.ts           # Abstract agent class
│       │   ├── MessageBus.ts          # Firestore-backed message routing
│       │   ├── ContextManager.ts      # Agent visibility control
│       │   ├── ExecutionEngine.ts     # Orchestration engine
│       │   ├── CostTracker.ts         # Token & cost accounting
│       │   ├── ArtifactManager.ts     # Versioned artifact management
│       │   ├── MindMapSerializer.ts   # Mind map → agent context
│       │   ├── registry.ts            # Agent role → config map
│       │   ├── prompts/               # System prompt templates
│       │   │   ├── coo.md
│       │   │   ├── cto.md
│       │   │   ├── cfo.md
│       │   │   ├── creative.md
│       │   │   ├── frontend.md
│       │   │   ├── backend.md
│       │   │   ├── devils-advocate.md
│       │   │   ├── sentinel.md
│       │   │   ├── documenter.md
│       │   │   ├── token-auditor.md
│       │   │   ├── api-cost-auditor.md
│       │   │   └── project-auditor.md
│       │   └── roles/                 # Agent implementations
│       │       ├── COOAgent.ts
│       │       ├── CTOAgent.ts
│       │       ├── CFOAgent.ts
│       │       ├── CreativeAgent.ts
│       │       ├── FrontendBuilderAgent.ts
│       │       ├── BackendBuilderAgent.ts
│       │       ├── DevilsAdvocateAgent.ts
│       │       ├── SentinelAgent.ts
│       │       ├── DocumenterAgent.ts
│       │       ├── TokenAuditorAgent.ts
│       │       ├── APICostAuditorAgent.ts
│       │       └── ProjectAuditorAgent.ts
│       └── security/
│           ├── scanner.ts             # Prompt injection detection
│           └── sanitizer.ts           # Input sanitization
│
├── src/                               # Client-side additions
│   ├── firebase/
│   │   ├── config.js                  # Firebase SDK initialization
│   │   ├── auth.js                    # Auth state management
│   │   ├── firestore.js               # Firestore CRUD operations
│   │   ├── listeners.js               # Real-time onSnapshot listeners
│   │   └── migration.js               # localStorage → Firestore migration
│   ├── ui/
│   │   ├── AuthPanel.js               # Login/logout UI
│   │   ├── AgentPanel.js              # Agent sidebar (messages, controls)
│   │   ├── CEOContextPanel.js         # CEO input form (concept, goals, etc.)
│   │   ├── ArtifactViewer.js          # Expandable artifact cards
│   │   ├── DiffViewer.js              # Round-over-round diff display
│   │   ├── ProjectTimeline.js         # Orchestration history timeline
│   │   └── PanelResizer.js            # Drag-to-resize sidebar
│   └── validation/
│       └── MindMapValidator.js        # Pre-flight mind map checks
│
└── docs/
    ├── phase3_plan.md                 # This document
    ├── agent-system.md                # Agent architecture deep-dive
    └── security.md                    # Security architecture
```

---

## Technology Stack (Phase 3 Additions)

| Layer     | Technology                                  | Purpose                                    |
| --------- | ------------------------------------------- | ------------------------------------------ |
| Auth      | Firebase Auth                               | Google Sign-In, user management            |
| Database  | Cloud Firestore                             | Projects, messages, artifacts, cost ledger |
| Compute   | Cloud Functions (Node.js 18)                | Agent execution, LLM gateway               |
| LLM APIs  | OpenAI, Anthropic, Google AI                | Multi-model routing                        |
| Security  | Firestore Rules + Sentinel agent            | Access control + content scanning          |
| Real-time | Firestore onSnapshot                        | Live agent message streaming               |
| Language  | TypeScript (functions), JavaScript (client) | Type safety for backend                    |

### NPM Dependencies (New)

**Client**:

- `firebase` — Firebase SDK (Auth, Firestore)
- `marked` — Markdown rendering for agent messages
- `diff` — Text diffing for plan revisions

**Functions**:

- `openai` — OpenAI API client
- `@anthropic-ai/sdk` — Anthropic API client
- `@google/generative-ai` — Google AI (Gemini) client
- `zod` — Schema validation for agent I/O
- `tiktoken` — Token counting

---

## Risk Assessment

| Risk                          | Impact | Likelihood | Mitigation                                      |
| ----------------------------- | ------ | ---------- | ----------------------------------------------- |
| LLM API costs escalate        | High   | Medium     | Strict budget caps, Tier 3 defaults, caching    |
| Agent loops (infinite rounds) | High   | Low        | Max round limit (5), COO decides completion     |
| Prompt injection via mind map | High   | Medium     | Sentinel scanning, input sanitization           |
| Cloud Function cold starts    | Medium | High       | Warm-up pings, keep-alive scheduling            |
| Agent outputs are low quality | Medium | Medium     | Devil's Advocate review, CEO approval gates     |
| Token limits exceeded         | Medium | Medium     | Context compression, summary-based handoffs     |
| Firestore read costs          | Medium | Medium     | Pagination, client-side caching, batched reads  |
| User confusion with 13 agents | Medium | Low        | Progressive disclosure, only show active agents |
| API rate limiting             | Low    | Medium     | Retry with backoff, queue-based execution       |

---

## Success Criteria

- [ ] CEO can draw a mind map, add metadata (types, priorities, phases), and run agents
- [ ] COO produces a coherent phase plan from the mind map within 60 seconds
- [ ] All 12 agent roles produce relevant, referenced outputs
- [ ] CEO can approve/revise/reject proposals in the UI
- [ ] Full planning cycle (3 rounds) completes within 5 minutes
- [ ] Total cost per planning cycle < $5.00 for a typical 20-node mind map
- [ ] Exported plan is a structured, engineer-readable document
- [ ] No user data leaks through agent outputs
- [ ] Prompt injection attempts are detected and blocked
- [ ] System is usable end-to-end without reading documentation

---

## Milestone Summary

| Phase     | Name                      | Duration        | LOC         | Key Deliverable                              |
| --------- | ------------------------- | --------------- | ----------- | -------------------------------------------- |
| 3.0       | Infrastructure Foundation | 2 weeks         | ~1,200      | Firebase + Auth + LLM Gateway                |
| 3.1       | Agent Framework Core      | 2 weeks         | ~2,000      | AgentBase + MessageBus + ExecutionEngine     |
| 3.2       | Node Metadata System      | 1.5 weeks       | ~1,000      | Enhanced nodes with status/priority/agent    |
| 3.3       | COO + Agent Panel UI      | 2.5 weeks       | ~2,500      | First working agent + conversation UI        |
| 3.4       | Specialist Agents         | 2.5 weeks       | ~3,000      | CTO, Creative, Frontend, Backend, Documenter |
| 3.5       | Review & Cost Layer       | 2 weeks         | ~2,500      | Devil's Advocate, Sentinel, Auditors         |
| 3.6       | Full Orchestration        | 2 weeks         | ~2,000      | Multi-round loop, exports, final polish      |
| **Total** |                           | **~14.5 weeks** | **~14,200** | **Complete multi-agent orchestration**       |

---

## Implementation Order Rationale

The phases are ordered for **progressive testability**:

1. **3.0 first** because everything depends on Firebase infrastructure
2. **3.1 next** because the agent framework must exist before any agent
3. **3.2 before 3.3** because agents need rich node metadata to work with
4. **3.3 before 3.4** because the COO + UI must work end-to-end before adding more agents
5. **3.4 before 3.5** because specialist agents generate the content that reviewers critique
6. **3.6 last** because it's integration — everything must exist first

Each sub-phase is **independently deployable and testable**. After 3.3, the CEO
can already run the COO agent and see results in the UI. Each subsequent phase
adds more agent voices to the conversation.
