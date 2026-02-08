/**
 * FileMenu — Dropdown file menu in the toolbar
 *
 * Provides: New, Open, Save, Save As, Export (PNG/JSON/SVG),
 * Import Reference File. Keyboard shortcuts included.
 */

export class FileMenu {
  /**
   * @param {import('../storage/FileManager.js').FileManager} fileManager
   */
  constructor(fileManager) {
    this.fm = fileManager;
    this.isOpen = false;

    this.btn = document.getElementById('btn-file-menu');
    this.menu = document.getElementById('file-menu-dropdown');

    this._buildMenu();
    this._bind();
  }

  toggle() {
    this.isOpen ? this.hide() : this.show();
  }

  show() {
    this.menu.classList.add('open');
    this.btn.classList.add('active');
    this.isOpen = true;
  }

  hide() {
    this.menu.classList.remove('open');
    this.btn.classList.remove('active');
    this.isOpen = false;
  }

  // ── Private ────────────────────────

  _buildMenu() {
    const items = [
      { label: 'New Project',           shortcut: 'Ctrl+N',        icon: '📄', action: () => this.fm.newProject() },
      { type: 'divider' },
      { label: 'Open File…',            shortcut: 'Ctrl+O',        icon: '📂', action: () => this.fm.openFile() },
      { type: 'divider' },
      { label: 'Save',                  shortcut: 'Ctrl+S',        icon: '💾', action: () => this.fm.save() },
      { label: 'Save As…',             shortcut: 'Ctrl+Shift+S',  icon: '📥', action: () => this.fm.saveAs() },
      { type: 'divider' },
      { label: 'Export', type: 'header' },
      { label: 'Export as PNG',         shortcut: '',              icon: '🖼️', action: () => this.fm.exportPNG() },
      { label: 'Export as JSON',        shortcut: '',              icon: '{ }', action: () => this.fm.exportJSON() },
      { label: 'Export as SVG',         shortcut: '',              icon: '◇',  action: () => this.fm.exportSVG() },
      { type: 'divider' },
      { label: 'Import Reference…',    shortcut: '',              icon: '📎', action: () => this.fm.importReference() },
    ];

    this.menu.innerHTML = '';
    items.forEach(item => {
      if (item.type === 'divider') {
        const hr = document.createElement('div');
        hr.className = 'file-menu-divider';
        this.menu.appendChild(hr);
        return;
      }

      if (item.type === 'header') {
        const hd = document.createElement('div');
        hd.className = 'file-menu-header';
        hd.textContent = item.label;
        this.menu.appendChild(hd);
        return;
      }

      const div = document.createElement('div');
      div.className = 'file-menu-item';
      div.innerHTML = `
        <span class="file-menu-icon">${item.icon}</span>
        <span class="file-menu-label">${item.label}</span>
        ${item.shortcut ? `<span class="file-menu-shortcut">${item.shortcut}</span>` : ''}
      `;
      div.addEventListener('click', () => {
        this.hide();
        item.action();
      });
      this.menu.appendChild(div);
    });
  }

  _bind() {
    // Toggle on button click
    this.btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.menu.contains(e.target) && !this.btn.contains(e.target)) {
        this.hide();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore when editing text
      if (document.activeElement?.isContentEditable ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          document.activeElement?.tagName === 'INPUT') return;

      // Ctrl+N → New
      if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        this.fm.newProject();
      }

      // Ctrl+O → Open
      if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
        e.preventDefault();
        this.fm.openFile();
      }

      // Ctrl+Shift+S → Save As
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.fm.saveAs();
      }
    });
  }
}
