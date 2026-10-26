import { Artwork } from '../types';

export type ArtworkSort = 'recommended' | 'newest' | 'price_asc' | 'price_desc';

export const normalizeArtworkSort = (rawSort?: string | null): ArtworkSort => {
  if (rawSort === 'newest') return 'newest';
  if (rawSort === 'price_asc') return 'price_asc';
  if (rawSort === 'price_desc') return 'price_desc';
  return 'recommended';
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

export const getEffectiveArtworkPrice = (artwork: Pick<Artwork, 'price' | 'specialPrice'>): number | null => {
  const special = toFiniteNumber(artwork.specialPrice);
  if (special !== null && special > 0) return special;
  const price = toFiniteNumber(artwork.price);
  if (price !== null && price > 0) return price;
  return null;
};

export const sortArtworks = (artworks: Artwork[], sort: ArtworkSort): Artwork[] => {
  if (sort === 'recommended') return artworks;

  const withIndex = artworks.map((artwork, index) => ({ artwork, index }));
  withIndex.sort((a, b) => {
    if (sort === 'newest') {
      const aTime = new Date(a.artwork.createdAt).getTime();
      const bTime = new Date(b.artwork.createdAt).getTime();
      if (aTime !== bTime) return bTime - aTime;
      return a.index - b.index;
    }

    const aPrice = getEffectiveArtworkPrice(a.artwork);
    const bPrice = getEffectiveArtworkPrice(b.artwork);
    const aMissing = aPrice === null;
    const bMissing = bPrice === null;
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    if (aPrice !== null && bPrice !== null && aPrice !== bPrice) {
      return sort === 'price_asc' ? aPrice - bPrice : bPrice - aPrice;
    }

    return a.index - b.index;
  });

  return withIndex.map(({ artwork }) => artwork);
};
