/**
 * MessageBus — @mention-aware message routing for inter-agent communication.
 *
 * Extends the concept of EventBus with structured messages that carry
 * sender, recipient (@role or @all), timestamps, and thread tracking.
 *
 * Messages are persisted to localStorage for session continuity.
 *
 * Usage:
 *   const bus = new MessageBus();
 *   bus.send('coo', '@cto', 'Please review the architecture plan.');
 *   bus.send('da', '@all', 'Quality findings report attached.');
 *   bus.subscribe('cto', msg => handleMessage(msg));
 */

const STORAGE_KEY = 'mindmapper_messagebus';

let _msgId = 0;

// ─── Message Types ──────────────────────────────────────────────────────

export const MSG_TYPE = Object.freeze({
  TASK:        'task',         // Work assignment
  RESPONSE:    'response',     // Task completion response
  REPORT:      'report',       // Report / findings
  QUESTION:    'question',     // Question to another agent
  STATUS:      'status',       // Status update
  ESCALATION:  'escalation',   // Escalated issue
  APPROVAL:    'approval',     // Approval request/response
  BROADCAST:   'broadcast',    // @all announcement
});

// ─── MessageBus ─────────────────────────────────────────────────────────

export class MessageBus {

  constructor() {
    /** @type {Map<string, Set<Function>>} role → subscriber callbacks */
    this._subscribers = new Map();

    /** @type {Map<string, Set<Function>>} type → subscriber callbacks */
    this._typeSubscribers = new Map();

    /** @type {object[]} All messages in current session */
    this._messages = [];

    /** @type {Map<string, object[]>} threadId → messages */
    this._threads = new Map();

    // Load persisted messages
    this._load();
  }

  /* ─── Sending ──────────────────────────────────────────── */

  /**
   * Send a message from one agent to another (or @all).
   *
   * @param {string} fromRole — sender role ID
   * @param {string} to       — '@roleId' or '@all'
   * @param {string} content  — message body
   * @param {object} [options]
   * @param {string} [options.type]     — MSG_TYPE value
   * @param {string} [options.threadId] — thread to attach to (auto-generated if omitted)
   * @param {object} [options.data]     — structured payload
   * @returns {object} — the created message
   */
  send(fromRole, to, content, options = {}) {
    const msg = {
      id: `msg_${Date.now().toString(36)}_${(++_msgId).toString(36)}`,
      fromRole,
      to,
      content,
      type: options.type || MSG_TYPE.STATUS,
      threadId: options.threadId || `thread_${Date.now().toString(36)}`,
      data: options.data || null,
      timestamp: Date.now(),
    };

    // Store
    this._messages.push(msg);

    // Thread tracking
    if (!this._threads.has(msg.threadId)) {
      this._threads.set(msg.threadId, []);
    }
    this._threads.get(msg.threadId).push(msg);

    // Route to subscribers
    this._route(msg);

    // Persist
    this._save();

    return msg;
  }

  /**
   * Broadcast a message to all agents.
   */
  broadcast(fromRole, content, options = {}) {
    return this.send(fromRole, '@all', content, {
      ...options,
      type: options.type || MSG_TYPE.BROADCAST,
    });
  }

  /* ─── Subscribing ──────────────────────────────────────── */

  /**
   * Subscribe to messages directed at a specific role.
   * @param {string} roleId
   * @param {Function} callback — (msg) => void
   * @returns {Function} — unsubscribe function
   */
  subscribe(roleId, callback) {
    if (!this._subscribers.has(roleId)) {
      this._subscribers.set(roleId, new Set());
    }
    this._subscribers.get(roleId).add(callback);
    return () => this._subscribers.get(roleId)?.delete(callback);
  }

  /**
   * Subscribe to messages of a specific type.
   * @param {string} type — MSG_TYPE value
   * @param {Function} callback
   * @returns {Function} — unsubscribe
   */
  subscribeType(type, callback) {
    if (!this._typeSubscribers.has(type)) {
      this._typeSubscribers.set(type, new Set());
    }
    this._typeSubscribers.get(type).add(callback);
    return () => this._typeSubscribers.get(type)?.delete(callback);
  }

