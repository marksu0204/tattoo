import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Upload, Download, Trash2, Layers, ChevronDown, X, Sparkles, Hand, ArrowLeft, ZoomIn, ZoomOut, RotateCw, FlipHorizontal, FlipVertical, Image } from 'lucide-react';
import { db } from '../services/mockBackend';
import { Artwork } from '../types';
import { useBrand } from '../context/BrandContext';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildPreviewSeo } from '../utils/seoConfig';
import { isSameOriginPublicAssetUrl, resolvePublicAssetUrl } from '../utils/publicAssetUrl';
import LineEntryButton, { LineBubbleIcon } from '../components/LineEntryButton';
import { LINE_GREEN } from '../utils/lineEntry';
import { buildLineInquiryUrl } from '../utils/brandContact';
import { buildArtworkPublicUrl, buildPreviewInquiryMessage, copyTextWithFallback, CUSTOM_INQUIRY_MESSAGE } from '../utils/contactInquiry';
import { trackArtworkContact } from '../services/tracking';
import { canvasToBlob, downloadBlobFile, isTouchMobileDevice } from '../utils/imageDownload';

const DEFAULT_TATTOO_OPACITY = 0.85;
const DEFAULT_TATTOO_SCALE = 0.3;
const DEFAULT_BACKGROUND_SCALE = 1;

interface TattooTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;  // 水平翻轉
  flipY: boolean;  // 垂直翻轉
}

type EditorPointerMode = 'normal' | 'fullscreen';
type FsToolbarPanel = 'none' | 'size' | 'rotate' | 'flip' | 'opacity' | 'background';

interface PointerPoint {
  clientX: number;
  clientY: number;
}

