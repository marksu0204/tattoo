import type { LineBroadcastImageEntry, LineCarouselItem } from '../types';
import { validateClickLinkUrl } from './lineAudienceSummary';

export const MAX_CAROUSEL_ITEMS = 10;

export function createCarouselItem(
  entry: LineBroadcastImageEntry,
  order: number,
): LineCarouselItem {
  return {
    id: crypto.randomUUID(),
    originalUrl: entry.originalUrl,
    previewUrl: entry.previewUrl,
    targetUrl: '',
    label: '',
    order,
  };
}

export function validateCarouselItems(items: LineCarouselItem[]): string | null {
  if (items.length > MAX_CAROUSEL_ITEMS) {
    return `輪播圖片最多 ${MAX_CAROUSEL_ITEMS} 張`;
  }
  for (const item of items) {
    if (!item.originalUrl.startsWith('https://') || !item.previewUrl.startsWith('https://')) {
      return '圖片必須為 HTTPS 公開網址（請使用上傳功能）';
    }
    if (item.targetUrl?.trim()) {
      const err = validateClickLinkUrl(item.targetUrl);
      if (err) return err;
    }
  }
  return null;
}

export function validateBroadcastPayload(
  content: string,
  mainImage: LineBroadcastImageEntry | null,
  carouselItems: LineCarouselItem[],
  clickLinkUrl = '',
): string | null {
  const trimmed = content.trim();
  if (!trimmed && !mainImage && carouselItems.length === 0) {
    return '請輸入訊息文字或上傳至少一張圖片';
  }
  if (trimmed.length > 2000) {
    return '訊息文字不可超過 2000 字';
  }
  if (mainImage) {
    if (!mainImage.originalUrl.startsWith('https://') || !mainImage.previewUrl.startsWith('https://')) {
      return '圖片必須為 HTTPS 公開網址（請使用上傳功能）';
    }
  }
  const carouselErr = validateCarouselItems(carouselItems);
  if (carouselErr) return carouselErr;
  return validateClickLinkUrl(clickLinkUrl);
}

export function formatLinkDisplay(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const path = parsed.pathname.length > 24 ? `${parsed.pathname.slice(0, 24)}…` : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
  }
}

export function normalizeCarouselOrder(items: LineCarouselItem[]): LineCarouselItem[] {
  return items.map((item, idx) => ({ ...item, order: idx }));
}
