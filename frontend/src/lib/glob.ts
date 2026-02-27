/**
 * Lightweight glob matching for URL paths.
 *
 * Supported patterns:
 *   /en/*       — matches one path segment (e.g. /en/pricing, /en/blog)
 *   /en/**      — matches one or more segments (e.g. /en/blog/post-1)
 *   /en/pricing — exact match
 *
 * Multiple patterns are combined as a union (OR).
 */

function patternToRegex(pattern: string): RegExp {
  let escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape regex special chars except *
    .replace(/\*\*/g, "\0GLOBSTAR\0")       // placeholder for **
    .replace(/\*/g, "[^/]+")                // * = one segment
    .replace(/\0GLOBSTAR\0/g, ".+");        // ** = one or more segments

  // ensure full path match
  return new RegExp(`^${escaped}$`);
}

export function matchGlob(pattern: string, path: string): boolean {
  const trimmed = pattern.trim();
  if (!trimmed) return false;
  return patternToRegex(trimmed).test(path);
}

export function filterPaths(
  paths: string[],
  patterns: string[]
): string[] {
  const validPatterns = patterns
    .map((p) => p.trim())
    .filter(Boolean);

  if (validPatterns.length === 0) return paths;

  const regexes = validPatterns.map(patternToRegex);
  return paths.filter((path) => regexes.some((re) => re.test(path)));
}
