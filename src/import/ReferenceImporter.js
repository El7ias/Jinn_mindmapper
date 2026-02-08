/**
 * ReferenceImporter — Converts reference files into MindMapper node/connection data
 *
 * Supported formats:
 *   .md   → Heading hierarchy (#, ##, ###...) + list items
 *   .txt  → Indentation-based hierarchy
 *   .png/.jpg/.jpeg → Single reference node with image metadata
 *   .doc/.docx      → Extracts text lines (best-effort)
 */

// ── Color/shape palette by depth ────────────────
const DEPTH_STYLES = [
  { color: '#00e5ff', shape: 'rounded'   },   // Root
  { color: '#7c4dff', shape: 'rectangle' },   // Level 1
  { color: '#ffc107', shape: 'rectangle' },   // Level 2
  { color: '#00ff88', shape: 'rectangle' },   // Level 3
  { color: '#ff6e40', shape: 'rectangle' },   // Level 4
  { color: '#e6edf3', shape: 'rectangle' },   // Level 5+
];

function styleForDepth(depth) {
  return DEPTH_STYLES[Math.min(depth, DEPTH_STYLES.length - 1)];
}

// ── Tree layout constants ───────────────────────
const LEVEL_GAP_Y = 150;
const NODE_MIN_WIDTH = 140;
const NODE_GAP_X = 40;

// ═══════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════

/**
 * Import a reference file and return { nodes, connections }
 * @param {File} file
 * @returns {Promise<{ nodes: Array, connections: Array }>}
 */
export async function importReferenceFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  switch (ext) {
    case 'md':
      return importMarkdown(await file.text());
    case 'txt':
      return importPlainText(await file.text());
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return importImage(file);
    case 'doc':
    case 'docx':
      return importDocument(file);
    default:
      // Try as plain text
      return importPlainText(await file.text());
  }
}

// ═══════════════════════════════════════════
//  Markdown Import
// ═══════════════════════════════════════════

function importMarkdown(text) {
  const lines = text.split(/\r?\n/);
  const root = { text: 'Document', depth: 0, children: [] };
  const stack = [root]; // Stack tracks current nesting path

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    // --- Heading: # → ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const node = { text: headingMatch[2].trim(), depth, children: [] };

      // Pop stack until we find a parent with lower depth
      while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    // --- List item: - or * or numbered
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const listDepth = (stack[stack.length - 1]?.depth || 0) + 1 + Math.floor(indent / 2);
      const node = { text: listMatch[3].trim(), depth: listDepth, children: [] };

      // Attach to nearest parent
      while (stack.length > 1 && stack[stack.length - 1].depth >= listDepth) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    // --- Regular text: append to current node or create sibling
    const trimmed = line.trim();
    if (trimmed && stack.length > 1) {
      // Append to most recent node's text
      const current = stack[stack.length - 1];
      if (current.text.length < 80) {
        current.text += ' ' + trimmed;
      }
    } else if (trimmed) {
      // Top-level text becomes a child of root
      root.children.push({ text: trimmed, depth: 1, children: [] });
    }
  }

  // If root has only one child and root text is generic, promote the child
  if (root.children.length === 1 && root.text === 'Document') {
    const promoted = root.children[0];
    promoted.depth = 0;
    return treeToData(promoted);
  }

  return treeToData(root);
}

// ═══════════════════════════════════════════
//  Plain Text Import (indentation-based)
// ═══════════════════════════════════════════

function importPlainText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) {
    return { nodes: [{ id: 'n_1', text: 'Empty Document', x: 400, y: 0, color: '#00e5ff', shape: 'rounded' }], connections: [] };
  }

  const root = { text: lines[0].trim(), depth: 0, children: [] };
  const stack = [root];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const indent = raw.match(/^(\s*)/)[1].length;
    const depth = Math.floor(indent / 2) + 1;
    const node = { text: raw.trim(), depth, children: [] };

    // Find parent
    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return treeToData(root);
}

// ═══════════════════════════════════════════
//  Image Import (creates reference node)
// ═══════════════════════════════════════════

