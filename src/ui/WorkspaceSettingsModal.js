/**
 * WorkspaceSettingsModal — Settings panel for configuring project workspace
 * preferences that get injected into every workflow prompt.
 *
 * Opens via gear icon in toolbar. All settings are auto-saved to localStorage
 * via WorkspaceSettings.
 */
import { WorkspaceSettings } from '../settings/WorkspaceSettings.js';

export class WorkspaceSettingsModal {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this.settings = new WorkspaceSettings();
    this._createDOM();
    this._bindEvents();
  }

  // ─── DOM Construction ───────────────────────────────────────────────

  _createDOM() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'workspace-settings-overlay';
    this.overlay.className = 'prompt-export-overlay'; // Reuse existing overlay styling
    this.overlay.innerHTML = `
      <div class="prompt-export-modal glass-panel workspace-settings-modal" id="workspace-settings-modal">
        <!-- Header -->
        <div class="prompt-export-header">
          <div class="export-header-left">
            <span class="export-icon">⚙️</span>
            <h2 class="export-title">Workspace Settings</h2>
          </div>
          <button class="prompt-export-close" id="ws-settings-close" title="Close">✕</button>
        </div>

        <!-- Settings Body -->
        <div class="workspace-settings-body">
          <!-- Left column: Project & Git -->
          <div class="settings-column">

            <!-- Project Location -->
            <fieldset class="settings-section">
              <legend class="settings-legend">📁 Project Location</legend>
              <div class="settings-field">
                <label for="ws-dev-folder">Dev folder path</label>
                <input type="text" id="ws-dev-folder" class="export-input" placeholder="D:\\AI_Dev\\projects  or  ~/dev" />
                <span class="field-hint">Root folder where new projects are created</span>
              </div>
              <div class="settings-field inline">
                <input type="checkbox" id="ws-create-subfolder" />
                <label for="ws-create-subfolder">Create a subfolder named after the project</label>
              </div>
            </fieldset>

            <!-- Git & GitHub -->
            <fieldset class="settings-section">
              <legend class="settings-legend">🐙 Git & GitHub</legend>
              <div class="settings-field inline">
                <input type="checkbox" id="ws-github-enabled" />
                <label for="ws-github-enabled">Enable Git/GitHub setup in prompts</label>
              </div>
              <div id="git-settings-group">
                <div class="settings-info-box" id="ws-git-prereq">
                  <span class="info-icon">💡</span>
                  <div class="info-content">
                    <strong>How it works:</strong> MindMapper puts Git/GitHub instructions into the prompt.
                    <strong>Claude Code</strong> then runs <code>git</code> and <code>gh</code> commands in <em>your</em> terminal
                    using <em>your</em> machine's existing auth.
                    <br/><br/>
                    <strong>Prerequisites (one-time setup):</strong><br/>
                    <code>winget install GitHub.cli</code> → then <code>gh auth login</code>
                  </div>
                </div>
                <div class="settings-row">
                  <div class="settings-field">
                    <label for="ws-github-username">GitHub username</label>
                    <input type="text" id="ws-github-username" class="export-input" placeholder="myuser" />
                  </div>
                  <div class="settings-field">
                    <label for="ws-github-org">Org (optional)</label>
                    <input type="text" id="ws-github-org" class="export-input" placeholder="my-org" />
                  </div>
                </div>
                <div class="settings-row">
                  <div class="settings-field">
                    <label for="ws-repo-visibility">Repo visibility</label>
                    <select id="ws-repo-visibility" class="export-input">
                      <option value="private">🔒 Private (default)</option>
                      <option value="public">🌐 Public</option>
                    </select>
                  </div>
                  <div class="settings-field">
                    <label for="ws-default-branch">Default branch</label>
                    <input type="text" id="ws-default-branch" class="export-input" placeholder="main" />
                  </div>
                </div>
                <div class="settings-field">
                  <label for="ws-git-auth-method">Auth method on your machine</label>
                  <select id="ws-git-auth-method" class="export-input">
                    <option value="gh-cli">GitHub CLI (gh auth login) — recommended</option>
                    <option value="ssh">SSH keys</option>
                    <option value="credential-manager">Git Credential Manager</option>
                    <option value="none">Not set up yet</option>
                  </select>
                  <span class="field-hint" id="ws-auth-hint">The prompt will include instructions matching your auth method</span>
                </div>
                <div class="settings-field inline">
                  <input type="checkbox" id="ws-auto-init" />
                  <label for="ws-auto-init">Auto-init Git repo with initial commit</label>
                </div>
                <div class="settings-field inline">
                  <input type="checkbox" id="ws-auto-push" />
                  <label for="ws-auto-push">Auto-create remote repo & push</label>
                </div>
                <div class="settings-field">
                  <label for="ws-commit-convention">Commit convention</label>
                  <select id="ws-commit-convention" class="export-input">
                    <option value="conventional">Conventional Commits (feat:, fix:, docs:...)</option>
                    <option value="freeform">Freeform (descriptive messages)</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <!-- Security -->
            <fieldset class="settings-section">
              <legend class="settings-legend">🛡️ Security Defaults</legend>
              <div class="settings-field inline">
                <input type="checkbox" id="ws-enforce-env" />
                <label for="ws-enforce-env">Enforce .env files for all secrets</label>
              </div>
              <div class="settings-field inline">
                <input type="checkbox" id="ws-require-gitignore" />
                <label for="ws-require-gitignore">Require .gitignore for sensitive files</label>
              </div>
            </fieldset>
          </div>

          <!-- Right column: Stack & Conventions -->
          <div class="settings-column">

            <!-- Tech Stack -->
            <fieldset class="settings-section">
              <legend class="settings-legend">🧰 Tech Stack Preferences</legend>
              <div class="settings-field">
                <label for="ws-preferred-stack">Preferred stack</label>
                <input type="text" id="ws-preferred-stack" class="export-input" placeholder="e.g. Next.js + Tailwind + Supabase" />
                <span class="field-hint">Leave empty to auto-detect or ask</span>
              </div>
              <div class="settings-row">
                <div class="settings-field">
                  <label for="ws-package-manager">Package manager</label>
                  <select id="ws-package-manager" class="export-input">
                    <option value="npm">npm</option>
                    <option value="yarn">yarn</option>
                    <option value="pnpm">pnpm</option>
                    <option value="bun">bun</option>
                  </select>
                </div>
                <div class="settings-field">
                  <label for="ws-preferred-language">Language</label>
                  <select id="ws-preferred-language" class="export-input">
                    <option value="">Auto-detect</option>
                    <option value="TypeScript">TypeScript</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="Dart">Dart / Flutter</option>
                    <option value="Python">Python</option>
                    <option value="Rust">Rust</option>
                    <option value="Go">Go</option>
                    <option value="Swift">Swift</option>
                  </select>
                </div>
              </div>
              <div class="settings-field">
                <label for="ws-node-version">Node.js version (optional)</label>
                <input type="text" id="ws-node-version" class="export-input" placeholder="e.g. 20 — leave empty for auto-detect" />
              </div>
            </fieldset>

            <!-- Coding Conventions -->
            <fieldset class="settings-section">
              <legend class="settings-legend">📐 Coding Conventions</legend>
              <div class="settings-row">
                <div class="settings-field">
                  <label for="ws-linter">Linter</label>
                  <select id="ws-linter" class="export-input">
                    <option value="eslint">ESLint</option>
                    <option value="biome">Biome</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div class="settings-field">
                  <label for="ws-formatter">Formatter</label>
                  <select id="ws-formatter" class="export-input">
                    <option value="prettier">Prettier</option>
                    <option value="biome">Biome</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              <div class="settings-row">
                <div class="settings-field">
                  <label for="ws-css-approach">CSS approach</label>
                  <select id="ws-css-approach" class="export-input">
                    <option value="vanilla">Vanilla CSS</option>
                    <option value="tailwind">Tailwind CSS</option>
                    <option value="css-modules">CSS Modules</option>
                    <option value="styled-components">Styled Components</option>
                  </select>
                </div>
                <div class="settings-field">
                  <label for="ws-test-framework">Test framework</label>
                  <select id="ws-test-framework" class="export-input">
                    <option value="">None / Auto-detect</option>
                    <option value="vitest">Vitest</option>
                    <option value="jest">Jest</option>
                    <option value="playwright">Playwright</option>
                    <option value="cypress">Cypress</option>
                  </select>
                </div>
              </div>
            </fieldset>

            <!-- Deployment -->
            <fieldset class="settings-section">
              <legend class="settings-legend">🚀 Deployment & CI</legend>
              <div class="settings-field">
                <label>Target platforms</label>
                <div class="checkbox-group" id="ws-platforms">
                  <label><input type="checkbox" value="web" /> Web</label>
                  <label><input type="checkbox" value="ios" /> iOS</label>
                  <label><input type="checkbox" value="android" /> Android</label>
                  <label><input type="checkbox" value="desktop" /> Desktop</label>
                </div>
              </div>
              <div class="settings-row">
                <div class="settings-field">
                  <label for="ws-hosting">Hosting</label>
                  <select id="ws-hosting" class="export-input">
                    <option value="">None / Ask me</option>
                    <option value="vercel">Vercel</option>
                    <option value="firebase">Firebase Hosting</option>
                    <option value="netlify">Netlify</option>
                    <option value="aws">AWS</option>
                    <option value="self-hosted">Self-hosted</option>
                  </select>
                </div>
                <div class="settings-field">
                  <label for="ws-ci">CI/CD</label>
                  <select id="ws-ci" class="export-input">
                    <option value="">None</option>
                    <option value="github-actions">GitHub Actions</option>
                    <option value="gitlab-ci">GitLab CI</option>
                    <option value="circleci">CircleCI</option>
                  </select>
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        <!-- Footer -->
        <div class="prompt-export-footer">
          <div class="export-footer-left">
            <button class="export-btn" id="ws-btn-reset" title="Reset all settings to defaults">🔄 Reset Defaults</button>
          </div>
          <div class="export-footer-right">
            <span class="ws-save-indicator" id="ws-save-indicator">✓ Auto-saved</span>
            <button class="export-btn primary" id="ws-btn-done">Done</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);
  }

  // ─── Event Binding ────────────────────────────────────────────────────

  _bindEvents() {
    // Close
    this.overlay.querySelector('#ws-settings-close').addEventListener('click', () => this.hide());
    this.overlay.querySelector('#ws-btn-done').addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.classList.contains('visible')) this.hide();
    });

    // Reset
    this.overlay.querySelector('#ws-btn-reset').addEventListener('click', () => {
      this.settings.reset();
      this._populateFields();
      this._showSaveIndicator('Defaults restored');
    });

    // GitHub toggle → show/hide git sub-settings
    this.overlay.querySelector('#ws-github-enabled').addEventListener('change', (e) => {
      const group = this.overlay.querySelector('#git-settings-group');
      group.style.display = e.target.checked ? '' : 'none';
    });

    // Auto-save on any input change (debounced)
    let saveDebounce = null;
    this.overlay.addEventListener('input', () => {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => this._saveFields(), 300);
    });
    this.overlay.addEventListener('change', () => {
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(() => this._saveFields(), 100);
    });
  }

  // ─── Public API ────────────────────────────────────────────────────

  show() {
    this._populateFields();
    this.overlay.classList.add('visible');
    const modal = this.overlay.querySelector('#workspace-settings-modal');
    requestAnimationFrame(() => modal.classList.add('visible'));
  }

  hide() {
    this._saveFields(); // Ensure final save
    const modal = this.overlay.querySelector('#workspace-settings-modal');
    modal.classList.remove('visible');
    setTimeout(() => this.overlay.classList.remove('visible'), 250);
  }

  /** Get workspace instructions for prompt generation */
  getWorkspaceInstructions(extraOptions = {}) {
    return this.settings.toWorkspaceInstructions(extraOptions);
  }

  // ─── Field Population ──────────────────────────────────────────────

  _populateFields() {
    const s = this.settings.getAll();
    const q = (sel) => this.overlay.querySelector(sel);

    // Project Location
    q('#ws-dev-folder').value = s.devFolder;
    q('#ws-create-subfolder').checked = s.createSubfolder;

    // Git & GitHub
    q('#ws-github-enabled').checked = s.githubEnabled;
    q('#git-settings-group').style.display = s.githubEnabled ? '' : 'none';
    q('#ws-github-username').value = s.githubUsername;
    q('#ws-github-org').value = s.githubOrg;
    q('#ws-repo-visibility').value = s.repoVisibility;
    q('#ws-default-branch').value = s.defaultBranch;
    q('#ws-auto-init').checked = s.autoInitRepo;
    q('#ws-auto-push').checked = s.autoPushToRemote;
    q('#ws-commit-convention').value = s.commitConvention;
    q('#ws-git-auth-method').value = s.gitAuthMethod || 'gh-cli';

    // Security
    q('#ws-enforce-env').checked = s.enforceEnvFiles;
    q('#ws-require-gitignore').checked = s.requireGitignore;

    // Tech Stack
    q('#ws-preferred-stack').value = s.preferredStack;
    q('#ws-package-manager').value = s.packageManager;
    q('#ws-preferred-language').value = s.preferredLanguage;
    q('#ws-node-version').value = s.nodeVersion;

    // Coding Conventions
    q('#ws-linter').value = s.linter;
    q('#ws-formatter').value = s.formatter;
    q('#ws-css-approach').value = s.cssApproach;
    q('#ws-test-framework').value = s.testFramework;

    // Deployment
    q('#ws-hosting').value = s.hostingProvider;
    q('#ws-ci').value = s.ciProvider;

    // Platforms checkboxes
    const platformCheckboxes = this.overlay.querySelectorAll('#ws-platforms input[type="checkbox"]');
    platformCheckboxes.forEach(cb => {
      cb.checked = s.targetPlatforms.includes(cb.value);
    });
  }

  // ─── Field Saving ──────────────────────────────────────────────────

  _saveFields() {
    const q = (sel) => this.overlay.querySelector(sel);

    // Collect platform checkboxes
    const platforms = [];
    this.overlay.querySelectorAll('#ws-platforms input[type="checkbox"]:checked').forEach(cb => {
      platforms.push(cb.value);
    });

    this.settings.update({
      devFolder: q('#ws-dev-folder').value.trim(),
      createSubfolder: q('#ws-create-subfolder').checked,
      githubEnabled: q('#ws-github-enabled').checked,
      githubUsername: q('#ws-github-username').value.trim(),
      githubOrg: q('#ws-github-org').value.trim(),
      repoVisibility: q('#ws-repo-visibility').value,
      defaultBranch: q('#ws-default-branch').value.trim() || 'main',
      autoInitRepo: q('#ws-auto-init').checked,
      autoPushToRemote: q('#ws-auto-push').checked,
      commitConvention: q('#ws-commit-convention').value,
      gitAuthMethod: q('#ws-git-auth-method').value,
      enforceEnvFiles: q('#ws-enforce-env').checked,
      requireGitignore: q('#ws-require-gitignore').checked,
      preferredStack: q('#ws-preferred-stack').value.trim(),
      packageManager: q('#ws-package-manager').value,
      preferredLanguage: q('#ws-preferred-language').value,
      nodeVersion: q('#ws-node-version').value.trim(),
      linter: q('#ws-linter').value,
      formatter: q('#ws-formatter').value,
      cssApproach: q('#ws-css-approach').value,
      testFramework: q('#ws-test-framework').value,
      hostingProvider: q('#ws-hosting').value,
      ciProvider: q('#ws-ci').value,
      targetPlatforms: platforms,
    });

    this._showSaveIndicator('✓ Auto-saved');
  }

  _showSaveIndicator(text) {
    const el = this.overlay.querySelector('#ws-save-indicator');
    if (el) {
      el.textContent = text;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    }
  }
}
