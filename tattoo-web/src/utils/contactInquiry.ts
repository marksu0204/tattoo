import { Artwork } from '../types';
import type { PublicBrandConfig } from '../config/brands';
import { buildLineInquiryUrl as buildBrandLineInquiryUrl } from './brandContact';
import { formatArtworkSize } from './artworkSize';
import { buildCanonicalUrl } from './seoConfig';
import { getEffectiveArtworkPrice } from '../services/tracking';

export { buildLineInquiryUrl, extractLineOaId } from './brandContact';

export const formatArtworkCode = (artworkId: string): string => {
  const raw = artworkId.trim();
  if (!raw) return 'UNKNOWN';
  if (raw.toUpperCase().startsWith('INK-')) return raw.toUpperCase();
  return raw;
};

export const formatInquiryPriceLabel = (
  artwork: Pick<Artwork, 'price' | 'specialPrice'>,
): string | null => {
  const effectivePrice = getEffectiveArtworkPrice(artwork);
  if (effectivePrice === null) return null;
  return `NT$${effectivePrice.toLocaleString('zh-TW')}`;
};

export type ArtworkInquirySummaryInput = {
  title: string;
  priceLabel?: string | null;
  size?: string | null;
  url: string;
};

export const buildArtworkPublicUrl = (
  artworkId: string,
  brand?: PublicBrandConfig | null,
): string => {
  const publicOrigin = brand?.publicOrigin?.replace(/\/$/, '');
  return buildCanonicalUrl(`/artwork/${artworkId}`, publicOrigin);
};

export const buildArtworkInquirySummary = (input: ArtworkInquirySummaryInput): string => {
  const title = input.title?.trim() || '未命名作品';
  const lines: string[] = [`作品：${title}`];

  const priceLabel = input.priceLabel?.trim();
  if (priceLabel) {
    lines.push(`預估價格：${priceLabel}`);
  }

  const size = input.size?.trim();
  if (size) {
    lines.push(`建議尺寸：${size}`);
  }

  lines.push('');
  lines.push('作品連結：');
  lines.push(input.url);

  return lines.join('\n');
};

export const buildArtworkInquiryContextFromArtwork = (
  artwork: Pick<Artwork, 'id' | 'title' | 'price' | 'specialPrice' | 'widthCm' | 'heightCm'>,
  brand?: PublicBrandConfig | null,
): ArtworkInquirySummaryInput => ({
  title: artwork.title,
  priceLabel: formatInquiryPriceLabel(artwork),
  size: formatArtworkSize(artwork),
  url: buildArtworkPublicUrl(artwork.id, brand),
});

export const buildArtworkInquiryMessage = (artwork: Pick<Artwork, 'id' | 'title'>, artworkUrl: string): string => {
  const code = formatArtworkCode(artwork.id);
  const title = artwork.title?.trim() || '未命名作品';
  return [
    `你好，我想詢問認領圖 ${code}《${title}》。`,
    '',
    '預計施作部位：',
    '希望尺寸：',
    '方便預約時間：',
    '',
    `作品網址：${artworkUrl}`,
  ].join('\n');
};

/** 客製諮詢的預填訊息（與 LINE 圖文選單「客製諮詢」按鈕相同格式） */
export const CUSTOM_INQUIRY_MESSAGE = [
  '你好，我想詢問客製刺青',
  '想刺的圖案／主題：',
  '預計部位：',
  '大概尺寸：',
  '喜歡的風格（水墨／點霧／素描／寫實）：',
  '參考圖片：（可以直接傳圖）',
].join('\n');

/** 刺青預覽「試看後詢問」的預填訊息 */
export const buildPreviewInquiryMessage = (artwork: Pick<Artwork, 'id' | 'title'>, artworkUrl: string): string => {
  const code = formatArtworkCode(artwork.id);
  const title = artwork.title?.trim() || '未命名作品';
  return [
    `你好，我在網站用刺青預覽試看了認領圖 ${code}《${title}》，想詢問這張。`,
    '',
    '預計施作部位：',
    '希望尺寸：',
    '方便預約時間：',
    '',
    `作品網址：${artworkUrl}`,
  ].join('\n');
};

export const buildBookingDateInquiryMessage = (input: ArtworkInquirySummaryInput): string => {
  const summary = buildArtworkInquirySummary(input);
  return [
    '你好，我對這張圖有興趣：',
    '',
    summary,
    '',
    '我想詢問可預約的日期，謝謝！',
  ].join('\n');
};

export const buildBookingDateInquiryMessageForArtwork = (
  artwork: Pick<Artwork, 'id' | 'title' | 'price' | 'specialPrice' | 'widthCm' | 'heightCm'>,
  brand?: PublicBrandConfig | null,
): string => buildBookingDateInquiryMessage(buildArtworkInquiryContextFromArtwork(artwork, brand));

/** @deprecated Prefer buildLineInquiryUrl(message, brand) from brandContact. */
export const buildLineInquiryUrlFromLineUrl = (
  message: string,
  brand?: PublicBrandConfig | null,
): string | null => buildBrandLineInquiryUrl(message, brand);

export const copyTextWithFallback = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // continue to legacy fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
};

export const openExternalLink = (url: string): void => {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    window.location.href = url;
  }
};
