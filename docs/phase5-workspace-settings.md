# Phase 5 — Workspace Settings

> **Status:** ✅ Complete & Tested  
> **Date:** 2026-02-07 / 2026-02-08  
> **Author:** Antigravity + El7ias

---

## Overview

Phase 5 introduces a **Workspace Settings** panel that lets users configure persistent project preferences — dev folder location, GitHub account details, preferred tech stack, coding conventions, and deployment targets. These preferences are injected into every generated workflow prompt, giving AI agents (Claude Code) the context they need to set up projects correctly without asking.

---

## Architecture

```
┌────────────────────────────────┐
│  WorkspaceSettingsModal (UI)   │  ← User fills in fields
│  src/ui/WorkspaceSettingsModal │
└────────────┬───────────────────┘
             │ auto-saves on change
             ▼
┌────────────────────────────────┐
│  WorkspaceSettings (Engine)    │  ← Persists to localStorage
│  src/settings/WorkspaceSettings│
└────────────┬───────────────────┘
             │ .toWorkspaceInstructions()
             ▼
┌────────────────────────────────┐
│  PromptExportModal._generate() │  ← Reads settings, passes to generator
│  src/ui/PromptExportModal.js   │
└────────────┬───────────────────┘
             │ genOptions.workspaceInstructions
             ▼
┌────────────────────────────────┐
│  WorkflowPromptGenerator       │  ← Embeds in workspace_instructions
│  _buildTaskDefinition()        │     (falls back to hardcoded defaults
│  src/export/WorkflowPrompt...  │      if no settings provided)
└────────────┬───────────────────┘
             │
             ▼
        Generated Prompt JSON
        (pasted into Claude Code)
```

### Key Design Decisions

1. **No personal data in source code** — Defaults are all empty strings. User-specific values (GitHub username, dev folder paths) live exclusively in `localStorage`, per-user, per-machine. Safe for executables, SaaS, and open source distribution.

2. **Graceful fallback** — If no settings modal is provided (e.g., older code paths), `_buildTaskDefinition` falls back to the original hardcoded `_buildWorkspaceInstructions()` function. Zero breaking changes.

3. **Auth-aware Git instructions** — The system doesn't store credentials. It asks the user _which_ auth method they use (GitHub CLI, SSH, Credential Manager, or "Not set up") and generates method-specific instructions in the prompt.

4. **Auto-save with debounce** — Settings save 300ms after the last keystroke (input events) or 100ms after dropdown/checkbox changes. No explicit "Save" button needed.

---

## Files Created

### `src/settings/WorkspaceSettings.js`

**Purpose:** Settings engine — persistence layer and prompt transformer.

| Method                                  | Description                            |
| --------------------------------------- | -------------------------------------- |
| `get(key)`                              | Read a single setting                  |
| `getAll()`                              | Read all settings as plain object      |
| `update(partial)`                       | Merge partial updates and save         |
| `reset()`                               | Restore all defaults                   |
| `toWorkspaceInstructions(extraOptions)` | Transform settings → prompt-ready JSON |
| `_load()` / `_save()`                   | localStorage read/write                |

**Settings Schema:**

```javascript
{
  // Project Location
  devFolder: '',                // Root path for new projects
  createSubfolder: true,        // Auto-create project-named subfolder

  // GitHub / Git
  githubEnabled: true,
  githubUsername: '',            // e.g. "El7ias"
  githubOrg: '',                // Optional org
  repoVisibility: 'private',   // 'private' | 'public'
  autoInitRepo: true,           // git init + initial commit
  autoPushToRemote: false,      // gh repo create + push
  defaultBranch: 'main',
  commitConvention: 'conventional',
  gitAuthMethod: 'gh-cli',     // 'gh-cli' | 'ssh' | 'credential-manager' | 'none'

  // Tech Stack
  preferredStack: '',           // e.g. "Next.js + Tailwind + Supabase"
  packageManager: 'npm',
  nodeVersion: '',
  preferredLanguage: '',

  // Coding Conventions
  linter: 'eslint',
  formatter: 'prettier',
  testFramework: '',
  cssApproach: 'vanilla',

  // Deployment
  targetPlatforms: [],
  ciProvider: '',
  hostingProvider: '',

  // Security
  enforceEnvFiles: true,
  requireGitignore: true,
}
```

**Auth-Aware Prompt Generation:**

When `gitAuthMethod` is set, the generated prompt includes method-specific instructions:

| Auth Method          | Remote URL Format        | Auto-Create Command                                     |
| -------------------- | ------------------------ | ------------------------------------------------------- |
| `gh-cli`             | `https://github.com/...` | `gh repo create owner/name --private --source=. --push` |
| `ssh`                | `git@github.com:...`     | Manual only                                             |
| `credential-manager` | `https://github.com/...` | Manual only                                             |
| `none`               | None                     | ⚠️ Prompt says "do NOT attempt remote operations"       |

---

### `src/ui/WorkspaceSettingsModal.js`

**Purpose:** Settings panel UI — two-column modal with 6 sections.

