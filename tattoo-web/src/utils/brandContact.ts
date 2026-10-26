import type { PublicBrandConfig } from '../config/brands';
import { WHITEHORN_CONFIG } from '../config/brands';
import { LINE_ID } from '../types';

/** Legacy whitehorn-only fallbacks — never used for other brands. */
const WHITEHORN_LEGACY_LINE_URL =
  WHITEHORN_CONFIG.lineUrl ?? `https://line.me/R/ti/p/@${LINE_ID.replace(/^@/, '')}`;
const WHITEHORN_LEGACY_INSTAGRAM_URL =
  WHITEHORN_CONFIG.instagramUrl ?? 'https://www.instagram.com/beigahtattoo/';

export function extractLineOaId(lineUrl?: string | null): string | null {
  if (!lineUrl) return null;
  const match = lineUrl.match(/@([^/?#]+)/);
  return match?.[1] ?? null;
}

/** lin.ee short links cannot use oaMessage prefill — open the official URL as-is. */
export function isLineShortUrl(lineUrl: string): boolean {
  try {
    const host = new URL(lineUrl).hostname.toLowerCase();
    return host === 'lin.ee' || host.endsWith('.lin.ee');
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Resolved LINE contact URL for the active brand.
 * Only whitehorn may use legacy LINE_ID fallback when lineUrl is absent.
 */
export function getBrandLineUrl(brand: PublicBrandConfig | null | undefined): string | null {
  const url = brand?.lineUrl?.trim();
  if (url) return url;
  if (brand?.code === 'whitehorn') return WHITEHORN_LEGACY_LINE_URL;
  return null;
}

/**
 * Resolved Instagram URL for the active brand.
 * Only whitehorn may use legacy bootstrap fallback when instagramUrl is absent.
 */
export function getBrandInstagramUrl(brand: PublicBrandConfig | null | undefined): string | null {
  const url = brand?.instagramUrl?.trim();
  if (url) return url;
  if (brand?.code === 'whitehorn') return WHITEHORN_LEGACY_INSTAGRAM_URL;
  return null;
}

export function hasBrandLineContact(brand: PublicBrandConfig | null | undefined): boolean {
  return getBrandLineUrl(brand) !== null;
}

export function hasBrandInstagramContact(brand: PublicBrandConfig | null | undefined): boolean {
  return getBrandInstagramUrl(brand) !== null;
}

export function hasAnyBrandContact(brand: PublicBrandConfig | null | undefined): boolean {
  return hasBrandLineContact(brand) || hasBrandInstagramContact(brand);
}

/** LINE LIFF member login — only when brand has a configured liffId. */
export function hasBrandLoginCapability(brand: PublicBrandConfig | null | undefined): boolean {
  return Boolean(brand?.liffId?.trim());
}

/** Public self-service booking calendar — requires brand LINE login (LIFF). */
export function shouldShowPublicBookingCalendar(brand: PublicBrandConfig | null | undefined): boolean {
  return hasBrandLoginCapability(brand);
}

/**
 * Build LINE contact URL for inquiry flows.
 * - line.me @OA URLs: oaMessage with encoded prefill (whitehorn legacy preserved).
 * - lin.ee short URLs: raw brand lineUrl, no message query (cannot prefill).
 * - Other valid http(s) LINE URLs without @: raw lineUrl fallback.
 */
export function buildLineInquiryUrl(
  message: string,
  brand?: PublicBrandConfig | null,
): string | null {
  const lineUrl = getBrandLineUrl(brand);
  if (!lineUrl) return null;
  if (isLineShortUrl(lineUrl)) return lineUrl;
  const lineId = extractLineOaId(lineUrl);
  if (!lineId) return isHttpUrl(lineUrl) ? lineUrl : null;
  return `https://line.me/R/oaMessage/@${lineId}/?${encodeURIComponent(message)}`;
}
