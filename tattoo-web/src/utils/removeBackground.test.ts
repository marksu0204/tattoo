import { describe, expect, it } from 'vitest';
import {
  type InkAlphaRemoveBgOptions,
  detectColorArtwork,
  detectPaperWhitePoint,
  removeBackgroundInkAlpha,
} from './removeBackground';
import { SYSTEM_DEFAULT_REMOVE_BG_PRESET, normalizeRemoveBgPreset, resolveEffectiveRemoveBgMode } from './removeBackgroundPreset';

type Rgb = [number, number, number];

/** 建立測試用像素：paperRatio 比例為紙張色，其餘依序填入 inkColors */
const makeImage = (paper: Rgb, inkColors: Rgb[], size = 100, paperRatio = 0.8) => {
  const count = size * size;
  const data = new Uint8ClampedArray(count * 4);
  const paperCount = Math.floor(count * paperRatio);
  for (let p = 0; p < count; p += 1) {
    const c = p < paperCount ? paper : inkColors[p % inkColors.length];
    data.set([c[0], c[1], c[2], 255], p * 4);
  }
  return { data, width: size, height: size };
};

const manual: InkAlphaRemoveBgOptions = {
  autoWhitePoint: false,
  whitePoint: 255,
  blackPoint: 0,
  noiseFloor: 0,
  inkStrength: 1,
};

describe('removeBackgroundInkAlpha', () => {
  it('outputs pure black pixels with alpha proportional to darkness', () => {
    const img = { data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255]), width: 3, height: 1 };
    removeBackgroundInkAlpha(img, manual);
    const px = Array.from(img.data);
    expect(px.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(px.slice(4, 8)).toEqual([0, 0, 0, 255]);
    expect(px.slice(8, 11)).toEqual([0, 0, 0]);
    expect(px[11]).toBeGreaterThanOrEqual(126);
    expect(px[11]).toBeLessThanOrEqual(128);
  });

  it('reproduces the original gray when composited back onto white', () => {
    for (const gray of [30, 90, 150, 210, 240]) {
      const img = { data: new Uint8ClampedArray([gray, gray, gray, 255]), width: 1, height: 1 };
      removeBackgroundInkAlpha(img, manual);
      const alpha = img.data[3] / 255;
      const recomposited = 255 * (1 - alpha);
      expect(Math.abs(recomposited - gray)).toBeLessThanOrEqual(1);
    }
  });

  it('auto-detects off-white paper so the paper becomes fully transparent', () => {
    const img = makeImage([228, 224, 215], [[20, 20, 20], [120, 120, 120]]);
    const result = removeBackgroundInkAlpha(img, { ...manual, autoWhitePoint: true, noiseFloor: 0.04 });
    expect(result.whitePointUsed).toBeLessThan(228);
    expect(img.data[3]).toBe(0);
    expect(result.transparentPercent).toBeGreaterThanOrEqual(79);
  });

  it('noise floor removes faint paper texture but keeps real ink', () => {
    const img = { data: new Uint8ClampedArray([248, 248, 248, 255, 60, 60, 60, 255]), width: 2, height: 1 };
    removeBackgroundInkAlpha(img, { ...manual, noiseFloor: 0.05 });
    expect(img.data[3]).toBe(0);
    expect(img.data[7]).toBeGreaterThan(150);
  });
});

describe('detectPaperWhitePoint', () => {
  it('returns null when there is no dominant light paper', () => {
    expect(detectPaperWhitePoint(makeImage([20, 20, 20], [[40, 40, 40]], 50, 1))).toBeNull();
  });
});

describe('detectColorArtwork', () => {
  it('treats black & gray ink on warm cream paper as not color', () => {
    const img = makeImage([240, 230, 210], [[25, 22, 20], [110, 105, 100], [170, 165, 158]]);
    expect(detectColorArtwork(img).isColor).toBe(false);
  });

  it('detects a colored artwork', () => {
    const img = makeImage([255, 255, 255], [[200, 30, 40], [30, 90, 200], [20, 20, 20]]);
    expect(detectColorArtwork(img).isColor).toBe(true);
  });
});

describe('remove bg preset', () => {
  it('keeps older saved presets valid and fills ink defaults', () => {
    const legacy = {
      mode: 'standard',
      standard: { threshold: 220, feather: 10 },
      grayscale: { whitePoint: 235, blackStrength: 1.5, opacityGain: 1, transparencyMode: 'linear', stepSize: 0.1 },
    };
    const normalized = normalizeRemoveBgPreset(legacy);
    expect(normalized?.mode).toBe('standard');
    expect(normalized?.standard.threshold).toBe(220);
    expect(normalized?.ink).toEqual(SYSTEM_DEFAULT_REMOVE_BG_PRESET.ink);
    expect(normalized?.autoColorFallback).toBe(true);
  });

  it('system default is ink mode and falls back to standard for color artworks', () => {
    expect(SYSTEM_DEFAULT_REMOVE_BG_PRESET.mode).toBe('ink_alpha');
    const colorImg = makeImage([255, 255, 255], [[200, 30, 40], [30, 90, 200]]);
    expect(resolveEffectiveRemoveBgMode(SYSTEM_DEFAULT_REMOVE_BG_PRESET, colorImg)).toEqual({
      mode: 'standard',
      colorDetected: true,
    });
    const inkImg = makeImage([255, 255, 255], [[20, 20, 20], [140, 140, 140]]);
    expect(resolveEffectiveRemoveBgMode(SYSTEM_DEFAULT_REMOVE_BG_PRESET, inkImg).mode).toBe('ink_alpha');
    expect(
      resolveEffectiveRemoveBgMode({ ...SYSTEM_DEFAULT_REMOVE_BG_PRESET, autoColorFallback: false }, colorImg).mode
    ).toBe('ink_alpha');
  });
});
