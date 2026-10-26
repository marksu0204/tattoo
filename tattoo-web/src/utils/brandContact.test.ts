import { describe, expect, it } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import {
  buildLineInquiryUrl,
  getBrandInstagramUrl,
  getBrandLineUrl,
  hasAnyBrandContact,
  hasBrandLineContact,
  hasBrandLoginCapability,
  shouldShowPublicBookingCalendar,
} from './brandContact';

describe('brandContact', () => {
  it('whitehorn resolves legacy LINE when lineUrl absent', () => {
    const brand = { ...WHITEHORN_CONFIG, lineUrl: undefined };
    expect(getBrandLineUrl(brand)).toContain('270vwddw');
    expect(hasBrandLineContact(brand)).toBe(true);
  });

  it('whitehorn resolves legacy IG when instagramUrl absent', () => {
    const brand = { ...WHITEHORN_CONFIG, instagramUrl: undefined };
    expect(getBrandInstagramUrl(brand)).toContain('beigahtattoo');
  });

  it('gujiguji without lineUrl does not fallback to whitehorn LINE', () => {
    expect(getBrandLineUrl(GUJIGUJI_CONFIG)).toBeNull();
    expect(buildLineInquiryUrl('test', GUJIGUJI_CONFIG)).toBeNull();
    expect(hasBrandLineContact(GUJIGUJI_CONFIG)).toBe(false);
  });

  it('gujiguji without instagramUrl does not fallback to whitehorn IG', () => {
    expect(getBrandInstagramUrl(GUJIGUJI_CONFIG)).toBeNull();
    expect(hasAnyBrandContact(GUJIGUJI_CONFIG)).toBe(false);
  });

  it('gujiguji with lin.ee lineUrl resolves getBrandLineUrl directly', () => {
    const brand = {
      ...GUJIGUJI_CONFIG,
      lineUrl: 'https://lin.ee/9LjLD34',
    };
    expect(getBrandLineUrl(brand)).toBe('https://lin.ee/9LjLD34');
    expect(hasBrandLineContact(brand)).toBe(true);
  });

  it('buildLineInquiryUrl returns lin.ee URL without message prefill', () => {
    const brand = {
      ...GUJIGUJI_CONFIG,
      lineUrl: 'https://lin.ee/9LjLD34',
    };
    const url = buildLineInquiryUrl('hello, inquiry message', brand);
    expect(url).toBe('https://lin.ee/9LjLD34');
    expect(url).not.toContain('oaMessage');
    expect(url).not.toContain('hello');
  });

  it('gujiguji with explicit lineUrl uses its own OA id', () => {
    const brand = {
      ...GUJIGUJI_CONFIG,
      lineUrl: 'https://line.me/R/ti/p/@gujiguji_test',
    };
    const url = buildLineInquiryUrl('hello', brand);
    expect(url).toContain('@gujiguji_test');
    expect(url).not.toContain('270vwddw');
  });

  it('gujiguji with explicit instagramUrl uses its own handle', () => {
    const brand = {
      ...GUJIGUJI_CONFIG,
      instagramUrl: 'https://www.instagram.com/gujiguji_tattoo/',
    };
    expect(getBrandInstagramUrl(brand)).toBe('https://www.instagram.com/gujiguji_tattoo/');
    expect(getBrandInstagramUrl(brand)).not.toContain('beigahtattoo');
    expect(hasAnyBrandContact(brand)).toBe(true);
  });

  it('buildLineInquiryUrl encodes message for whitehorn', () => {
    const message = '你好，作品《測試 & 特殊符號 % # ?》';
    const url = buildLineInquiryUrl(message, WHITEHORN_CONFIG);
    expect(url).toContain('line.me/R/oaMessage/@');
    expect(url).toContain(encodeURIComponent(message));
  });

  it('whitehorn has login capability when liffId is configured', () => {
    expect(hasBrandLoginCapability(WHITEHORN_CONFIG)).toBe(true);
  });

  it('gujiguji without liffId has no login capability', () => {
    expect(hasBrandLoginCapability(GUJIGUJI_CONFIG)).toBe(false);
  });

  it('whitehorn shows public booking calendar when login capability exists', () => {
    expect(shouldShowPublicBookingCalendar(WHITEHORN_CONFIG)).toBe(true);
  });

  it('gujiguji hides public booking calendar without login capability', () => {
    expect(shouldShowPublicBookingCalendar(GUJIGUJI_CONFIG)).toBe(false);
  });
});
