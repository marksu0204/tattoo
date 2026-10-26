
import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageSeo } from '../hooks/usePageSeo';
import { buildHomepageSeo } from '../utils/seoConfig';
import { db, PaginatedArtworks } from '../services/mockBackend';
import { lineService } from '../services/lineService';
import { Artwork, ArtworkStatus } from '../types';
import { Filter, Heart, ChevronDown, X } from 'lucide-react';
import FilterChipPanel, { type FilterChipGroup } from '../components/FilterChipPanel';
import { GALLERY_TAXONOMY_GROUPS } from '../utils/taxonomyMigration';
import {
  ARTWORK_TAG_GROUP_LABELS,
  ARTWORK_TAG_GROUPS,
  buildTaxonomyFilterLabel,
  emptyTaxonomyCatalog,
  filterGalleryVisibleTaxonomy,
  parseTaxonomyTagIds,
  toTaxonomyParam,
  toggleTaxonomyTagId,
} from '../utils/artworkTaxonomy';
import type { ArtworkTaxonomyCatalogResponse } from '../types';
import { useApp } from '../App';
import { useBrand } from '../context/BrandContext';
import { getHomeGalleryEmptyMessage, getHomeHeroIntro, HOME_MENU_HINT } from '../utils/brandPresentation';
import { formatArtworkSize } from '../utils/artworkSize';
import { ArtworkSort, normalizeArtworkSort, sortArtworks } from '../utils/artworkSort';
import {
  applyFilterParams,
  BUDGET_OPTIONS,
  buildFilterChips,
  CLAIM_OPTIONS,
  hasAnyFilter,
  parseBudgetFilters,
  parseClaimFilters,
  parsePlacementFilters,
  parseSizeFilters,
  SIZE_OPTIONS,
  toggleFilterValue,
} from '../utils/artworkFilters';
import { trackEvent } from '../services/tracking';
import { buildCardImageSources } from '../utils/imageUrl';
import { resolvePublicAssetUrl } from '../utils/publicAssetUrl';
import LineEntryButton from '../components/LineEntryButton';
import { CUSTOM_INQUIRY_MESSAGE } from '../utils/contactInquiry';

// 骨架屏組件 - 用於載入時顯示（固定高度避免 CLS）
const SkeletonCard = memo(() => (
  <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-800 animate-pulse" style={{ minHeight: '280px' }}>
    <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800" />
  </div>
));

// 圖片組件 - 帶懶載入和錯誤處理
const LazyImage = memo(({
  src,
  fallbackSrc,
  srcSet,
  sizes,
  alt,
  className,
  loading,
  fetchPriority,
}: {
  src: string;
  fallbackSrc?: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  className: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);
  const [imgSrcSet, setImgSrcSet] = useState(srcSet);
  const [imgSizes, setImgSizes] = useState(sizes);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setImgSrc(src);
    setImgSrcSet(srcSet);
    setImgSizes(sizes);
    setIsLoaded(false);
    setError(false);
  }, [src, srcSet, sizes]);

  // iOS/Safari 偶發不觸發 onLoad 時，使用 complete 狀態保底避免卡片維持透明。
  useEffect(() => {
    const node = imgRef.current;
    if (!node || error || isLoaded) return;
    if (node.complete && node.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [imgSrc, imgSrcSet, error, isLoaded]);

  return (
    <>
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
      <img 
        ref={imgRef}
        src={imgSrc}
        srcSet={imgSrcSet}
        sizes={imgSizes}
        alt={alt}
        width={600}
        height={800}
        loading={loading ?? 'lazy'}
        fetchPriority={fetchPriority ?? 'auto'}
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (fallbackSrc && imgSrc !== fallbackSrc) {
            setImgSrc(fallbackSrc);
            // fallback 階段關閉 srcset，避免瀏覽器再次選到失敗候選
            setImgSrcSet(undefined);
            setImgSizes(undefined);
            return;
          }
          setError(true);
        }}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      />
      {error && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-500">
          載入失敗
        </div>
      )}
    </>
  );
});

