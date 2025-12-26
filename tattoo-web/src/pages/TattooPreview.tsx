import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Upload, Download, RotateCw, ZoomIn, ZoomOut, Move, Trash2, Image, Layers, RefreshCw, ChevronDown, X, Sparkles, FlipHorizontal, FlipVertical, ChevronsUpDown, Hand, LogIn, Maximize2 } from 'lucide-react';
import { db } from '../services/mockBackend';
import { Artwork } from '../types';
import { useApp } from '../App';

interface TattooTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;  // 水平翻轉
  flipY: boolean;  // 垂直翻轉
}

const TattooPreview: React.FC = () => {
  const { user } = useApp();
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
  // 透明度
  const [opacity, setOpacity] = useState(0.85);
  // 背景圖片縮放
  const [backgroundScale, setBackgroundScale] = useState(1);
  // 是否顯示操作提示
  const [showGestureHint, setShowGestureHint] = useState(true);
  // 下載預覽彈窗（手機版用）
  const [downloadPreviewUrl, setDownloadPreviewUrl] = useState<string | null>(null);
  // 全螢幕模式
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [fullscreenCanvasSize, setFullscreenCanvasSize] = useState({ width: 0, height: 0 });
  // 拖曳狀態
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 雙指縮放狀態
  const [isPinching, setIsPinching] = useState(false);
  const [lastPinchDistance, setLastPinchDistance] = useState(0);
  const [lastPinchAngle, setLastPinchAngle] = useState(0);
  
  // Canvas 相關
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  
  // 圖片物件
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const tattooImageRef = useRef<HTMLImageElement | null>(null);

  // 🔒 未登入時顯示提示頁面
  if (!user) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-card rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">刺青預覽模擬</h1>
            <p className="text-gray-400 mb-6">
              此功能需要登入後才能使用。<br />
              請先使用 LINE 帳號登入，即可體驗刺青預覽模擬功能！
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-[#06C755] hover:bg-[#05b34d] text-white font-bold py-4 px-8 rounded-xl transition-all hover:scale-105 shadow-lg"
            >
              <LogIn size={20} />
              LINE 登入
            </Link>
            <p className="text-gray-500 text-sm mt-6">
              登入後可享受完整的刺青預覽體驗
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 計算兩點之間的距離
  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 計算兩點之間的角度
  const getAngle = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

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
  }, [artworkIdFromUrl]);

  // 用於追蹤是否需要置中 PNG
  const [needsCentering, setNeedsCentering] = useState(false);

  // 從 URL 載入刺青圖片
  const loadTattooFromUrl = (url: string) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      tattooImageRef.current = img;
      setTattooImage(url);
      setNeedsCentering(true); // 標記需要置中
    };
    img.src = url;
  };

  // 當 canvasSize 變化且需要置中時，將 PNG 置中
  useEffect(() => {
    if (needsCentering && canvasSize.width > 0 && canvasSize.height > 0) {
      setTransform({
        x: canvasSize.width / 2,
        y: canvasSize.height / 2,
        scale: 0.3,
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

  // 處理背景圖片上傳
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          bgImageRef.current = img;
          setBackgroundImage(event.target?.result as string);
          
          // 計算 Canvas 尺寸（根據容器寬度等比縮放，左右留空間）
          const container = containerRef.current;
          if (container) {
            // 手機板留出左右各 10% 的空間給滑動
            const isMobile = window.innerWidth < 768;
            const paddingRatio = isMobile ? 0.85 : 0.95; // 手機 85%，桌面 95%
            const maxWidth = container.clientWidth * paddingRatio;
            const ratio = img.height / img.width;
            const width = Math.min(maxWidth, img.width);
            const height = width * ratio;
            setCanvasSize({ width, height });
            
            // 如果已經有刺青圖片，標記需要置中
            if (tattooImageRef.current) {
              setNeedsCentering(true);
            }
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
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

  // 全螢幕模式下鎖定 body 滾動（防止 LINE 瀏覽器下拉關閉）
  useEffect(() => {
    if (isFullscreen) {
      // 記錄當前滾動位置
      const scrollY = window.scrollY;
      
      // 添加 class 並鎖定 body
      document.body.classList.add('fullscreen-mode');
      document.body.style.top = `-${scrollY}px`;
      document.documentElement.style.overflow = 'hidden';
      
      // 防止觸控事件傳播到 LINE 瀏覽器
      const preventScroll = (e: TouchEvent) => {
        // 只在全螢幕覆蓋層外才阻止
        const target = e.target as HTMLElement;
        if (!target.closest('.fullscreen-canvas-area')) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('touchmove', preventScroll, { passive: false });
      
      return () => {
        // 恢復 body
        document.body.classList.remove('fullscreen-mode');
        document.body.style.top = '';
        document.documentElement.style.overflow = '';
        
        // 恢復滾動位置
        window.scrollTo(0, scrollY);
        
        document.removeEventListener('touchmove', preventScroll);
      };
    }
  }, [isFullscreen]);

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

  // 滑鼠事件處理
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!tattooImage) return;
    setIsDragging(true);
    setShowGestureHint(false); // 隱藏操作提示
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left - transform.x,
        y: e.clientY - rect.top - transform.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !tattooImage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - rect.left - dragStart.x,
        y: e.clientY - rect.top - dragStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 觸控事件處理 - 支援單指拖曳和雙指縮放/旋轉
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!tattooImage) return;
    e.preventDefault();
    
    // 隱藏操作提示
    setShowGestureHint(false);
    
    if (e.touches.length === 1) {
      // 單指：拖曳
      setIsDragging(true);
      setIsPinching(false);
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDragStart({
          x: touch.clientX - rect.left - transform.x,
          y: touch.clientY - rect.top - transform.y,
        });
      }
    } else if (e.touches.length === 2) {
      // 雙指：縮放和旋轉
      setIsDragging(false);
      setIsPinching(true);
      const distance = getDistance(e.touches[0], e.touches[1]);
      const angle = getAngle(e.touches[0], e.touches[1]);
      setLastPinchDistance(distance);
      setLastPinchAngle(angle);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!tattooImage) return;
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging && !isPinching) {
      // 單指拖曳
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setTransform(prev => ({
          ...prev,
          x: touch.clientX - rect.left - dragStart.x,
          y: touch.clientY - rect.top - dragStart.y,
        }));
      }
    } else if (e.touches.length === 2 && isPinching) {
      // 雙指縮放和旋轉
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const currentAngle = getAngle(e.touches[0], e.touches[1]);
      
      // 計算縮放比例
      const scaleChange = currentDistance / lastPinchDistance;
      
      // 計算旋轉角度變化
      const angleChange = currentAngle - lastPinchAngle;
      
      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.05, Math.min(3, prev.scale * scaleChange)),
        rotation: prev.rotation + angleChange,
      }));
      
      setLastPinchDistance(currentDistance);
      setLastPinchAngle(currentAngle);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      setIsPinching(false);
    } else if (e.touches.length === 1) {
      // 從雙指變成單指，重新初始化拖曳
      setIsPinching(false);
      setIsDragging(true);
      const touch = e.touches[0];
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setDragStart({
          x: touch.clientX - rect.left - transform.x,
          y: touch.clientY - rect.top - transform.y,
        });
      }
    }
  };

  // 縮放控制
  const handleScale = (delta: number) => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.05, Math.min(3, prev.scale + delta)),
    }));
  };

  // 旋轉控制
  const handleRotate = (delta: number) => {
    setTransform(prev => ({
      ...prev,
      rotation: prev.rotation + delta,
    }));
  };

  // 水平翻轉
  const handleFlipX = () => {
    setTransform(prev => ({
      ...prev,
      flipX: !prev.flipX,
    }));
  };

  // 垂直翻轉
  const handleFlipY = () => {
    setTransform(prev => ({
      ...prev,
      flipY: !prev.flipY,
    }));
  };

  // 下載合成圖片
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

    // 生成圖片 URL
    const imageDataUrl = downloadCanvas.toDataURL('image/png');
    const artworkName = selectedArtwork?.title || 'custom';
    
    // 檢測是否為行動裝置
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      // 手機版：顯示預覽彈窗，讓用戶長按保存
      setDownloadPreviewUrl(imageDataUrl);
    } else {
      // 桌面版：直接下載
      const link = document.createElement('a');
      link.download = `tattoo-preview-${artworkName}-${Date.now()}.png`;
      link.href = imageDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // 重置刺青位置
  const handleReset = () => {
    setTransform({
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      scale: 0.3,
      rotation: 0,
      flipX: false,
      flipY: false,
    });
    setOpacity(0.85);
    setBackgroundScale(1);
  };

  // 清除所有
  const handleClear = () => {
    setBackgroundImage(null);
    setTattooImage(null);
    setSelectedArtwork(null);
    bgImageRef.current = null;
    tattooImageRef.current = null;
    setCanvasSize({ width: 0, height: 0 });
    setTransform({ x: 0, y: 0, scale: 1, rotation: 0, flipX: false, flipY: false });
    setBackgroundScale(1);
    setOpacity(0.85);
    setShowGestureHint(true); // 重新顯示操作提示
    navigate('/preview', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 標題區域 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            <span className="text-primary">刺青</span>預覽模擬器
          </h1>
          <p className="text-gray-400 max-w-lg mx-auto">
            上傳您的身體部位照片，搭配刺青圖案進行預覽，確認效果後即可下載合成照片
          </p>
        </div>

        {/* 作品選擇器 */}
        {artworksWithPng.length > 0 && (
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

        {/* 上傳區域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 背景圖片上傳 */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="hidden"
              id="bg-upload"
            />
            <label
              htmlFor="bg-upload"
              className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 ${
                backgroundImage
                  ? 'border-green-500/50 bg-green-900/10'
                  : 'border-gray-600 hover:border-primary hover:bg-primary/5'
              }`}
            >
              <Image className={`w-10 h-10 mb-3 ${backgroundImage ? 'text-green-400' : 'text-gray-500'}`} />
              <span className="text-sm font-medium text-gray-300">
                {backgroundImage ? '✓ 已上傳身體部位照片' : '上傳身體部位照片'}
              </span>
              <span className="text-xs text-gray-500 mt-1">點擊選擇圖片</span>
            </label>
          </div>

          {/* 刺青圖片上傳（如果沒有選擇作品才顯示上傳按鈕） */}
          <div className="relative">
            {!selectedArtwork ? (
              <>
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-purple-500/50 bg-purple-900/10">
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
        </div>

        {/* Canvas 預覽區域 - 左右留空間方便滑動 */}
        <div className="relative mb-6">
          {/* 左側滑動提示 - 僅手機/平板顯示 */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 md:hidden">
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-r-lg py-4 px-1 flex flex-col items-center gap-1 border-r border-y border-white/10">
              <ChevronsUpDown size={16} className="text-gray-400" />
              <span className="text-[10px] text-gray-500 writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>滑動</span>
            </div>
          </div>
          
          {/* 右側滑動提示 - 僅手機/平板顯示 */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 md:hidden">
            <div className="bg-gray-800/80 backdrop-blur-sm rounded-l-lg py-4 px-1 flex flex-col items-center gap-1 border-l border-y border-white/10">
              <ChevronsUpDown size={16} className="text-gray-400" />
              <span className="text-[10px] text-gray-500" style={{ writingMode: 'vertical-rl' }}>滑動</span>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative bg-gray-900/50 rounded-2xl border border-white/10 overflow-hidden mx-6 md:mx-0"
            style={{ minHeight: '300px' }}
          >
            {/* 上方滑動安全區 */}
            <div className="h-4 md:h-2 bg-transparent" />
            
            {!backgroundImage ? (
              <div className="flex flex-col items-center justify-center h-80 text-gray-500">
                <Upload className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">請先上傳身體部位照片</p>
              </div>
            ) : (
              <div className="px-3 md:px-2 relative">
                <canvas
                  ref={canvasRef}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`mx-auto block ${tattooImage ? 'cursor-move' : 'cursor-default'}`}
                  style={{ maxWidth: '100%', touchAction: 'none' }}
                />
                
                {/* 中央雙指縮放提示 - 僅在有 PNG 且尚未操作時顯示 */}
                {tattooImage && showGestureHint && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none md:hidden transition-opacity duration-500">
                    <div className="bg-black/70 backdrop-blur-sm rounded-2xl p-4 flex flex-col items-center gap-2 border border-primary/30 shadow-lg shadow-primary/10 animate-pulse">
                      <div className="flex items-center gap-3">
                        <Hand size={24} className="text-primary" />
                        <ZoomIn size={20} className="text-primary" />
                      </div>
                      <p className="text-xs text-white font-medium">雙指縮放旋轉</p>
                      <p className="text-[10px] text-gray-400">單指拖曳移動</p>
                    </div>
                  </div>
                )}

                {/* 全螢幕按鈕 - 僅手機/平板顯示 */}
                {tattooImage && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="absolute top-3 right-3 md:hidden bg-black/70 hover:bg-black/90 backdrop-blur-sm p-3 rounded-xl border border-white/20 transition-all active:scale-95"
                  >
                    <Maximize2 size={20} className="text-white" />
                  </button>
                )}
              </div>
            )}
            
            {/* 下方滑動安全區 */}
            <div className="h-4 md:h-2 bg-transparent" />
            
            {/* 底部操作提示 */}
            {backgroundImage && tattooImage && (
              <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full">
                <p className="text-xs text-gray-300 flex items-center gap-2">
                  <Move size={14} /> 
                  <span className="hidden sm:inline">拖曳移動 · 雙指縮放旋轉</span>
                  <span className="sm:hidden">拖曳移動 · 雙指縮放</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 控制面板 */}
        {backgroundImage && tattooImage && (
          <div className="bg-gray-900/50 rounded-xl border border-white/10 p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 縮放控制 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <ZoomIn size={16} /> 縮放大小
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleScale(-0.05)}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  >
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
                  <button
                    onClick={() => handleScale(0.05)}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <span className="text-sm text-gray-400 w-14 text-right">
                    {(transform.scale * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* 旋轉控制 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <RotateCw size={16} /> 旋轉角度
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRotate(-15)}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  >
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
                  <button
                    onClick={() => handleRotate(15)}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  >
                    <RotateCw size={18} />
                  </button>
                  <span className="text-sm text-gray-400 w-14 text-right">
                    {transform.rotation.toFixed(0)}°
                  </span>
                </div>
              </div>

              {/* 翻轉控制 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <FlipHorizontal size={16} /> 翻轉
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleFlipX}
                    className={`flex-1 p-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      transform.flipX 
                        ? 'bg-primary text-black' 
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                    }`}
                  >
                    <FlipHorizontal size={18} />
                    <span className="text-sm">水平翻轉</span>
                  </button>
                  <button
                    onClick={handleFlipY}
                    className={`flex-1 p-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      transform.flipY 
                        ? 'bg-primary text-black' 
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                    }`}
                  >
                    <FlipVertical size={18} />
                    <span className="text-sm">垂直翻轉</span>
                  </button>
                </div>
              </div>

              {/* 透明度控制 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Layers size={16} /> 刺青透明度
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.01"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-sm text-gray-400 w-14 text-right">
                    {(opacity * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* 背景圖片縮放 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Image size={16} /> 背景縮放
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setBackgroundScale(prev => Math.max(0.5, prev - 0.1))}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
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
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <button
                    onClick={() => setBackgroundScale(prev => Math.min(2, prev + 0.1))}
                    className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  >
                    <ZoomIn size={18} />
                  </button>
                  <span className="text-sm text-gray-400 w-14 text-right">
                    {(backgroundScale * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex flex-wrap gap-3 justify-center">
          {backgroundImage && tattooImage && (
            <>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium transition-all"
              >
                <RefreshCw size={18} /> 重置位置
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-black font-bold transition-all shadow-lg shadow-primary/25"
              >
                <Download size={18} /> 下載合成照片
              </button>
            </>
          )}
          {(backgroundImage || tattooImage) && (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-900/50 hover:bg-red-800/60 text-red-200 font-medium transition-all"
            >
              <Trash2 size={18} /> 清除全部
            </button>
          )}
        </div>

        {/* 使用說明 */}
        <div className="mt-10 bg-gray-900/30 rounded-xl border border-white/5 p-6">
          <h3 className="text-lg font-bold text-white mb-4">📖 使用說明</h3>
          <ol className="space-y-3 text-gray-400 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">1</span>
              <span>上傳您想要刺青的身體部位照片（如手臂、小腿等）</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">2</span>
              <span>從作品集選擇刺青圖案，或上傳自己的去背 PNG 檔案</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">3</span>
              <span>單指拖曳移動刺青 · 雙指捏合縮放 · 雙指旋轉調整角度</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">4</span>
              <span>使用控制項調整大小、旋轉、翻轉和透明度</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">5</span>
              <span>確認效果滿意後，點擊「下載合成照片」保存結果</span>
            </li>
          </ol>
        </div>
      </div>

      {/* 📱 全螢幕編輯模式 */}
      {isFullscreen && backgroundImage && tattooImage && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col fullscreen-overlay"
          style={{ 
            touchAction: 'none',
            overscrollBehavior: 'none',
          }}
        >
          {/* 頂部控制列 */}
          <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center justify-between safe-area-top">
            <h3 className="text-white font-bold text-lg">全螢幕編輯</h3>
            <button
              onClick={() => setIsFullscreen(false)}
              className="bg-gray-800 hover:bg-gray-700 p-2 rounded-xl border border-white/10 transition-colors"
            >
              <X size={24} className="text-white" />
            </button>
          </div>

          {/* 全螢幕 Canvas 區域 */}
          <div 
            ref={fullscreenContainerRef}
            className="flex-1 flex items-center justify-center p-2 overflow-hidden fullscreen-canvas-area"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={fullscreenCanvasRef}
              width={fullscreenCanvasSize.width}
              height={fullscreenCanvasSize.height}
              onMouseDown={(e) => {
                if (!tattooImage) return;
                setIsDragging(true);
                setShowGestureHint(false);
                
                // 計算尺寸比例
                const scaleRatioX = canvasSize.width > 0 ? fullscreenCanvasSize.width / canvasSize.width : 1;
                const scaleRatioY = canvasSize.height > 0 ? fullscreenCanvasSize.height / canvasSize.height : 1;
                
                const rect = fullscreenCanvasRef.current?.getBoundingClientRect();
                if (rect) {
                  setDragStart({
                    x: e.clientX - rect.left - transform.x * scaleRatioX,
                    y: e.clientY - rect.top - transform.y * scaleRatioY,
                  });
                }
              }}
              onMouseMove={(e) => {
                if (!isDragging || !tattooImage) return;
                
                // 計算尺寸比例（全螢幕 -> 普通模式）
                const scaleRatioX = fullscreenCanvasSize.width > 0 ? canvasSize.width / fullscreenCanvasSize.width : 1;
                const scaleRatioY = fullscreenCanvasSize.height > 0 ? canvasSize.height / fullscreenCanvasSize.height : 1;
                
                const rect = fullscreenCanvasRef.current?.getBoundingClientRect();
                if (rect) {
                  const fullscreenX = e.clientX - rect.left - dragStart.x;
                  const fullscreenY = e.clientY - rect.top - dragStart.y;
                  setTransform(prev => ({
                    ...prev,
                    x: fullscreenX * scaleRatioX,
                    y: fullscreenY * scaleRatioY,
                  }));
                }
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                if (!tattooImage) return;
                e.preventDefault();
                setShowGestureHint(false);
                
                // 計算尺寸比例（普通模式 vs 全螢幕）
                const scaleRatioX = canvasSize.width > 0 ? fullscreenCanvasSize.width / canvasSize.width : 1;
                const scaleRatioY = canvasSize.height > 0 ? fullscreenCanvasSize.height / canvasSize.height : 1;
                
                if (e.touches.length === 1) {
                  setIsDragging(true);
                  setIsPinching(false);
                  const touch = e.touches[0];
                  const rect = fullscreenCanvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    // 使用按比例調整的位置計算拖曳起點
                    setDragStart({
                      x: touch.clientX - rect.left - transform.x * scaleRatioX,
                      y: touch.clientY - rect.top - transform.y * scaleRatioY,
                    });
                  }
                } else if (e.touches.length === 2) {
                  setIsDragging(false);
                  setIsPinching(true);
                  const distance = getDistance(e.touches[0], e.touches[1]);
                  const angle = getAngle(e.touches[0], e.touches[1]);
                  setLastPinchDistance(distance);
                  setLastPinchAngle(angle);
                }
              }}
              onTouchMove={(e) => {
                if (!tattooImage) return;
                e.preventDefault();
                
                // 計算尺寸比例（全螢幕 -> 普通模式）
                const scaleRatioX = fullscreenCanvasSize.width > 0 ? canvasSize.width / fullscreenCanvasSize.width : 1;
                const scaleRatioY = fullscreenCanvasSize.height > 0 ? canvasSize.height / fullscreenCanvasSize.height : 1;
                
                if (e.touches.length === 1 && isDragging && !isPinching) {
                  const touch = e.touches[0];
                  const rect = fullscreenCanvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    // 將全螢幕座標轉換回普通模式座標
                    const fullscreenX = touch.clientX - rect.left - dragStart.x;
                    const fullscreenY = touch.clientY - rect.top - dragStart.y;
                    setTransform(prev => ({
                      ...prev,
                      x: fullscreenX * scaleRatioX,
                      y: fullscreenY * scaleRatioY,
                    }));
                  }
                } else if (e.touches.length === 2 && isPinching) {
                  const currentDistance = getDistance(e.touches[0], e.touches[1]);
                  const currentAngle = getAngle(e.touches[0], e.touches[1]);
                  const scaleChange = currentDistance / lastPinchDistance;
                  const angleChange = currentAngle - lastPinchAngle;
                  setTransform(prev => ({
                    ...prev,
                    scale: Math.max(0.05, Math.min(3, prev.scale * scaleChange)),
                    rotation: prev.rotation + angleChange,
                  }));
                  setLastPinchDistance(currentDistance);
                  setLastPinchAngle(currentAngle);
                }
              }}
              onTouchEnd={(e) => {
                // 計算尺寸比例
                const scaleRatioX = canvasSize.width > 0 ? fullscreenCanvasSize.width / canvasSize.width : 1;
                const scaleRatioY = canvasSize.height > 0 ? fullscreenCanvasSize.height / canvasSize.height : 1;
                
                if (e.touches.length === 0) {
                  setIsDragging(false);
                  setIsPinching(false);
                } else if (e.touches.length === 1) {
                  setIsPinching(false);
                  setIsDragging(true);
                  const touch = e.touches[0];
                  const rect = fullscreenCanvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    setDragStart({
                      x: touch.clientX - rect.left - transform.x * scaleRatioX,
                      y: touch.clientY - rect.top - transform.y * scaleRatioY,
                    });
                  }
                }
              }}
              className="cursor-move max-w-full max-h-full"
              style={{ touchAction: 'none' }}
            />
          </div>

          {/* 底部快捷控制列 */}
          <div className="flex-shrink-0 bg-gray-900/95 backdrop-blur-sm border-t border-white/10 px-4 py-3 safe-area-bottom">
            <div className="flex items-center justify-center gap-3 mb-3">
              {/* 縮小 */}
              <button
                onClick={() => handleScale(-0.1)}
                className="p-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors border border-white/10"
              >
                <ZoomOut size={22} />
              </button>
              {/* 放大 */}
              <button
                onClick={() => handleScale(0.1)}
                className="p-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors border border-white/10"
              >
                <ZoomIn size={22} />
              </button>
              {/* 左旋轉 */}
              <button
                onClick={() => handleRotate(-15)}
                className="p-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors border border-white/10"
              >
                <RotateCw size={22} className="transform -scale-x-100" />
              </button>
              {/* 右旋轉 */}
              <button
                onClick={() => handleRotate(15)}
                className="p-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition-colors border border-white/10"
              >
                <RotateCw size={22} />
              </button>
              {/* 水平翻轉 */}
              <button
                onClick={handleFlipX}
                className={`p-3 rounded-xl transition-colors border border-white/10 ${
                  transform.flipX ? 'bg-primary text-black' : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                <FlipHorizontal size={22} />
              </button>
              {/* 垂直翻轉 */}
              <button
                onClick={handleFlipY}
                className={`p-3 rounded-xl transition-colors border border-white/10 ${
                  transform.flipY ? 'bg-primary text-black' : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                <FlipVertical size={22} />
              </button>
            </div>
            
            {/* 透明度滑桿 */}
            <div className="flex items-center gap-3 px-2">
              <Layers size={16} className="text-gray-400 flex-shrink-0" />
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.01"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-xs text-gray-400 w-10 text-right">{(opacity * 100).toFixed(0)}%</span>
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
