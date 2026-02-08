/**
 * WorkspaceSettings — Persists user project/workspace preferences.
 *
 * These settings are injected into every generated workflow prompt so the
 * executing agent (Claude Code) knows WHERE to build, HOW to set up git,
 * and WHAT stack/conventions to use.
 *
 * Storage: localStorage (immediate) — no Tauri dependency.
 */
const SETTINGS_KEY = 'mindmapper_workspace_settings';

const DEFAULTS = {
  // ── Project Location ─────────────────────────────────────────────────
  devFolder: '',               // e.g. D:\AI_Dev\projects  or ~/dev
  createSubfolder: true,       // Create a subfolder named after the project

  // ── GitHub / Git ──────────────────────────────────────────────────────
  githubEnabled: true,
  githubUsername: '',           // Filled in via Settings panel, persisted in localStorage
  githubOrg: '',               // Optional — org name if using org repos
  repoVisibility: 'private',   // 'private' | 'public'
  autoInitRepo: true,          // git init + initial commit
  autoPushToRemote: false,     // Auto create remote and push
  defaultBranch: 'main',
  commitConvention: 'conventional', // 'conventional' | 'freeform'
  gitAuthMethod: 'gh-cli',     // 'gh-cli' | 'ssh' | 'credential-manager' | 'none'

  // ── Tech Stack Preferences ────────────────────────────────────────────
  preferredStack: '',          // e.g. "Next.js + Tailwind + Supabase"
  packageManager: 'npm',       // 'npm' | 'yarn' | 'pnpm' | 'bun'
  nodeVersion: '',             // e.g. "20" — leave empty for auto-detect
  preferredLanguage: '',       // e.g. "TypeScript" | "JavaScript" | "Dart"

  // ── Coding Conventions ────────────────────────────────────────────────
  linter: 'eslint',           // 'eslint' | 'biome' | 'none'
  formatter: 'prettier',      // 'prettier' | 'biome' | 'none'
  testFramework: '',           // e.g. "vitest" | "jest" | "playwright"
  cssApproach: 'vanilla',     // 'vanilla' | 'tailwind' | 'css-modules' | 'styled-components'

  // ── Deployment / CI ───────────────────────────────────────────────────
  targetPlatforms: [],         // e.g. ['web', 'ios', 'android', 'desktop']
  ciProvider: '',              // e.g. 'github-actions' | 'none'
  hostingProvider: '',         // e.g. 'vercel' | 'firebase' | 'netlify'

  // ── Security Defaults ─────────────────────────────────────────────────
  enforceEnvFiles: true,       // Always use .env, never hardcode secrets
  requireGitignore: true,      // Ensure .gitignore includes sensitive files
};

export class WorkspaceSettings {
  constructor() {
    this._settings = { ...DEFAULTS };
    this._load();
  }

  /** Get a single setting value */
  get(key) {
    return this._settings[key];
  }

  /** Get all settings as a plain object */
  getAll() {
    return { ...this._settings };
  }

  /** Update one or more settings */
  update(partial) {
    Object.assign(this._settings, partial);
    this._save();
  }

  /** Reset all settings to defaults */
  reset() {
    this._settings = { ...DEFAULTS };
    this._save();
  }

