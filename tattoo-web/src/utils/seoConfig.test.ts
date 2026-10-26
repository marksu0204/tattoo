import { describe, expect, it } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import {
  buildArtworkLoadingSeo,
  buildCanonicalUrl,
  buildHomepageSeo,
} from './seoConfig';

describe('seoConfig runtime canonical', () => {
  it('gujiguji homepage canonical uses brand publicOrigin', () => {
    const seo = buildHomepageSeo(new URLSearchParams(), GUJIGUJI_CONFIG);
    expect(seo.canonicalUrl).toBe('https://gujiguji.inkflow.work/');
  });

  it('whitehorn homepage canonical uses brand publicOrigin', () => {
    const seo = buildHomepageSeo(new URLSearchParams(), WHITEHORN_CONFIG);
    expect(seo.canonicalUrl).toBe('https://inkflow.work/');
  });

  it('gujiguji artwork canonical does not fallback to inkflow.work', () => {
    const seo = buildArtworkLoadingSeo('123', GUJIGUJI_CONFIG);
    expect(seo.canonicalUrl).toBe('https://gujiguji.inkflow.work/artwork/123');
    expect(seo.canonicalUrl).not.toContain('https://inkflow.work/artwork');
  });

  it('buildCanonicalUrl prefers explicit publicOrigin', () => {
    expect(buildCanonicalUrl('/aftercare', 'https://gujiguji.inkflow.work')).toBe(
      'https://gujiguji.inkflow.work/aftercare',
    );
  });
});
