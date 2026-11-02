/**
 * XSS sanitization utilities.
 *
 * Prisma parameterised queries already prevent SQL injection. This layer defends
 * against stored XSS by stripping HTML tags from free-text fields before they are
 * written to the database (notes, descriptions, client names/addresses, etc.).
 *
 * Intentional design decisions:
 *  - No DOMPurify dependency — it is a browser library and adds ~70 kB to the
 *    server bundle. A tag-strip regex is sufficient for the fields we protect.
 *  - We strip tags but keep the inner text: `<script>alert(1)</script>` → `alert(1)`.
 *  - Null/non-string input is passed through unchanged so callers don't need
 *    guards before sanitising.
 */

export function stripHtmlTags(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitise every string value in a flat object recursively one level deep.
 * Array values are mapped element-wise. Non-string scalars pass through.
 */
export function sanitizeObject<T extends Record<string, unknown>>(input: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      result[key] = stripHtmlTags(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => (typeof v === 'string' ? stripHtmlTags(v) : v));
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
