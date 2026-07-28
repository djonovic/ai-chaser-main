export const SITE_URL = 'https://chaseai.app';

/**
 * Serialize a schema object for a JSON-LD <script> tag.
 * Escapes characters that could close the script tag or start HTML comments,
 * preventing script injection through content strings.
 */
export function serializeJsonLd(schema: object): string {
  return JSON.stringify(schema)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/** Normalize path to a single canonical form: no trailing slash except root. */
export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeading || '/';
}

/**
 * Build a canonical URL for chaseai.app.
 * Strips query/hash and normalizes trailing slashes on the production host.
 */
export function getCanonicalUrl(explicit?: string, pathname?: string): string {
  if (explicit) {
    if (explicit.startsWith('http://') || explicit.startsWith('https://')) {
      const parsed = new URL(explicit);
      const path = normalizePathname(parsed.pathname);
      return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
    }
    const path = normalizePathname(explicit);
    return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  }

  const path = normalizePathname(pathname ?? '/');
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}
