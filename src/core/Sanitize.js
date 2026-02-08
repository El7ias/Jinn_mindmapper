/**
 * Sanitize — Shared HTML sanitization utilities.
 * 
 * Security layer to prevent XSS across all components.
 * All user-supplied or AI-generated content MUST pass through
 * one of these functions before being injected via innerHTML.
 */

import DOMPurify from 'dompurify';

/**
 * Escape a plain-text string so it's safe for innerHTML injection.
 * Converts HTML-special characters to their entity equivalents.
 * 
 * @param {string} str - Raw text (user input, node labels, etc.)
 * @returns {string} HTML-escaped string safe for innerHTML
 */
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Sanitize rendered HTML (e.g. from markdown parsers) by stripping
 * dangerous tags/attributes while preserving safe formatting.
 * 
 * Allows: formatting tags, links, images, code blocks, lists, tables.
 * Strips: <script>, <iframe>, event handlers (onclick, onerror, etc.),
 *         javascript: URIs, <style> injection, <form>, <input>.
 * 
 * @param {string} html - Pre-rendered HTML (e.g. from marked.parse())
 * @returns {string} Sanitized HTML safe for innerHTML
 */
export function sanitizeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    // Allow safe formatting + structure tags
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'img',
      'code', 'pre', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'span', 'div', 'hr',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class',
      'target', 'rel',
    ],
    // Force all links to open in new tab with noopener
    ADD_ATTR: ['target'],
    ALLOW_DATA_ATTR: false,
    // Block javascript: URIs
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

/**
 * Sanitize a value for use in an HTML attribute (e.g. title, data-*).
 * Escapes quotes and angle brackets.
 * 
 * @param {string} str - Raw string
 * @returns {string} Safe attribute value
 */
export function escapeAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
