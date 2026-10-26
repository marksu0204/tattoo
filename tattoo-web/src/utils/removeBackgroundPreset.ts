import {
  type GrayscaleAlphaRemoveBgOptions,
  type InkAlphaRemoveBgOptions,
  type RemoveBgMode,
  type StandardRemoveBgOptions,
  detectColorArtwork,
  processRemoveBackground,
} from './removeBackground';
import { isSameOriginPublicAssetUrl } from './publicAssetUrl';

export const REMOVE_BG_PRESET_SETTING_KEY = 'artwork_remove_bg_preset';

export interface RemoveBgPreset {
  mode: RemoveBgMode;
  standard: StandardRemoveBgOptions;
  grayscale: GrayscaleAlphaRemoveBgOptions;
  ink: InkAlphaRemoveBgOptions;
  /** 純黑墨色模式下，偵測到彩色作品時自動改用「標準去背」保留原色 */
  autoColorFallback: boolean;
  savedAt?: string;
}

export const DEFAULT_INK_OPTIONS: InkAlphaRemoveBgOptions = {
  autoWhitePoint: true,
  whitePoint: 240,
  blackPoint: 25,
  noiseFloor: 0.04,
  inkStrength: 1.0,
};

/** 與 RemoveBgTool 初始值一致，作為尚未儲存 preset 時的 fallback */
export const SYSTEM_DEFAULT_REMOVE_BG_PRESET: RemoveBgPreset = {
  mode: 'ink_alpha',
  standard: { threshold: 230, feather: 15 },
  grayscale: {
    whitePoint: 235,
    blackStrength: 1.5,
    opacityGain: 1.0,
    transparencyMode: 'linear',
    stepSize: 0.1,
  },
  ink: { ...DEFAULT_INK_OPTIONS },
  autoColorFallback: true,
};

const normalizeInkOptions = (value: unknown): InkAlphaRemoveBgOptions => {
  // 舊版 preset 沒有 ink 欄位 → 使用預設值，不讓整個 preset 失效
  if (!value || typeof value !== 'object') return { ...DEFAULT_INK_OPTIONS };
  const raw = value as Partial<InkAlphaRemoveBgOptions>;
  const pick = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    autoWhitePoint: typeof raw.autoWhitePoint === 'boolean' ? raw.autoWhitePoint : DEFAULT_INK_OPTIONS.autoWhitePoint,
    whitePoint: pick(raw.whitePoint, DEFAULT_INK_OPTIONS.whitePoint),
    blackPoint: pick(raw.blackPoint, DEFAULT_INK_OPTIONS.blackPoint),
    noiseFloor: pick(raw.noiseFloor, DEFAULT_INK_OPTIONS.noiseFloor),
    inkStrength: pick(raw.inkStrength, DEFAULT_INK_OPTIONS.inkStrength),
  };
};

export function normalizeRemoveBgPreset(value: unknown): RemoveBgPreset | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<RemoveBgPreset>;
  const mode: RemoveBgMode | null =
    raw.mode === 'grayscale_alpha' || raw.mode === 'standard' || raw.mode === 'ink_alpha' ? raw.mode : null;
  if (!mode) return null;

  const standard = raw.standard;
  const grayscale = raw.grayscale;
  if (!standard || typeof standard !== 'object' || !grayscale || typeof grayscale !== 'object') return null;

  const threshold = Number(standard.threshold);
  const feather = Number(standard.feather);
  const whitePoint = Number(grayscale.whitePoint);
  const blackStrength = Number(grayscale.blackStrength);
  const opacityGain = Number(grayscale.opacityGain);
  const transparencyMode = grayscale.transparencyMode === 'stepped' ? 'stepped' : 'linear';
  const stepSize = grayscale.stepSize === 0.05 || grayscale.stepSize === 0.1 || grayscale.stepSize === 0.2
    ? grayscale.stepSize
    : 0.1;

  if (![threshold, feather, whitePoint, blackStrength, opacityGain].every(Number.isFinite)) return null;

  return {
    mode,
    standard: { threshold, feather },
    grayscale: { whitePoint, blackStrength, opacityGain, transparencyMode, stepSize },
    ink: normalizeInkOptions(raw.ink),
    autoColorFallback: typeof raw.autoColorFallback === 'boolean' ? raw.autoColorFallback : true,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : undefined,
  };
}

