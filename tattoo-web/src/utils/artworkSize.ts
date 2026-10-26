import { Artwork } from '../types';

const sizeNumberFormatter = new Intl.NumberFormat('zh-TW', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const cleanPlacement = (value: string): string => value.trim();

export const normalizePlacementList = (placements: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of placements) {
    const item = cleanPlacement(raw);
    if (!item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
};

export const parsePlacementInput = (value: string): string[] => {
  if (!value.trim()) return [];
  return normalizePlacementList(value.split(/[,\n\u3001]/g));
};

const hasPositiveNumber = (value?: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const formatSizeNumber = (value: number): string => sizeNumberFormatter.format(value);

export const formatArtworkSize = (artwork: Pick<Artwork, 'widthCm' | 'heightCm'>): string | null => {
  const hasWidth = hasPositiveNumber(artwork.widthCm);
  const hasHeight = hasPositiveNumber(artwork.heightCm);

  if (hasWidth && hasHeight) {
    return `約${formatSizeNumber(artwork.widthCm)} × ${formatSizeNumber(artwork.heightCm)} cm`;
  }
  if (hasWidth) {
    return `約寬 ${formatSizeNumber(artwork.widthCm)} cm`;
  }
  if (hasHeight) {
    return `約高 ${formatSizeNumber(artwork.heightCm)} cm`;
  }
  return null;
};
