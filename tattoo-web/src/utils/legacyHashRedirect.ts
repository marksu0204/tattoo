/**
 * Normalize legacy HashRouter URLs (#/path?query) to clean BrowserRouter URLs.
 * Runs before React render; idempotent after replaceState clears the router hash.
 */
export function normalizeLegacyHashUrl(): void {
  if (typeof window === 'undefined') return;

  const { hash, search } = window.location;
  if (!hash.startsWith('#/')) return;

  const hashBody = hash.slice(1);
  const queryIndex = hashBody.indexOf('?');
  const hashPath = queryIndex >= 0 ? hashBody.slice(0, queryIndex) : hashBody;
  const hashQuery = queryIndex >= 0 ? hashBody.slice(queryIndex + 1) : '';

  let path = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  const topParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hashQuery);
  hashParams.forEach((value, key) => {
    if (!topParams.has(key)) {
      topParams.set(key, value);
    }
  });

  const mergedQuery = topParams.toString();
  const newUrl = `${path || '/'}${mergedQuery ? `?${mergedQuery}` : ''}`;
  window.history.replaceState(null, '', newUrl);
}
