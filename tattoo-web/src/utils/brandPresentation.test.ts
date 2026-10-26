import { describe, expect, it } from 'vitest';
import { GUJIGUJI_CONFIG, WHITEHORN_CONFIG } from '../config/brands';
import {
  getAftercareContactNote,
  getAftercareEmptyMessage,
  getCalendarRegionSubline,
  getHeaderBrandLabel,
  getHomeGalleryEmptyMessage,
  getImageWatermarkText,
  shouldShowHeaderLogoImage,
} from './brandPresentation';

describe('brandPresentation', () => {
  it('whitehorn header keeps INKFLOW label and never shows logo image', () => {
    const withLogo = { ...WHITEHORN_CONFIG, logoUrl: 'https://inkflow.work/uploads/logo.webp' };
    expect(getHeaderBrandLabel(withLogo)).toBe('INKFLOW');
    expect(shouldShowHeaderLogoImage(withLogo)).toBe(false);
  });

  it('gujiguji header shows logo image when logoUrl is set', () => {
    const withLogo = { ...GUJIGUJI_CONFIG, logoUrl: '/uploads/guji_logo.webp' };
    expect(shouldShowHeaderLogoImage(withLogo)).toBe(true);
    expect(getHeaderBrandLabel(withLogo)).toBe('咕嘰咕嘰刺青');
  });

  it('gujiguji header falls back to brand name when logoUrl is absent', () => {
    expect(shouldShowHeaderLogoImage(GUJIGUJI_CONFIG)).toBe(false);
    expect(getHeaderBrandLabel(GUJIGUJI_CONFIG)).toBe('咕嘰咕嘰刺青');
  });

  it('whitehorn calendar subline keeps taipei copy', () => {
    expect(getCalendarRegionSubline(WHITEHORN_CONFIG)).toBe('台北刺青請透過 LINE 另外詢問');
  });

  it('gujiguji has no calendar subline by default', () => {
    expect(getCalendarRegionSubline(GUJIGUJI_CONFIG)).toBeNull();
  });

  it('gujiguji watermark does not fallback to beigahtattoo', () => {
    expect(getImageWatermarkText(GUJIGUJI_CONFIG)).toBeNull();
  });

  it('whitehorn watermark falls back to beigahtattoo without IG url', () => {
    const brand = { ...WHITEHORN_CONFIG, instagramUrl: undefined };
    expect(getImageWatermarkText(brand)).toBe('@beigahtattoo');
  });

  it('gujiguji aftercare contact note is hidden without LINE', () => {
    expect(getAftercareContactNote(GUJIGUJI_CONFIG)).toBeNull();
  });

  it('aftercare empty message is brand-neutral', () => {
    expect(getAftercareEmptyMessage(GUJIGUJI_CONFIG)).toBe('保養說明尚未設定，請直接聯繫刺青師。');
    expect(getAftercareEmptyMessage(GUJIGUJI_CONFIG)).not.toContain('白角');
  });

  it('whitehorn aftercare contact note shows when LINE is available', () => {
    expect(getAftercareContactNote(WHITEHORN_CONFIG)).toContain('LINE');
  });

  it('gujiguji home empty gallery uses brand-neutral copy', () => {
    expect(getHomeGalleryEmptyMessage(GUJIGUJI_CONFIG, { hasActiveFilters: false })).toBe(
      '咕嘰咕嘰刺青尚無上架作品，敬請期待。',
    );
  });

  it('home empty gallery with filters keeps filter guidance copy', () => {
    expect(getHomeGalleryEmptyMessage(GUJIGUJI_CONFIG, { hasActiveFilters: true })).toBe(
      '目前沒有符合條件的作品，試試調整篩選條件。',
    );
  });
});
