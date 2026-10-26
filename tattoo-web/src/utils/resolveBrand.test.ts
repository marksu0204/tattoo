import { describe, expect, it } from 'vitest';
import {
  getDevBrandOverride,
  normalizeHostname,
  resolveBrandFromHostname,
  resolveBrandIdentityFromHostname,
} from './resolveBrand';

describe('normalizeHostname', () => {
  it('lowercases and strips port', () => {
    expect(normalizeHostname('INKFLOW.WORK:443')).toBe('inkflow.work');
    expect(normalizeHostname('localhost:5173')).toBe('localhost');
  });
});

describe('resolveBrandIdentityFromHostname', () => {
  it('resolves inkflow.work to whitehorn identity', () => {
    const r = resolveBrandIdentityFromHostname('inkflow.work');
    expect(r.isKnownHost).toBe(true);
    expect(r.brandCode).toBe('whitehorn');
  });

  it('resolves www.inkflow.work to whitehorn identity', () => {
    const r = resolveBrandIdentityFromHostname('www.inkflow.work');
    expect(r.isKnownHost).toBe(true);
    expect(r.brandCode).toBe('whitehorn');
  });

  it('resolves gujiguji host identity even when bootstrap isActive=false', () => {
    const r = resolveBrandIdentityFromHostname('gujiguji.inkflow.work');
    expect(r.isKnownHost).toBe(true);
    expect(r.brandCode).toBe('gujiguji');
    expect(r.brand?.code).toBe('gujiguji');
    expect(r.brand?.isActive).toBe(false);
  });

  it('returns null identity for unknown host', () => {
    const r = resolveBrandIdentityFromHostname('unknown.example.com');
    expect(r.isKnownHost).toBe(false);
    expect(r.brand).toBeNull();
    expect(r.brandCode).toBeNull();
  });

  it('defaults localhost to whitehorn in dev', () => {
    const r = resolveBrandIdentityFromHostname('localhost');
    expect(r.isKnownHost).toBe(true);
    expect(r.brandCode).toBe('whitehorn');
  });
});

describe('resolveBrandFromHostname (legacy wrapper)', () => {
  it('treats known inactive-bootstrap gujiguji host as known (isSupported mirrors identity)', () => {
    const r = resolveBrandFromHostname('gujiguji.inkflow.work');
    expect(r.isSupported).toBe(true);
    expect(r.brandCode).toBe('gujiguji');
  });

  it('does not fallback unknown host to whitehorn', () => {
    const r = resolveBrandFromHostname('random.inkflow.work');
    expect(r.isSupported).toBe(false);
    expect(r.brand).toBeNull();
  });
});

describe('getDevBrandOverride', () => {
  it('returns null when not in dev (production build semantics)', () => {
    if (import.meta.env.DEV) {
      expect(getDevBrandOverride('?brand=gujiguji')).toBe('gujiguji');
    } else {
      expect(getDevBrandOverride('?brand=gujiguji')).toBeNull();
    }
  });

  it('ignores invalid brand query in dev', () => {
    if (import.meta.env.DEV) {
      expect(getDevBrandOverride('?brand=evil')).toBeNull();
    }
  });
});
