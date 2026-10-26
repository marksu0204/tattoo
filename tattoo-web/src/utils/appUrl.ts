/** Build absolute app URL for the current origin (clean path, no hash). */
export function buildAppOriginUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalized}`;
}
