/**
 * Storage — localStorage adapter with debounced auto-save.
 */
const STORAGE_KEY = 'mindmapper_state';

export class Storage {
  constructor(bus) {
    this.bus = bus;
    this._saveTimeout = null;
    this._saveDelay = 500;

    this.bus.on('state:changed', () => this._scheduleAutoSave());
  }

  _scheduleAutoSave() {
    clearTimeout(this._saveTimeout);
    this._updateIndicator('saving');
    this._saveTimeout = setTimeout(() => {
      this.bus.emit('state:save-request');
    }, this._saveDelay);
  }

  save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this._updateIndicator('saved');
    } catch (e) {
      console.error('Storage save failed:', e);
      this._updateIndicator('error');
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Storage load failed:', e);
    }
    return null;
  }

  _updateIndicator(status) {
    const el = document.getElementById('save-indicator');
    if (!el) return;

    el.className = `save-indicator ${status}`;
    const textEl = el.querySelector('span:last-child');
    if (textEl) {
      textEl.textContent = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving...' : 'Error';
    }
  }
}