**Sections:**

| #   | Section               | Fields                                                                                  |
| --- | --------------------- | --------------------------------------------------------------------------------------- |
| 1   | 📁 Project Location   | Dev folder path, create subfolder toggle                                                |
| 2   | 🐙 Git & GitHub       | Username, org, visibility, branch, auth method, auto-init, auto-push, commit convention |
| 3   | 🛡️ Security Defaults  | Enforce .env, require .gitignore                                                        |
| 4   | 🧰 Tech Stack         | Preferred stack, package manager, language, Node version                                |
| 5   | 📐 Coding Conventions | Linter, formatter, CSS approach, test framework                                         |
| 6   | 🚀 Deployment & CI    | Target platforms, hosting provider, CI provider                                         |

**Special UI features:**

- Git & GitHub section includes an **info box** explaining the auth flow (MindMapper → prompt → Claude Code → your terminal → your auth)
- GitHub sub-settings toggle on/off with the "Enable Git/GitHub" checkbox
- Reset Defaults button in footer
- Auto-saved indicator with flash animation

---

## Files Modified

### `src/main.js`

- **Import:** Added `WorkspaceSettingsModal` import
- **Init:** `this.workspaceSettingsModal = new WorkspaceSettingsModal(this.bus)` — initialized before `PromptExportModal` so it can be passed as a dependency
- **Constructor:** `PromptExportModal` now receives `this.workspaceSettingsModal` as 4th argument
- **Event:** `btn-workspace-settings` click listener opens the modal

### `src/ui/PromptExportModal.js`

- **Constructor:** Accepts optional 4th param `settingsModal`
- **`_generate()`:** If settings modal exists, calls `settingsModal.getWorkspaceInstructions()` and passes result as `genOptions.workspaceInstructions` to both `generateWorkflowPrompt()` and `generateTaskJSON()`

### `src/export/WorkflowPromptGenerator.js`

- **`_buildTaskDefinition()`:** Line 51 changed from:
  ```javascript
  workspace_instructions: _buildWorkspaceInstructions(options),
  ```
  to:
  ```javascript
  workspace_instructions: options.workspaceInstructions || _buildWorkspaceInstructions(options),
  ```
  This means user settings take priority; hardcoded defaults are the fallback.

### `index.html`

- **Toolbar:** Added gear icon Settings button (`id="btn-workspace-settings"`) with SVG gear path, positioned after Generate Prompt with a divider

### `src/styles/main.css`

- **Added ~170 lines** of CSS for:
  - `.workspace-settings-modal` — modal width override
  - `.workspace-settings-body` — two-column flex layout
  - `.settings-column`, `.settings-section`, `.settings-legend` — fieldset structure
  - `.settings-field`, `.settings-field.inline` — label/input pairs
  - `.settings-row` — side-by-side field pairs
  - `.checkbox-group` — platform checkboxes
  - `.field-hint` — helper text
  - `.ws-save-indicator` — auto-save flash
  - `.settings-info-box` — the Git auth explanation banner

---

## GitHub CLI Setup

**Completed during this session:**

| Step                                       | Status           |
| ------------------------------------------ | ---------------- |
| `winget install GitHub.cli`                | ✅ Installed     |
| `gh auth login --web --git-protocol https` | ✅ Authenticated |
| Account: **El7ias**                        | ✅ Verified      |
| Protocol: HTTPS                            | ✅ Configured    |
| Token scopes: `gist`, `read:org`, `repo`   | ✅ Sufficient    |

**Auth verification command:**

```powershell
gh auth status
# → ✓ Logged in to github.com account El7ias
```

---

## Testing Status

| Test                                         | Result                           |
| -------------------------------------------- | -------------------------------- |
| Settings panel opens via toolbar gear icon   | ✅ Verified                      |
| Fields auto-save to localStorage             | ✅ Verified                      |
| Settings appear in generated prompt JSON     | ✅ Verified (Test #1)            |
| Full project test with real agent execution  | ✅ Extremely promising (Test #4) |
| Rate limit hit at ~1:50 AM, resuming at 6 AM | ⏳ Pending completion            |

---

## Security Considerations

- **No credentials in source code** — GitHub username, tokens, SSH keys are never stored in MindMapper
- **localStorage only** — User settings are per-browser, per-machine, never transmitted
- **Auth method awareness** — If user selects "Not set up yet", the prompt explicitly tells Claude Code NOT to attempt remote operations
- **Private by default** — Repo visibility defaults to `private`
- **Security policies always included** — `.env` enforcement and `.gitignore` requirements are on by default

---

## Next Steps (Post-Testing)

1. **Complete rate-limited project test** — Resume when API limits reset (~6 AM)
2. **Settings import/export** — Allow `.json` export for portability across machines
3. **Wire merged workspace instructions** — Blend user settings with generator defaults rather than full replacement
4. **Tauri desktop packaging** — Phase 4 scaffolding is in place; package as native app
5. **Auto-detect GitHub username** — Could run `gh api user -q .login` on app startup to pre-fill
