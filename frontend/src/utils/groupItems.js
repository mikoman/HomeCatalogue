/** Group items that share the same trimmed name (preserves first-seen order). */
export function groupItemsByName(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.name.trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return Array.from(groups.values()).map((groupItems) => ({
    name: groupItems[0].name,
    items: groupItems,
    count: groupItems.length,
  }));
}
