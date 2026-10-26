/**
 * Report HTML Helpers
 *
 * Shared HTML-escaping utility used by all PDF report templates.
 * Prevents XSS when user data is embedded in HTML template strings.
 */

/**
 * Escapes HTML special characters so user-supplied strings render as plain
 * text rather than being interpreted as markup.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escapes a value for safe embedding inside a double-quoted CSV cell.
 * Prefixes formula-injection characters (=, +, -, @) with a single-quote
 * and doubles any internal double-quotes per RFC 4180.
 */
export function escapeCsv(str: string): string {
  let val = str;
  if (/^[=+\-@]/.test(val)) {
    val = `'${val}`;
  }
  return val.replace(/"/g, '""');
}
