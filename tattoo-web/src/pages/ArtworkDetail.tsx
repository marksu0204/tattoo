
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { lineService } from '../services/lineService';
import { Artwork, ClaimStage } from '../types';
import { useApp } from '../App';
import { useBrand } from '../context/BrandContext';
import { ArrowLeft, Heart, ChevronLeft, ChevronRight } from 'lucide-react';
import ProtectedImage from '../components/ProtectedImage';
import { formatArtworkSize } from '../utils/artworkSize';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildArtworkLoadingSeo, buildArtworkNotFoundSeo, buildArtworkSeo } from '../utils/seoConfig';
import NotFound from './NotFound';
import MobileContactBar from '../components/MobileContactBar';
import ArtworkContactChoice from '../components/ArtworkContactChoice';
import ArtworkReassuranceInfo from '../components/ArtworkReassuranceInfo';
import {
  buildArtworkInquiryMessage,
  buildBookingDateInquiryMessageForArtwork,
  buildLineInquiryUrl,
  copyTextWithFallback,
} from '../utils/contactInquiry';
import {
  getBrandInstagramUrl,
  hasAnyBrandContact,
  hasBrandInstagramContact,
  hasBrandLineContact,
  shouldShowPublicBookingCalendar,
} from '../utils/brandContact';
import { getLiffEnvironmentState } from '../utils/liffEnvironment';
import { getBookingCtaCopy, resolveBookingCtaAction } from '../utils/resolveBookingCtaAction';
import { getArtworkContactCtaLabel, getImageWatermarkText } from '../utils/brandPresentation';
import { debugAnalytics, getEffectiveArtworkPrice, trackArtworkContact, trackArtworkView, trackEvent } from '../services/tracking';
import { buildAppOriginUrl } from '../utils/appUrl';
import { buildCardImageSources } from '../utils/imageUrl';

const ARTWORK_DESCRIPTION_EMPTY_FALLBACK = '尚未提供作品說明。';
const LEGACY_EMPTY_ARTWORK_DESCRIPTIONS = new Set([
  'No description provided.',
  'No description provided',
  '目前尚無作品說明。',
]);

function getArtworkDescriptionDisplay(description?: string | null): string {
  const trimmed = description?.trim();
  if (!trimmed || LEGACY_EMPTY_ARTWORK_DESCRIPTIONS.has(trimmed)) {
    return ARTWORK_DESCRIPTION_EMPTY_FALLBACK;
  }
  return trimmed;
}

const ArtworkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useApp();
  const { brand } = useBrand();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [prevArtwork, setPrevArtwork] = useState<Artwork | null>(null);
  const [nextArtwork, setNextArtwork] = useState<Artwork | null>(null);
  const [relatedArtworks, setRelatedArtworks] = useState<Artwork[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [hintAnimating, setHintAnimating] = useState(false);
  const [contactChoiceOpen, setContactChoiceOpen] = useState(false);
  const [sizeReferenceExpanded, setSizeReferenceExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [liffEnv, setLiffEnv] = useState(() => getLiffEnvironmentState(brand?.liffId));
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);
  const contactInFlightRef = useRef(false);
  const contactClickLockRef = useRef<Map<string, number>>(new Map());
  const CONTACT_CLICK_LOCK_WINDOW_MS = 1500;

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      // 讀取當前作品 + 全部作品，用於「下一個商品」導覽
      const [found, allArtworks] = await Promise.all([
        db.getArtwork(id),
        db.getArtworks()
      ]);
      setArtwork(found);
      setIsLoading(false);
      setCurrentImageIndex(0);
      setShowSwipeHint(true);
      setSizeReferenceExpanded(false);
      hasInteracted.current = false;
      
      // 記錄瀏覽次數
      if (found) {
        db.recordView(id);
      }

      if (!found || !Array.isArray(allArtworks) || allArtworks.length <= 1) {
        setPrevArtwork(null);
        setNextArtwork(null);
        setRelatedArtworks([]);
        return;
      }

      const currentIndex = allArtworks.findIndex(a => a.id === found.id);
      if (currentIndex === -1) {
        setPrevArtwork(allArtworks[allArtworks.length - 1] ?? null);
        setNextArtwork(allArtworks[0] ?? null);
        return;
      }

      const prev = allArtworks[(currentIndex - 1 + allArtworks.length) % allArtworks.length];
      const next = allArtworks[(currentIndex + 1) % allArtworks.length];
      setPrevArtwork(prev && prev.id !== found.id ? prev : null);
      setNextArtwork(next && next.id !== found.id ? next : null);

      const sameCategoryAvailable = allArtworks
        .filter(a => a.id !== found.id && a.category === found.category && (a.claimStage ?? (a.status === 'CLAIMED' ? ClaimStage.CLAIMED : ClaimStage.AVAILABLE)) === ClaimStage.AVAILABLE)
        .slice(0, 3);
      if (sameCategoryAvailable.length > 0) {
        setRelatedArtworks(sameCategoryAvailable);
      } else {
        const fallbackAvailable = allArtworks
          .filter(a => a.id !== found.id && (a.claimStage ?? (a.status === 'CLAIMED' ? ClaimStage.CLAIMED : ClaimStage.AVAILABLE)) === ClaimStage.AVAILABLE)
          .slice(0, 3);
        setRelatedArtworks(fallbackAvailable);
      }
    };
    fetchData();
  }, [id]);

  // 更新收藏狀態當 user 或 artwork 改變時
  useEffect(() => {
    if (user && artwork) {
      setIsFavorited(user.favorites?.includes(artwork.id) || false);
    } else {
      setIsFavorited(false);
    }
  }, [user, artwork]);

  useEffect(() => {
    const syncLiffEnv = () => setLiffEnv(getLiffEnvironmentState(brand?.liffId));
    syncLiffEnv();
    return lineService.onLiffInitSettled(syncLiffEnv);
  }, [brand?.liffId]);

  const bookingAction = useMemo(() => resolveBookingCtaAction({
    hasBookingCapability: shouldShowPublicBookingCalendar(brand),
    liffEnvironmentReady: liffEnv.isReady,
    isLiffLoggedIn: liffEnv.isLiffLoggedIn,
    hasValidLineAccessToken: liffEnv.hasValidLineAccessToken,
  }), [brand, liffEnv.isReady, liffEnv.isLiffLoggedIn, liffEnv.hasValidLineAccessToken]);

  const bookingCtaCopy = useMemo(() => getBookingCtaCopy(bookingAction), [bookingAction]);

  const handleBookNow = () => {
      if (!user) {
          if(window.confirm('請先登入以進行預約。前往登入頁面？')) {
              navigate('/login', { state: { returnTo: `/artwork/${id}` } });
          }
          return;
      }
      navigate('/calendar', { state: { artwork } });
  };

  const handleBookFromModal = async () => {
      const env = getLiffEnvironmentState(brand?.liffId);
      const action = resolveBookingCtaAction({
        hasBookingCapability: shouldShowPublicBookingCalendar(brand),
        liffEnvironmentReady: env.isReady,
        isLiffLoggedIn: env.isLiffLoggedIn,
        hasValidLineAccessToken: env.hasValidLineAccessToken,
      });
      if (action === 'checking') {
        return;
      }
      setContactChoiceOpen(false);
      if (action === 'line') {
        await handleBookingLineInquiry();
        return;
      }
      handleBookNow();
  };

  const handleBookingLineInquiry = async () => {
      if (contactInFlightRef.current) return;
      contactInFlightRef.current = true;
      const message = buildBookingDateInquiryMessageForArtwork(artwork, brand);
      const destinationUrl = buildLineInquiryUrl(message, brand);
      if (!destinationUrl) {
        contactInFlightRef.current = false;
        return;
      }
      try {
        const copied = await copyTextWithFallback(message);
        showToast(copied ? '詢問內容已複製，將為你開啟 LINE' : '複製失敗，將直接開啟 LINE');
        window.location.assign(destinationUrl);
      } finally {
        window.setTimeout(() => {
          contactInFlightRef.current = false;
        }, CONTACT_CLICK_LOCK_WINDOW_MS);
      }
  };

  const showToast = (message: string) => {
      setToastMessage(message);
      window.setTimeout(() => setToastMessage(null), 2200);
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!user) {
          if(window.confirm('請先登入才能使用收藏功能！前往登入頁面？')) {
              navigate('/login', { state: { returnTo: `/artwork/${id}` } });
          }
          return;
      }
      if (!artwork) return;
      
      // 保存當前狀態以便失敗時恢復
      const previousState = isFavorited;
      
      // 立即更新本地狀態以提供即時反饋
      setIsFavorited(!isFavorited);
      
      try {
          const accessToken = lineService.getAccessToken();
          if (!accessToken) {
            if (window.confirm('LINE登入狀態失效，請重新登入。前往登入頁面？')) {
              navigate('/login', { state: { returnTo: `/artwork/${id}` } });
            }
            setIsFavorited(previousState);
            return;
          }
          await db.toggleFavorite(artwork.id, accessToken, user.id);
          await refreshUser(); // Update global user state to reflect new favorites
      } catch (error) {
          // 如果失敗，恢復到之前的狀態
          setIsFavorited(previousState);
          console.error("Toggle favorite failed", error);
      }
  };

  const allImages = artwork?.imageUrls && artwork.imageUrls.length > 0
    ? artwork.imageUrls
    : artwork ? [artwork.imageUrl] : [];

  // 首次載入時播放滑動提示動畫
  useEffect(() => {
    if (allImages.length > 1 && !hasInteracted.current) {
      const timer = setTimeout(() => {
        setHintAnimating(true);
        setTimeout(() => setHintAnimating(false), 800);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [allImages.length]);

  const artworkSeo = useMemo(() => {
    if (isLoading) {
      return id ? buildArtworkLoadingSeo(id, brand) : buildArtworkNotFoundSeo(brand);
    }
    if (!artwork) return buildArtworkNotFoundSeo(brand);
    return buildArtworkSeo(artwork, brand);
  }, [artwork, brand, id, isLoading]);

  usePageSeo(artworkSeo);

  const goToImage = useCallback((index: number) => {
    hasInteracted.current = true;
    setShowSwipeHint(false);
    if (index < 0) setCurrentImageIndex(allImages.length - 1);
    else if (index >= allImages.length) setCurrentImageIndex(0);
    else setCurrentImageIndex(index);
  }, [allImages.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      if (diff > 0) goToImage(currentImageIndex + 1);
      else goToImage(currentImageIndex - 1);
    }
  };

  useEffect(() => {
    if (!artwork) return;
    const stage = artwork.claimStage ?? (artwork.status === 'CLAIMED' ? ClaimStage.CLAIMED : ClaimStage.AVAILABLE);
    const statusLabel = stage === ClaimStage.CLAIMED
      ? 'CLAIMED'
      : stage === ClaimStage.NEGOTIATING
        ? 'NEGOTIATING'
        : 'AVAILABLE';
    const onceKey = `ViewContent:${artwork.id}:${window.location.pathname}`;
    trackArtworkView({
      artwork,
      status: statusLabel,
      onceKey,
    });
  }, [artwork]);

  if (isLoading) return <div className="pt-20 text-center text-gray-500">載入中...</div>;
  if (!artwork) return <NotFound />;

  const claimStage = artwork.claimStage ?? (artwork.status === 'CLAIMED' ? ClaimStage.CLAIMED : ClaimStage.AVAILABLE);
  const isAvailable = claimStage === ClaimStage.AVAILABLE;
  const isNegotiating = claimStage === ClaimStage.NEGOTIATING;
  const isClaimed = claimStage === ClaimStage.CLAIMED;

  const artworkUrl = window.location.href;
  const inquiryMessage = buildArtworkInquiryMessage(
    { id: artwork.id, title: artwork.title },
    artworkUrl
  );
  const lineInquiryUrl = buildLineInquiryUrl(inquiryMessage, brand);
  const instagramUrl = getBrandInstagramUrl(brand);

  const handleContactClick = async (channel: 'line' | 'instagram') => {
    if (contactInFlightRef.current) return;
    const lockKey = `${artwork.id}:${channel}`;
    const now = Date.now();
    const lastTriggeredAt = contactClickLockRef.current.get(lockKey) ?? 0;
    if (now - lastTriggeredAt < CONTACT_CLICK_LOCK_WINDOW_MS) return;
    contactClickLockRef.current.set(lockKey, now);

    contactInFlightRef.current = true;
    setContactChoiceOpen(false);
    debugAnalytics('contact click', { channel, artworkId: artwork.id });
    const isDebugMode = new URLSearchParams(window.location.search).get('analytics_debug') === '1';
    const destinationUrl = channel === 'line' ? lineInquiryUrl : instagramUrl;
    if (!destinationUrl) {
      contactInFlightRef.current = false;
      return;
    }
    const effectivePrice = getEffectiveArtworkPrice(artwork) ?? undefined;
    if (isDebugMode) console.debug('[Contact] entered', { channel, artworkId: artwork.id, effectivePrice });

    try {
      db.recordArtworkEvent({
        artworkId: artwork.id,
        eventType: 'contact',
        channel,
      });
      if (isDebugMode) console.debug('[Contact] before analytics', { channel, artworkId: artwork.id, effectivePrice });
      const trackResult = await trackArtworkContact({ artwork, channel });
      if (isDebugMode) console.debug('[Contact] after GA4', { channel, artworkId: artwork.id, effectivePrice, gaQueued: trackResult.gaQueued });
      if (isDebugMode) console.debug('[Contact] after Meta', { channel, artworkId: artwork.id, effectivePrice, metaQueued: trackResult.metaQueued });
      const copied = await copyTextWithFallback(inquiryMessage);
      if (copied) {
        showToast(channel === 'line' ? '詢問內容已複製，將為你開啟 LINE' : '詢問內容已複製，請貼到 Instagram 私訊');
      } else {
        showToast(channel === 'line' ? '複製失敗，將直接開啟 LINE' : '複製失敗，已開啟 Instagram');
      }
      debugAnalytics('opening external contact', {
        channel,
        artworkId: artwork.id,
        value: trackResult.value,
      });
      if (isDebugMode) console.debug('[Contact] opening external', { channel, artworkId: artwork.id, effectivePrice: trackResult.value });
      window.location.assign(destinationUrl);
    } finally {
      window.setTimeout(() => {
        contactInFlightRef.current = false;
      }, CONTACT_CLICK_LOCK_WINDOW_MS);
    }
  };

  const handleLineConsult = async () => {
    await handleContactClick('line');
  };

  const handleInstagramContact = async () => {
    if (!instagramUrl) return;
    await handleContactClick('instagram');
  };

  const primaryCtaLabel = getArtworkContactCtaLabel(brand);
  const hasDisplayPrice = typeof artwork.specialPrice === 'number' || typeof artwork.price === 'number';
  const formatTwd = (value: number) => `NT$${value.toLocaleString('zh-TW')}`;
  const sizeSummary = formatArtworkSize(artwork);
  const priceLabel = !hasDisplayPrice
    ? '價格請洽詢'
    : artwork.specialPrice
      ? formatTwd(artwork.specialPrice)
      : formatTwd(artwork.price as number);
  const sizeLabelForContact = sizeSummary || '尺寸可依部位討論';
  const canContact = (isAvailable || isNegotiating) && hasAnyBrandContact(brand);
  const showBookAppointment = isAvailable && bookingAction !== 'hidden';

  const openContactChoice = () => setContactChoiceOpen(true);

  const renderSizeReferenceDetails = () => (
    <div className="space-y-3 pt-2 border-t border-white/10 mt-2">
      {artwork.sizeNote && (
        <p className="text-sm text-gray-300 whitespace-pre-line">{artwork.sizeNote}</p>
      )}
      {artwork.recommendedPlacements && artwork.recommendedPlacements.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">建議施作部位</p>
          <div className="flex flex-wrap gap-2">
            {artwork.recommendedPlacements.map((placement) => (
              <span key={placement} className="px-2.5 py-1 rounded-full text-xs bg-gray-800 text-gray-200 border border-gray-700">
                {placement}
              </span>
            ))}
          </div>
        </div>
      )}
      {!artwork.sizeNote && (!artwork.recommendedPlacements || artwork.recommendedPlacements.length === 0) && (
        <p className="text-sm text-gray-400">尚未提供額外尺寸參考，實際可依施作部位與刺青師討論。</p>
      )}
    </div>
  );

  const handleGoPrevArtwork = () => {
    if (!prevArtwork) return;
    navigate(`/artwork/${prevArtwork.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoNextArtwork = () => {
    if (!nextArtwork) return;
    navigate(`/artwork/${nextArtwork.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenTattooPreview = () => {
    trackEvent('OpenTattooPreview', {
      content_id: artwork.id,
      content_name: artwork.title,
      source: 'artwork_detail',
    });
    navigate(`/preview?artworkId=${artwork.id}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-8">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={20} className="mr-2" /> 返回
      </button>

      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        {/* Image Section - Carousel */}
        <div 
          ref={carouselRef}
          className="relative rounded-xl overflow-hidden bg-card shadow-2xl select-none min-h-[320px] md:min-h-[520px]"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* 圖片滑動區域 */}
          <div 
            className="flex transition-transform duration-300 ease-out"
            style={{ 
              transform: hintAnimating 
                ? `translateX(-40px)` 
                : `translateX(-${currentImageIndex * 100}%)` 
            }}
          >
            {allImages.map((imgUrl, idx) => (
              <div key={idx} className="w-full shrink-0">
                <ProtectedImage 
                  src={imgUrl} 
                  alt={`${artwork.title} - ${idx + 1}`} 
                  className={`w-full h-auto object-cover ${isClaimed ? 'grayscale opacity-70' : ''}`}
                  maxCanvasWidth={1600}
                  priority={idx === 0}
                  watermarkText={getImageWatermarkText(brand) ?? undefined}
                />
              </div>
            ))}
          </div>

          {/* 圖片計數器 (1/3) */}
          {allImages.length > 1 && (
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full z-20 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              {currentImageIndex + 1} / {allImages.length}
            </div>
          )}

          {/* 右側漸層提示（暗示右邊還有圖片） */}
          {allImages.length > 1 && showSwipeHint && currentImageIndex === 0 && (
            <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-black/20 to-transparent z-10 pointer-events-none flex items-center justify-end pr-1">
              <ChevronRight size={20} className="text-white/60 animate-pulse" />
            </div>
          )}

          {/* 左右箭頭（桌面端） */}
          {allImages.length > 1 && (
            <>
              <button
                onClick={() => goToImage(currentImageIndex - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2.5 rounded-full transition-all z-10 hidden md:flex items-center justify-center shadow-lg"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={() => goToImage(currentImageIndex + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2.5 rounded-full transition-all z-10 hidden md:flex items-center justify-center shadow-lg"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* 圖片指示器 (dots) - 帶半透明背景膠囊 */}
          {allImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2 flex gap-2.5 items-center">
              {allImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => { hasInteracted.current = true; setShowSwipeHint(false); setCurrentImageIndex(idx); }}
                  className={`rounded-full transition-all duration-300 ${
                    idx === currentImageIndex 
                      ? 'w-6 h-2.5 bg-white shadow-lg' 
                      : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}

          {/* 滑動提示文字（首次載入顯示，互動後消失） */}
          {allImages.length > 1 && showSwipeHint && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-10 md:hidden animate-bounce">
              <div className="bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full flex items-center gap-2 shadow-lg whitespace-nowrap">
                <ChevronLeft size={14} className="opacity-60" />
                左右滑動查看更多圖片
                <ChevronRight size={14} className="opacity-60" />
              </div>
            </div>
          )}

          {isClaimed && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                <span className="bg-red-600 text-white px-6 py-2 rounded-full text-xl font-bold uppercase -rotate-12 border-2 border-white">
                    已認領
                </span>
             </div>
          )}
          {(isAvailable || isNegotiating) && artwork.specialPrice && (
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded font-bold shadow-lg animate-pulse" style={allImages.length > 1 ? { left: 'auto', right: '4.5rem' } : {}}>
                  特價中
              </div>
          )}
          {/* Favorite Button */}
          <button
            onClick={toggleFavorite}
            className={`absolute top-4 right-4 p-3 rounded-full transition-all hover:scale-110 z-20 shadow-lg ${
                isFavorited 
                  ? 'text-pink-500 bg-white/90 border-2 border-pink-500' 
                  : 'text-gray-800 border-2 border-gray-800 bg-white/90 hover:border-pink-500 hover:text-pink-500'
            }`}
          >
              <Heart size={24} className={isFavorited ? "fill-current" : ""} />
          </button>
        </div>

        {/* Info Section */}
        <div className="flex flex-col justify-center">
          <div className="flex flex-col gap-5">
            {/* 1. 作品名稱 / 狀態 */}
            <div className="order-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-block px-3 py-1 bg-gray-800 text-primary text-xs rounded-full">
                  {artwork.category}
                </span>
                <span className="inline-block px-3 py-1 bg-gray-800 text-gray-200 text-xs rounded-full">
                  作品編號：{artwork.id}
                </span>
                <span className={`inline-block px-3 py-1 text-xs rounded-full font-semibold ${
                  isAvailable
                    ? 'bg-green-900/70 text-green-200'
                    : isNegotiating
                      ? 'bg-amber-900/70 text-amber-200'
                      : 'bg-red-900/70 text-red-200'
                }`}>
                  {isAvailable ? '尚未認領' : isNegotiating ? '洽談中' : '已認領'}
                </span>
              </div>
              {isAvailable && (
                <p className="text-xs text-gray-400 mb-2">此設計僅提供一位客人認領</p>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{artwork.title}</h1>
              {isNegotiating && (
                <p className="text-sm text-amber-200/90 mb-2">目前洽談中，可詢問候補</p>
              )}
              {isClaimed && (
                <p className="text-sm text-red-200/90 mb-2">此設計已被認領</p>
              )}
              <p className="text-gray-300 leading-relaxed text-base md:text-lg">
                {getArtworkDescriptionDisplay(artwork.description)}
              </p>
            </div>

            {/* 2. 預估價格 */}
            <div className="order-2">
              <p className="text-sm text-gray-500 mb-1">預估價格</p>
              {hasDisplayPrice ? (
                artwork.specialPrice ? (
                  <div className="flex items-baseline gap-3">
                    <p className="text-3xl font-bold text-red-500 whitespace-nowrap">{formatTwd(artwork.specialPrice)}</p>
                    {typeof artwork.price === 'number' && (
                      <p className="text-lg text-gray-500 line-through whitespace-nowrap">{formatTwd(artwork.price)}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-primary whitespace-nowrap">{formatTwd(artwork.price as number)}</p>
                )
              ) : (
                <p className="text-xl font-semibold text-amber-300">價格請洽詢</p>
              )}
            </div>

            {/* Mobile: 尺寸摘要 / Desktop: 完整尺寸區塊（order-6） */}
            <div className="order-3 md:order-6">
              <p className="text-sm text-gray-500 mb-1">建議尺寸</p>
              <p className="text-white font-semibold">{sizeSummary || '約 — cm'}</p>
              <p className="text-sm text-gray-400 mt-1">實際尺寸可依刺青部位調整</p>
              <button
                type="button"
                onClick={() => setSizeReferenceExpanded((prev) => !prev)}
                className="mt-2 text-sm text-primary hover:underline"
              >
                {sizeReferenceExpanded ? '收合尺寸參考' : '查看尺寸參考'}
              </button>
              <div className="hidden md:block">
                {sizeReferenceExpanded && renderSizeReferenceDetails()}
              </div>
            </div>

            {/* 3/4. 安心資訊 */}
            <div className="order-4 md:order-3">
              <ArtworkReassuranceInfo />
            </div>

            {/* 4/5. 主要 CTA（桌機） */}
            {canContact && (
              <div className="order-5 md:order-4 hidden md:block">
                <button
                  type="button"
                  onClick={openContactChoice}
                  className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-4 px-6 rounded-xl transition-transform hover:scale-[1.01] shadow-lg shadow-primary/20"
                >
                  {primaryCtaLabel}
                </button>
              </div>
            )}

            {/* 5/6. Preview CTA */}
            {artwork.pngUrl && (
              <div className="order-6 md:order-5">
                <button
                  type="button"
                  onClick={handleOpenTattooPreview}
                  className="w-full rounded-xl border-2 border-primary/35 bg-primary/8 hover:bg-primary/12 text-white font-semibold py-3.5 px-5 transition-all shadow-sm shadow-primary/10"
                >
                  <span className="flex flex-col items-center gap-1">
                    <span className="text-sm md:text-base tracking-wide">👁 看看刺在我身上的效果</span>
                    <span className="text-xs text-gray-400 font-normal">拍照即可試看・免登入</span>
                  </span>
                </button>
              </div>
            )}

            {/* Mobile: 尺寸詳細（展開後，位於 Preview 之後） */}
            <div className="order-7 md:hidden">
              {sizeReferenceExpanded && renderSizeReferenceDetails()}
            </div>

            {/* 已認領：相似作品 */}
            {isClaimed && relatedArtworks.length > 0 && (
              <div className="order-8 md:order-7 bg-card/60 border border-white/10 rounded-xl p-4">
                <p className="text-sm text-gray-300 mb-3">這件作品已認領，你也可以看看其他相似作品：</p>
                <div className="space-y-2">
                  {relatedArtworks.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(`/artwork/${item.id}`)}
                      className="w-full text-left bg-gray-800/60 hover:bg-gray-700/70 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-3 transition-colors"
                    >
                      {(() => {
                        const cardSrc = item.imageUrls?.[0] || item.imageUrl;
                        const fullSrc = item.imageUrls?.[1] || item.imageUrl;
                        const imageSources = buildCardImageSources(cardSrc, fullSrc);
                        return (
                          <img
                            src={imageSources.primaryUrl}
                            srcSet={imageSources.srcSet}
                            sizes="48px"
                            alt={item.title}
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              if (e.currentTarget.src !== imageSources.fallbackUrl) {
                                e.currentTarget.src = imageSources.fallbackUrl;
                              }
                            }}
                            className="w-12 h-12 object-cover rounded-md"
                          />
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{item.title}</p>
                        <p className="text-xs text-gray-400">#{item.id}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 7/8. 上一個 / 下一個 */}
            {(prevArtwork || nextArtwork) && (
              <div className="order-9 md:order-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prevArtwork && (
                  <button
                    type="button"
                    onClick={handleGoPrevArtwork}
                    className="group w-full rounded-2xl border border-white/10 bg-gradient-to-r from-gray-900 to-gray-800 p-3 hover:border-primary/50 hover:from-gray-800 hover:to-gray-700 transition-all duration-300 shadow-lg"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                        <ChevronLeft size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] tracking-wide uppercase text-gray-500">上一個商品</p>
                        <p className="text-white font-semibold truncate group-hover:text-primary transition-colors">
                          {prevArtwork.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">#{prevArtwork.category}</p>
                      </div>
                      {(() => {
                        const cardSrc = prevArtwork.imageUrls?.[0] || prevArtwork.imageUrl;
                        const fullSrc = prevArtwork.imageUrls?.[1] || prevArtwork.imageUrl;
                        const imageSources = buildCardImageSources(cardSrc, fullSrc);
                        return (
                          <img
                            src={imageSources.primaryUrl}
                            srcSet={imageSources.srcSet}
                            sizes="48px"
                            alt={prevArtwork.title}
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              if (e.currentTarget.src !== imageSources.fallbackUrl) {
                                e.currentTarget.src = imageSources.fallbackUrl;
                              }
                            }}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        );
                      })()}
                    </div>
                  </button>
                )}

                {nextArtwork && (
                  <button
                    type="button"
                    onClick={handleGoNextArtwork}
                    className="group w-full rounded-2xl border border-white/10 bg-gradient-to-r from-gray-900 to-gray-800 p-3 hover:border-primary/50 hover:from-gray-800 hover:to-gray-700 transition-all duration-300 shadow-lg"
                  >
                    <div className="flex items-center gap-3 text-left">
                      {(() => {
                        const cardSrc = nextArtwork.imageUrls?.[0] || nextArtwork.imageUrl;
                        const fullSrc = nextArtwork.imageUrls?.[1] || nextArtwork.imageUrl;
                        const imageSources = buildCardImageSources(cardSrc, fullSrc);
                        return (
                          <img
                            src={imageSources.primaryUrl}
                            srcSet={imageSources.srcSet}
                            sizes="48px"
                            alt={nextArtwork.title}
                            width={48}
                            height={48}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              if (e.currentTarget.src !== imageSources.fallbackUrl) {
                                e.currentTarget.src = imageSources.fallbackUrl;
                              }
                            }}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                          />
                        );
                      })()}
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] tracking-wide uppercase text-gray-500">下一個商品</p>
                        <p className="text-white font-semibold truncate group-hover:text-primary transition-colors">
                          {nextArtwork.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">#{nextArtwork.category}</p>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}

            <div className="order-10 flex flex-wrap gap-2">
              {artwork.tags.map((tag) => (
                <span key={tag} className="text-xs text-gray-500">#{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {canContact && (
        <MobileContactBar
          primaryLabel={primaryCtaLabel}
          onPrimaryClick={openContactChoice}
        />
      )}

      <ArtworkContactChoice
        open={contactChoiceOpen}
        onClose={() => setContactChoiceOpen(false)}
        artworkTitle={artwork.title}
        priceLabel={priceLabel}
        sizeLabel={sizeLabelForContact}
        isNegotiating={isNegotiating}
        showBookAppointment={showBookAppointment}
        bookingCtaTitle={bookingCtaCopy?.title}
        bookingCtaSubtitle={bookingCtaCopy?.subtitle}
        bookingCtaIcon={bookingCtaCopy?.icon}
        bookingCtaDisabled={bookingCtaCopy?.disabled ?? false}
        onLineClick={handleLineConsult}
        onBookClick={handleBookFromModal}
        onInstagramClick={handleInstagramContact}
        showLine={hasBrandLineContact(brand)}
        showInstagram={hasBrandInstagramContact(brand)}
      />

      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[140] bg-black/80 text-white text-sm px-4 py-2 rounded-lg shadow-xl md:bottom-6"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)' }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default ArtworkDetail;
