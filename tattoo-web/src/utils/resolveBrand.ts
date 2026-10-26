import {
  BRAND_CONFIGS,
  BRAND_HOST_ALIASES,
  BrandCode,
  PublicBrandConfig,
} from '../config/brands';

export interface BrandIdentityResolution {
  brand: PublicBrandConfig | null;
  brandCode: BrandCode | null;
  isKnownHost: boolean;
  isDevOverride: boolean;
}

/** @deprecated Use BrandIdentityResolution — kept for transitional imports. */
export interface BrandResolution extends BrandIdentityResolution {
  /** @deprecated Production support is DB-validated in BrandContext, not synchronous. */
  isSupported: boolean;
}

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

export function normalizeHostname(rawHost: string): string {
  let host = rawHost.trim().toLowerCase();
  const colonIndex = host.indexOf(':');
  if (colonIndex >= 0) {
    host = host.slice(0, colonIndex);
  }
  return host;
}

export function resolveBrandCodeFromHost(hostname: string): BrandCode | null {
  return BRAND_HOST_ALIASES[hostname] ?? null;
}

/**
 * DEV-only: ?brand=whitehorn|gujiguji
 * Production builds always ignore query override.
 */
export function getDevBrandOverride(search?: string): BrandCode | null {
  if (!import.meta.env.DEV) {
    return null;
  }
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const param = new URLSearchParams(query).get('brand')?.trim().toLowerCase();
  if (param === 'whitehorn' || param === 'gujiguji') {
    return param;
  }
  return null;
}

function buildIdentityResolution(
  brand: PublicBrandConfig | null,
  isKnownHost: boolean,
  isDevOverride: boolean,
): BrandIdentityResolution {
  return {
    brand,
    brandCode: brand?.code ?? null,
    isKnownHost,
    isDevOverride,
  };
}

/**
 * Resolve known brand identity from hostname (+ DEV override).
 *
 * Does NOT gate on bootstrap isActive — public activation is DB-authoritative
 * via GET getPublicBrandConfig in BrandContext.
 */
export function resolveBrandIdentityFromHostname(
  rawHost: string,
  options?: { search?: string },
): BrandIdentityResolution {
  const hostname = normalizeHostname(rawHost);
  const devOverride = getDevBrandOverride(options?.search);

  if (devOverride) {
    return buildIdentityResolution(BRAND_CONFIGS[devOverride], true, true);
  }

  if (LOCAL_DEV_HOSTS.has(hostname)) {
    return buildIdentityResolution(BRAND_CONFIGS.whitehorn, true, false);
  }

  const code = resolveBrandCodeFromHost(hostname);
  if (!code) {
    return buildIdentityResolution(null, false, false);
  }

  return buildIdentityResolution(BRAND_CONFIGS[code], true, false);
}

/**
 * Legacy wrapper — identity only; isSupported mirrors isKnownHost for compatibility.
 * Production public activation must use BrandContext.isSupported after API validation.
 */
export function resolveBrandFromHostname(
  rawHost: string,
  options?: { search?: string },
): BrandResolution {
  const identity = resolveBrandIdentityFromHostname(rawHost, options);
  return {
    ...identity,
    isSupported: identity.isKnownHost && identity.brand !== null,
  };
}