const PAGE_SIZE = 20;
const SORT_OPTIONS: Array<{ value: ArtworkSort; label: string }> = [
  { value: 'recommended', label: '推薦排序' },
  { value: 'newest', label: '最新上架' },
  { value: 'price_asc', label: '價格由低到高' },
  { value: 'price_desc', label: '價格由高到低' },
];

type OpenPanel = 'category' | 'filter' | null;

const Home: React.FC = () => {
  const { user, refreshUser } = useApp();
  const { brand } = useBrand();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read category from URL, default to 'All'
  const selectedCategory = searchParams.get('category') || 'All';
  const selectedSort = normalizeArtworkSort(searchParams.get('sort'));
  const budgetQuery = searchParams.get('budget') ?? '';
  const sizeQuery = searchParams.get('size') ?? '';
  const claimQuery = searchParams.get('claim') ?? '';
  const placementQuery = searchParams.get('placement') ?? '';
  const taxonomyQuery = searchParams.get('taxonomy') ?? '';
  const selectedBudgets = parseBudgetFilters(budgetQuery || null);
  const selectedSizes = parseSizeFilters(sizeQuery || null);
  const selectedClaims = parseClaimFilters(claimQuery || null);
  const selectedPlacements = parsePlacementFilters(placementQuery || null);
  const selectedTaxonomyTagIds = parseTaxonomyTagIds(taxonomyQuery || null);
  const filterChips = buildFilterChips({
    budgets: selectedBudgets,
    sizes: selectedSizes,
    claims: selectedClaims,
    placements: selectedPlacements,
  });
  const hasFilters = hasAnyFilter({
    budgets: selectedBudgets,
    sizes: selectedSizes,
    claims: selectedClaims,
    placements: selectedPlacements,
  }) || selectedTaxonomyTagIds.length > 0;
  const hasActiveFilters = hasFilters || selectedCategory !== 'All';
  const galleryEmptyMessage = getHomeGalleryEmptyMessage(brand, {
    hasActiveFilters,
  });

  const homepageSeo = useMemo(() => buildHomepageSeo(searchParams, brand), [searchParams, brand]);
  usePageSeo(homepageSeo);

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [filteredArtworks, setFilteredArtworks] = useState<Artwork[]>([]);
  const [taxonomyCatalog, setTaxonomyCatalog] = useState<ArtworkTaxonomyCatalogResponse>(emptyTaxonomyCatalog());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [availablePlacements, setAvailablePlacements] = useState<string[]>([]);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  // 本地收藏狀態，用於即時 UI 反饋
  const [localFavorites, setLocalFavorites] = useState<Set<string>>(new Set());
  // 無限捲動哨兵元素
  const sentinelRef = useRef<HTMLDivElement>(null);
  const galleryControlsRef = useRef<HTMLDivElement>(null);
  const categoryPanelRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // 切換分類時重新載入
  useEffect(() => {
    setArtworks([]);
    setCurrentPage(1);
    setHasMore(false);
    loadPagedCards(1, true, selectedCategory, selectedSort, {
      budgets: selectedBudgets,
      sizes: selectedSizes,
      claims: selectedClaims,
      placements: selectedPlacements,
      taxonomyTagIds: selectedTaxonomyTagIds,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedCategory,
    selectedSort,
    budgetQuery,
    sizeQuery,
    claimQuery,
    placementQuery,
    taxonomyQuery,
    user?.id
  ]);

  useEffect(() => {
    db.getArtworkTags()
      .then(setTaxonomyCatalog)
      .catch((e) => console.error('Failed to load taxonomy tags', e));
  }, []);

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setOpenPanel(null);

  useEffect(() => {
    if (openPanel === null) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (galleryControlsRef.current?.contains(target)) return;
      if (categoryPanelRef.current?.contains(target)) return;
      if (filterPanelRef.current?.contains(target)) return;
      setOpenPanel(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel]);


  // 無限捲動：哨兵元素進入視窗時自動載入下一頁
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadPagedCards(currentPage + 1, false, selectedCategory, selectedSort, {
            budgets: selectedBudgets,
            sizes: selectedSizes,
            claims: selectedClaims,
            placements: selectedPlacements,
            taxonomyTagIds: selectedTaxonomyTagIds,
          });
        }
      },
      { rootMargin: '200px' } // 提前 200px 觸發，滑動更流暢
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasMore,
    isLoadingMore,
    isLoading,
    currentPage,
    selectedCategory,
    selectedSort,
    budgetQuery,
    sizeQuery,
    claimQuery,
    placementQuery,
    taxonomyQuery
  ]);

  // 同步本地收藏狀態與全局用戶狀態
  useEffect(() => {
    if (user?.favorites) {
      setLocalFavorites(new Set(user.favorites));
    } else {
      setLocalFavorites(new Set());
    }
  }, [user?.favorites]);

  // 顯示用清單（首頁推薦排序維持收藏優先）
  useEffect(() => {
    const favSet = new Set(user?.favorites ?? []);

    if (selectedCategory === 'All' && selectedSort === 'recommended') {
      // 已收藏優先，其餘維持 artworks 原本隨機順序
      if (favSet.size > 0) {
        const sorted = [...artworks].sort((a, b) => {
          const aFav = favSet.has(a.id) ? 0 : 1;
          const bFav = favSet.has(b.id) ? 0 : 1;
          return aFav - bFav;
        });
        setFilteredArtworks(sorted);
      } else {
        setFilteredArtworks(artworks);
      }
    } else if (selectedCategory === 'Favorites') {
      // Favorites 由後端篩選，前端仍保留一次保險過濾（處理同步延遲）
      setFilteredArtworks(artworks.filter(a => favSet.has(a.id)));
    } else {
      // 其他情況由後端已處理，不再重複前端計算
      setFilteredArtworks(artworks);
    }
  }, [selectedCategory, selectedSort, artworks, user]);

  /** 隨機排序輔助：未認領亂序 + 已認領依日期 */
  const applySortOrder = (arts: Artwork[]): Artwork[] => {
    const available = arts.filter(a => a.status === ArtworkStatus.AVAILABLE);
    const claimed   = arts.filter(a => a.status === ArtworkStatus.CLAIMED);
    available.sort(() => Math.random() - 0.5);
    claimed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [...available, ...claimed];
  };

  /** 作品卡片分頁載入（All / 指定分類） */
  const loadPagedCards = async (
    page: number,
    isFirst: boolean = false,
    category: string = 'All',
    sort: ArtworkSort = 'recommended',
    filters: {
      budgets: string[];
      sizes: string[];
      claims: string[];
      placements: string[];
      taxonomyTagIds?: number[];
    } = { budgets: [], sizes: [], claims: [], placements: [] }
  ) => {
    if (isFirst) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const result = await db.getArtworkCards(
        page,
        PAGE_SIZE,
        category,
        user?.id,
        sort,
        filters,
        category === 'Favorites' ? lineService.getAccessToken() : undefined
      );

      const paginated = result as PaginatedArtworks;
      const newArts = sort === 'recommended'
        ? applySortOrder(paginated.artworks)
        : sortArtworks(paginated.artworks, sort);

      setArtworks(prev => isFirst ? newArts : [...prev, ...newArts]);
      setHasMore(paginated.hasMore);
      setCurrentPage(page);
      setTotalCount(paginated.total ?? 0);
      if (Array.isArray(paginated.availablePlacements)) {
        setAvailablePlacements(paginated.availablePlacements);
      }
    } catch (e) {
      console.error('Failed to load page', e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const setCategory = (cat: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('category', cat);
    next.set('sort', selectedSort);
    setSearchParams(next);
  };

  const applyTaxonomyFilters = (tagIds: number[]) => {
    const next = new URLSearchParams(searchParams);
    const param = toTaxonomyParam(tagIds);
    if (param) next.set('taxonomy', param);
    else next.delete('taxonomy');
    next.set('category', selectedCategory);
    next.set('sort', selectedSort);
    setSearchParams(next);
  };

  const clearTaxonomyFilters = () => {
    applyTaxonomyFilters([]);
  };

  const setSort = (sort: ArtworkSort) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', sort);
    next.set('category', selectedCategory);
    setSearchParams(next);
    trackEvent('SortDesigns', {
      sort,
      category: selectedCategory,
    });
  };

  const updateFilters = (nextFilters: {
    budgets?: string[];
    sizes?: string[];
    claims?: string[];
    placements?: string[];
  }) => {
    const next = applyFilterParams(searchParams, nextFilters);
    next.set('category', selectedCategory);
    next.set('sort', selectedSort);
    setSearchParams(next);
    trackEvent('UseFilter', {
      budget: (nextFilters.budgets ?? selectedBudgets).join(','),
      size: (nextFilters.sizes ?? selectedSizes).join(','),
      claim: (nextFilters.claims ?? selectedClaims).join(','),
      placement: (nextFilters.placements ?? selectedPlacements).join(','),
      category: selectedCategory,
    });
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('budget');
    next.delete('size');
    next.delete('claim');
    next.delete('placement');
    next.set('category', selectedCategory);
    next.set('sort', selectedSort);
    setSearchParams(next);
  };

  const removeChip = (chipKey: string) => {
    const [kind, value] = chipKey.split(':');
    if (!kind || !value) return;
    if (kind === 'budget') {
      updateFilters({ budgets: selectedBudgets.filter((v) => v !== value) });
    } else if (kind === 'size') {
      updateFilters({ sizes: selectedSizes.filter((v) => v !== value) });
    } else if (kind === 'claim') {
      updateFilters({ claims: selectedClaims.filter((v) => v !== value) });
    } else if (kind === 'placement') {
      updateFilters({ placements: selectedPlacements.filter((v) => v !== value) });
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, artId: string) => {
    e.preventDefault(); // Prevent link click
    e.stopPropagation(); // Stop event bubbling to Link
    if (!user) {
        alert('請先登入才能使用收藏功能！');
        return;
    }
    
    // 保存當前狀態以便失敗時恢復
    const wasFavorited = localFavorites.has(artId);
    const previousFavorites = new Set(localFavorites);
    
    // 立即更新本地狀態以提供即時反饋
    const newFavorites = new Set(localFavorites);
    if (wasFavorited) {
      newFavorites.delete(artId);
    } else {
      newFavorites.add(artId);
      const targetArtwork = artworks.find((a) => a.id === artId);
      trackEvent('AddToFavorites', {
        content_id: artId,
        content_name: targetArtwork?.title ?? '',
        source: 'home_list',
      });
    }
    setLocalFavorites(newFavorites);
    
    try {
        const accessToken = lineService.getAccessToken();
        if (!accessToken) {
          alert('LINE登入狀態失效，請重新登入');
          return;
        }
        await db.toggleFavorite(artId, accessToken, user.id);
        await refreshUser(); // Update global user state to reflect new favorites
    } catch (error) {
        // 如果失敗，恢復到之前的狀態
        setLocalFavorites(previousFavorites);
        console.error("Toggle favorite failed", error);
        alert('收藏功能發生錯誤，請稍後再試');
    }
  };

  const isFavorite = (artId: string) => {
      // 優先使用本地狀態（即時反饋），如果沒有則使用全局狀態
      if (localFavorites.has(artId)) return true;
      return user?.favorites?.includes(artId) || false;
  };

  const hasDisplayPrice = (artwork: Artwork) =>
    typeof artwork.specialPrice === 'number' || typeof artwork.price === 'number';

  const formatTwd = (value: number) => `NT$${value.toLocaleString('zh-TW')}`;
  const activeFilterCount = selectedBudgets.length + selectedSizes.length + selectedClaims.length + selectedPlacements.length;
  const taxonomyFilterLabel = buildTaxonomyFilterLabel(selectedTaxonomyTagIds, taxonomyCatalog);
  const hasTaxonomyFilters = selectedTaxonomyTagIds.length > 0;
  const visibleTaxonomyCatalog = useMemo(
    () => filterGalleryVisibleTaxonomy(taxonomyCatalog),
    [taxonomyCatalog]
  );

  // 分類（題材／風格…）選項：點選即套用
  // 前台只顯示「題材」「風格」；其他群組（企劃／作品形式）只在後台使用
  const taxonomyGroups: FilterChipGroup[] = ARTWORK_TAG_GROUPS.filter((groupKey) =>
    (GALLERY_TAXONOMY_GROUPS as string[]).includes(groupKey)
  ).map((groupKey) => ({
    key: groupKey,
    label: ARTWORK_TAG_GROUP_LABELS[groupKey],
    options: (visibleTaxonomyCatalog.tagsByGroup[groupKey] ?? []).map((tag) => ({
      value: String(tag.id),
      label: tag.displayName,
      selected: selectedTaxonomyTagIds.includes(tag.id),
    })),
  }));

  const toggleTaxonomyTag = (_groupKey: string, value: string) => {
    applyTaxonomyFilters(toggleTaxonomyTagId(selectedTaxonomyTagIds, Number(value)));
  };

  // 篩選（預算／尺寸／部位／認領狀態）選項：點選即套用
  const filterGroups: FilterChipGroup[] = [
    {
      key: 'budget',
      label: '預算',
      options: BUDGET_OPTIONS.map((o) => ({ value: o.value, label: o.label, selected: selectedBudgets.includes(o.value) })),
    },
    {
      key: 'size',
      label: '尺寸',
      options: SIZE_OPTIONS.map((o) => ({ value: o.value, label: o.label, selected: selectedSizes.includes(o.value) })),
    },
    {
      key: 'placement',
      label: '建議部位',
      options: availablePlacements.map((p) => ({ value: p, label: p, selected: selectedPlacements.includes(p) })),
      emptyText: '目前尚無可用部位資料',
    },
    {
      key: 'claim',
      label: '認領狀態',
      options: CLAIM_OPTIONS.map((o) => ({ value: o.value, label: o.label, selected: selectedClaims.includes(o.value) })),
    },
  ];

  const toggleFilterOption = (groupKey: string, value: string) => {
    if (groupKey === 'budget') updateFilters({ budgets: toggleFilterValue(selectedBudgets, value) });
    else if (groupKey === 'size') updateFilters({ sizes: toggleFilterValue(selectedSizes, value) });
    else if (groupKey === 'placement') updateFilters({ placements: toggleFilterValue(selectedPlacements, value) });
    else if (groupKey === 'claim') updateFilters({ claims: toggleFilterValue(selectedClaims, value) });
  };

  const categoryPanelContent = (
    <FilterChipPanel
      groups={taxonomyGroups}
      onToggle={toggleTaxonomyTag}
      onClear={clearTaxonomyFilters}
      onDone={closePanel}
      hasSelection={hasTaxonomyFilters}
      resultCount={totalCount}
      isLoading={isLoading}
    />
  );

  const filterPanelContent = (
    <FilterChipPanel
      groups={filterGroups}
      onToggle={toggleFilterOption}
      onClear={clearAllFilters}
      onDone={closePanel}
      hasSelection={activeFilterCount > 0}
      resultCount={totalCount}
      isLoading={isLoading}
    />
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Hero / Intro - 固定高度避免 CLS */}
      <div className="mb-6 text-center" style={{ minHeight: '24px' }}>
        <p className="text-gray-400 max-w-xl mx-auto">
          {getHomeHeroIntro(brand)}
          <span className="md:hidden"> | {HOME_MENU_HINT}</span>
        </p>
      </div>

      {/* 客製諮詢入口：小橫條，不佔版面 */}
      <div className="mb-6 max-w-xl mx-auto flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-card/60 px-4 py-2.5">
        <p className="text-sm text-gray-300">
          沒有剛好喜歡的？<span className="text-gray-400">刺青師也能為你設計專屬圖</span>
        </p>
        <LineEntryButton
          placement="custom_inquiry_home"
          variant="pill"
          label="客製諮詢"
          message={CUSTOM_INQUIRY_MESSAGE}
          className="shrink-0"
        />
      </div>

      {/* Quick filters + taxonomy */}
      <div ref={galleryControlsRef} className="sticky top-16 z-40 mb-8 py-3 bg-dark/95 backdrop-blur-md -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 border-b border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center text-gray-500 shrink-0"><Filter size={16} /></div>

          <button
            type="button"
            onClick={() => setCategory('All')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === 'All'
                ? 'bg-primary text-black'
                : 'bg-card text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            全部
          </button>

          <button
            type="button"
            onClick={() => {
              if (!user) { alert('請先登入才能使用收藏功能！'); return; }
              setCategory('Favorites');
            }}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
              selectedCategory === 'Favorites'
                ? 'bg-pink-600 text-white'
                : 'bg-card text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <Heart size={13} className={selectedCategory === 'Favorites' ? 'fill-current' : ''} />
            我的收藏
          </button>

          <button
            type="button"
            onClick={() => setCategory('NewArrivals')}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === 'NewArrivals' || selectedCategory === '新上架'
                ? 'bg-primary text-black'
                : 'bg-card text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            新上架
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => togglePanel('category')}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 border ${
                openPanel === 'category' || hasTaxonomyFilters
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-card border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              {hasTaxonomyFilters ? taxonomyFilterLabel : '分類'}
              <ChevronDown size={14} className={openPanel === 'category' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {openPanel === 'category' && (
              <div
                ref={categoryPanelRef}
                className="hidden md:block absolute left-0 top-full mt-2 w-[min(92vw,720px)] rounded-xl border border-white/10 bg-card shadow-2xl p-4 z-50"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {categoryPanelContent}
              </div>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => togglePanel('filter')}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 border ${
                openPanel === 'filter' || activeFilterCount > 0
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-card border-white/10 text-gray-300 hover:border-white/20'
              }`}
            >
              篩選{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              <ChevronDown size={14} className={openPanel === 'filter' ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>

            {openPanel === 'filter' && (
              <div
                ref={filterPanelRef}
                className="hidden md:block absolute left-0 top-full mt-2 w-[min(92vw,720px)] rounded-xl border border-white/10 bg-card shadow-2xl p-4 z-50"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {filterPanelContent}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="artwork-sort" className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
              排序
            </label>
            <select
              id="artwork-sort"
              value={selectedSort}
              onChange={(e) => setSort(normalizeArtworkSort(e.target.value))}
              className="bg-card border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary min-w-[136px]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {hasTaxonomyFilters && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-gray-500">分類 ●{selectedTaxonomyTagIds.length}</span>
            <button
              onClick={clearTaxonomyFilters}
              className="text-gray-400 hover:text-white inline-flex items-center gap-1"
            >
              <X size={12} /> 清除分類
            </button>
          </div>
        )}
      </div>

      {/* Mobile Category Bottom Sheet */}
      {openPanel === 'category' && (
        <div className="fixed inset-0 z-[130] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={closePanel} />
          <div
            ref={categoryPanelRef}
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-white/10 p-4 max-h-[78vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">分類</h3>
              <button type="button" onClick={closePanel} className="text-sm text-gray-400">關閉</button>
            </div>
            {categoryPanelContent}
          </div>
        </div>
      )}

      {/* Mobile Filter Drawer */}
      {openPanel === 'filter' && (
        <div className="fixed inset-0 z-[120] md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={closePanel} />
          <div
            ref={filterPanelRef}
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-white/10 p-4 max-h-[78vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">篩選</h3>
              <button type="button" onClick={closePanel} className="text-sm text-gray-400">關閉</button>
            </div>
            {filterPanelContent}
          </div>
        </div>
      )}

      {(hasFilters || filterChips.length > 0) && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => removeChip(chip.key)}
                className="px-3 py-1 rounded-full text-xs bg-gray-800 text-gray-200 border border-gray-700 hover:border-gray-500"
              >
                {chip.label} ×
              </button>
            ))}
            {hasFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                清除全部
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 text-sm text-gray-400">
        符合條件作品：<span className="text-white font-semibold">{totalCount}</span> 件
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredArtworks.map(artwork => (
            <div key={artwork.id} className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-900">
              <Link 
                to={`/artwork/${artwork.id}`} 
                className="absolute inset-0 z-0"
                onClick={(e) => {
                  // 如果點擊的是收藏按鈕區域，不導航
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) {
                    e.preventDefault();
                  }
                }}
              >
                {(() => {
                  const cardUrl = resolvePublicAssetUrl(
                    artwork.cardImageUrl ?? artwork.imageUrl,
                    brand,
                  );
                  const fullUrl = resolvePublicAssetUrl(
                    artwork.imageUrls?.[1] ?? artwork.imageUrl,
                    brand,
                  );
                  const { primaryUrl, fallbackUrl, srcSet, sizes } = buildCardImageSources(
                    cardUrl,
                    fullUrl,
                  );
                  const isLcpCandidate = artwork === filteredArtworks[0];
                  return (
                    <LazyImage
                      src={primaryUrl}
                      fallbackSrc={fallbackUrl}
                      srcSet={srcSet}
                      sizes={sizes}
                      alt={artwork.title}
                      loading={isLcpCandidate ? 'eager' : 'lazy'}
                      fetchPriority={isLcpCandidate ? 'high' : 'auto'}
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${artwork.status === ArtworkStatus.CLAIMED ? 'opacity-50 grayscale' : ''}`}
                    />
                  );
                })()}
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Content on Hover */}
                <div className="absolute bottom-0 left-0 p-4 w-full translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-white font-bold truncate">{artwork.title}</h3>
                  <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-300">{artwork.category}</p>
                      {artwork.specialPrice && (
                          <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">特價</span>
                      )}
                  </div>
                  <p className="text-[11px] text-gray-300/90 mt-0.5 min-h-[16px] truncate">
                    建議尺寸：{formatArtworkSize(artwork) || '尺寸可依部位討論'}
                  </p>
                  <div className="mt-1 min-h-[20px]">
                    {hasDisplayPrice(artwork) ? (
                      artwork.specialPrice ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-bold text-red-400 whitespace-nowrap">{formatTwd(artwork.specialPrice)}</span>
                          {typeof artwork.price === 'number' && (
                            <span className="text-[10px] text-gray-500 line-through whitespace-nowrap">{formatTwd(artwork.price)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-primary whitespace-nowrap">
                          {formatTwd(artwork.price as number)}
                        </span>
                      )
                    ) : (
                      <span className="text-xs font-medium text-amber-300 whitespace-nowrap">價格請洽詢</span>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  {artwork.isNew && (
                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-primary/90 text-black">
                      新上架
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    artwork.status === ArtworkStatus.CLAIMED ? 'bg-red-900/80 text-red-200' : 'bg-green-900/80 text-green-200'
                  }`}>
                    {artwork.status === ArtworkStatus.CLAIMED ? '已認領' : '未認領'}
                  </span>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 md:hidden">
                  {hasDisplayPrice(artwork) ? (
                    artwork.specialPrice ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-red-400 whitespace-nowrap">{formatTwd(artwork.specialPrice)}</span>
                        {typeof artwork.price === 'number' && (
                          <span className="text-[10px] text-gray-400 line-through whitespace-nowrap">{formatTwd(artwork.price)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-primary whitespace-nowrap">
                        {formatTwd(artwork.price as number)}
                      </span>
                    )
                  ) : (
                    <span className="text-xs font-medium text-amber-300 whitespace-nowrap">價格請洽詢</span>
                  )}
                </div>
              </Link>

              {/* Favorite Button - Outside Link with higher z-index */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(e, artwork.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`absolute top-2 left-2 p-2 rounded-full transition-all hover:scale-110 z-50 pointer-events-auto ${
                    isFavorite(artwork.id) 
                      ? 'text-pink-500 bg-white/10 border-2 border-pink-500/50' 
                      : 'text-gray-800 border-2 border-gray-800 bg-white/80 hover:border-pink-500 hover:text-pink-500 hover:bg-white/90'
                }`}
                style={{ pointerEvents: 'auto' }}
              >
                  <Heart size={20} className={isFavorite(artwork.id) ? "fill-current" : ""} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredArtworks.length === 0 && (
        <div className="text-center py-20 text-gray-500 space-y-3">
          <p>{galleryEmptyMessage}</p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 hover:border-gray-500"
            >
              清除條件重新查看
            </button>
          )}
          <div className="pt-6 space-y-3">
            <p className="text-sm text-gray-400">找不到喜歡的？也可以跟我們聊聊客製</p>
            <LineEntryButton
              placement="gallery_empty"
              variant="pill"
              label="客製諮詢"
              message={CUSTOM_INQUIRY_MESSAGE}
              className="h-10 px-4 text-sm"
            />
          </div>
        </div>
      )}

      {/* 載入中骨架 */}
      {isLoadingMore && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 mt-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={`more-${i}`} />)}
        </div>
      )}

      {/* 無限捲動哨兵：進入視窗時自動觸發下一頁 */}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />
    </div>
  );
};

export default Home;
