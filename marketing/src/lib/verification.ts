/**
 * Single source of truth for "last verified" dates shown on comparison pages.
 * Update these values whenever competitor pricing or features are re-checked.
 */
export const PRICING_LAST_VERIFIED = '2026-07-28';

/** Human-readable version of PRICING_LAST_VERIFIED, e.g. "July 28, 2026". */
export function formatVerifiedDate(isoDate: string = PRICING_LAST_VERIFIED): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
