/**
 * CredentialVault — AES-GCM encrypted credential storage
 *
 * Phase 8B: Securely stores commerce node credentials in localStorage
 * using browser-native Web Crypto API.
 *
 * Encryption:
 *   - PBKDF2 key derivation from a user passphrase
 *   - AES-GCM (256-bit) for authenticated encryption
 *   - Unique IV per encryption operation
 *   - Salt stored alongside encrypted data
 *
 * Storage format in localStorage:
 *   { salt: base64, entries: { [nodeId]: { iv: base64, data: base64 } } }
 *
 * Future: migrate to OS keychain via Tauri invoke for desktop builds.
 */

const VAULT_KEY = 'mindmapper_credential_vault';
const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 recommendation
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // AES-GCM standard

export class CredentialVault {
  /**
   * @param {import('../core/EventBus.js').EventBus} bus
   */
  constructor(bus) {
    this.bus = bus;
    this._cryptoKey = null;
    this._unlocked = false;
    this._salt = null;

    this._bindEvents();
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /** Check if the browser supports Web Crypto */
  static isSupported() {
    return !!(globalThis.crypto?.subtle);
  }

  /** Whether the vault is currently unlocked */
  get isUnlocked() {
    return this._unlocked;
  }

  /** Whether a vault exists in localStorage */
  get hasVault() {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      if (!raw) return false;
      const vault = JSON.parse(raw);
      return !!vault.salt;
    } catch {
      return false;
    }
  }

  /**
   * Unlock the vault with a passphrase.
   * If no vault exists yet, creates one with this passphrase.
   * @param {string} passphrase
   * @returns {Promise<boolean>} true if unlock succeeded
   */
  async unlock(passphrase) {
    if (!CredentialVault.isSupported()) {
      console.warn('[CredentialVault] Web Crypto not available — credentials stored in plaintext');
      this._unlocked = true;
      return true;
    }

    try {
      const vault = this._loadVault();

      if (vault && vault.salt) {
        // Existing vault — derive key from stored salt
        this._salt = this._b64ToBuffer(vault.salt);
        this._cryptoKey = await this._deriveKey(passphrase, this._salt);

        // Verify the key by trying to decrypt a test entry if available
        if (vault.entries && Object.keys(vault.entries).length > 0) {
          const firstKey = Object.keys(vault.entries)[0];
          try {
            await this._decrypt(vault.entries[firstKey]);
          } catch {
            this._cryptoKey = null;
            this.bus.emit('vault:error', { message: 'Incorrect passphrase' });
            return false;
          }
        }
      } else {
        // Create new vault
        this._salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
        this._cryptoKey = await this._deriveKey(passphrase, this._salt);
        this._saveVault({ salt: this._bufferToB64(this._salt), entries: {} });
      }

      this._unlocked = true;
      this.bus.emit('vault:unlocked');
      return true;
    } catch (e) {
      console.error('[CredentialVault] Failed to unlock:', e);
      this.bus.emit('vault:error', { message: 'Failed to unlock vault' });
      return false;
    }
  }

  /** Lock the vault (clear derived key from memory) */
  lock() {
    this._cryptoKey = null;
    this._unlocked = false;
    this.bus.emit('vault:locked');
  }

  /**
   * Encrypt and store credentials for a node
   * @param {string} nodeId
   * @param {object} credentials - Plain credential object
   */
  async store(nodeId, credentials) {
    if (!this._canOperate()) return;

    const vault = this._loadVault() || { salt: this._bufferToB64(this._salt), entries: {} };

    if (!CredentialVault.isSupported()) {
      // Fallback: store plaintext (browser without Web Crypto)
      vault.entries[nodeId] = { plain: true, data: JSON.stringify(credentials) };
    } else {
      vault.entries[nodeId] = await this._encrypt(JSON.stringify(credentials));
    }

    this._saveVault(vault);
  }

  /**
   * Retrieve and decrypt credentials for a node
   * @param {string} nodeId
   * @returns {Promise<object|null>} Decrypted credentials or null
   */
  async retrieve(nodeId) {
    if (!this._canOperate()) return null;

    const vault = this._loadVault();
    if (!vault?.entries?.[nodeId]) return null;

    try {
      const entry = vault.entries[nodeId];

      if (entry.plain) {
        // Plaintext fallback
        return JSON.parse(entry.data);
      }

      const json = await this._decrypt(entry);
      return JSON.parse(json);
    } catch (e) {
      console.warn('[CredentialVault] Failed to decrypt for node:', nodeId, e);
      return null;
    }
  }

