/**
 * SessionStore — Persists orchestration session history and logs.
 *
 * Desktop (Tauri): uses tauri-plugin-store for local JSON persistence.
 * Browser: falls back to localStorage (limited, no secure storage).
 *
 * Each session record captures:
 *   - sessionId, timestamps (start/end)
 *   - status, exitCode
 *   - prompt summary (truncated), project name
 *   - metrics: message count, error count, elapsed time
 */

const STORE_NAME = 'mindmapper-sessions.json';
const MAX_SESSIONS = 50;
const LS_KEY = 'mindmapper_sessions';

export class SessionStore {

  constructor() {
    this._cache = null; // lazy-loaded session list
  }

  /* ─── Read ──────────────────────────────────────────────── */

  /**
   * Get all stored sessions, newest first.
   * @returns {Promise<Array>}
   */
  async list() {
    const sessions = await this._load();
    return [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  }

  /**
   * Get a single session by ID.
   * @param {string} sessionId
   * @returns {Promise<Object|null>}
   */
  async get(sessionId) {
    const sessions = await this._load();
    return sessions.find(s => s.sessionId === sessionId) || null;
  }

  /* ─── Write ─────────────────────────────────────────────── */

  /**
   * Save or update a session record.
   * @param {Object} record
   * @param {string} record.sessionId
   * @param {string} record.projectName
   * @param {string} record.status
   * @param {number} record.startedAt        — Date.now() timestamp
   * @param {number} [record.completedAt]
   * @param {number} [record.exitCode]
   * @param {number} [record.messageCount]
   * @param {number} [record.errorCount]
   * @param {string} [record.promptPreview]  — first 200 chars of prompt
   */
  async save(record) {
    const sessions = await this._load();
    const idx = sessions.findIndex(s => s.sessionId === record.sessionId);

    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], ...record };
    } else {
      sessions.push(record);
    }

    // Cap to MAX_SESSIONS, removing oldest
    if (sessions.length > MAX_SESSIONS) {
      sessions.sort((a, b) => b.startedAt - a.startedAt);
      sessions.length = MAX_SESSIONS;
    }

    await this._persist(sessions);
    this._cache = sessions;
  }

  /**
   * Delete a session by ID.
   * @param {string} sessionId
   */
  async remove(sessionId) {
    let sessions = await this._load();
    sessions = sessions.filter(s => s.sessionId !== sessionId);
    await this._persist(sessions);
    this._cache = sessions;
  }

  /**
   * Clear all stored sessions.
   */
  async clear() {
    await this._persist([]);
    this._cache = [];
  }

  /* ─── Storage Backend ───────────────────────────────────── */

  /** @returns {Promise<Array>} */
  async _load() {
    if (this._cache) return this._cache;

    try {
      // Use localStorage for both browser and Tauri (avoids hijacking API-key Tauri commands)
      const raw = localStorage.getItem(LS_KEY);
      this._cache = raw ? JSON.parse(raw) : [];
    } catch {
      this._cache = [];
    }

    return this._cache;
  }

  /** @param {Array} sessions */
  async _persist(sessions) {
    try {
      // Use localStorage for both browser and Tauri (BUG-03b fix)
      localStorage.setItem(LS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.error('SessionStore: failed to persist sessions', e);
    }
  }
}
