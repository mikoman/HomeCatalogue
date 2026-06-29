/**
 * Normalize an item name for re-scan dedup matching: lowercase, trim, collapse
 * whitespace, drop a trailing plural 's'. Catches the overwhelmingly common
 * re-scan duplicates ("Olive Oil" vs "olive oil", "Mug" vs "Mugs").
 *
 * ponytail: exact-normalized match only. Upgrade path: token-overlap or
 * embedding similarity (free once semantic search lands) if near-misses slip through.
 */
export function normalizeName(name) {
  const n = (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return n.length > 3 && n.endsWith('s') ? n.slice(0, -1) : n;
}