  /**
   * Remove credentials for a node
   * @param {string} nodeId
   */
  remove(nodeId) {
    const vault = this._loadVault();
    if (!vault?.entries) return;

    delete vault.entries[nodeId];
    this._saveVault(vault);
  }

  /**
   * Retrieve all stored node IDs
   * @returns {string[]}
   */
  listNodeIds() {
    const vault = this._loadVault();
    return vault?.entries ? Object.keys(vault.entries) : [];
  }

  /**
   * Bulk decrypt all credentials (for prompt export)
   * @returns {Promise<Map<string, object>>} nodeId → credentials
   */
  async retrieveAll() {
    if (!this._canOperate()) return new Map();

    const vault = this._loadVault();
    if (!vault?.entries) return new Map();

    const result = new Map();
    for (const [nodeId, entry] of Object.entries(vault.entries)) {
      try {
        if (entry.plain) {
          result.set(nodeId, JSON.parse(entry.data));
        } else {
          const json = await this._decrypt(entry);
          result.set(nodeId, JSON.parse(json));
        }
      } catch {
        // Skip corrupted entries
        console.warn('[CredentialVault] Skipping corrupted entry for:', nodeId);
      }
    }
    return result;
  }

  /** Change the vault passphrase — re-encrypts all entries */
  async changePassphrase(oldPassphrase, newPassphrase) {
    // First verify old passphrase
    const oldSalt = this._salt;
    const oldKey = await this._deriveKey(oldPassphrase, oldSalt);

    const vault = this._loadVault();
    if (!vault?.entries) return false;

    // Decrypt all with old key
    const plainEntries = {};
    const savedKey = this._cryptoKey;
    this._cryptoKey = oldKey;

    for (const [nodeId, entry] of Object.entries(vault.entries)) {
      try {
        if (entry.plain) {
          plainEntries[nodeId] = entry.data;
        } else {
          plainEntries[nodeId] = await this._decrypt(entry);
        }
      } catch {
        // If decryption fails, old passphrase is wrong
        this._cryptoKey = savedKey;
        return false;
      }
    }

    // Generate new salt and key
    this._salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    this._cryptoKey = await this._deriveKey(newPassphrase, this._salt);

    // Re-encrypt everything
    const newVault = { salt: this._bufferToB64(this._salt), entries: {} };
    for (const [nodeId, json] of Object.entries(plainEntries)) {
      newVault.entries[nodeId] = await this._encrypt(json);
    }

    this._saveVault(newVault);
    this.bus.emit('vault:passphrase-changed');
    return true;
  }

  /** Clear the entire vault */
  destroy() {
    localStorage.removeItem(VAULT_KEY);
    this._cryptoKey = null;
    this._salt = null;
    this._unlocked = false;
    this.bus.emit('vault:destroyed');
  }

  // ─── Private: Crypto Operations ──────────────────────────────────────

  /** Derive an AES-GCM key from a passphrase + salt using PBKDF2 */
  async _deriveKey(passphrase, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /** Encrypt a plaintext string → { iv: base64, data: base64 } */
  async _encrypt(plaintext) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this._cryptoKey,
      encoder.encode(plaintext)
    );

    return {
      iv: this._bufferToB64(iv),
      data: this._bufferToB64(new Uint8Array(ciphertext)),
    };
  }

  /** Decrypt { iv: base64, data: base64 } → plaintext string */
  async _decrypt(entry) {
    const iv = this._b64ToBuffer(entry.iv);
    const ciphertext = this._b64ToBuffer(entry.data);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this._cryptoKey,
      ciphertext
    );

    return new TextDecoder().decode(plainBuffer);
  }

  // ─── Private: Helpers ────────────────────────────────────────────────

  _bufferToB64(buffer) {
    let binary = '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  _b64ToBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  _loadVault() {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveVault(vault) {
    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    } catch (e) {
      console.error('[CredentialVault] Failed to save vault:', e);
    }
  }

  _canOperate() {
    if (!this._unlocked) {
      this.bus.emit('vault:locked-warning', { message: 'Vault is locked. Unlock to access credentials.' });
      return false;
    }
    return true;
  }

  _bindEvents() {
    // Auto-store credentials when a commerce node is updated
    this.bus.on('vault:store-request', async ({ nodeId, credentials }) => {
      await this.store(nodeId, credentials);
    });

    // Remove vault entry when a node is deleted
    this.bus.on('node:deleted', ({ id }) => {
      this.remove(id);
    });
  }
}