  /**
   * Subscribe to ALL messages (e.g., for logging).
   * @param {Function} callback
   * @returns {Function} — unsubscribe
   */
  subscribeAll(callback) {
    return this.subscribe('__all__', callback);
  }

  /* ─── Querying ─────────────────────────────────────────── */

  /**
   * Get all messages.
   */
  getAll() {
    return [...this._messages];
  }

  /**
   * Get messages for a specific role (sent TO them or @all).
   * @param {string} roleId
   * @param {number} [limit] — max messages to return (most recent)
   */
  getForRole(roleId, limit) {
    const filtered = this._messages.filter(
      m => m.to === `@${roleId}` || m.to === '@all'
    );
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get messages FROM a specific role.
   * @param {string} roleId
   */
  getFromRole(roleId) {
    return this._messages.filter(m => m.fromRole === roleId);
  }

  /**
   * Get a thread by ID.
   * @param {string} threadId
   */
  getThread(threadId) {
    return this._threads.get(threadId) || [];
  }

  /**
   * Get messages by type.
   * @param {string} type
   */
  getByType(type) {
    return this._messages.filter(m => m.type === type);
  }

  /**
   * Get the last N messages.
   * @param {number} n
   */
  getRecent(n = 20) {
    return this._messages.slice(-n);
  }

  /**
   * Get message count.
   */
  get count() {
    return this._messages.length;
  }

  /**
   * Get thread count.
   */
  get threadCount() {
    return this._threads.size;
  }

  /* ─── Session Management ───────────────────────────────── */

  /**
   * Clear all messages (start fresh session).
   */
  clear() {
    this._messages = [];
    this._threads.clear();
    this._save();
  }

  /**
   * Export messages for external consumption.
   */
  export() {
    return {
      messages: [...this._messages],
      threads: Object.fromEntries(this._threads),
      stats: {
        total: this._messages.length,
        threads: this._threads.size,
        byType: this._countByType(),
      },
    };
  }

  /* ─── Internal ─────────────────────────────────────────── */

  /**
   * Route a message to appropriate subscribers.
   */
  _route(msg) {
    // Deliver to target role
    const targetRole = msg.to.replace(/^@/, '');
    if (targetRole === 'all') {
      // Broadcast: notify ALL role subscribers
      this._subscribers.forEach((callbacks) => {
        callbacks.forEach(cb => {
          try { cb(msg); } catch (e) { console.error('[MessageBus] Subscriber error:', e); }
        });
      });
    } else {
      // Direct: notify only the target role
      const callbacks = this._subscribers.get(targetRole);
      if (callbacks) {
        callbacks.forEach(cb => {
          try { cb(msg); } catch (e) { console.error('[MessageBus] Subscriber error:', e); }
        });
      }
    }

    // Also notify __all__ subscribers (loggers, UI)
    const allCallbacks = this._subscribers.get('__all__');
    if (allCallbacks && targetRole !== 'all') {
      allCallbacks.forEach(cb => {
        try { cb(msg); } catch (e) { console.error('[MessageBus] All-subscriber error:', e); }
      });
    }

    // Notify type subscribers
    const typeCallbacks = this._typeSubscribers.get(msg.type);
    if (typeCallbacks) {
      typeCallbacks.forEach(cb => {
        try { cb(msg); } catch (e) { console.error('[MessageBus] Type-subscriber error:', e); }
      });
    }
  }

  /**
   * Count messages by type.
   */
  _countByType() {
    const counts = {};
    this._messages.forEach(m => {
      counts[m.type] = (counts[m.type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Save messages to localStorage.
   */
  _save() {
    try {
      // Keep only last 500 messages to avoid bloating localStorage
      const toSave = this._messages.slice(-500);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch { /* quota exceeded — silently fail */ }
  }

  /**
   * Load messages from localStorage.
   */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._messages = JSON.parse(raw);
        // Rebuild thread map
        this._messages.forEach(msg => {
          if (!this._threads.has(msg.threadId)) {
            this._threads.set(msg.threadId, []);
          }
          this._threads.get(msg.threadId).push(msg);
        });
      }
    } catch {
      this._messages = [];
    }
  }
}
