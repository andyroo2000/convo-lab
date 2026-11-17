// Storage can be unavailable in private windows. Conversion still works after
// a direct download; persistence is an optimization, not a startup requirement.
export async function cachedAsset(url) {
  let cache;
  try {
    cache = await caches.open('convolab-browser-input-v2');
    const saved = await cache.match(url);
    if (saved) return saved;
  } catch {
    /* Private storage is optional. */
  }
  const response = await fetch(url);
  if (!response.ok) throw Error(`Could not download conversion asset (${response.status})`);
  if (cache) {
    try {
      await cache.put(url, response.clone());
    } catch {
      /* Quota does not disable typing. */
    }
  }
  return response;
}
