/**
 * HTML Sanitization Module
 * Prevents XSS attacks by sanitizing HTML content before rendering
 *
 * IMPORTANT: Requires dompurify package. Install with:
 * npm install dompurify
 */

import DOMPurify from 'dompurify'

// Allowed tags for markdown content
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u',
  'ul', 'ol', 'li',
  'a', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div'
]

// Allowed attributes
const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'class', 'id',
  'colspan', 'rowspan'
]

// Default configuration
const DEFAULT_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: { html: true },
}

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} html - Raw HTML string
 * @param {object} options - Optional DOMPurify configuration
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html, options = {}) {
  if (!html) return ''

  const config = {
    ...DEFAULT_CONFIG,
    ...options,
  }

  return DOMPurify.sanitize(html, config)
}

/**
 * Sanitize HTML for markdown content specifically
 * More permissive than default to support formatted content
 * @param {string} html - HTML generated from markdown
 * @returns {string} Sanitized HTML
 */
export function sanitizeMarkdown(html) {
  if (!html) return ''

  return DOMPurify.sanitize(html, {
    ...DEFAULT_CONFIG,
    // Add target="_blank" with rel="noopener" for security
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'button'],
  })
}

/**
 * Sanitize and render markdown safely
 * Wraps a markdown renderer with sanitization
 * @param {function} markdownRenderer - Function that converts markdown to HTML
 * @param {string} markdown - Raw markdown content
 * @returns {string} Sanitized HTML
 */
export function renderMarkdownSafe(markdownRenderer, markdown) {
  if (!markdown) return ''

  const html = markdownRenderer(markdown)
  return sanitizeMarkdown(html)
}

/**
 * Check if DOMPurify is properly loaded
 * @returns {boolean}
 */
export function isSanitizerAvailable() {
  return typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function'
}

export default {
  sanitizeHtml,
  sanitizeMarkdown,
  renderMarkdownSafe,
  isSanitizerAvailable,
}
