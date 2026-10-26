import { describe, expect, it } from 'vitest';
import { buildNewTagIds, proposeForArtwork, proposeStyle, proposeSubject, RETIRED_TAG_KEYS, NEW_TAGS } from './taxonomyMigration';

describe('proposeSubject', () => {
  it('prefers a concrete subject over abstract', () => {
    expect(proposeSubject(['insect', 'abstract'])).toBe('insect');
    expect(proposeSubject(['abstract'])).toBe('abstract');
  });
  it('merges absorbed subjects', () => {
    expect(proposeSubject(['bird'])).toBe('animal');
    expect(proposeSubject(['myth_religion', 'abstract'])).toBe('human');
    expect(proposeSubject(['landscape'])).toBe('astronomy_zodiac');
    expect(proposeSubject(['text_symbol'])).toBe('abstract');
  });
  it('returns null without subject tags', () => {
    expect(proposeSubject(['black_grey'])).toBeNull();
  });
});

describe('proposeStyle', () => {
  it('picks one main style by priority', () => {
    expect(proposeStyle(['black_grey', 'dotwork', 'realism'])).toBe('realism');
    expect(proposeStyle(['black_grey', 'sketch', 'dotwork'])).toBe('sketch');
    expect(proposeStyle(['black_grey', 'dotwork', 'sumi_ink'])).toBe('sumi_ink');
    expect(proposeStyle(['fluid_smoke'])).toBe('sumi_ink');
    expect(proposeStyle(['black_grey', 'dotwork'])).toBe('dotwork');
    expect(proposeStyle(['black_grey'])).toBe('sumi_ink');
    expect(proposeStyle([])).toBeNull();
  });
});

describe('proposeForArtwork', () => {
  it('applies manual overrides and flags them for review', () => {
    expect(proposeForArtwork('1779006817182', ['insect', 'abstract', 'dotwork'])).toEqual({
      subject: 'marine',
      style: 'dotwork',
      needsReview: true,
    });
  });
  it('flags artworks the rules cannot classify', () => {
    expect(proposeForArtwork('unknown', []).needsReview).toBe(true);
    expect(proposeForArtwork('unknown', ['floral_botanical', 'sketch']).needsReview).toBe(false);
  });
});

describe('buildNewTagIds', () => {
  const idByKey = { floral_botanical: 1, sketch: 14, want_to_tattoo: 29, discount: 30 };
  it('keeps want_to_tattoo, drops retired tags', () => {
    expect(buildNewTagIds({ subject: 'floral_botanical', style: 'sketch' }, ['floral_botanical', 'black_grey', 'want_to_tattoo', 'discount'], idByKey))
      .toEqual([1, 14, 29]);
  });
});

describe('tag plan', () => {
  it('never retires a tag that is reused as a new tag', () => {
    const reused = new Set(NEW_TAGS.map((t) => t.tagKey));
    expect(RETIRED_TAG_KEYS.filter((k) => reused.has(k))).toEqual([]);
  });
});
