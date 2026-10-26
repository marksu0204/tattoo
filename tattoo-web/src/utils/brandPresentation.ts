import type { BrandCode, PublicBrandConfig } from '../config/brands';
import { getBrandInstagramUrl, hasBrandLineContact } from './brandContact';

/** Header mark: WHITEHORN keeps INKFLOW master branding; other brands use logo or name. */
export function getHeaderBrandLabel(brand: PublicBrandConfig | null | undefined): string {
  if (!brand || brand.code === 'whitehorn') {
    return 'INKFLOW';
  }
  return brand.name;
}

export function shouldShowHeaderLogoImage(brand: PublicBrandConfig | null | undefined): boolean {
  return Boolean(brand && brand.code !== 'whitehorn' && brand.logoUrl);
}

export function getFooterGalleryHint(brand: PublicBrandConfig | null | undefined): string {
  if (getBrandInstagramUrl(brand)) {
    return '成品圖歡迎參考 IG';
  }
  return brand?.name ? `${brand.name} 作品集` : '作品集';
}

export function getCalendarRegionNotice(brand: PublicBrandConfig | null | undefined): string {
  if (brand?.regionLabel) {
    return `此頁為${brand.regionLabel}預約制刺青預約`;
  }
  return brand?.name ? `${brand.name} 預約` : '預約行事曆';
}

/** Home hero one-liner: customer-facing brand + region (without mobile menu hint). */
export function getHomeHeroIntro(brand: PublicBrandConfig | null | undefined): string {
  const name = brand?.name ?? '刺青工作室';
  const regionPart = brand?.regionLabel ? `${brand.regionLabel}刺青` : '刺青';
  return `${name} | ${regionPart}`;
}

/** Shown below md alongside hero intro — desktop nav is already visible. */
export const HOME_MENU_HINT = '右上角MENU有更多功能';

type BrandPresentationCopy = {
  calendarRegionSubline?: string | null;
};

/** Brand-specific customer-facing copy — centralised, no scattered if/else in components. */
const BRAND_PRESENTATION: Partial<Record<BrandCode, BrandPresentationCopy>> = {
  whitehorn: {
    calendarRegionSubline: '台北刺青請透過 LINE 另外詢問',
  },
};

/** Optional subline under calendar region notice. GUJIGUJI has none unless added here later. */
export function getCalendarRegionSubline(brand: PublicBrandConfig | null | undefined): string | null {
  if (!brand) return null;
  const copy = BRAND_PRESENTATION[brand.code];
  if (copy && 'calendarRegionSubline' in copy) {
    return copy.calendarRegionSubline ?? null;
  }
  return null;
}

/** IG-style watermark; whitehorn legacy fallback only for whitehorn without IG URL. */
export function getImageWatermarkText(brand: PublicBrandConfig | null | undefined): string | null {
  const igUrl = getBrandInstagramUrl(brand);
  if (igUrl) {
    const match = igUrl.match(/instagram\.com\/([^/?#]+)/i);
    if (match?.[1]) return `@${match[1]}`;
  }
  if (brand?.code === 'whitehorn') return '@beigahtattoo';
  return null;
}

export function getAftercareHeading(_brand: PublicBrandConfig | null | undefined): string {
  return '刺青術後保養';
}

export function getAftercareSubtitle(_brand: PublicBrandConfig | null | undefined): string {
  return '您的紋身護理指南，確保作品完美復原。';
}

/** Shown when brand has no aftercare row in DB (not configured). */
export function getAftercareEmptyMessage(_brand: PublicBrandConfig | null | undefined): string {
  return '保養說明尚未設定，請直接聯繫刺青師。';
}

/** Footer contact note — hidden when brand has no LINE contact. */
export function getAftercareContactNote(brand: PublicBrandConfig | null | undefined): string | null {
  if (!hasBrandLineContact(brand)) {
    return null;
  }
  return '如有任何問題，歡迎隨時透過 LINE 聯繫我們。';
}

/** Home gallery empty copy — brand-neutral when gallery truly has zero works. */
export function getHomeGalleryEmptyMessage(
  brand: PublicBrandConfig | null | undefined,
  options: { hasActiveFilters: boolean },
): string {
  if (!options.hasActiveFilters) {
    return `${brand?.name ?? '工作室'}尚無上架作品，敬請期待。`;
  }
  return '目前沒有符合條件的作品，試試調整篩選條件。';
}

export function getConsentHeading(_brand: PublicBrandConfig | null | undefined): string {
  return '紋身同意書';
}

export function getConsentBrandSubtitle(brand: PublicBrandConfig | null | undefined): string | null {
  return brand?.name ?? brand?.seoSiteName ?? null;
}

export function getArtworkContactCtaLabel(_brand: PublicBrandConfig | null | undefined): string {
  return '我要詢問 / 認領';
}
