/** Load every page so season views and directories never silently stop at 100 items. */
export async function allPages<T>(
  fetchPage: (skip: number) => Promise<{ items: T[]; total: number; has_more: boolean }>,
) {
  const items: T[] = [];
  let total = 0;
  do {
    const page = await fetchPage(items.length);
    total = page.total;
    items.push(...page.items);
    if (!page.has_more || !page.items.length) break;
  } while (items.length < total);
  return { items, total, skip: 0, limit: items.length, has_more: false };
}