export function getRemoveBgModeLabel(mode: RemoveBgMode): string {
  if (mode === 'ink_alpha') return '純黑墨色';
  return mode === 'grayscale_alpha' ? '灰階透明去背' : '標準去背';
}

export function formatRemoveBgPresetSummary(preset: RemoveBgPreset, options?: { isSystemDefault?: boolean }): string {
  if (options?.isSystemDefault) {
    return `系統預設：${getRemoveBgModeLabel(preset.mode)}${preset.mode === 'ink_alpha' && preset.autoColorFallback ? '（彩色作品自動保留原色）' : ''}`;
  }

  if (preset.mode === 'ink_alpha') {
    const parts = [
      '純黑墨色',
      preset.ink.autoWhitePoint ? '紙色自動偵測' : `紙張白點 ${preset.ink.whitePoint}`,
      `黑點 ${preset.ink.blackPoint}`,
      `雜訊清除 ${Math.round(preset.ink.noiseFloor * 100)}%`,
      `墨色濃度 ${preset.ink.inkStrength.toFixed(1)}`,
    ];
    if (preset.autoColorFallback) parts.push('彩色作品自動保留原色');
    return parts.join(' · ');
  }

  if (preset.mode === 'standard') {
    return `標準去背 · 白色閾值 ${preset.standard.threshold} · 邊緣柔化 ${preset.standard.feather}`;
  }

  const parts = [
    '灰階透明',
    `白色門檻 ${preset.grayscale.whitePoint}`,
    `黑度 ${preset.grayscale.blackStrength.toFixed(1)}`,
    `不透明度 ${preset.grayscale.opacityGain.toFixed(1)}x`,
  ];
  if (preset.grayscale.transparencyMode === 'stepped') {
    parts.push(`分級 ${Math.round(preset.grayscale.stepSize * 100)}%`);
  }
  return parts.join(' · ');
}

function loadImageFromSource(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | null = null;

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('無法載入圖片'));
    };

    if (typeof source === 'string') {
      if (!isSameOriginPublicAssetUrl(source)) {
        img.crossOrigin = 'anonymous';
      }
      img.src = source;
      return;
    }

    objectUrl = URL.createObjectURL(source);
    img.src = objectUrl;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('PNG 產生失敗'));
          return;
        }
        resolve(blob);
      },
      'image/png'
    );
  });
}

/**
 * 決定實際使用的去背模式：
 * 預設為純黑墨色且開啟彩色保護時，偵測到彩色作品就改用標準去背（保留原色）。
 */
export function resolveEffectiveRemoveBgMode(
  preset: RemoveBgPreset,
  imageData: Pick<ImageData, 'data' | 'width' | 'height'>
): { mode: RemoveBgMode; colorDetected: boolean } {
  if (preset.mode !== 'ink_alpha' || !preset.autoColorFallback) {
    return { mode: preset.mode, colorDetected: false };
  }
  const { isColor } = detectColorArtwork(imageData);
  return { mode: isColor ? 'standard' : 'ink_alpha', colorDetected: isColor };
}

export interface TransparentPngResult {
  blob: Blob;
  /** 實際使用的模式（可能因彩色偵測而與 preset 不同） */
  usedMode: RemoveBgMode;
  colorDetected: boolean;
}

/** 從主圖產生真正含 alpha 的 PNG（不含 preview 背景），並回報實際使用的模式 */
export async function generateTransparentPng(
  source: File | Blob | string,
  preset: RemoveBgPreset
): Promise<TransparentPngResult> {
  const img = await loadImageFromSource(source);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 不可用');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { mode, colorDetected } = resolveEffectiveRemoveBgMode(preset, imageData);
  processRemoveBackground(imageData, mode, preset.standard, preset.grayscale, preset.ink);
  ctx.putImageData(imageData, 0, 0);

  return { blob: await canvasToPngBlob(canvas), usedMode: mode, colorDetected };
}

/** 相容舊呼叫：只回傳 Blob */
export async function generateTransparentPngBlob(
  source: File | Blob | string,
  preset: RemoveBgPreset
): Promise<Blob> {
  return (await generateTransparentPng(source, preset)).blob;
}
