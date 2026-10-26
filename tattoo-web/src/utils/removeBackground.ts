export type RemoveBgMode = 'standard' | 'grayscale_alpha' | 'ink_alpha';

export type GrayscaleTransparencyMode = 'linear' | 'stepped';

export type GrayscaleStepSize = 0.05 | 0.1 | 0.2;

export interface StandardRemoveBgOptions {
  threshold: number;
  feather: number;
}

export interface GrayscaleAlphaRemoveBgOptions {
  whitePoint: number;
  /** UI「黑度強化」：值越高 → 黑線越實（內部以 1/blackStrength 作 curve exponent） */
  blackStrength: number;
  opacityGain: number;
  transparencyMode: GrayscaleTransparencyMode;
  stepSize: GrayscaleStepSize;
}

/**
 * 純黑墨色：輸出像素一律為純黑 (0,0,0)，深淺完全由 alpha 表現。
 * 疊到皮膚上只會「變暗」不會「變白」，效果接近真實刺青墨水。
 */
export interface InkAlphaRemoveBgOptions {
  /** true = 自動偵測紙張白點（建議），false = 使用 whitePoint */
  autoWhitePoint: boolean;
  /** 手動紙張白點：比這個亮的視為紙張，完全透明 */
  whitePoint: number;
  /** 比這個暗的視為 100% 純黑 */
  blackPoint: number;
  /** 雜訊清除 (0~0.3)：淡於此比例的墨色視為紙紋直接去除 */
  noiseFloor: number;
  /** 黑度曲線：>1 淡墨更明顯，<1 淡墨更透明 */
  inkStrength: number;
}

export interface RemoveBgProcessResult {
  width: number;
  height: number;
  elapsedMs: number;
  transparentPercent: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const toGrayscale = (r: number, g: number, b: number) =>
  0.299 * r + 0.587 * g + 0.114 * b;

const countFullyTransparentPixels = (px: Uint8ClampedArray, pixelCount: number) => {
  let transparent = 0;
  for (let i = 0; i < pixelCount; i += 1) {
    if (px[i * 4 + 3] === 0) transparent += 1;
  }
  return transparent;
};

/** 標準去背：去除白底並保留主體 */
export function removeBackgroundStandard(
  imageData: ImageData,
  options: StandardRemoveBgOptions
): RemoveBgProcessResult {
  const t0 = performance.now();
  const { threshold, feather } = options;
  const px = imageData.data;
  const softRange = feather;
  const pixelCount = imageData.width * imageData.height;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];

    const brightness = (r + g + b) / 3;
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
    const whiteness = brightness - saturation * 128;

    if (whiteness >= threshold) {
      px[i + 3] = 0;
    } else if (whiteness >= threshold - softRange) {
      const alpha = Math.round(255 * (1 - (whiteness - (threshold - softRange)) / softRange));
      px[i + 3] = clamp(alpha, 0, 255);
    }
  }

  const transparent = countFullyTransparentPixels(px, pixelCount);
  return {
    width: imageData.width,
    height: imageData.height,
    elapsedMs: performance.now() - t0,
    transparentPercent: pixelCount > 0 ? (transparent / pixelCount) * 100 : 0,
  };
}

/** 灰階透明去背：依明度轉換 alpha，保留淺灰層次 */
export function removeBackgroundGrayscaleAlpha(
  imageData: ImageData,
  options: GrayscaleAlphaRemoveBgOptions
): RemoveBgProcessResult {
  const t0 = performance.now();
  const { whitePoint, blackStrength, opacityGain, transparencyMode, stepSize } = options;
  const px = imageData.data;
  const pixelCount = imageData.width * imageData.height;
  const safeWhitePoint = Math.max(1, whitePoint);
  const safeBlackStrength = Math.max(0.1, blackStrength);
  const safeOpacityGain = Math.max(0.1, opacityGain);
  const curveExponent = 1 / safeBlackStrength;

  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const gray = toGrayscale(r, g, b);

    let normalized = clamp((safeWhitePoint - gray) / safeWhitePoint, 0, 1);
    normalized = Math.pow(normalized, curveExponent);

    let alpha = clamp(normalized * 255 * safeOpacityGain, 0, 255);

    if (transparencyMode === 'stepped' && stepSize > 0) {
      const alpha01 = alpha / 255;
      const stepped = Math.round(alpha01 / stepSize) * stepSize;
      alpha = clamp(stepped * 255, 0, 255);
    }

    px[i + 3] = Math.round(alpha);
  }

  const transparent = countFullyTransparentPixels(px, pixelCount);
  return {
    width: imageData.width,
    height: imageData.height,
    elapsedMs: performance.now() - t0,
    transparentPercent: pixelCount > 0 ? (transparent / pixelCount) * 100 : 0,
  };
}

type PixelBuffer = Pick<ImageData, 'data' | 'width' | 'height'>;

/**
 * 自動偵測紙張白點：取亮部 (>=128) 直方圖的峰值（紙張通常是畫面中最多的亮色），
 * 再往下留一點緩衝，讓紙張本身與輕微紙紋都落在「完全透明」範圍。
 * 回傳 null 代表找不到明顯紙張（例如滿版深色圖），交由呼叫端使用手動值。
 */
