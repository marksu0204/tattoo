import { describe, expect, it } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import {
  isPublicBrandPresentation,
  mergePublicBrandPresentation,
  type PublicBrandPresentation,
} from './mergeBrandPresentation';

describe('mergePublicBrandPresentation', () => {
  const whitehornApi: PublicBrandPresentation = {
    code: 'whitehorn',
    name: '白角刺青 DB',
    publicOrigin: 'https://inkflow.work',
    primaryColor: '#d4af37',
    accentColor: '#121212',
    instagramUrl: 'https://www.instagram.com/beigahtattoo/',
    lineUrl: 'https://line.me/R/ti/p/@270vwddw',
    seoSiteName: '白角刺青 DB',
    seoDefaultDescription: 'DB description',
    regionLabel: '台南市東區',
    logoUrl: null,
  };

  it('merges presentation when API code matches bootstrap', () => {
    const merged = mergePublicBrandPresentation(WHITEHORN_CONFIG, whitehornApi);
    expect(merged.code).toBe('whitehorn');
    expect(merged.name).toBe('白角刺青 DB');
    expect(merged.hostnames).toEqual(WHITEHORN_CONFIG.hostnames);
    expect(merged.isActive).toBe(true);
    expect(merged.liffId).toBe(WHITEHORN_CONFIG.liffId);
    expect(merged.lineUrl).toContain('270vwddw');
  });

  it('rejects API code mismatch and keeps bootstrap', () => {
    const merged = mergePublicBrandPresentation(WHITEHORN_CONFIG, {
      ...whitehornApi,
      code: 'gujiguji',
    });
    expect(merged).toEqual(WHITEHORN_CONFIG);
  });

  it('returns bootstrap when API is null', () => {
    expect(mergePublicBrandPresentation(GUJIGUJI_CONFIG, null)).toEqual(GUJIGUJI_CONFIG);
  });

  it('DB null contacts stay undefined (no bootstrap whitehorn leakage)', () => {
    const merged = mergePublicBrandPresentation(GUJIGUJI_CONFIG, {
      code: 'gujiguji',
      name: '咕嘰咕嘰刺青',
      publicOrigin: 'https://gujiguji.inkflow.work',
      primaryColor: '#f4a7b9',
      accentColor: '#1a1a2e',
      instagramUrl: null,
      lineUrl: null,
      seoSiteName: '咕嘰咕嘰刺青',
      seoDefaultDescription: '籌備中',
      regionLabel: '台南市東區',
      logoUrl: null,
    });
    expect(merged.instagramUrl).toBeUndefined();
    expect(merged.lineUrl).toBeUndefined();
    expect(merged.isActive).toBe(false);
  });

  it('DB theme colors override bootstrap', () => {
    const merged = mergePublicBrandPresentation(GUJIGUJI_CONFIG, {
      code: 'gujiguji',
      name: '咕嘰咕嘰刺青',
      publicOrigin: 'https://gujiguji.inkflow.work',
      primaryColor: '#ff0000',
      accentColor: '#0000ff',
      seoSiteName: '咕嘰咕嘰刺青',
      seoDefaultDescription: 'test',
      regionLabel: null,
      logoUrl: null,
      lineUrl: null,
      instagramUrl: null,
    });
    expect(merged.primaryColor).toBe('#ff0000');
    expect(merged.accentColor).toBe('#0000ff');
  });

  it('DB logoUrl and contact URLs override bootstrap when present', () => {
    const merged = mergePublicBrandPresentation(GUJIGUJI_CONFIG, {
      code: 'gujiguji',
      name: '咕嘰咕嘰刺青',
      publicOrigin: 'https://gujiguji.inkflow.work',
      primaryColor: '#f4a7b9',
      accentColor: '#1a1a2e',
      logoUrl: '/uploads/guji_logo.webp',
      instagramUrl: 'https://www.instagram.com/gujiguji_tattoo/',
      lineUrl: 'https://line.me/R/ti/p/@gujiguji_oa',
      seoSiteName: '咕嘰咕嘰刺青',
      seoDefaultDescription: '正式描述',
      regionLabel: '台南市東區',
    });
    expect(merged.logoUrl).toBe('/uploads/guji_logo.webp');
    expect(merged.instagramUrl).toBe('https://www.instagram.com/gujiguji_tattoo/');
    expect(merged.lineUrl).toBe('https://line.me/R/ti/p/@gujiguji_oa');
  });
});

describe('isPublicBrandPresentation', () => {
  it('validates minimal public config shape', () => {
    expect(
      isPublicBrandPresentation({
        code: 'whitehorn',
        name: 'x',
        primaryColor: '#000',
        accentColor: '#111',
        seoSiteName: 'x',
        seoDefaultDescription: 'x',
        publicOrigin: 'https://inkflow.work',
      }),
    ).toBe(true);
    expect(isPublicBrandPresentation({ code: 'bad' })).toBe(false);
  });
});
