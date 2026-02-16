# Sprint 5.5 — MVP Boss Level: Project Readiness Tracker

> Every project should have a clear, measurable, _celebratable_ moment when it
> crosses from "under construction" to "open for business." In video game terms,
> this is **defeating the first Boss** — the hardest, most meaningful checkpoint.

**Status:** Planned — implement after Sprint 5 agent execution is operational  
**Prerequisite:** Sprint 5 (Agent Framework Backend) complete  
**Estimated scope:** ~1,500–2,000 LOC across 3 layers  
**Priority:** High — gives the agent system a concrete goal to aim for

---

## 1. Vision

MindMapper's core promise is: _"Draw a mind map, press Run, and AI agents build
your app."_ But **how does the system know when the app is DONE enough to
launch?** That's what Sprint 5.5 solves.

### The Level System

Every project progresses through levels, modeled after video game boss stages:

```
LEVEL 0 — Blueprint        🗺️  "The map is drawn"
           └─ Mind map has valid structure, nodes labeled, connections made
           └─ The planning is complete — no code yet

LEVEL 1 — MVP Boss 🏆      🎮  "Open for business"
           └─ All MVP-critical nodes are marked complete + verified
           └─ Core transaction flow works end-to-end
           └─ This is THE BOSS FIGHT — the hardest checkpoint to clear
           └─ Achievement unlocked, stats displayed, celebration triggered

LEVEL 2 — Growth           📈  "Scaling up"
           └─ Analytics, optimization, secondary features
           └─ Post-launch iteration and improvement

LEVEL 3 — Mastery          👑  "Full vision realized"
           └─ Every node in the original mind map is complete
           └─ Polish, edge cases, premium features, full documentation
```

**Level 1 is the only one that truly matters.** Everything before it is
preparation. Everything after it is optimization.

---

## 2. Design: The Three Layers

### Layer 1 — Node-Level Metadata (Foundation)

Add two new fields to every mind map node:

| Field              | Type    | Values                                                  | Purpose                                   |
| ------------------ | ------- | ------------------------------------------------------- | ----------------------------------------- |
| `completionStatus` | enum    | `not_started` · `in_progress` · `complete` · `verified` | Track individual node progress            |
| `mvpCritical`      | boolean | `true` / `false` (default: `false`)                     | Tag whether this node is required for MVP |

#### Node Visual Indicators

Nodes gain a completion ring or badge:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ ⬜ Auth System   │     │ 🔄 Auth System   │     │ ✅ Auth System   │
│   not_started   │     │   in_progress   │     │   verified ★    │
│                 │     │  ░░░▓▓▓▓▓░░░░   │     │  ▓▓▓▓▓▓▓▓▓▓▓   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      (dim)                 (pulsing)               (solid glow)

★ = MVP-critical nodes get a star/crown badge
```

#### Implementation Targets

- `NodeManager.js` — extend node data model with `completionStatus` and `mvpCritical`
- `PropertyPanel.js` — add completion dropdown + MVP toggle in node properties
- `ContextMenu.js` — add "Mark as Complete" / "Mark as MVP-Critical" right-click options
- `Node CSS` — completion status ring styles + MVP badge
- `MindMapSerializer.js` — include new fields in serialization
- `MindMapValidator.js` — validate completion status values

---

### Layer 2 — Project-Level MVP Scorecard

A new component that aggregates node-level status into a project-wide progress
meter, displayed in the Agent Panel.

#### MVP Scorecard Component (`MVPScorecard.js`)

```
┌──────────────────────────────────────┐
│  🎮 PROJECT LEVEL: 0 — Blueprint     │
│  ━━━━━━━━━━━━━━━━━━━░░░░░░░░░░  37%  │
│                                      │
│  MVP Requirements:     4 / 11 done   │
│  ├─ Features:          2 / 6  ✅✅⬜⬜⬜⬜│
│  ├─ Integrations:      1 / 3  ✅⬜⬜    │
│  ├─ Security:          1 / 1  ✅        │
│  └─ Transaction Flow:  0 / 1  ⬜        │
│                                      │
│  🔒 BOSS GATE: Payment flow untested │
│                                      │
│  ⏳ Est. to MVP: 3 agent rounds      │
└──────────────────────────────────────┘
```

#### Score Calculation

```
mvpScore = (mvpNodes.filter(n => n.completionStatus === 'verified').length)
         / (mvpNodes.length)
         * 100

projectLevel =
  mvpScore === 0   → Level 0 (Blueprint)
  mvpScore < 100   → Level 0 (Blueprint, with progress)
  mvpScore === 100  → Level 1 (MVP Boss Cleared!)
  allNodes complete → Level 3 (Mastery)
