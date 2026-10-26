/**
 * Frontend brand bootstrap — NOT the runtime presentation source of truth.
 *
 * Role:
 * 1. Host identity bootstrap (BRAND_HOST_ALIASES → code)
 * 2. Safe first-paint fallback before API merge
 * 3. DEV fallback defaults
 * 4. Test fixtures
 *
 * Runtime presentation (logo, colors, contact URLs, SEO copy) comes from
 * the brands table via GET getPublicBrandConfig, merged in BrandContext.
 */

export type BrandCode = 'whitehorn' | 'gujiguji';

export interface PublicBrandConfig {
  code: BrandCode;
  name: string;
  hostnames: string[];
  publicOrigin: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  instagramUrl?: string;
  lineUrl?: string;
  liffId?: string | null;
  seoSiteName: string;
  seoDefaultDescription: string;
  regionLabel?: string;
  /** Legacy/bootstrap flag only — production activation is DB-authoritative via getPublicBrandConfig. */
  isActive: boolean;
}

export const WHITEHORN_CONFIG: PublicBrandConfig = {
  code: 'whitehorn',
  name: '白角刺青',
  hostnames: ['inkflow.work', 'www.inkflow.work'],
  publicOrigin: 'https://inkflow.work',
  primaryColor: '#d4af37',
  accentColor: '#121212',
  instagramUrl: 'https://www.instagram.com/beigahtattoo/',
  lineUrl: 'https://line.me/R/ti/p/@270vwddw',
  liffId: '2008577726-oMLazLyj',
  seoSiteName: '白角刺青',
  seoDefaultDescription: '白角刺青為台南市東區預約制刺青工作室。',
  regionLabel: '台南市東區',
  isActive: true,
};

export const GUJIGUJI_CONFIG: PublicBrandConfig = {
  code: 'gujiguji',
  name: '咕嘰咕嘰刺青',
  hostnames: ['gujiguji.inkflow.work'],
  publicOrigin: 'https://gujiguji.inkflow.work',
  primaryColor: '#f4a7b9',
  accentColor: '#1a1a2e',
  seoSiteName: '咕嘰咕嘰刺青',
  seoDefaultDescription: '咕嘰咕嘰刺青 — 台南可愛小圖、寵物與客製刺青（籌備中）。',
  regionLabel: '台南市東區',
  isActive: false,
};

export const BRAND_CONFIGS: Record<BrandCode, PublicBrandConfig> = {
  whitehorn: WHITEHORN_CONFIG,
  gujiguji: GUJIGUJI_CONFIG,
};

export const BRAND_CODES: BrandCode[] = ['whitehorn', 'gujiguji'];

/** Host allowlist → brand code (lowercase, no port). */
export const BRAND_HOST_ALIASES: Record<string, BrandCode> = {
  'inkflow.work': 'whitehorn',
  'www.inkflow.work': 'whitehorn',
  'gujiguji.inkflow.work': 'gujiguji',
};
