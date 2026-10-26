/**
 * 圖片下載工具。
 *
 * iPhone／iPad／Android（含 LINE 內建瀏覽器）對 <a download> 支援不完整，
 * 尤其是大圖的 data: URL 在 Safari 會出現下載提示但存不下來，
 * 所以行動裝置改用「顯示圖片 → 長按儲存／分享到相簿」。
 */

type NavigatorLike = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & { platform?: string };

/** 行動裝置判斷；iPadOS 的 Safari 會偽裝成 Mac，需用觸控點數辨識 */
export function isTouchMobileDevice(nav: NavigatorLike | undefined = typeof navigator !== 'undefined' ? navigator : undefined): boolean {
  if (!nav) return false;
  const ua = nav.userAgent || '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  const looksLikeMac = /Macintosh/i.test(ua) || nav.platform === 'MacIntel';
  return looksLikeMac && (nav.maxTouchPoints ?? 0) > 1;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('圖片產生失敗'))), type);
  });
}

/** 以 blob: URL 觸發下載（電腦版與 iOS 13+ Safari 都支援，避免大型 data: URL 失敗） */
export function downloadBlobFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** 是否可用系統分享選單分享檔案（iOS Safari／Chrome 支援；LINE 內建瀏覽器多半不支援） */
export function canShareImageFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
