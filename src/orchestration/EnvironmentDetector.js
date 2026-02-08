/**
 * EnvironmentDetector — Detects runtime environment capabilities.
 *
 * Determines whether MindMapper is running inside a Tauri native window
 * (desktop app — full subprocess + filesystem access) or in a standard
 * browser (web — limited to SaaS API calls).
 */
export class EnvironmentDetector {

  /** @returns {boolean} True when running inside Tauri desktop shell. */
  static get isTauri() {
    return !!(window.__TAURI_INTERNALS__);
  }

  /** @returns {boolean} True when running in a plain browser tab. */
  static get isBrowser() {
    return !EnvironmentDetector.isTauri;
  }

  /** @returns {'desktop'|'browser'} Current platform label. */
  static get platform() {
    return EnvironmentDetector.isTauri ? 'desktop' : 'browser';
  }

  /**
   * Returns a capabilities manifest describing what the current
   * environment can do.
   * @returns {{ subprocess: boolean, secureStore: boolean, nativeDialogs: boolean, fileSystem: boolean }}
   */
  static get capabilities() {
    if (EnvironmentDetector.isTauri) {
      return {
        subprocess: true,      // Can spawn Claude Code CLI
        secureStore: true,      // Tauri store plugin
        nativeDialogs: true,    // Native folder picker
        fileSystem: true,       // Full FS access via Rust
      };
    }
    return {
      subprocess: false,       // No CLI access in browser
      secureStore: false,       // localStorage only (Phase 4B: Firebase)
      nativeDialogs: false,     // HTML file input only
      fileSystem: false,        // No direct FS access
    };
  }

  /**
   * Guard — throws if a desktop-only feature is used in the browser.
   * @param {string} feature — human-readable name of the feature
   */
  static requireDesktop(feature) {
    if (!EnvironmentDetector.isTauri) {
      throw new Error(
        `"${feature}" requires the MindMapper desktop app. ` +
        `This feature is not available in the browser.`
      );
    }
  }
}
