import { describe, expect, it } from 'vitest';
import { Artwork, ArtworkStatus } from '../types';
import { getEffectiveArtworkPrice, sortArtworks } from './artworkSort';

const createArtwork = (
  id: string,
  options: Partial<Pick<Artwork, 'price' | 'specialPrice' | 'createdAt'>> = {}
): Artwork => ({
  id,
  title: id,
  description: '',
  imageUrl: '',
  category: 'All',
  status: ArtworkStatus.AVAILABLE,
  createdAt: options.createdAt ?? '2026-08-07 00:00:00',
  tags: [],
  price: options.price,
  specialPrice: options.specialPrice,
});

describe('artworkSort', () => {
  it('一般價格：使用原價排序', () => {
    const artworks = [
      createArtwork('a', { price: 5000 }),
      createArtwork('b', { price: 3000 }),
      createArtwork('c', { price: 8000 }),
    ];
    const sorted = sortArtworks(artworks, 'price_asc');
    expect(sorted.map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });

  it('優惠價格：使用 specialPrice 作為實際排序價格', () => {
    const artworks = [
      createArtwork('a', { price: 6000, specialPrice: 2500 }),
      createArtwork('b', { price: 3000 }),
      createArtwork('c', { price: 4500, specialPrice: 2800 }),
    ];
    const sorted = sortArtworks(artworks, 'price_asc');
    expect(sorted.map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });

  it('相同價格：維持穩定排序', () => {
    const artworks = [
      createArtwork('a', { price: 3000 }),
      createArtwork('b', { price: 3000 }),
      createArtwork('c', { price: 3000 }),
    ];
    const sorted = sortArtworks(artworks, 'price_asc');
    expect(sorted.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('無價格作品：一律排在最後', () => {
    const artworks = [
      createArtwork('a', { price: 3000 }),
      createArtwork('b'),
      createArtwork('c', { price: Number.NaN }),
      createArtwork('d', { specialPrice: 2000 }),
    ];
    const sorted = sortArtworks(artworks, 'price_asc');
    expect(sorted.map((a) => a.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('價格由低到高', () => {
    const artworks = [
      createArtwork('a', { price: 9000 }),
      createArtwork('b', { price: 1200 }),
      createArtwork('c', { price: 4500 }),
    ];
    const sorted = sortArtworks(artworks, 'price_asc');
    expect(sorted.map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('價格由高到低', () => {
    const artworks = [
      createArtwork('a', { price: 9000 }),
      createArtwork('b', { price: 1200 }),
      createArtwork('c', { price: 4500 }),
    ];
    const sorted = sortArtworks(artworks, 'price_desc');
    expect(sorted.map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });

  it('getEffectiveArtworkPrice 會優先取優惠價', () => {
    expect(getEffectiveArtworkPrice(createArtwork('x', { price: 3000, specialPrice: 1800 }))).toBe(1800);
    expect(getEffectiveArtworkPrice(createArtwork('y', { price: 3000 }))).toBe(3000);
    expect(getEffectiveArtworkPrice(createArtwork('z', { price: Number.NaN }))).toBeNull();
  });
});