const TattooPreview: React.FC = () => {
  const { brand } = useBrand();
  usePageSeo(buildPreviewSeo(brand));
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const artworkIdFromUrl = searchParams.get('artworkId');

  // 作品列表（有 PNG 的）
  const [artworksWithPng, setArtworksWithPng] = useState<Artwork[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [isArtworkSelectorOpen, setIsArtworkSelectorOpen] = useState(false);
  const [isLoadingArtworks, setIsLoadingArtworks] = useState(true);

  // 背景圖片（身體部位）
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  // 刺青圖片（PNG）
  const [tattooImage, setTattooImage] = useState<string | null>(null);
  // 刺青變換狀態
  const [transform, setTransform] = useState<TattooTransform>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    flipX: false,
    flipY: false,
  });
  // 透明度 / 背景縮放（僅 Full-Screen Toolbar 可調）
  const [opacity, setOpacity] = useState(DEFAULT_TATTOO_OPACITY);
  const [backgroundScale, setBackgroundScale] = useState(DEFAULT_BACKGROUND_SCALE);
  // 是否顯示操作提示
  const [showGestureHint, setShowGestureHint] = useState(true);
  // 下載預覽彈窗（手機版用）
  const [downloadPreviewUrl, setDownloadPreviewUrl] = useState<string | null>(null);
  // 全螢幕模式
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsToolbarPanel, setFsToolbarPanel] = useState<FsToolbarPanel>('none');
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [fullscreenCanvasSize, setFullscreenCanvasSize] = useState({ width: 0, height: 0 });
  
  // Canvas 相關
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // 圖片物件
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const tattooImageRef = useRef<HTMLImageElement | null>(null);

  const activePointersRef = useRef(new Map<number, PointerPoint>());
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pinchStateRef = useRef({ lastDistance: 0, lastAngle: 0 });
  const editorScrollYRef = useRef(0);
  const pendingAutoEnterRef = useRef(false);

  const getPointDistance = (p1: PointerPoint, p2: PointerPoint) => {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getPointAngle = (p1: PointerPoint, p2: PointerPoint) => {
    const dx = p2.clientX - p1.clientX;
    const dy = p2.clientY - p1.clientY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const getEditorScaleRatios = (mode: EditorPointerMode) => {
    if (mode === 'normal') {
      return { toDisplayX: 1, toDisplayY: 1, toModelX: 1, toModelY: 1 };
    }
    const toDisplayX = canvasSize.width > 0 ? fullscreenCanvasSize.width / canvasSize.width : 1;
    const toDisplayY = canvasSize.height > 0 ? fullscreenCanvasSize.height / canvasSize.height : 1;
    const toModelX = fullscreenCanvasSize.width > 0 ? canvasSize.width / fullscreenCanvasSize.width : 1;
    const toModelY = fullscreenCanvasSize.height > 0 ? canvasSize.height / fullscreenCanvasSize.height : 1;
    return { toDisplayX, toDisplayY, toModelX, toModelY };
  };

  const getEditorCanvas = (mode: EditorPointerMode) =>
    mode === 'normal' ? canvasRef.current : fullscreenCanvasRef.current;

  // 用於追蹤是否需要置中 PNG
  const [needsCentering, setNeedsCentering] = useState(false);

  // 從 URL 載入刺青圖片（shared /uploads/ 先正規化為目前 brand origin）
  const loadTattooFromUrl = useCallback((url: string) => {
    const resolved = resolvePublicAssetUrl(url, brand);
    const img = new window.Image();
    if (!isSameOriginPublicAssetUrl(resolved)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      tattooImageRef.current = img;
      setTattooImage(resolved);
      setNeedsCentering(true);
    };
    img.onerror = () => {
      console.error('Failed to load tattoo PNG:', resolved);
    };
    img.src = resolved;
  }, [brand]);

  // 載入有 PNG 的作品列表
  useEffect(() => {
    const loadArtworks = async () => {
      setIsLoadingArtworks(true);
      try {
        const allArtworks = await db.getArtworks();
        const withPng = allArtworks.filter(art => art.pngUrl);
        setArtworksWithPng(withPng);
        
        // 如果 URL 有 artworkId，自動選擇該作品
        if (artworkIdFromUrl) {
          const artwork = withPng.find(a => a.id === artworkIdFromUrl);
          if (artwork) {
            setSelectedArtwork(artwork);
            loadTattooFromUrl(artwork.pngUrl!);
          }
        }
      } catch (e) {
        console.error('Failed to load artworks:', e);
      } finally {
        setIsLoadingArtworks(false);
      }
    };
    loadArtworks();
  }, [artworkIdFromUrl, loadTattooFromUrl]);

  // 當 canvasSize 變化且需要置中時，將 PNG 置中
  useEffect(() => {
    if (needsCentering && canvasSize.width > 0 && canvasSize.height > 0) {
      setTransform({
        x: canvasSize.width / 2,
        y: canvasSize.height / 2,
        scale: DEFAULT_TATTOO_SCALE,
        rotation: 0,
        flipX: false,
        flipY: false,
      });
      setNeedsCentering(false);
      setShowGestureHint(true); // 重新顯示操作提示
    }
  }, [needsCentering, canvasSize]);

  // 選擇作品
  const handleSelectArtwork = (artwork: Artwork) => {
    setSelectedArtwork(artwork);
    if (artwork.pngUrl) {
      loadTattooFromUrl(artwork.pngUrl);
    }
    setIsArtworkSelectorOpen(false);
    
    // 更新 URL 參數
    navigate(`/preview?artworkId=${artwork.id}`, { replace: true });
  };

  // 清除選擇的作品
  const handleClearSelectedArtwork = () => {
    setSelectedArtwork(null);
    setTattooImage(null);
    tattooImageRef.current = null;
    navigate('/preview', { replace: true });
  };

  // 背景圖片上傳 input
  const bgCameraInputRef = useRef<HTMLInputElement>(null);
  const bgGalleryInputRef = useRef<HTMLInputElement>(null);

  const applyBackgroundFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        bgImageRef.current = img;
        setBackgroundImage(event.target?.result as string);

        const container = containerRef.current;
        const fallbackWidth = Math.min(window.innerWidth - 32, 896);
        const containerWidth = container?.clientWidth ?? fallbackWidth;
        const isMobile = window.innerWidth < 768;
        const paddingRatio = isMobile ? 0.85 : 0.95;
        const maxWidth = containerWidth * paddingRatio;
        const ratio = img.height / img.width;
        const width = Math.min(maxWidth, img.width);
        const height = width * ratio;
        setCanvasSize({ width, height });

        pendingAutoEnterRef.current = true;

        if (tattooImageRef.current) {
          setNeedsCentering(true);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // 處理背景圖片上傳
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      applyBackgroundFile(file);
    }
    e.target.value = '';
  };

  const handleReplaceBackground = () => {
    activePointersRef.current.clear();
    pendingAutoEnterRef.current = false;
    setIsFullscreen(false);
    setBackgroundImage(null);
    bgImageRef.current = null;
    setCanvasSize({ width: 0, height: 0 });
    setShowGestureHint(true);
  };

  const getArtworkReturnPath = useCallback(() => {
    const id = artworkIdFromUrl || selectedArtwork?.id;
    return id ? `/artwork/${id}` : '/';
  }, [artworkIdFromUrl, selectedArtwork?.id]);

  const hasArtworkContext = Boolean(artworkIdFromUrl || selectedArtwork?.id);

  const getArtworkReturnLabel = useCallback(() => {
    if (selectedArtwork?.title) {
      return `回到「${selectedArtwork.title}」`;
    }
    if (artworkIdFromUrl) {
      return '回到作品頁';
    }
    return '回作品集';
  }, [selectedArtwork?.title, artworkIdFromUrl]);

  const getArtworkReturnShortLabel = useCallback(() => {
    return hasArtworkContext ? '回作品' : '回作品集';
  }, [hasArtworkContext]);

  const handleReturnToArtwork = useCallback(() => {
    activePointersRef.current.clear();
    setFsToolbarPanel('none');
    setIsFullscreen(false);
    navigate(getArtworkReturnPath());
  }, [navigate, getArtworkReturnPath]);

  const toggleFsToolbarPanel = (panel: Exclude<FsToolbarPanel, 'none'>) => {
    setFsToolbarPanel(prev => (prev === panel ? 'none' : panel));
  };

  const handleEnterPositionEditor = () => {
    if (!backgroundImage || !tattooImage) return;
    setShowGestureHint(true);
    setFsToolbarPanel('none');
    setIsFullscreen(true);
  };

  const handleExitPositionEditor = () => {
    activePointersRef.current.clear();
    setFsToolbarPanel('none');
    setIsFullscreen(false);
  };

  const getInitialTattooTransform = useCallback((): TattooTransform => ({
    x: canvasSize.width / 2,
    y: canvasSize.height / 2,
    scale: DEFAULT_TATTOO_SCALE,
    rotation: 0,
    flipX: false,
    flipY: false,
  }), [canvasSize.width, canvasSize.height]);

  const handleResetTattooTransform = () => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;
    setTransform(getInitialTattooTransform());
    setOpacity(DEFAULT_TATTOO_OPACITY);
    setBackgroundScale(DEFAULT_BACKGROUND_SCALE);
    setShowGestureHint(true);
  };

  const handleScale = (delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.05, Math.min(3, prev.scale + delta)),
    }));
  };

  const handleRotate = (delta: number) => {
    setTransform(prev => ({
      ...prev,
      rotation: prev.rotation + delta,
    }));
  };

  const handleFlipX = () => {
    setTransform(prev => ({ ...prev, flipX: !prev.flipX }));
  };

  const handleFlipY = () => {
    setTransform(prev => ({ ...prev, flipY: !prev.flipY }));
  };

  // 處理刺青圖片上傳（手動上傳）
  const handleTattooUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 清除已選擇的作品
      setSelectedArtwork(null);
      navigate('/preview', { replace: true });
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          tattooImageRef.current = img;
          setTattooImage(event.target?.result as string);
          setNeedsCentering(true); // 標記需要置中
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // 繪製 Canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 清除畫布（使用中性灰色背景）
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 繪製背景圖片（支援縮放）
    if (bgImageRef.current) {
      ctx.save();
      
      // 移動到畫布中心
      ctx.translate(canvas.width / 2, canvas.height / 2);
      // 縮放
      ctx.scale(backgroundScale, backgroundScale);
      // 繪製圖片（從中心點開始）
      ctx.drawImage(
        bgImageRef.current, 
        -canvas.width / 2, 
        -canvas.height / 2, 
        canvas.width, 
        canvas.height
      );
      
      ctx.restore();
    }

    // 繪製刺青圖片
    if (tattooImageRef.current && tattooImage) {
      const tattoo = tattooImageRef.current;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      
      // 移動到刺青中心位置
      ctx.translate(transform.x, transform.y);
      // 旋轉
      ctx.rotate((transform.rotation * Math.PI) / 180);
      // 翻轉
      ctx.scale(
        transform.flipX ? -transform.scale : transform.scale,
        transform.flipY ? -transform.scale : transform.scale
      );
      
      // 繪製（以圖片中心為原點）
      ctx.drawImage(
        tattoo,
        -tattoo.width / 2,
        -tattoo.height / 2,
        tattoo.width,
        tattoo.height
      );
      
      ctx.restore();
    }
  }, [transform, opacity, tattooImage, backgroundScale]);

  // 當狀態變化時重繪
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, backgroundImage, tattooImage, transform, opacity, canvasSize, backgroundScale]);

  // 全螢幕模式下計算 Canvas 尺寸
  useEffect(() => {
    if (isFullscreen && fullscreenContainerRef.current && bgImageRef.current) {
      const container = fullscreenContainerRef.current;
      const img = bgImageRef.current;
      
      // 計算容器可用空間
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 計算圖片比例
      const imgRatio = img.height / img.width;
      const containerRatio = containerHeight / containerWidth;
      
      let width, height;
      
      if (imgRatio > containerRatio) {
        // 圖片更高，以高度為準
        height = containerHeight * 0.95;
        width = height / imgRatio;
      } else {
        // 圖片更寬，以寬度為準
        width = containerWidth * 0.95;
        height = width * imgRatio;
      }
      
      setFullscreenCanvasSize({ width, height });
    }
  }, [isFullscreen]);

  // 新身體照片 + 刺青圖載入完成後，自動進入 Full-Screen Editor（僅一次）
  useEffect(() => {
    if (!pendingAutoEnterRef.current) return;
    if (!backgroundImage || !tattooImage || canvasSize.width === 0 || needsCentering) return;

    pendingAutoEnterRef.current = false;
    setShowGestureHint(true);
    setIsFullscreen(true);
  }, [backgroundImage, tattooImage, canvasSize, needsCentering]);

  // Full-Screen Editor 開啟時鎖定 body scroll
  useEffect(() => {
    if (!isFullscreen) return;

    const scrollY = window.scrollY;
    editorScrollYRef.current = scrollY;
    const body = document.body;
    const html = document.documentElement;
    const savedBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    const savedHtmlOverflow = html.style.overflow;
    const savedHtmlOverscroll = html.style.overscrollBehavior;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';

    return () => {
      body.style.position = savedBodyStyles.position;
      body.style.top = savedBodyStyles.top;
      body.style.width = savedBodyStyles.width;
      body.style.overflow = savedBodyStyles.overflow;
      html.style.overflow = savedHtmlOverflow;
      html.style.overscrollBehavior = savedHtmlOverscroll;
      window.scrollTo(0, editorScrollYRef.current);
    };
  }, [isFullscreen]);

  useEffect(() => {
    return () => {
      activePointersRef.current.clear();
    };
  }, []);

  // 繪製全螢幕 Canvas（使用相對位置轉換）
  useEffect(() => {
    if (!isFullscreen) return;
    
    const canvas = fullscreenCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    // 計算尺寸比例（全螢幕 vs 普通模式）
    const scaleRatioX = canvasSize.width > 0 ? canvas.width / canvasSize.width : 1;
    const scaleRatioY = canvasSize.height > 0 ? canvas.height / canvasSize.height : 1;

    // 清除畫布
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 繪製背景圖片
    if (bgImageRef.current) {
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(backgroundScale, backgroundScale);
      ctx.drawImage(
        bgImageRef.current,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
      );
      ctx.restore();
    }

    // 繪製刺青圖片（按比例調整位置）
    if (tattooImageRef.current && tattooImage) {
      const tattoo = tattooImageRef.current;
      ctx.save();
      ctx.globalAlpha = opacity;
      
      // 使用按比例調整的位置
      const adjustedX = transform.x * scaleRatioX;
      const adjustedY = transform.y * scaleRatioY;
      
      ctx.translate(adjustedX, adjustedY);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(
        transform.flipX ? -transform.scale : transform.scale,
        transform.flipY ? -transform.scale : transform.scale
      );
      ctx.drawImage(
        tattoo,
        -tattoo.width / 2,
        -tattoo.height / 2,
        tattoo.width,
        tattoo.height
      );
      ctx.restore();
    }
  }, [isFullscreen, fullscreenCanvasSize, canvasSize, transform, opacity, tattooImage, backgroundScale]);

  // Pointer Events — 僅 Full-Screen Editor 允許 Tattoo 手勢
  const handleEditorPointerDown = (
    e: React.PointerEvent<HTMLCanvasElement>,
    mode: EditorPointerMode
  ) => {
    if (mode !== 'fullscreen') return;
    if (!tattooImage) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const canvas = getEditorCanvas(mode);
    if (!canvas) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setShowGestureHint(false);

    activePointersRef.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const rect = canvas.getBoundingClientRect();
    const { toDisplayX, toDisplayY } = getEditorScaleRatios(mode);
    const pointers = Array.from(activePointersRef.current.values());

    if (pointers.length === 1 && rect) {
      dragStartRef.current = {
        x: e.clientX - rect.left - transform.x * toDisplayX,
        y: e.clientY - rect.top - transform.y * toDisplayY,
      };
    } else if (pointers.length === 2) {
      pinchStateRef.current = {
        lastDistance: getPointDistance(pointers[0], pointers[1]),
        lastAngle: getPointAngle(pointers[0], pointers[1]),
      };
    }
  };

  const handleEditorPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>,
    mode: EditorPointerMode
  ) => {
    if (mode !== 'fullscreen') return;
    if (!tattooImage || !activePointersRef.current.has(e.pointerId)) return;
    e.preventDefault();

    activePointersRef.current.set(e.pointerId, {
      clientX: e.clientX,
      clientY: e.clientY,
    });

    const canvas = getEditorCanvas(mode);
    const rect = canvas?.getBoundingClientRect();
    const { toDisplayX, toDisplayY, toModelX, toModelY } = getEditorScaleRatios(mode);
    const pointers = Array.from(activePointersRef.current.values());

    if (pointers.length === 1 && rect) {
      const displayX = e.clientX - rect.left - dragStartRef.current.x;
      const displayY = e.clientY - rect.top - dragStartRef.current.y;
      setTransform(prev => ({
        ...prev,
        x: displayX * toModelX,
        y: displayY * toModelY,
      }));
    } else if (pointers.length === 2) {
      const currentDistance = getPointDistance(pointers[0], pointers[1]);
      const currentAngle = getPointAngle(pointers[0], pointers[1]);
      const scaleChange = currentDistance / pinchStateRef.current.lastDistance;
      const angleChange = currentAngle - pinchStateRef.current.lastAngle;

      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.05, Math.min(3, prev.scale * scaleChange)),
        rotation: prev.rotation + angleChange,
      }));

      pinchStateRef.current = {
        lastDistance: currentDistance,
        lastAngle: currentAngle,
      };
    }
  };

  const handleEditorPointerEnd = (
    e: React.PointerEvent<HTMLCanvasElement>,
    mode: EditorPointerMode
  ) => {
    if (mode !== 'fullscreen') return;
    activePointersRef.current.delete(e.pointerId);

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const canvas = getEditorCanvas(mode);
    const rect = canvas?.getBoundingClientRect();
    const { toDisplayX, toDisplayY } = getEditorScaleRatios(mode);
    const pointers = Array.from(activePointersRef.current.values());

    if (pointers.length === 0) {
      // gesture ended
    } else if (pointers.length === 1) {
      const point = pointers[0];
      if (rect) {
        dragStartRef.current = {
          x: point.clientX - rect.left - transform.x * toDisplayX,
          y: point.clientY - rect.top - transform.y * toDisplayY,
        };
      }
    }
  };

  // 下載合成圖片
  const [lineInquiryBusy, setLineInquiryBusy] = useState(false);
  const previewLineInquiryUrl = selectedArtwork
    ? buildLineInquiryUrl(buildPreviewInquiryMessage(selectedArtwork, buildArtworkPublicUrl(selectedArtwork.id, brand)), brand)
    : null;

  /** 試看完直接詢問這張作品：記錄詢問事件、複製詢問內容，再開啟 LINE（帶入作品資訊） */
  const handlePreviewLineInquiry = async () => {
    if (!selectedArtwork || !previewLineInquiryUrl || lineInquiryBusy) return;
    setLineInquiryBusy(true);
    try {
      db.recordArtworkEvent({ artworkId: selectedArtwork.id, eventType: 'contact', channel: 'line' });
      await trackArtworkContact({ artwork: selectedArtwork, channel: 'line' });
      await copyTextWithFallback(
        buildPreviewInquiryMessage(selectedArtwork, buildArtworkPublicUrl(selectedArtwork.id, brand))
      );
    } catch (e) {
      console.warn('preview line inquiry tracking failed', e);
    } finally {
      window.location.assign(previewLineInquiryUrl);
      window.setTimeout(() => setLineInquiryBusy(false), 1500);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !backgroundImage) return;

    // 創建高解析度 Canvas 進行下載
    const downloadCanvas = document.createElement('canvas');
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx || !bgImageRef.current) return;

    const bgImg = bgImageRef.current;
    downloadCanvas.width = bgImg.width;
    downloadCanvas.height = bgImg.height;

    // 繪製背景（包含縮放）
    ctx.save();
    ctx.translate(downloadCanvas.width / 2, downloadCanvas.height / 2);
    ctx.scale(backgroundScale, backgroundScale);
    ctx.drawImage(bgImg, -bgImg.width / 2, -bgImg.height / 2);
    ctx.restore();

    // 計算縮放比例
    const scaleRatio = bgImg.width / canvasSize.width;

    // 繪製刺青
    if (tattooImageRef.current && tattooImage) {
      const tattoo = tattooImageRef.current;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      
      ctx.translate(transform.x * scaleRatio, transform.y * scaleRatio);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(
        (transform.flipX ? -1 : 1) * transform.scale * scaleRatio,
        (transform.flipY ? -1 : 1) * transform.scale * scaleRatio
      );
      
      ctx.drawImage(
        tattoo,
        -tattoo.width / 2,
        -tattoo.height / 2,
        tattoo.width,
        tattoo.height
      );
      
      ctx.restore();
    }

    const artworkName = selectedArtwork?.title || 'custom';

    // 行動裝置（含偽裝成 Mac 的 iPad）：顯示圖片讓使用者長按儲存
    if (isTouchMobileDevice()) {
      setDownloadPreviewUrl(downloadCanvas.toDataURL('image/png'));
      return;
    }
    // 電腦：以 blob 下載，避免大型 data: URL 失敗
    canvasToBlob(downloadCanvas)
      .then((blob) => downloadBlobFile(blob, `tattoo-preview-${artworkName}-${Date.now()}.png`))
      .catch(() => alert('圖片產生失敗，請再試一次。'));
  };

  // 清除所有（內部流程用，不對客人顯示）
  const handleClear = () => {
    activePointersRef.current.clear();
    pendingAutoEnterRef.current = false;
    setIsFullscreen(false);
    setBackgroundImage(null);
    setTattooImage(null);
    setSelectedArtwork(null);
    bgImageRef.current = null;
    tattooImageRef.current = null;
    setCanvasSize({ width: 0, height: 0 });
    setTransform({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
    setOpacity(DEFAULT_TATTOO_OPACITY);
    setBackgroundScale(DEFAULT_BACKGROUND_SCALE);
    setShowGestureHint(true);
    navigate('/preview', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black py-8 px-4">
      <input
        ref={bgCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleBackgroundUpload}
        className="hidden"
      />
      <input
        ref={bgGalleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleBackgroundUpload}
        className="hidden"
      />

      {!backgroundImage ? (
        <div className="max-w-md mx-auto min-h-[calc(100vh-4rem)] flex flex-col justify-center py-8">
          {artworkIdFromUrl && isLoadingArtworks ? (
            <div className="text-center text-gray-400 py-20">載入作品中...</div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReturnToArtwork}
                className="mb-6 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                <ArrowLeft size={16} />
                ← {getArtworkReturnLabel()}
              </button>

              {selectedArtwork && (
                <div className="flex items-center gap-3 mb-8 p-3 rounded-xl border border-white/10 bg-white/5">
                  <img
                    src={selectedArtwork.imageUrl}
                    alt={selectedArtwork.title}
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">預覽作品</p>
                    <p className="text-white font-medium truncate">{selectedArtwork.title}</p>
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-snug">
                  看看這張刺青放在你身上的效果
                </h1>
                <p className="text-gray-300 mt-4">請先拍攝想刺青的位置</p>
                <p className="text-sm text-gray-500 mt-2">建議鏡頭正對皮膚、光線充足</p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => bgCameraInputRef.current?.click()}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-black font-bold py-4 text-base shadow-lg shadow-primary/20 transition-colors"
                >
                  📷 拍一張照片
                </button>
                <button
                  type="button"
                  onClick={() => bgGalleryInputRef.current?.click()}
                  className="w-full rounded-xl border border-white/15 bg-transparent hover:bg-white/5 text-gray-200 font-medium py-3.5 text-sm transition-colors"
                >
                  從相簿選擇
                </button>
              </div>

              <button
                type="button"
                onClick={handleReturnToArtwork}
                className="mt-6 w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                <ArrowLeft size={16} />
                ← {getArtworkReturnLabel()}
              </button>
            </>
          )}
        </div>
      ) : (
      <div className="max-w-4xl mx-auto">
        <button
          type="button"
          onClick={handleReturnToArtwork}
          className="mb-4 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          ← {getArtworkReturnLabel()}
        </button>

        {/* 標題區域 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            <span className="text-primary">刺青</span>合成預覽
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            確認合成效果後，可下載或回到作品頁
          </p>
          {selectedArtwork && (
            <p className="text-xs text-gray-500 mt-2">作品：{selectedArtwork.title}</p>
          )}
        </div>

        {/* 作品選擇器（從作品頁進入時已帶 artworkId，不顯示） */}
        {artworksWithPng.length > 0 && !artworkIdFromUrl && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-primary" />
              <span className="text-sm font-medium text-gray-300">從作品集選擇刺青圖案</span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsArtworkSelectorOpen(!isArtworkSelectorOpen)}
                className="w-full bg-gray-800/80 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-gray-800 transition-colors"
              >
                {selectedArtwork ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={selectedArtwork.imageUrl} 
                      alt={selectedArtwork.title} 
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="text-left">
                      <p className="text-white font-medium">{selectedArtwork.title}</p>
                      <p className="text-xs text-gray-500">{selectedArtwork.category}</p>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400">選擇一個刺青圖案...</span>
                )}
                <ChevronDown 
                  size={20} 
                  className={`text-gray-400 transition-transform ${isArtworkSelectorOpen ? 'rotate-180' : ''}`} 
                />
              </button>

              {/* 下拉選單 */}
              {isArtworkSelectorOpen && (
                <div className="absolute z-20 w-full mt-2 bg-gray-900 border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                  {isLoadingArtworks ? (
                    <div className="p-4 text-center text-gray-500">載入中...</div>
                  ) : artworksWithPng.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">目前沒有可用的刺青圖案</div>
                  ) : (
                    artworksWithPng.map(art => (
                      <button
                        key={art.id}
                        onClick={() => handleSelectArtwork(art)}
                        className={`w-full p-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0 ${
                          selectedArtwork?.id === art.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <img 
                          src={art.imageUrl} 
                          alt={art.title} 
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="text-left flex-1">
                          <p className="text-white font-medium">{art.title}</p>
                          <p className="text-xs text-gray-500">{art.category}</p>
                        </div>
                        {selectedArtwork?.id === art.id && (
                          <span className="text-primary text-xs font-bold">已選擇</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {selectedArtwork && (
              <button
                onClick={handleClearSelectedArtwork}
                className="mt-2 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
              >
                <X size={12} /> 清除選擇，改用自己上傳的圖案
              </button>
            )}
          </div>
        )}

        {/* 上傳區域：已有背景照片時隱藏背景上傳；未選作品時仍可上傳刺青 */}
        <div className={`grid grid-cols-1 ${!selectedArtwork ? 'md:grid-cols-2' : ''} gap-4 mb-6`}>
          {!selectedArtwork && (
          <div className="relative md:col-span-2">
            <input
              type="file"
              accept="image/png"
              onChange={handleTattooUpload}
              className="hidden"
              id="tattoo-upload"
            />
            <label
              htmlFor="tattoo-upload"
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                tattooImage
                  ? 'border-green-500/50 bg-green-900/10'
                  : 'border-gray-600 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <Layers className={`w-10 h-10 mb-3 ${tattooImage ? 'text-green-400' : 'text-gray-500'}`} />
              <span className="text-sm font-medium text-gray-300">
                {tattooImage ? '✓ 已上傳刺青圖案' : '上傳刺青圖案 (PNG)'}
              </span>
              <span className="text-xs text-gray-500 mt-1">建議使用去背PNG檔</span>
            </label>
          </div>
          )}

          {selectedArtwork && (
              <div className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-purple-500/50 bg-purple-900/10 mb-2">
                <img 
                  src={selectedArtwork.pngUrl} 
                  alt={selectedArtwork.title}
                  className="w-16 h-16 object-contain mb-2"
                />
                <span className="text-sm font-medium text-purple-300">
                  ✓ 使用作品：{selectedArtwork.title}
                </span>
                <span className="text-xs text-gray-500 mt-1">已自動載入刺青圖案</span>
              </div>
          )}
        </div>

        {/* Canvas 預覽區域 */}
        <div className="relative mb-4">
          <div
            ref={containerRef}
            className="relative bg-gray-900/50 rounded-2xl border border-white/10 overflow-hidden mx-6 md:mx-0 preview-editor-area"
            style={{ minHeight: '300px', touchAction: 'pan-y' }}
          >
            <div className="px-3 md:px-2 relative py-2" style={{ touchAction: 'pan-y' }}>
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  className="mx-auto block cursor-default pointer-events-none"
                  style={{ maxWidth: '100%', touchAction: 'pan-y' }}
                />
            </div>
          </div>

          {tattooImage && (
            <div className="mt-4 max-w-md mx-auto flex flex-col gap-3">
              <button
                type="button"
                onClick={handleEnterPositionEditor}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold py-4 px-6 shadow-lg shadow-primary/20 transition-colors"
              >
                <Hand size={20} />
                ✋ 重新調整刺青
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-6 transition-colors"
              >
                <Download size={20} />
                下載合成照片
              </button>
              {backgroundImage && (
                <div className="rounded-xl border border-[#06C755]/40 bg-[#06C755]/10 p-4 text-center space-y-3">
                  {selectedArtwork && previewLineInquiryUrl ? (
                    <>
                      <p className="text-sm text-gray-200">喜歡這個效果？直接傳給刺青師詢問這張</p>
                      <button
                        type="button"
                        onClick={handlePreviewLineInquiry}
                        disabled={lineInquiryBusy}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl text-white font-bold py-3.5 px-6 transition-opacity hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: LINE_GREEN }}
                      >
                        <LineBubbleIcon size={20} />
                        LINE 詢問這張
                      </button>
                      <p className="text-xs text-gray-500">會自動帶入作品資訊，可以順便把合成照片傳給我們</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-200">想刺這個圖案？歡迎聊聊客製</p>
                      <LineEntryButton placement="preview_result" variant="block" label="LINE 客製諮詢" message={CUSTOM_INQUIRY_MESSAGE} />
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={handleReturnToArtwork}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 py-2 transition-colors"
              >
                <ArrowLeft size={16} />
                ← {getArtworkReturnLabel()}
              </button>
              <button
                type="button"
                onClick={handleReplaceBackground}
                className="w-full text-xs text-gray-500 hover:text-gray-300 py-1 transition-colors"
              >
                更換身體照片
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Full-Screen Tattoo Position Editor */}
      {isFullscreen && backgroundImage && tattooImage && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col fullscreen-overlay"
          style={{ 
            touchAction: 'none',
            overscrollBehavior: 'none',
          }}
        >
          {/* 頂部 */}
          <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 safe-area-top">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3">
              <button
                type="button"
                onClick={handleReturnToArtwork}
                className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors justify-self-start px-1 py-1"
              >
                <ArrowLeft size={16} />
                {getArtworkReturnShortLabel()}
              </button>
              <h3 className="text-white font-bold text-base whitespace-nowrap">刺青預覽</h3>
              <div aria-hidden="true" />
            </div>
          </div>

          {/* 大畫面 Canvas */}
          <div 
            ref={fullscreenContainerRef}
            className="flex-1 flex items-center justify-center p-2 overflow-hidden fullscreen-canvas-area min-h-0"
            style={{ touchAction: 'none', overscrollBehavior: 'none' }}
          >
            <canvas
              ref={fullscreenCanvasRef}
              width={fullscreenCanvasSize.width}
              height={fullscreenCanvasSize.height}
              onPointerDown={(e) => handleEditorPointerDown(e, 'fullscreen')}
              onPointerMove={(e) => handleEditorPointerMove(e, 'fullscreen')}
              onPointerUp={(e) => handleEditorPointerEnd(e, 'fullscreen')}
              onPointerCancel={(e) => handleEditorPointerEnd(e, 'fullscreen')}
              className="cursor-move max-w-full max-h-full"
              style={{ touchAction: 'none' }}
            />

            {showGestureHint && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6">
                <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-2 border border-primary/30 shadow-lg max-w-xs">
                  <div className="flex items-center gap-3">
                    <Hand size={24} className="text-primary" />
                    <ZoomIn size={20} className="text-primary" />
                  </div>
                  <p className="text-xs text-white font-medium text-center">拖曳移動 · 雙指縮放旋轉</p>
                </div>
              </div>
            )}
          </div>

          {/* 底部：Compact Toolbar + 重置 / 完成調整 */}
          <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 safe-area-bottom">
            {fsToolbarPanel !== 'none' && (
              <div className="px-4 pt-3 pb-2 border-b border-white/5">
                {fsToolbarPanel === 'size' && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleScale(-0.05)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white shrink-0">
                      <ZoomOut size={18} />
                    </button>
                    <input
                      type="range"
                      min="0.05"
                      max="3"
                      step="0.01"
                      value={transform.scale}
                      onChange={(e) => setTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <button type="button" onClick={() => handleScale(0.05)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white shrink-0">
                      <ZoomIn size={18} />
                    </button>
                    <span className="text-sm text-gray-400 w-12 text-right shrink-0">{(transform.scale * 100).toFixed(0)}%</span>
                  </div>
                )}
                {fsToolbarPanel === 'rotate' && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => handleRotate(-15)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white shrink-0">
                      <RotateCw size={18} className="transform -scale-x-100" />
                    </button>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="1"
                      value={transform.rotation}
                      onChange={(e) => setTransform(prev => ({ ...prev, rotation: parseFloat(e.target.value) }))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <button type="button" onClick={() => handleRotate(15)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white shrink-0">
                      <RotateCw size={18} />
                    </button>
                    <span className="text-sm text-gray-400 w-12 text-right shrink-0">{transform.rotation.toFixed(0)}°</span>
                  </div>
                )}
                {fsToolbarPanel === 'flip' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleFlipX}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        transform.flipX ? 'bg-primary text-black' : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                    >
                      <FlipHorizontal size={16} />
                      水平翻轉
                    </button>
                    <button
                      type="button"
                      onClick={handleFlipY}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        transform.flipY ? 'bg-primary text-black' : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                    >
                      <FlipVertical size={16} />
                      垂直翻轉
                    </button>
                  </div>
                )}
                {fsToolbarPanel === 'opacity' && (
                  <div className="flex items-center gap-3">
                    <Layers size={16} className="text-gray-400 shrink-0" />
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.01"
                      value={opacity}
                      onChange={(e) => setOpacity(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-sm text-gray-400 w-12 text-right shrink-0">{(opacity * 100).toFixed(0)}%</span>
                  </div>
                )}
                {fsToolbarPanel === 'background' && (
                  <div className="flex items-center gap-3">
                    <Image size={16} className="text-gray-400 shrink-0" />
                    <button
                      type="button"
                      onClick={() => setBackgroundScale(prev => Math.max(0.5, prev - 0.05))}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white shrink-0"
                    >
                      <ZoomOut size={18} />
                    </button>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.05"
                      value={backgroundScale}
                      onChange={(e) => setBackgroundScale(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setBackgroundScale(prev => Math.min(2, prev + 0.05))}
                      className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white shrink-0"
                    >
                      <ZoomIn size={18} />
                    </button>
                    <span className="text-sm text-gray-400 w-12 text-right shrink-0">{(backgroundScale * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-5 gap-1 px-3 pt-2">
              {([
                ['size', '大小'],
                ['rotate', '旋轉'],
                ['flip', '翻轉'],
                ['opacity', '透明度'],
                ['background', '背景'],
              ] as const).map(([panel, label]) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => toggleFsToolbarPanel(panel)}
                  className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    fsToolbarPanel === panel
                      ? 'bg-primary/20 text-primary'
                      : 'bg-gray-800/80 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="flex gap-3 px-4 pt-2"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              <button
                type="button"
                onClick={handleResetTattooTransform}
                className="flex-1 rounded-xl border border-white/15 bg-gray-800/80 hover:bg-gray-800 text-gray-300 font-medium py-3.5 text-sm transition-colors"
              >
                重置
              </button>
              <button
                type="button"
                onClick={handleExitPositionEditor}
                className="flex-[2] rounded-xl bg-primary hover:bg-primary/90 text-black font-bold py-3.5 text-base shadow-lg shadow-primary/20 transition-colors"
              >
                完成調整
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 手機版下載預覽彈窗 */}
      {downloadPreviewUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border border-white/10 p-4 max-w-lg w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">保存圖片</h3>
              <button 
                onClick={() => setDownloadPreviewUrl(null)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="bg-gray-800 rounded-xl p-2 mb-4">
              <img 
                src={downloadPreviewUrl} 
                alt="合成預覽" 
                className="w-full h-auto rounded-lg"
              />
            </div>
            
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
              <p className="text-primary font-medium text-center mb-2">📱 保存方式</p>
              <p className="text-gray-300 text-sm text-center">
                <strong>長按上方圖片</strong>，然後選擇「保存圖片」或「加入照片」
              </p>
            </div>

            <button
              onClick={() => setDownloadPreviewUrl(null)}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TattooPreview;
