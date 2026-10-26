import type { Artwork } from '../types';
import { getArtworkPlacementState } from './artworkPreviewData';
import { normalizeArtworkPlacementKeys } from './artworkPlacements';

/**
 * 批次更新 PNG 時要送給 saveArtwork 的資料。
 *
 * 後端 saveArtwork 會用整包資料覆蓋作品，所以這裡完全比照
 * 「編輯作品 → 不改任何欄位 → 儲存」時表單送出的內容，只替換 pngUrl。
 *
 * 刻意不送 tagIds：後端在沒有 tagIds 欄位時不會動到分類標籤關聯，
 * 比重送一次更保險；category 也沿用原值，不重新推導。
 */
export function buildArtworkPngUpdatePayload(art: Artwork, pngUrl: string | undefined): Artwork {
  const placementKeys = normalizeArtworkPlacementKeys(getArtworkPlacementState(art).keys);
  const imageUrls = (art.imageUrls && art.imageUrls.length > 0 ? art.imageUrls : [art.imageUrl]).filter(Boolean);
  const sizeNote = art.sizeNote?.trim();

  const payload: Artwork = {
    id: art.id,
    title: art.title,
    description: art.description || 'No description provided.',
    imageUrl: art.imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : [art.imageUrl],
    pngUrl: pngUrl || undefined,
    category: art.category,
    price: art.price ? Number(art.price) : undefined,
    specialPrice: art.specialPrice ? Number(art.specialPrice) : undefined,
    widthCm: art.widthCm,
    heightCm: typeof art.heightCm === 'number' ? art.heightCm : undefined,
    sizeNote: sizeNote || undefined,
    recommendedPlacements: placementKeys,
    recommendedPlacementKeys: placementKeys,
    status: art.status,
    createdAt: art.createdAt,
    tags: Array.isArray(art.tags) ? art.tags : [],
    isNew: Boolean(art.isNew),
  };
  return payload;
}

export type BatchPngScope = 'all' | 'with_png' | 'missing_png';

export function filterArtworksForBatch(artworks: Artwork[], scope: BatchPngScope): Artwork[] {
  const hasCover = (a: Artwork) => Boolean((a.imageUrls && a.imageUrls[0]) || a.imageUrl);
  return artworks.filter((a) => {
    if (!hasCover(a)) return false;
    const hasPng = Boolean(a.pngUrl && a.pngUrl.trim());
    if (scope === 'with_png') return hasPng;
    if (scope === 'missing_png') return !hasPng;
    return true;
  });
}

/**
 * 分類整理用：與 PNG 批次相同的保守 payload，但替換 tagIds 與 category。
 * category 設成新題材名稱（與編輯表單儲存時的行為一致），
 * 避免後端舊分類自動遷移把已停用的標籤加回作品。
 */
export function buildArtworkTaxonomyUpdatePayload(art: Artwork, tagIds: number[], category: string): Artwork {
  return {
    ...buildArtworkPngUpdatePayload(art, art.pngUrl),
    category,
    tagIds,
  };
}
