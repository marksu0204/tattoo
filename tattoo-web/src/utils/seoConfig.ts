import { Artwork, ClaimStage } from '../types';
import { resolveArtworkClaimStage } from './artworkFilters';
import { formatArtworkSize } from './artworkSize';
import { getEffectiveArtworkPrice } from '../services/tracking';
import type { DocumentMetaParams, RobotsDirective } from './pageMeta';
import type { PublicBrandConfig } from '../config/brands';
import { WHITEHORN_CONFIG } from '../config/brands';

export const SEO_SITE_NAME = WHITEHORN_CONFIG.seoSiteName;
export const SEO_PRODUCTION_ORIGIN = WHITEHORN_CONFIG.publicOrigin;

export const SEO_DEFAULT_DESCRIPTION = WHITEHORN_CONFIG.seoDefaultDescription;

export type BrandSeoSnapshot = {
  siteName: string;
  defaultDescription: string;
  publicOrigin: string;
};

export function brandSeoSnapshot(brand?: PublicBrandConfig | null): BrandSeoSnapshot {
  const source = brand ?? WHITEHORN_CONFIG;
  return {
    siteName: source.seoSiteName,
    defaultDescription: source.seoDefaultDescription,
    publicOrigin: source.publicOrigin.replace(/\/$/, ''),
  };
}

export const HOME_SEO_INDEXABLE = {
  title: '白角刺青｜台南水墨、黑灰與客製刺青',
  description:
    '白角刺青位於台南市東區仁東街，為預約制刺青工作室，提供水墨、黑灰、花卉、抽象與客製刺青，可查看認領作品、價格、尺寸與預約資訊。',
} as const;

const HOME_FILTER_PARAM_KEYS = [
  'sort',
  'category',
  'budget',
  'size',
  'claim',
  'placement',
  'taxonomy',
] as const;

export function buildCanonicalUrl(pathname: string, publicOrigin?: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const pathOnly = normalized.split('?')[0].split('#')[0];
  let cleanPath = pathOnly || '/';
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }
  const origin = (publicOrigin ?? SEO_PRODUCTION_ORIGIN).replace(/\/$/, '');
  return `${origin}${cleanPath}`;
}

export function isValidSeoImageUrl(url?: string | null): url is string {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function hasHomeSeoFilterParams(searchParams: URLSearchParams): boolean {
  return HOME_FILTER_PARAM_KEYS.some((key) => {
    const value = searchParams.get(key);
    return value !== null && value !== '';
  });
}

const baseMeta = (
  partial: Omit<DocumentMetaParams, 'siteName' | 'ogType'> & {
    ogType?: string;
  },
  brand?: PublicBrandConfig | null,
): DocumentMetaParams => {
  const ctx = brandSeoSnapshot(brand);
  return {
    siteName: ctx.siteName,
    ogType: 'website',
    ...partial,
  };
};

export function buildHomepageSeo(
  searchParams: URLSearchParams,
  brand?: PublicBrandConfig | null,
): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  const indexable =
    !brand || brand.code === 'whitehorn'
      ? HOME_SEO_INDEXABLE
      : {
          title: `${ctx.siteName}｜${brand.regionLabel ?? '刺青'}`,
          description: ctx.defaultDescription,
        };
  const robots: RobotsDirective = hasHomeSeoFilterParams(searchParams)
    ? 'noindex, follow'
    : 'index, follow';

  return baseMeta(
    {
      title: indexable.title,
      description: indexable.description,
      canonicalUrl: buildCanonicalUrl('/', ctx.publicOrigin),
      robots,
    },
    brand,
  );
}

export function buildAftercareSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `刺青術後保養｜${ctx.siteName}`,
      description:
        '提供刺青後清潔、保濕與日常照護注意事項，協助了解刺青完成後的基本保養流程。',
      canonicalUrl: buildCanonicalUrl('/aftercare', ctx.publicOrigin),
      robots: 'index, follow',
    },
    brand,
  );
}

export function buildLoginSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `${ctx.siteName}｜會員登入`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildAdminSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `${ctx.siteName}｜管理後台`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildCalendarSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `${ctx.siteName}｜預約行事曆`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildProfileSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `${ctx.siteName}｜會員中心`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildPreviewSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `${ctx.siteName}｜刺青預覽`,
      description: ctx.defaultDescription,
      robots: 'noindex, follow',
    },
    brand,
  );
}

