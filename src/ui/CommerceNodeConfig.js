/**
 * CommerceNodeConfig — Configuration panel for commerce/integration nodes.
 *
 * Phase 8: When a commerce node is double-clicked, this panel opens as a
 * floating overlay anchored to the viewport. It dynamically renders input
 * fields based on the commerce type's field definitions, and persists
 * credential values back into the node data.
 */

import { COMMERCE_NODE_TYPES, getCredentialStatus } from '../nodes/NodeManager.js';
import { escapeHtml, escapeAttr } from '../core/Sanitize.js';
import { CredentialVault } from '../security/CredentialVault.js';

export class CommerceNodeConfig {
  /**
   * @param {EventBus} bus
   * @param {NodeManager} nodeManager
   * @param {CredentialVault} [vault]
   * @param {import('../integrations/ConnectionTester.js').ConnectionTester} [tester]
   */
  constructor(bus, nodeManager, vault = null, tester = null) {
    this.bus = bus;
    this.nodeManager = nodeManager;
    this.vault = vault;
    this.tester = tester;
    this._activeNodeId = null;

    this._panel = this._createPanel();
    document.body.appendChild(this._panel);

    this._bindEvents();
  }

  // ─── DOM ─────────────────────────────────────────────────────────────────

  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'commerce-config-panel';
    panel.className = 'commerce-config-panel hidden';
    panel.innerHTML = `
      <div class="commerce-config-header">
        <span class="commerce-config-icon"></span>
        <span class="commerce-config-title">Configure Integration</span>
        <div class="commerce-config-header-actions">
          <button class="commerce-vault-toggle" title="Vault Status">🔒</button>
          <button class="commerce-config-close" title="Close">&times;</button>
        </div>
      </div>
      <div class="commerce-vault-bar hidden">
        <input type="password" class="commerce-vault-passphrase" placeholder="Enter vault passphrase…" autocomplete="off" />
        <button class="commerce-vault-unlock" type="button">Unlock</button>
      </div>
      <div class="commerce-config-body"></div>
      <div class="commerce-config-footer">
        <span class="commerce-config-status"></span>
        <div class="commerce-config-actions">
          <button class="commerce-config-test" title="Test credentials">🔌 Test</button>
          <button class="commerce-config-save">Save</button>
        </div>
      </div>
    `;
    return panel;
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  _bindEvents() {
    // Open panel on request
    this.bus.on('commerce:config-request', ({ nodeId }) => this.open(nodeId));

    // Close button
    this._panel.querySelector('.commerce-config-close').addEventListener('click', () => this.close());

    // Save button
    this._panel.querySelector('.commerce-config-save').addEventListener('click', () => this._save());

    // Test Connection button
    this._panel.querySelector('.commerce-config-test').addEventListener('click', () => this._testConnection());

    // Vault toggle
    this._panel.querySelector('.commerce-vault-toggle').addEventListener('click', () => this._toggleVaultBar());

    // Vault unlock
    this._panel.querySelector('.commerce-vault-unlock').addEventListener('click', () => this._unlockVault());
    this._panel.querySelector('.commerce-vault-passphrase').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._unlockVault();
    });

    // Vault event listeners
    this.bus.on('vault:unlocked', () => this._updateVaultUI());
    this.bus.on('vault:locked', () => this._updateVaultUI());

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this._panel.classList.contains('hidden')) {
        this.close();
      }
    });

    // Close if user clicks outside the panel
    document.addEventListener('mousedown', (e) => {
      if (!this._panel.classList.contains('hidden') && !this._panel.contains(e.target)) {
        // Don't close if clicking on a node (allows re-selection)
        if (e.target.closest('.mind-node')) return;
        this.close();
      }
    });
  }

  // ─── Open / Close ────────────────────────────────────────────────────────

  async open(nodeId) {
    const node = this.nodeManager.getNode(nodeId);
    if (!node || !node.commerceType) return;

    this._activeNodeId = nodeId;

    const commerceDef = COMMERCE_NODE_TYPES.find(c => c.id === node.commerceType);
    if (!commerceDef) return;

    // Update header
    this._panel.querySelector('.commerce-config-icon').textContent = commerceDef.icon;
    this._panel.querySelector('.commerce-config-title').textContent = `Configure ${commerceDef.label}`;
    this._updateVaultUI();

    // Try to load credentials from vault first, fall back to node data
    let credentials = node.credentials || {};
    if (this.vault?.isUnlocked) {
      const vaultCreds = await this.vault.retrieve(nodeId);
      if (vaultCreds) credentials = vaultCreds;
    }

    // Build field inputs
    const body = this._panel.querySelector('.commerce-config-body');
    body.innerHTML = '';

    const fields = commerceDef.fields;
    if (fields.length === 0 && node.commerceType === 'custom-integration') {
      body.innerHTML = this._buildCustomFieldsEditor(node);
    } else {
      fields.forEach(field => {
        const value = credentials?.[field.key] || '';
        const filled = value.length > 0;
        body.innerHTML += this._buildFieldHTML(field, value, filled);
      });
    }

    // Bind password toggle buttons
    body.querySelectorAll('.commerce-field-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
          btn.title = 'Hide';
        } else {
          input.type = 'password';
          btn.textContent = '👁';
          btn.title = 'Show';
        }
      });
    });

    // Status
    this._updateStatus();

    // Show with animation
    this._panel.classList.remove('hidden');
    requestAnimationFrame(() => this._panel.classList.add('visible'));

    // Focus first empty field
    const firstEmpty = body.querySelector('input:not([value]), input[value=""]');
    if (firstEmpty) setTimeout(() => firstEmpty.focus(), 200);
  }

  close() {
    this._panel.classList.remove('visible');
    setTimeout(() => {
      this._panel.classList.add('hidden');
      this._activeNodeId = null;
    }, 250);
  }

  // ─── Save ────────────────────────────────────────────────────────────────

  async _save() {
    if (!this._activeNodeId) return;
    const node = this.nodeManager.getNode(this._activeNodeId);
    if (!node) return;

    const body = this._panel.querySelector('.commerce-config-body');
    const inputs = body.querySelectorAll('[data-field-key]');
    const credentials = {};

    inputs.forEach(input => {
      const key = input.dataset.fieldKey;
      let val;
      if (input.tagName === 'TEXTAREA') {
        val = input.value.trim();
      } else {
        val = input.value.trim();
      }
      if (val) credentials[key] = val;
    });

    // Store in vault if unlocked (encrypted), otherwise store in node (plaintext)
    if (this.vault?.isUnlocked) {
      await this.vault.store(this._activeNodeId, credentials);
      // Store only non-sensitive fields in the node for display purposes
      node.credentials = this._stripSecrets(node.commerceType, credentials);
    } else {
      node.credentials = credentials;
    }

    // Update the node title with smart label (P1.4)
    const commerceDef = COMMERCE_NODE_TYPES.find(c => c.id === node.commerceType);
    const defaultLabel = commerceDef?.label || '';
    // If the node text is the default label (or empty), auto-generate a descriptive name
    const isDefaultText = !node.text || node.text === defaultLabel || node.text.startsWith(defaultLabel + ':');
    if (isDefaultText && commerceDef) {
      // Use displayKey first, then fall back to scanning fields
      const displayKey = commerceDef.displayKey;
      let displayValue = displayKey ? credentials[displayKey] : null;
      if (!displayValue) {
        // Fallback: find first non-empty non-password field
        for (const f of commerceDef.fields) {
          if (f.type !== 'password' && credentials[f.key]) {
            displayValue = credentials[f.key];
            break;
          }
        }
      }
      if (displayValue) {
        // Mask password-type values (show last 4 chars)
        const field = commerceDef.fields.find(f => f.key === displayKey);
        if (field?.type === 'password' && displayValue.length > 4) {
          displayValue = '•••' + displayValue.slice(-4);
        }
        node.text = `${defaultLabel}: ${displayValue}`;
        this.nodeManager._refreshNodeOverlays(this._activeNodeId);
      }
    }

    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');

    // Flash save status
    const statusEl = this._panel.querySelector('.commerce-config-status');
    const vaultIcon = this.vault?.isUnlocked ? ' 🔐' : '';
    statusEl.textContent = `✓ Saved${vaultIcon}`;
    statusEl.classList.add('saved');
    setTimeout(() => {
      statusEl.textContent = '';
      statusEl.classList.remove('saved');
    }, 2000);
  }

  /**
   * Strip secret/password fields from credentials for node-level storage.
   * Only non-sensitive fields (URLs, IDs, names) are kept in the node data.
   */
  _stripSecrets(commerceType, credentials) {
    const commerceDef = COMMERCE_NODE_TYPES.find(c => c.id === commerceType);
    if (!commerceDef) return {};

    const safe = {};
    commerceDef.fields.forEach(f => {
      if (f.type !== 'password' && credentials[f.key]) {
        safe[f.key] = credentials[f.key];
      }
    });
    return safe;
  }

  // ─── Field rendering ────────────────────────────────────────────────────

  _buildFieldHTML(field, value, filled) {
    const isPassword = field.type === 'password';
    const isTextarea = field.type === 'textarea';
    const filledClass = filled ? 'filled' : '';
    const sanitizedValue = escapeAttr(value);

    // Help tooltip: ? icon with hover hint + clickable link
    let helpIcon = '';
    if (field.helpHint) {
      if (field.helpUrl) {
        helpIcon = `<a class="commerce-field-help" href="${escapeAttr(field.helpUrl)}" target="_blank" rel="noopener" title="${escapeAttr(field.helpHint)}">?</a>`;
      } else {
        helpIcon = `<span class="commerce-field-help" title="${escapeAttr(field.helpHint)}">?</span>`;
      }
    }

    if (isTextarea) {
      return `
        <div class="commerce-field ${filledClass}">
          <label class="commerce-field-label">${escapeHtml(field.label)}${helpIcon}</label>
          <textarea class="commerce-field-input commerce-field-textarea"
            data-field-key="${escapeAttr(field.key)}"
            placeholder="Enter ${escapeAttr(field.label)}…"
            spellcheck="false"
          >${escapeHtml(value)}</textarea>
        </div>
      `;
    }

    return `
      <div class="commerce-field ${filledClass}">
        <label class="commerce-field-label">
          ${escapeHtml(field.label)}${helpIcon}
          ${filled ? '<span class="commerce-field-status">●</span>' : ''}
        </label>
        <div class="commerce-field-input-wrap">
          <input class="commerce-field-input"
            type="${isPassword ? 'password' : 'text'}"
            data-field-key="${escapeAttr(field.key)}"
            value="${sanitizedValue}"
            placeholder="Enter ${escapeAttr(field.label)}…"
            spellcheck="false"
            autocomplete="off"
          />
          ${isPassword ? `<button class="commerce-field-toggle" title="Show" type="button">👁</button>` : ''}
        </div>
      </div>
    `;
  }

  _buildCustomFieldsEditor(node) {
    const fields = node.customFields || [];
    let html = `<div class="commerce-custom-fields-editor">
      <p class="commerce-custom-hint">Define custom fields for this integration:</p>`;

    fields.forEach((f, i) => {
      html += `
        <div class="commerce-custom-field-row" data-index="${i}">
          <input class="commerce-custom-key" value="${escapeAttr(f.key || '')}" placeholder="Field Name" data-field-key="__custom_key_${i}" />
          <input class="commerce-custom-value" value="${escapeAttr(node.credentials?.[f.key] || '')}" placeholder="Value" data-field-key="${escapeAttr(f.key || `__custom_val_${i}`)}" />
        </div>`;
    });

    html += `
      <button class="commerce-custom-add" type="button" title="Add field">+ Add Field</button>
    </div>`;

    return html;
  }

  _updateStatus() {
    if (!this._activeNodeId) return;
    const node = this.nodeManager.getNode(this._activeNodeId);
    if (!node) return;

    const commerceDef = COMMERCE_NODE_TYPES.find(c => c.id === node.commerceType);
    if (!commerceDef) return;

    const totalFields = commerceDef.fields.length;
    const filledFields = commerceDef.fields.filter(f => node.credentials?.[f.key]).length;

    const statusEl = this._panel.querySelector('.commerce-config-status');
    if (totalFields === 0) {
      statusEl.textContent = 'Custom integration';
    } else if (filledFields === totalFields) {
      statusEl.textContent = `✓ All ${totalFields} fields configured`;
      statusEl.classList.add('all-filled');
    } else {
      statusEl.textContent = `${filledFields}/${totalFields} fields configured`;
      statusEl.classList.remove('all-filled');
    }
  }

  // ─── Connection Test ─────────────────────────────────────────────────────

  async _testConnection() {
    if (!this._activeNodeId || !this.tester) return;
    const node = this.nodeManager.getNode(this._activeNodeId);
    if (!node || !node.commerceType) return;

    // Gather current field values from the panel (unsaved state is fine for testing)
    const body = this._panel.querySelector('.commerce-config-body');
    const inputs = body.querySelectorAll('[data-field-key]');
    const credentials = {};
    inputs.forEach(input => {
      const key = input.dataset.fieldKey;
      const val = input.value.trim();
      if (val) credentials[key] = val;
    });

    // Show loading state
    const testBtn = this._panel.querySelector('.commerce-config-test');
    const statusEl = this._panel.querySelector('.commerce-config-status');
    testBtn.disabled = true;
    testBtn.textContent = '⏳ Testing…';
    statusEl.textContent = 'Testing connection…';
    statusEl.className = 'commerce-config-status testing';

    // Run test
    const result = await this.tester.test(this._activeNodeId, node.commerceType, credentials);

    // Update button
    testBtn.disabled = false;
    testBtn.textContent = '🔌 Test';

    // Show result
    statusEl.textContent = result.message;
    if (result.status === 'verified') {
      statusEl.className = 'commerce-config-status test-success';
      node.connectionStatus = 'verified';
    } else if (result.status === 'cors-blocked') {
      statusEl.className = 'commerce-config-status test-cors';
      node.connectionStatus = 'untested';
    } else {
      statusEl.className = 'commerce-config-status test-failed';
      node.connectionStatus = 'failed';
    }

    // Refresh node badge overlays
    this.nodeManager._refreshNodeOverlays(this._activeNodeId);
    this.bus.emit('node:updated', node);
    this.bus.emit('state:changed');

    // Clear status after 8 seconds
    setTimeout(() => {
      if (statusEl.textContent === result.message) {
        this._updateStatus();
      }
    }, 8000);
  }

  // ─── Vault UI ────────────────────────────────────────────────────────────

  _toggleVaultBar() {
    const bar = this._panel.querySelector('.commerce-vault-bar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) {
      bar.querySelector('.commerce-vault-passphrase').focus();
    }
  }

  async _unlockVault() {
    if (!this.vault) return;

    const input = this._panel.querySelector('.commerce-vault-passphrase');
    const passphrase = input.value;
    if (!passphrase) return;

    const btn = this._panel.querySelector('.commerce-vault-unlock');
    btn.textContent = '⏳';
    btn.disabled = true;

    const success = await this.vault.unlock(passphrase);

    btn.disabled = false;
    if (success) {
      btn.textContent = '✓';
      input.value = '';
      this._panel.querySelector('.commerce-vault-bar').classList.add('hidden');
      // Re-open to load vault credentials
      if (this._activeNodeId) this.open(this._activeNodeId);
    } else {
      btn.textContent = '✗ Wrong passphrase';
      setTimeout(() => { btn.textContent = 'Unlock'; }, 2000);
    }
  }

  _updateVaultUI() {
    const toggle = this._panel.querySelector('.commerce-vault-toggle');
    if (!this.vault) {
      toggle.classList.add('hidden');
      return;
    }

    toggle.classList.remove('hidden');
    if (this.vault.isUnlocked) {
      toggle.textContent = '🔓';
      toggle.title = 'Vault unlocked — credentials are encrypted';
      toggle.classList.add('vault-unlocked');
    } else {
      toggle.textContent = '🔒';
      toggle.title = 'Vault locked — click to unlock for encrypted storage';
      toggle.classList.remove('vault-unlocked');
    }
  }
}