export function detectPaperWhitePoint(imageData: PixelBuffer): number | null {
  const px = imageData.data;
  const pixelCount = imageData.width * imageData.height;
  if (pixelCount === 0) return null;

  const stride = Math.max(1, Math.floor(pixelCount / 250_000));
  const hist = new Uint32Array(256);
  let sampled = 0;
  for (let p = 0; p < pixelCount; p += stride) {
    const i = p * 4;
    if (px[i + 3] < 128) continue;
    hist[Math.round(toGrayscale(px[i], px[i + 1], px[i + 2]))] += 1;
    sampled += 1;
  }
  if (sampled === 0) return null;

  let peak = -1;
  let peakCount = 0;
  for (let v = 128; v < 256; v += 1) {
    // 用 ±2 的視窗平滑，避免 JPEG 雜訊造成假峰值
    let windowCount = 0;
    for (let k = -2; k <= 2; k += 1) {
      const idx = v + k;
      if (idx >= 0 && idx < 256) windowCount += hist[idx];
    }
    if (windowCount > peakCount) {
      peakCount = windowCount;
      peak = v;
    }
  }

  // 紙張至少要佔取樣的 15% 才可信
  if (peak < 0 || peakCount < sampled * 0.15) return null;
  return clamp(peak - 6, 128, 255);
}

/** 純黑墨色去背：RGB 一律為黑，alpha = 墨色深度 */
export function removeBackgroundInkAlpha(
  imageData: PixelBuffer,
  options: InkAlphaRemoveBgOptions
): RemoveBgProcessResult & { whitePointUsed: number } {
  const t0 = performance.now();
  const px = imageData.data;
  const pixelCount = imageData.width * imageData.height;

  const detected = options.autoWhitePoint ? detectPaperWhitePoint(imageData) : null;
  const whitePoint = clamp(detected ?? options.whitePoint, 1, 255);
  const blackPoint = clamp(options.blackPoint, 0, whitePoint - 1);
  const range = whitePoint - blackPoint;
  const noiseFloor = clamp(options.noiseFloor, 0, 0.9);
  const exponent = 1 / Math.max(0.1, options.inkStrength);

  for (let i = 0; i < px.length; i += 4) {
    const gray = toGrayscale(px[i], px[i + 1], px[i + 2]);
    const sourceAlpha = px[i + 3] / 255;

    let ink = clamp((whitePoint - gray) / range, 0, 1);
    // 雜訊清除採「平滑起點」：低於門檻歸零，之上重新映射到 0~1，避免硬切出鋸齒
    ink = ink <= noiseFloor ? 0 : (ink - noiseFloor) / (1 - noiseFloor);
    if (ink > 0 && exponent !== 1) ink = Math.pow(ink, exponent);

    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = Math.round(ink * sourceAlpha * 255);
  }

  const transparent = countFullyTransparentPixels(px, pixelCount);
  return {
    width: imageData.width,
    height: imageData.height,
    elapsedMs: performance.now() - t0,
    transparentPercent: pixelCount > 0 ? (transparent / pixelCount) * 100 : 0,
    whitePointUsed: Math.round(whitePoint),
  };
}

export interface ColorArtworkDetection {
  isColor: boolean;
  /** 有墨色的像素中，屬於明顯彩色的比例 (0~1) */
  colorRatio: number;
}

/**
 * 判斷是否為彩色作品：只看「非紙張」的像素，計算其中明顯有彩度的比例。
 * 米白紙、暖色燈光下拍的黑白稿彩度低，不會被誤判。
 */
export function detectColorArtwork(imageData: PixelBuffer): ColorArtworkDetection {
  const px = imageData.data;
  const pixelCount = imageData.width * imageData.height;
  const stride = Math.max(1, Math.floor(pixelCount / 250_000));
  const paperWhite = detectPaperWhitePoint(imageData) ?? 235;
  const inkLimit = paperWhite - 25;

  let inkPixels = 0;
  let colorPixels = 0;
  for (let p = 0; p < pixelCount; p += stride) {
    const i = p * 4;
    if (px[i + 3] < 128) continue;
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    if (toGrayscale(r, g, b) >= inkLimit) continue;
    inkPixels += 1;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    if (chroma >= 50) colorPixels += 1;
  }

  const colorRatio = inkPixels > 0 ? colorPixels / inkPixels : 0;
  return {
    isColor: inkPixels >= 50 && colorRatio >= 0.12,
    colorRatio,
  };
}

export function processRemoveBackground(
  imageData: ImageData,
  mode: RemoveBgMode,
  standardOptions: StandardRemoveBgOptions,
  grayscaleOptions: GrayscaleAlphaRemoveBgOptions,
  inkOptions: InkAlphaRemoveBgOptions
): RemoveBgProcessResult {
  if (mode === 'ink_alpha') {
    return removeBackgroundInkAlpha(imageData, inkOptions);
  }
  if (mode === 'grayscale_alpha') {
    return removeBackgroundGrayscaleAlpha(imageData, grayscaleOptions);
  }
  return removeBackgroundStandard(imageData, standardOptions);
}
