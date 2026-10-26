import { describe, expect, it } from 'vitest';
import { ArtworkStatus, type Artwork } from '../types';
import { buildArtworkPngUpdatePayload, filterArtworksForBatch } from './artworkPngBatch';

const base: Artwork = {
  id: 'a1',
  title: '水墨花',
  description: '描述',
  imageUrl: '/uploads/a1.jpg',
  imageUrls: ['/uploads/a1.jpg', '/uploads/a1-2.jpg'],
  pngUrl: '/uploads/old.png',
  category: '花卉植物',
  isNew: true,
  status: ArtworkStatus.AVAILABLE,
  price: 15000,
  specialPrice: 11000,
  widthCm: 12,
  heightCm: 30,
  sizeNote: '  可微調  ',
  recommendedPlacements: ['前臂外側', 'thigh'],
  tagIds: [3, 7],
  createdAt: '2026-09-01 10:00:00',
  tags: ['花', '水墨'],
};

describe('buildArtworkPngUpdatePayload', () => {
  it('only replaces pngUrl and keeps every other saved field', () => {
    const payload = buildArtworkPngUpdatePayload(base, '/uploads/new.png');
    expect(payload).toMatchObject({
      id: 'a1',
      title: '水墨花',
      description: '描述',
      imageUrl: '/uploads/a1.jpg',
      imageUrls: ['/uploads/a1.jpg', '/uploads/a1-2.jpg'],
      pngUrl: '/uploads/new.png',
      category: '花卉植物',
      isNew: true,
      status: ArtworkStatus.AVAILABLE,
      price: 15000,
      specialPrice: 11000,
      widthCm: 12,
      heightCm: 30,
      sizeNote: '可微調',
      recommendedPlacements: ['forearm_outer', 'thigh'],
      recommendedPlacementKeys: ['forearm_outer', 'thigh'],
      createdAt: '2026-09-01 10:00:00',
      tags: ['花', '水墨'],
    });
  });

  it('does not send tagIds so taxonomy relations stay untouched', () => {
    const payload = buildArtworkPngUpdatePayload(base, '/uploads/new.png');
    expect('tagIds' in payload).toBe(false);
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('tagIds');
  });

  it('keeps isNew false and restores an empty png on undo', () => {
    const payload = buildArtworkPngUpdatePayload({ ...base, isNew: false }, '');
    expect(payload.isNew).toBe(false);
    expect(payload.pngUrl).toBeUndefined();
  });
});

describe('filterArtworksForBatch', () => {
  const list: Artwork[] = [
    base,
    { ...base, id: 'a2', pngUrl: '' },
    { ...base, id: 'a3', pngUrl: undefined, imageUrl: '', imageUrls: [] },
  ];
  it('filters by png presence and skips artworks without a cover image', () => {
    expect(filterArtworksForBatch(list, 'all').map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(filterArtworksForBatch(list, 'with_png').map((a) => a.id)).toEqual(['a1']);
    expect(filterArtworksForBatch(list, 'missing_png').map((a) => a.id)).toEqual(['a2']);
  });
});
