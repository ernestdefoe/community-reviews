export type StarFill = 'full' | 'half' | 'empty';

/**
 * The five stars of a rating, rounded to the nearest half: 2.5 → full, full, half, empty, empty; 4.3 → 4.5.
 * Kept free of imports so a plain `node --test` can check it.
 */
export function starFill(value: number | null | undefined): StarFill[] {
  const halves = Math.max(0, Math.min(10, Math.round((Number(value) || 0) * 2)));
  return [1, 2, 3, 4, 5].map((n) => (halves >= n * 2 ? 'full' : halves === n * 2 - 1 ? 'half' : 'empty'));
}