export function build3dPreviewTestSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `${ctx.siteName}｜3D 預覽測試`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildConsentSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `同意書｜${ctx.siteName}`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildAppointmentSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `預約資料｜${ctx.siteName}`,
      description: ctx.defaultDescription,
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildNotFoundSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `找不到頁面｜${ctx.siteName}`,
      description: '您所查看的頁面不存在或連結已變更。',
      robots: 'noindex, nofollow',
    },
    brand,
  );
}

export function buildDefaultSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: ctx.siteName,
      description: ctx.defaultDescription,
      robots: 'index, follow',
      canonicalUrl: buildCanonicalUrl('/', ctx.publicOrigin),
    },
    brand,
  );
}

const getTaxonomyLabels = (
  artwork: Artwork,
  groupKey: 'style' | 'subject'
): string[] => {
  const fromTags =
    artwork.taxonomyTags
      ?.filter((tag) => tag.groupKey === groupKey)
      .map((tag) => tag.displayName.trim())
      .filter(Boolean) ?? [];
  return Array.from(new Set(fromTags));
};

export function buildArtworkSeoTitle(artwork: Artwork, brand?: PublicBrandConfig | null): string {
  const ctx = brandSeoSnapshot(brand);
  const stage = resolveArtworkClaimStage(artwork);
  const title = artwork.title.trim();

  if (stage === ClaimStage.CLAIMED) {
    return `${title}｜刺青作品｜${ctx.siteName}`;
  }

  const styleLabel = getTaxonomyLabels(artwork, 'style')[0];
  const subjectLabel = getTaxonomyLabels(artwork, 'subject')[0];
  const accent = styleLabel || subjectLabel;

  if (accent && !title.includes(accent)) {
    return `${accent}${title}刺青認領圖｜${ctx.siteName}`;
  }

  return `${title}｜刺青認領圖｜${ctx.siteName}`;
}

export function buildArtworkSeoDescription(artwork: Artwork, brand?: PublicBrandConfig | null): string {
  const ctx = brandSeoSnapshot(brand);
  const segments: string[] = [];
  const title = artwork.title?.trim();
  if (title) {
    segments.push(`「${title}」刺青設計`);
  }

  const styleLabels = getTaxonomyLabels(artwork, 'style');
  const subjectLabels = getTaxonomyLabels(artwork, 'subject');
  const styleSubject = [...styleLabels, ...subjectLabels];
  if (styleSubject.length > 0) {
    segments.push(`風格為${styleSubject.join('／')}`);
  } else if (artwork.category?.trim()) {
    segments.push(`風格為${artwork.category.trim()}`);
  }

  const sizeText = formatArtworkSize(artwork);
  if (sizeText) {
    segments.push(`建議尺寸${sizeText}`);
  }

  const stage = resolveArtworkClaimStage(artwork);
  if (stage === ClaimStage.AVAILABLE) {
    segments.push('目前可認領');
  } else if (stage === ClaimStage.NEGOTIATING) {
    segments.push('目前洽談中');
  } else if (stage === ClaimStage.CLAIMED) {
    segments.push('此作品已認領');
  }

  const price = getEffectiveArtworkPrice(artwork);
  if (price !== null) {
    segments.push(`價格 NT$${price.toLocaleString('zh-TW')}`);
  }

  segments.push(`查看作品細節與${ctx.siteName}預約資訊。`);

  return segments.join('，').slice(0, 160);
}

export function buildArtworkSeo(artwork: Artwork, brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  const primaryImage = artwork.imageUrls?.[0] || artwork.imageUrl;
  return baseMeta(
    {
      title: buildArtworkSeoTitle(artwork, brand),
      description: buildArtworkSeoDescription(artwork, brand),
      canonicalUrl: buildCanonicalUrl(`/artwork/${artwork.id}`, ctx.publicOrigin),
      imageUrl: isValidSeoImageUrl(primaryImage) ? primaryImage : undefined,
      robots: 'index, follow',
    },
    brand,
  );
}

export function buildArtworkLoadingSeo(artworkId: string, brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: ctx.siteName,
      description: ctx.defaultDescription,
      canonicalUrl: buildCanonicalUrl(`/artwork/${artworkId}`, ctx.publicOrigin),
      robots: 'index, follow',
    },
    brand,
  );
}

export function buildArtworkNotFoundSeo(brand?: PublicBrandConfig | null): DocumentMetaParams {
  const ctx = brandSeoSnapshot(brand);
  return baseMeta(
    {
      title: `找不到頁面｜${ctx.siteName}`,
      description: '您所查看的作品可能不存在，或連結已變更。',
      robots: 'noindex, nofollow',
    },
    brand,
  );
}
