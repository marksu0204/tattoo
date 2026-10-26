import type { Artwork } from '../types';
import {
  formatArtworkPlacementSummary,
  normalizeArtworkPlacementKeys,
  resolveStoredPlacements,
  type ArtworkPlacementKey,
} from './artworkPlacements';

export type ArtworkPreviewDataFilter =
  | 'all'
  | 'missing_png'
  | 'missing_size'
  | 'missing_placement'
  | 'complete';

const sizeNumberFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const hasArtworkPng = (artwork: Pick<Artwork, 'pngUrl'>): boolean =>
  Boolean(artwork.pngUrl && artwork.pngUrl.trim());

export const hasValidRecommendedLength = (artwork: Pick<Artwork, 'heightCm'>): boolean =>
  typeof artwork.heightCm === 'number' && Number.isFinite(artwork.heightCm) && artwork.heightCm > 0;

export const formatRecommendedLength = (heightCm?: number): string | null => {
  if (!hasValidRecommendedLength({ heightCm })) return null;
  return `${sizeNumberFormatter.format(heightCm!)} cm`;
};

export const getArtworkPlacementState = (artwork: Artwork) => {
  const keys = (artwork.recommendedPlacementKeys ?? []) as ArtworkPlacementKey[];
  const legacy = artwork.legacyRecommendedPlacements ?? [];
  if (keys.length > 0 || legacy.length > 0) {
    return { keys, legacy, labels: formatArtworkPlacementSummary(keys, legacy) };
  }
  const resolved = resolveStoredPlacements(artwork.recommendedPlacements);
  return {
    keys: resolved.keys,
    legacy: resolved.legacy,
    labels: formatArtworkPlacementSummary(resolved.keys, resolved.legacy),
  };
};

export const hasValidArtworkPlacements = (artwork: Artwork): boolean =>
  getArtworkPlacementState(artwork).keys.length > 0;

export const getArtworkPreviewCompleteness = (artwork: Artwork): { complete: number; total: 3 } => {
  let complete = 0;
  if (hasArtworkPng(artwork)) complete += 1;
  if (hasValidRecommendedLength(artwork)) complete += 1;
  if (hasValidArtworkPlacements(artwork)) complete += 1;
  return { complete, total: 3 };
};

export const matchesArtworkPreviewFilter = (artwork: Artwork, filter: ArtworkPreviewDataFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'missing_png') return !hasArtworkPng(artwork);
  if (filter === 'missing_size') return !hasValidRecommendedLength(artwork);
  if (filter === 'missing_placement') return !hasValidArtworkPlacements(artwork);
  return hasArtworkPng(artwork) && hasValidRecommendedLength(artwork) && hasValidArtworkPlacements(artwork);
};

export const ARTWORK_PREVIEW_FILTER_LABELS: Record<ArtworkPreviewDataFilter, string> = {
  all: '全部',
  missing_png: '缺PNG',
  missing_size: '缺尺寸',
  missing_placement: '缺部位',
  complete: '資料完整',
};