  /**
   * Export settings as workspace_instructions for the workflow prompt.
   * This is the bridge between UI preferences and the generated JSON.
   */
  toWorkspaceInstructions(extraOptions = {}) {
    const s = this._settings;
    const instructions = {};

    // ── Project Setup ─────────────────────────────────────────────────
    if (s.devFolder) {
      instructions.project_directory = {
        base_path: s.devFolder,
        create_subfolder: s.createSubfolder,
        instruction: s.createSubfolder
          ? `Create the project in a new subfolder under "${s.devFolder}" named after the project (kebab-case).`
          : `Use "${s.devFolder}" as the project root directory.`
      };
    }

    // ── Git & GitHub ──────────────────────────────────────────────────
    if (s.githubEnabled) {
      instructions.git_setup = {
        auto_init: s.autoInitRepo,
        default_branch: s.defaultBranch,
        commit_convention: s.commitConvention,
        commit_convention_note: s.commitConvention === 'conventional'
          ? 'Use Conventional Commits: feat:, fix:, docs:, chore:, refactor:, test:, style:, perf:, ci:, build:'
          : 'Use clear, descriptive commit messages.',
      };

      if (s.githubUsername || s.githubOrg) {
        const owner = s.githubOrg || s.githubUsername;
        const authMethod = s.gitAuthMethod || 'gh-cli';
        
        // Auth-method-specific instructions
        const authInstructions = {
          'gh-cli': {
            setup_prereq: 'GitHub CLI (gh) must be authenticated. User should have run: gh auth login',
            create_cmd: s.autoPushToRemote
              ? `gh repo create ${owner}/<project-name> --${s.repoVisibility} --source=. --remote=origin --push`
              : null,
            remote_url: `https://github.com/${owner}/<project-name>.git`,
          },
          'ssh': {
            setup_prereq: 'SSH key must be configured in GitHub account settings.',
            create_cmd: null,
            remote_url: `git@github.com:${owner}/<project-name>.git`,
          },
          'credential-manager': {
            setup_prereq: 'Git Credential Manager handles auth automatically on push.',
            create_cmd: null,
            remote_url: `https://github.com/${owner}/<project-name>.git`,
          },
          'none': {
            setup_prereq: '⚠️ Git auth is NOT configured. Do NOT attempt to push. Only initialize local git repo.',
            create_cmd: null,
            remote_url: null,
          }
        };

        const auth = authInstructions[authMethod] || authInstructions['gh-cli'];
        instructions.github = {
          owner,
          visibility: s.repoVisibility,
          auth_method: authMethod,
          setup_prereq: auth.setup_prereq,
          auto_create_repo: s.autoPushToRemote && authMethod !== 'none',
          remote_url: auth.remote_url,
          instruction: authMethod === 'none'
            ? 'Git auth is not configured. Initialize a local git repository only — do NOT attempt remote operations.'
            : s.autoPushToRemote && auth.create_cmd
              ? `Create the repo and push: ${auth.create_cmd}`
              : auth.remote_url
                ? `Set remote origin to: ${auth.remote_url}`
                : `The user will configure git remote manually.`
        };
      }
    }

    // ── Tech Stack ────────────────────────────────────────────────────
    instructions.preferred_stack = s.preferredStack || extraOptions.stack || 'Determine from existing project files or ask user.';
    instructions.package_manager = s.packageManager;

    if (s.nodeVersion) {
      instructions.node_version = s.nodeVersion;
    }
    if (s.preferredLanguage) {
      instructions.preferred_language = s.preferredLanguage;
    }

    // ── Coding Conventions ────────────────────────────────────────────
    instructions.coding_conventions = {
      linter: s.linter,
      formatter: s.formatter,
      css_approach: s.cssApproach,
    };
    if (s.testFramework) {
      instructions.coding_conventions.test_framework = s.testFramework;
    }

    // ── Deployment ────────────────────────────────────────────────────
    if (s.targetPlatforms.length > 0) {
      instructions.target_platforms = s.targetPlatforms;
    }
    if (s.hostingProvider) {
      instructions.hosting = s.hostingProvider;
    }
    if (s.ciProvider) {
      instructions.ci = s.ciProvider;
    }

    // ── Security Defaults ─────────────────────────────────────────────
    instructions.security_defaults = {
      enforce_env_files: s.enforceEnvFiles,
      require_gitignore: s.requireGitignore,
      policies: [
        'NEVER commit secrets, API keys, or tokens to the repository.',
        'Use .env files for all sensitive configuration. Add .env to .gitignore.',
        s.requireGitignore ? 'Verify .gitignore covers: .env*, node_modules/, dist/, .DS_Store, *.log' : null,
      ].filter(Boolean)
    };

    // ── General Policies ──────────────────────────────────────────────
    instructions.codebase_scope = 'Use the current workspace as the canonical project root. Inspect existing files, package configuration, and any docs to align architecture and naming.';
    instructions.allowed_tools = extraOptions.allowedTools || [
      'editor_read_write', 'terminal', 'browser_preview', 'git'
    ];
    instructions.general_policies = [
      'Prefer iterative plans and small, reviewable patches over large monolithic edits.',
      'Keep all design and technical decisions documented in /docs.',
      'Before executing potentially destructive changes (deletes, mass refactors), restate your plan and confirm with the user if the risk is high.',
      'Run builds and tests after each significant change to catch regressions early.',
    ];

    return instructions;
  }

  // ── Private ─────────────────────────────────────────────────────────
  _load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Merge saved over defaults (handles new keys added in future versions)
        Object.assign(this._settings, saved);
      }
    } catch (e) {
      console.warn('WorkspaceSettings load failed:', e);
    }
  }

  _save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this._settings));
    } catch (e) {
      console.warn('WorkspaceSettings save failed:', e);
    }
  }
}
