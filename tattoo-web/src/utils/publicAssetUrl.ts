import type { PublicBrandConfig } from '../config/brands';

export const UPLOADS_PATH_PREFIX = '/uploads/';

/** Hostnames that serve the shared Cloudways public_html/uploads directory. */
export const INKFLOW_SHARED_UPLOAD_HOSTS = new Set([
  'inkflow.work',
  'www.inkflow.work',
  'gujiguji.inkflow.work',
]);

export type PublicAssetBrand = Pick<PublicBrandConfig, 'publicOrigin'> | null | undefined;

function trimTrailingSlash(origin: string): string {
  return origin.replace(/\/$/, '');
}

export function getBrandPublicOrigin(brand?: PublicAssetBrand): string {
  const fromBrand = brand?.publicOrigin?.trim();
  if (fromBrand) return trimTrailingSlash(fromBrand);
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://inkflow.work';
}

export function isSharedUploadPathname(pathname: string): boolean {
  return pathname.startsWith(UPLOADS_PATH_PREFIX);
}

export function isInkflowSharedUploadHost(hostname: string): boolean {
  return INKFLOW_SHARED_UPLOAD_HOSTS.has(hostname.toLowerCase());
}

/** True when the page origin is an INKFLOW shared-app host (production admin/public). */
export function isTrustedSharedAppRuntimeOrigin(origin: string): boolean {
  try {
    return isInkflowSharedUploadHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * Target origin for shared /uploads/ assets.
 * Priority: trusted runtimeOrigin (browser page) → brand.publicOrigin → window → whitehorn default.
 */
export function resolveSharedUploadTargetOrigin(
  brand?: PublicAssetBrand,
  runtimeOrigin?: string,
): string {
  const runtime = runtimeOrigin?.trim();
  if (runtime && isTrustedSharedAppRuntimeOrigin(runtime)) {
    return trimTrailingSlash(runtime);
  }
  return getBrandPublicOrigin(brand);
}

function applyTargetOriginToSharedUploadUrl(trimmed: string, targetOrigin: string): string {
  if (trimmed.startsWith('/')) {
    if (!isSharedUploadPathname(trimmed)) return trimmed;
    return `${targetOrigin}${trimmed}`;
  }

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!isSharedUploadPathname(parsed.pathname)) {
      return trimmed;
    }
    if (!isInkflowSharedUploadHost(parsed.hostname)) {
      return trimmed;
    }

    const origin = new URL(targetOrigin);
    parsed.protocol = origin.protocol;
    parsed.hostname = origin.hostname;
    parsed.port = origin.port;
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

/**
 * Normalize INKFLOW shared /uploads/ assets for canvas-safe same-origin fetch.
 * Browser callers should pass runtimeOrigin = window.location.origin (auto-detected when omitted in browser).
 */
export function resolvePublicAssetUrl(
  url: string | null | undefined,
  brand?: PublicAssetBrand,
  runtimeOrigin?: string,
): string {
  if (!url || !url.trim()) return '';

  const effectiveRuntime =
    runtimeOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : undefined);
  const targetOrigin = resolveSharedUploadTargetOrigin(brand, effectiveRuntime);

  return applyTargetOriginToSharedUploadUrl(url.trim(), targetOrigin);
}

export function isSameOriginPublicAssetUrl(
  url: string,
  baseOrigin: string = typeof window !== 'undefined' ? window.location.origin : '',
): boolean {
  if (!url || !baseOrigin) return false;
  try {
    return new URL(url, baseOrigin).origin === baseOrigin;
  } catch {
    return false;
  }
}
