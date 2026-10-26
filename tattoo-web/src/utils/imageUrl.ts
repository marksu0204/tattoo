const UPLOADS_SEGMENT = '/uploads/';

const getExtensionIndex = (path: string): number => path.lastIndexOf('.');

export const isUploadsAsset = (url: string): boolean => {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.includes(UPLOADS_SEGMENT);
  } catch {
    return false;
  }
};

export const toThumbUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url, window.location.origin);
    const dotIndex = getExtensionIndex(parsed.pathname);
    if (!parsed.pathname.includes(UPLOADS_SEGMENT) || dotIndex < 0) return null;
    parsed.pathname = `${parsed.pathname.slice(0, dotIndex)}_thumb.webp`;
    return parsed.toString();
  } catch {
    return null;
  }
};

export const buildCardImageSources = (cardUrl: string, originalUrl?: string) => {
  // 後端 getArtworkCards 已優先回傳 cardImageUrl（存在時就是可用縮圖）
  // 前端不再二次推導，避免產生 _thumb_thumb.webp 類型錯誤路徑
  const primaryUrl = cardUrl;
  const fallbackUrl = originalUrl && originalUrl !== primaryUrl ? originalUrl : cardUrl;

  const srcSetCandidates: string[] = [];
  srcSetCandidates.push(`${primaryUrl} 480w`);
  if (fallbackUrl && fallbackUrl !== primaryUrl) {
    srcSetCandidates.push(`${fallbackUrl} 1200w`);
  }

  return {
    primaryUrl,
    fallbackUrl,
    srcSet: srcSetCandidates.join(', '),
    sizes: '(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 24vw',
  };
};
