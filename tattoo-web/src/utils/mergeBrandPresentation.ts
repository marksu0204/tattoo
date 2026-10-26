import type { BrandCode, PublicBrandConfig } from '../config/brands';

/**
 * Public presentation payload from GET getPublicBrandConfig.
 * Identity fields (hostnames, isActive, liffId) are intentionally excluded.
 */
export type PublicBrandPresentation = {
  code: BrandCode;
  name: string;
  logoUrl?: string | null;
  primaryColor: string;
  accentColor: string;
  instagramUrl?: string | null;
  lineUrl?: string | null;
  seoSiteName: string;
  seoDefaultDescription: string;
  regionLabel?: string | null;
  publicOrigin: string;
};

function nonEmptyString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiredString(
  apiValue: string | null | undefined,
  bootstrapValue: string,
): string {
  const fromApi = nonEmptyString(apiValue);
  return fromApi ?? bootstrapValue;
}

/**
 * Merge DB presentation onto bootstrap identity.
 *
 * Rules:
 * - Identity (code, hostnames, isActive, liffId) always from bootstrap.
 * - API code must match bootstrap.code or merge is rejected.
 * - DB null/empty optional URLs → undefined (no cross-brand fallback).
 * - API failure / mismatch → return bootstrap unchanged.
 */
export function mergePublicBrandPresentation(
  bootstrap: PublicBrandConfig,
  api: PublicBrandPresentation | null | undefined,
): PublicBrandConfig {
  if (!api || api.code !== bootstrap.code) {
    return bootstrap;
  }

  return {
    ...bootstrap,
    code: bootstrap.code,
    hostnames: bootstrap.hostnames,
    isActive: bootstrap.isActive,
    liffId: bootstrap.liffId,
    name: requiredString(api.name, bootstrap.name),
    publicOrigin: requiredString(api.publicOrigin, bootstrap.publicOrigin),
    logoUrl: nonEmptyString(api.logoUrl),
    primaryColor: requiredString(api.primaryColor, bootstrap.primaryColor),
    accentColor: requiredString(api.accentColor, bootstrap.accentColor),
    instagramUrl: nonEmptyString(api.instagramUrl),
    lineUrl: nonEmptyString(api.lineUrl),
    seoSiteName: requiredString(api.seoSiteName, bootstrap.seoSiteName),
    seoDefaultDescription: requiredString(
      api.seoDefaultDescription,
      bootstrap.seoDefaultDescription,
    ),
    regionLabel: nonEmptyString(api.regionLabel),
  };
}

export function isPublicBrandPresentation(value: unknown): value is PublicBrandPresentation {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    (row.code === 'whitehorn' || row.code === 'gujiguji') &&
    typeof row.name === 'string' &&
    typeof row.primaryColor === 'string' &&
    typeof row.accentColor === 'string' &&
    typeof row.seoSiteName === 'string' &&
    typeof row.seoDefaultDescription === 'string' &&
    typeof row.publicOrigin === 'string'
  );
}