```

#### Boss Gate Detection

The **Boss Gate** is the single hardest MVP requirement — the non-negotiable
proof that the project works. The system should auto-detect it based on
project type:

| Project Type | Boss Gate                           | How to Verify                        |
| ------------ | ----------------------------------- | ------------------------------------ |
| E-commerce   | Test transaction completes          | Commerce node connection test passes |
| SaaS app     | User can sign up + use core feature | Auth + core feature nodes verified   |
| API project  | Endpoint responds to real request   | Integration test node verified       |
| Content site | Live URL serves pages               | Deployment node verified             |
| Mobile app   | App installs and runs core flow     | QA node verified                     |

The **COO agent** should identify the Boss Gate during the planning phase and
mark it explicitly in the execution plan.

#### Implementation Targets

- New `src/ui/MVPScorecard.js` — progress meter component
- `AgentPanel.js` — inject scorecard into the panel (below agent roster)
- `main.js` — wire `state:changed` events to scorecard recalculation
- `MVPScorecard.css` — progress bar, level badge, category bars
- `COOAgent.js` — extend planning to identify Boss Gate + MVP-critical nodes
- `ExecutionEngine.js` — track completion during agent rounds

---

### Layer 3 — Boss Achievement & Celebration

When the MVP score reaches 100%, trigger the Boss Level achievement:

#### Achievement Moment

1. **Screen flash** — brief gold/emerald flash overlay on the canvas
2. **Achievement toast** — animated badge slides in from top:
   ```
   ┌───────────────────────────────────────┐
   │  🏆 LEVEL 1 CLEARED — MVP ACHIEVED!  │
   │                                       │
   │  ✨ Your project is open for business │
   │                                       │
   │  🕐 Time to MVP:  47 min             │
   │  💰 Cost to MVP:  $0.83              │
   │  🤖 Agent rounds: 5                  │
   │  📊 Nodes completed: 11 / 11         │
   │                                       │
   │     [ Continue to Level 2 → ]        │
   └───────────────────────────────────────┘
   ```
3. **Confetti animation** — subtle PCB-themed particle burst (circuit traces, solder dots)
4. **Sound effect** (optional) — short achievement chime (if audio is enabled in settings)
5. **Achievement saved** — timestamp + stats stored in project metadata

#### MVP Stats Captured

| Stat              | Source                          |
| ----------------- | ------------------------------- |
| Time to MVP       | Session timer in AgentPanel     |
| Cost to MVP       | CostTracker accumulated spend   |
| Agent rounds      | ExecutionEngine round counter   |
| Nodes completed   | MVPScorecard count              |
| Boss Gate cleared | Timestamp of final verification |
| Agents involved   | AgentRegistry active agent list |

#### Implementation Targets

- New `src/ui/MVPAchievement.js` — achievement overlay + animation
- `MVPScorecard.js` — trigger achievement when score hits 100%
- `mvp-achievement.css` — celebration animations (keyframes, particle effects)
- `Storage.js` — persist achievement data with project save
- `CostTracker.js` — expose `costToMVP()` snapshot method

---

## 3. Agent Integration

### COO Agent Enhancements

During the planning phase, the COO should:

1. **Identify MVP-critical nodes** — analyze the mind map and recommend which
   nodes are essential for MVP vs. post-launch
2. **Detect the Boss Gate** — determine what single action proves the project
   works (e.g., "test transaction completes")
3. **Estimate rounds to MVP** — calculate how many agent execution rounds
   are needed to reach Level 1
4. **Prioritize MVP tasks** — schedule MVP-critical work in earlier phases

### COO Plan Output Extension

Add to the COO's JSON plan output:

```json
{
  "phases": [ ... ],
  "mvp": {
    "criticalNodes": ["auth-system", "payment-flow", "product-catalog"],
    "bossGate": {
      "nodeId": "payment-flow",
      "description": "A test transaction completes end-to-end",
      "verificationMethod": "connection-test"
    },
    "estimatedRoundsToMVP": 4,
    "estimatedCostToMVP": "$0.50–$1.20"
  }
}
```

### Agent Status Updates

During execution, agents should update node completion status:

```
COO assigns task → node status: in_progress
Agent completes task → node status: complete
QA agent verifies → node status: verified
All MVP nodes verified → 🏆 LEVEL 1 CLEARED
```

---

## 4. Data Model Changes

### Node Metadata Extension

```javascript
// In NodeManager.js — extend node data model
{
  id: 'node_abc123',
  label: 'User Authentication',
  type: 'feature',
  priority: 'critical',
  agentRole: 'backend',

  // NEW — Sprint 5.5
  completionStatus: 'not_started',  // not_started | in_progress | complete | verified
  mvpCritical: true,                // Is this required for MVP?
  completedAt: null,                // Timestamp when marked complete
  verifiedAt: null,                 // Timestamp when verified by QA/Sentinel
  completedBy: null,                // Agent roleId that completed it
}
```

### Project Metadata Extension

```javascript
// In Storage.js or FileManager.js — extend project save data
{
  nodes: [ ... ],
  connections: [ ... ],
  viewport: { ... },

  // NEW — Sprint 5.5
  projectLevel: 0,                  // 0 = Blueprint, 1 = MVP, 2 = Growth, 3 = Mastery
  mvpAchievement: null,             // { achievedAt, timeToMVP, costToMVP, agentRounds, stats }
  bossGate: null,                   // { nodeId, description, clearedAt }
}
```

---

## 5. Event Bus Channels

| Event                       | Emitter                  | Consumer                | Payload                           |
| --------------------------- | ------------------------ | ----------------------- | --------------------------------- |
| `node:completion-changed`   | NodeManager, ContextMenu | MVPScorecard            | `{ nodeId, status, mvpCritical }` |
| `mvp:score-updated`         | MVPScorecard             | AgentPanel              | `{ score, level, remaining }`     |
| `mvp:boss-gate-cleared`     | MVPScorecard             | MVPAchievement          | `{ nodeId, timestamp }`           |
| `mvp:level-achieved`        | MVPScorecard             | MVPAchievement, Storage | `{ level, stats }`                |
| `mvp:achievement-dismissed` | MVPAchievement           | AgentPanel              | `{}`                              |

---

## 6. File Manifest

| File                                  | Type   | Est. Lines | Purpose                                   |
| ------------------------------------- | ------ | ---------- | ----------------------------------------- |
| `src/ui/MVPScorecard.js`              | New    | ~300       | Progress tracker component                |
| `src/ui/MVPAchievement.js`            | New    | ~200       | Achievement overlay + animation           |
| `src/css/mvp-scorecard.css`           | New    | ~150       | Scorecard + progress bar styles           |
| `src/css/mvp-achievement.css`         | New    | ~100       | Celebration animations                    |
| `src/ui/NodeManager.js`               | Modify | +50        | Add completionStatus + mvpCritical fields |
| `src/ui/PropertyPanel.js`             | Modify | +40        | Completion dropdown + MVP toggle          |
| `src/ui/ContextMenu.js`               | Modify | +30        | Right-click completion actions            |
| `src/ui/AgentPanel.js`                | Modify | +20        | Inject MVPScorecard                       |
| `src/agents/COOAgent.js`              | Modify | +60        | MVP planning + Boss Gate detection        |
| `src/agents/ExecutionEngine.js`       | Modify | +40        | Completion tracking during rounds         |
| `src/core/Storage.js`                 | Modify | +20        | Persist achievement data                  |
| `src/prompts/AgentPrompts.js`         | Modify | +30        | MVP awareness in agent prompts            |
| `src/serializer/MindMapSerializer.js` | Modify | +10        | Serialize new fields                      |
| `src/css/nodes.css`                   | Modify | +40        | Completion ring + MVP badge styles        |
| **Total**                             |        | **~1,090** |                                           |

---

## 7. Acceptance Criteria

- [ ] Nodes can be marked with `completionStatus` via right-click menu and property panel
- [ ] Nodes can be tagged as `mvpCritical` via toggle in property panel
- [ ] MVP-critical nodes display a visual badge (star/crown)
- [ ] Completion status shows as a colored ring/indicator on nodes
- [ ] MVPScorecard appears in Agent Panel showing progress breakdown by category
- [ ] Project level (0–3) is calculated and displayed
- [ ] Boss Gate is identified (manually or by COO agent)
- [ ] When all MVP nodes reach `verified` status, Level 1 achievement triggers
- [ ] Achievement overlay displays with stats (time, cost, rounds, nodes)
- [ ] Achievement data persists with project save
- [ ] COO agent planning includes MVP-critical node identification
- [ ] Agent execution updates node completion status as tasks complete

---

## 8. Dependencies

| Dependency                         | Status      | Required For                    |
| ---------------------------------- | ----------- | ------------------------------- |
| Sprint 5 — Agent execution working | In progress | Agent-driven completion updates |
| Node metadata system               | ✅ Complete | Extending with new fields       |
| CostTracker                        | ✅ Complete | Cost-to-MVP calculation         |
| AgentPanel                         | ✅ Complete | Scorecard injection point       |
| MindMapSerializer                  | ✅ Complete | Serializing new fields          |

---

## 9. Design Philosophy

> **"All projects should strive to this 1st level."**
>
> The MVP Boss Level isn't just a feature — it's a philosophy. It tells the
> user: _your project isn't done when it's "good enough." It's done when it
> can accept its first transaction._ Whether that's a payment, a user signup,
> an API response, or a page load — the Boss Gate is the proof that your
> project is REAL.
>
> By gamifying this milestone, we make the journey measurable, the progress
> visible, and the achievement celebratable. Every project in MindMapper
> starts at Level 0. The question is: **can your agents get it to Level 1?**
