import React, { useRef, useEffect, useState, memo, useCallback, useMemo } from 'react';
import { useBrand } from '../context/BrandContext';
import { isSameOriginPublicAssetUrl, resolvePublicAssetUrl } from '../utils/publicAssetUrl';

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
  watermarkText?: string;
  watermarkOpacity?: number;
  /** Canvas 最大寬度（px），用於限制記憶體。預設 600（適合縮圖），詳情頁可設大些 */
  maxCanvasWidth?: number;
  priority?: boolean;
}

/**
 * ProtectedImage — 四層防盜保護圖片元件
 * 
 * Layer 1: CSS pointer-events:none / user-select:none / -webkit-touch-callout:none
 *          + JS 禁止 contextmenu & dragstart
 * Layer 2: 透明遮罩 div（右鍵另存只會存到空白）
 * Layer 3: Canvas 浮水印（截圖也帶有標記）
 * Layer 4: 前台已使用壓縮版（上傳時已處理）
 * 
 * 手機優化：
 * - IntersectionObserver 懶載入（只在可視範圍內才建立 Canvas）
 * - 限制 Canvas 解析度，避免記憶體爆炸
 * - 元件卸載時釋放 Canvas 記憶體
 */
const ProtectedImage: React.FC<ProtectedImageProps> = memo(({
  src,
  alt,
  className = '',
  watermarkText,
  watermarkOpacity = 0.15,
  maxCanvasWidth = 600,
  priority = false,
}) => {
  const { brand } = useBrand();
  const resolvedSrc = useMemo(() => resolvePublicAssetUrl(src, brand), [src, brand]);
  const isSameOrigin = useMemo(
    () => isSameOriginPublicAssetUrl(resolvedSrc),
    [resolvedSrc],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // IntersectionObserver 懶載入 — 只在圖片進入可視區域時才開始渲染
  useEffect(() => {
    if (priority) {
      setIsVisible(true);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // 可見後不再需要觀察
        }
      },
      {
        rootMargin: '200px', // 提前 200px 開始載入
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [priority]);

  // 浮水印繪製函式
  const drawWatermark = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();

    const fontSize = Math.max(12, Math.min(width, height) * 0.05);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.fillStyle = `rgba(255, 255, 255, ${watermarkOpacity})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const angle = -30 * (Math.PI / 180);
    const textWidth = ctx.measureText(watermarkText).width;
    const spacingX = textWidth + 60;
    const spacingY = fontSize * 4;
    const diagonal = Math.sqrt(width * width + height * height);

    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);

    for (let y = -diagonal; y < diagonal; y += spacingY) {
      for (let x = -diagonal; x < diagonal; x += spacingX) {
        ctx.fillText(watermarkText, x, y);
      }
    }

    ctx.restore();
  }, [watermarkText, watermarkOpacity]);

  // 圖片載入與 Canvas 渲染（只在可見時觸發）
  useEffect(() => {
    if (!resolvedSrc || !isVisible) return;

    let cancelled = false;

    const renderToCanvas = (img: HTMLImageElement) => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 計算縮放後的尺寸（限制記憶體使用）
      let drawWidth = img.naturalWidth;
      let drawHeight = img.naturalHeight;

      if (drawWidth > maxCanvasWidth) {
        const scale = maxCanvasWidth / drawWidth;
        drawWidth = maxCanvasWidth;
        drawHeight = Math.round(img.naturalHeight * scale);
      }

      canvas.width = drawWidth;
      canvas.height = drawHeight;

      // 繪製圖片（縮放至 Canvas 尺寸）
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

      // 繪製浮水印（僅在有文字時）
      if (watermarkText) {
        drawWatermark(ctx, drawWidth, drawHeight);
      }

      setIsLoaded(true);
      setHasError(false);
    };

    // Same-origin shared uploads: load directly without crossOrigin.
    const img = new Image();
    if (!isSameOrigin) {
      img.crossOrigin = 'anonymous';
    }
    try {
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = priority ? 'high' : 'auto';
    } catch {
      // ignore unsupported browser props
    }

    img.onload = () => renderToCanvas(img);

    img.onerror = () => {
      if (isSameOrigin) {
        if (!cancelled) {
          setHasError(true);
          setIsLoaded(false);
        }
        return;
      }
      // Cross-origin fallback: load without crossOrigin (display-only; may taint canvas).
      const fallbackImg = new Image();
      fallbackImg.onload = () => renderToCanvas(fallbackImg);
      fallbackImg.onerror = () => {
        if (!cancelled) {
          setHasError(true);
          setIsLoaded(false);
        }
      };
      fallbackImg.src = resolvedSrc;
    };

    img.src = resolvedSrc;

    // 清理：釋放 Canvas 記憶體
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;

      // 釋放 Canvas 記憶體（重要！避免手機 OOM）
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 1;
        canvas.height = 1;
      }
    };
  }, [resolvedSrc, isVisible, maxCanvasWidth, drawWatermark, priority, isSameOrigin]);

  // Layer 1: JS 事件阻擋
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventDefault = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    container.addEventListener('contextmenu', preventDefault, { capture: true });
    container.addEventListener('dragstart', preventDefault, { capture: true });

    return () => {
      container.removeEventListener('contextmenu', preventDefault, { capture: true } as EventListenerOptions);
      container.removeEventListener('dragstart', preventDefault, { capture: true } as EventListenerOptions);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="protected-image-container"
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      {/* Loading 佔位 */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}

      {/* Layer 3: Canvas 浮水印圖片 */}
      <canvas
        ref={canvasRef}
        aria-label={alt}
        role="img"
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          display: 'block',
        } as React.CSSProperties}
      />

      {/* Layer 2: 透明遮罩層 — 右鍵另存只會存到透明空白 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* 載入失敗 */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-500">
          載入失敗
        </div>
      )}
    </div>
  );
});

ProtectedImage.displayName = 'ProtectedImage';

export default ProtectedImage;