async function importImage(file) {
  const name = file.name.replace(/\.[^.]+$/, '');

  return {
    nodes: [
      { id: 'n_img_root', text: name, x: 350, y: 0, color: '#7c4dff', shape: 'rounded' },
      { id: 'n_img_type', text: `Type: ${file.type}`, x: 100, y: 150, color: '#ffc107', shape: 'parallelogram' },
      { id: 'n_img_size', text: `Size: ${formatBytes(file.size)}`, x: 350, y: 150, color: '#ffc107', shape: 'parallelogram' },
      { id: 'n_img_ref', text: `📸 Image Reference`, x: 600, y: 150, color: '#ff6e40', shape: 'circle' },
      { id: 'n_img_note', text: 'Add analysis notes here', x: 350, y: 300, color: '#e6edf3', shape: 'rectangle' },
    ],
    connections: [
      { id: 'c_img_1', sourceId: 'n_img_root', sourcePort: 'bottom', targetId: 'n_img_type', targetPort: 'top', directed: 'forward' },
      { id: 'c_img_2', sourceId: 'n_img_root', sourcePort: 'bottom', targetId: 'n_img_size', targetPort: 'top', directed: 'forward' },
      { id: 'c_img_3', sourceId: 'n_img_root', sourcePort: 'bottom', targetId: 'n_img_ref', targetPort: 'top', directed: 'forward' },
      { id: 'c_img_4', sourceId: 'n_img_size', sourcePort: 'bottom', targetId: 'n_img_note', targetPort: 'top', directed: 'forward' },
    ],
  };
}

// ═══════════════════════════════════════════
//  Document Import (.doc/.docx — best-effort)
// ═══════════════════════════════════════════

async function importDocument(file) {
  try {
    // Try reading as text (works for .doc plain text, .txt renamed)
    const text = await file.text();
    // Filter out binary garbage
    const clean = text.replace(/[^\x20-\x7E\n\r\t]/g, '').trim();
    if (clean.length > 20) {
      return importPlainText(clean);
    }
  } catch {
    // ignore
  }

  // Fallback: create reference node
  const name = file.name.replace(/\.[^.]+$/, '');
  return {
    nodes: [
      { id: 'n_doc_root', text: name, x: 350, y: 0, color: '#00e5ff', shape: 'rounded' },
      { id: 'n_doc_note', text: 'Export as .txt or .md for full import', x: 350, y: 150, color: '#ffc107', shape: 'rectangle' },
    ],
    connections: [
      { id: 'c_doc_1', sourceId: 'n_doc_root', sourcePort: 'bottom', targetId: 'n_doc_note', targetPort: 'top', directed: 'forward' },
    ],
  };
}

// ═══════════════════════════════════════════
//  Tree → Flat Data Conversion + Auto-Layout
// ═══════════════════════════════════════════

let _idCounter = 0;

function treeToData(root) {
  _idCounter = 0;
  const nodes = [];
  const connections = [];

  // 1. Assign IDs and collect flat list
  assignIds(root);

  // 2. Calculate subtree widths (bottom-up)
  calcWidth(root);

  // 3. Position nodes (top-down)
  positionNode(root, 400, 0);

  // 4. Flatten to arrays
  flattenTree(root, nodes, connections);

  return { nodes, connections };
}

function assignIds(node) {
  node.id = `n_import_${++_idCounter}`;
  node.children?.forEach(assignIds);
}

function calcWidth(node) {
  if (!node.children || node.children.length === 0) {
    node._width = NODE_MIN_WIDTH;
    return node._width;
  }
  node._width = node.children.reduce((sum, c) => sum + calcWidth(c), 0)
    + (node.children.length - 1) * NODE_GAP_X;
  return node._width;
}

function positionNode(node, cx, y) {
  node.x = cx - 60; // offset so center of node ~140px wide is at cx
  node.y = y;

  if (!node.children || node.children.length === 0) return;

  let startX = cx - node._width / 2;
  for (const child of node.children) {
    const childCenter = startX + child._width / 2;
    positionNode(child, childCenter, y + LEVEL_GAP_Y);
    startX += child._width + NODE_GAP_X;
  }
}

function flattenTree(node, nodes, connections) {
  const style = styleForDepth(node.depth);
  nodes.push({
    id: node.id,
    text: node.text,
    x: Math.round(node.x),
    y: Math.round(node.y),
    color: style.color,
    shape: style.shape,
  });

  if (node.children) {
    for (const child of node.children) {
      connections.push({
        id: `c_import_${++_idCounter}`,
        sourceId: node.id,
        sourcePort: 'bottom',
        targetId: child.id,
        targetPort: 'top',
        directed: 'forward',
      });
      flattenTree(child, nodes, connections);
    }
  }
}

// ── Utility ─────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
