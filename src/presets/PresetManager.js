/**
 * PresetManager — Manages built-in and user-defined presets
 *
 * Responsibilities:
 *   - Provides access to built-in presets
 *   - Saves / loads / deletes custom presets in localStorage
 *   - Exports the preset data structure for the modal UI
 */

import { BUILTIN_PRESETS } from './builtinPresets.js';

const CUSTOM_PRESETS_KEY = 'mindmapper_custom_presets';

export class PresetManager {
  constructor() {
    this.builtins = BUILTIN_PRESETS;
    this._customCache = null;
  }

  /** Get all built-in presets */
  getBuiltins() {
    return this.builtins;
  }

  /** Get all custom (user-defined) presets */
  getCustom() {
    if (!this._customCache) {
      this._customCache = this._loadCustom();
    }
    return this._customCache;
  }

  /** Get all presets: builtins + custom */
  getAll() {
    return [...this.builtins, ...this.getCustom()];
  }

  /** Get a single preset by ID */
  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  }

  /**
   * Save the current canvas state as a custom preset
   * @param {string} name – user-chosen name
   * @param {string} description – optional description
   * @param {string} icon – emoji icon
   * @param {object} data – { nodes, connections } snapshot
   * @returns {object} the created preset
   */
  saveCustom(name, description, icon, data) {
    const customs = this.getCustom();
    const preset = {
      id: `custom_${Date.now()}`,
      name,
      description: description || 'Custom preset',
      icon: icon || '📌',
      category: 'custom',
      data: JSON.parse(JSON.stringify(data)), // deep clone
      createdAt: new Date().toISOString(),
    };
    customs.push(preset);
    this._saveCustom(customs);
    this._customCache = customs;
    return preset;
  }

  /** Delete a custom preset by ID */
  deleteCustom(presetId) {
    let customs = this.getCustom();
    customs = customs.filter(p => p.id !== presetId);
    this._saveCustom(customs);
    this._customCache = customs;
  }

  /** Rename a custom preset */
  renameCustom(presetId, newName) {
    const customs = this.getCustom();
    const preset = customs.find(p => p.id === presetId);
    if (preset) {
      preset.name = newName;
      this._saveCustom(customs);
    }
  }

  // ── Private ──────────────────────────

  _loadCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveCustom(presets) {
    try {
      localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
    } catch (e) {
      console.warn('Failed to save custom presets:', e);
    }
  }
}
