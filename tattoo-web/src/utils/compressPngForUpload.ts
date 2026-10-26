const DEFAULT_MAX_PAYLOAD_CHARS = Math.floor(1.4 * 1024 * 1024);
const DEFAULT_INITIAL_LONGEST_SIDE = 1200;
const DEFAULT_MIN_LONGEST_SIDE = 480;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = src;
  });

const scaleToLongestSide = (width: number, height: number, maxLongestSide: number) => {
  const longest = Math.max(width, height);
  if (longest <= maxLongestSide) {
    return { width, height };
  }
  const ratio = maxLongestSide / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

export const renderPngDataUrlAtLongestSide = async (
  file: File,
  maxLongestSide: number
): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = scaleToLongestSide(img.width, img.height, maxLongestSide);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context error');

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/png');
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export async function compressPngForUpload(
  file: File,
  options?: {
    maxPayloadChars?: number;
    initialLongestSide?: number;
    minLongestSide?: number;
  }
): Promise<{ dataUrl: string; blob: Blob; longestSide: number }> {
  const maxPayloadChars = options?.maxPayloadChars ?? DEFAULT_MAX_PAYLOAD_CHARS;
  let longestSide = options?.initialLongestSide ?? DEFAULT_INITIAL_LONGEST_SIDE;
  const minLongestSide = options?.minLongestSide ?? DEFAULT_MIN_LONGEST_SIDE;

  let lastDataUrl = '';
  while (longestSide >= minLongestSide) {
    const dataUrl = await renderPngDataUrlAtLongestSide(file, longestSide);
    lastDataUrl = dataUrl;
    if (dataUrl.length <= maxPayloadChars) {
      return {
        dataUrl,
        blob: await dataUrlToBlob(dataUrl),
        longestSide,
      };
    }
    longestSide = Math.floor(longestSide * 0.75);
  }

  if (lastDataUrl) {
    const blob = await dataUrlToBlob(lastDataUrl);
    if (blob.size <= maxPayloadChars) {
      return { dataUrl: lastDataUrl, blob, longestSide: minLongestSide };
    }
  }

  throw new Error('PNG 壓縮後仍超過伺服器允許大小，請縮小原圖或降低細節後再試。');
}
