import { describe, expect, it } from 'vitest';
import { isTouchMobileDevice } from './imageDownload';

describe('isTouchMobileDevice', () => {
  it('detects iPhone and Android', () => {
    expect(isTouchMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(isTouchMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', maxTouchPoints: 5 })).toBe(true);
  });
  it('detects iPad that reports itself as a Mac', () => {
    expect(isTouchMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', maxTouchPoints: 5, platform: 'MacIntel' })).toBe(true);
  });
  it('keeps real desktop Macs and PCs as desktop', () => {
    expect(isTouchMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0, platform: 'MacIntel' })).toBe(false);
    expect(isTouchMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 })).toBe(false);
  });
});
