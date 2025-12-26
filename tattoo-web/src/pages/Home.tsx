
import React, { useState, useEffect, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Artwork, ArtworkStatus } from '../types';
import { Filter, Heart } from 'lucide-react';
import { useApp } from '../App';

// 骨架屏組件 - 用於載入時顯示
const SkeletonCard = memo(() => (
  <div className="aspect-[3/4] overflow-hidden rounded-lg bg-gray-800 animate-pulse">
    <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800" />
  </div>
));

// 圖片組件 - 帶懶載入和錯誤處理
const LazyImage = memo(({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <>
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse" />
      )}
      <img 
        src={src} 
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
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

const Home: React.FC = () => {
  const { user, refreshUser } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read category from URL, default to 'All'
  const selectedCategory = searchParams.get('category') || 'All';

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [filteredArtworks, setFilteredArtworks] = useState<Artwork[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 本地收藏狀態，用於即時 UI 反饋
  const [localFavorites, setLocalFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  // 同步本地收藏狀態與全局用戶狀態
  useEffect(() => {
    if (user?.favorites) {
      setLocalFavorites(new Set(user.favorites));
    } else {
      setLocalFavorites(new Set());
    }
  }, [user?.favorites]);

  useEffect(() => {
    if (selectedCategory === 'All') {
      setFilteredArtworks(artworks);
    } else if (selectedCategory === 'Favorites') {
      const favs = user?.favorites || [];
      setFilteredArtworks(artworks.filter(a => favs.includes(a.id)));
    } else {
      setFilteredArtworks(artworks.filter(a => a.category === selectedCategory));
    }
  }, [selectedCategory, artworks, user]);

  const loadData = async () => {
    setIsLoading(true);
    const [arts, cats] = await Promise.all([
        db.getArtworks(),
        db.getCategories()
    ]);
    
    // 分離可認領與已認領的商品
    const available = arts.filter((a: Artwork) => a.status === ArtworkStatus.AVAILABLE);
    const claimed = arts.filter((a: Artwork) => a.status === ArtworkStatus.CLAIMED);
    
    // 可認領的商品隨機排序
    const shuffledAvailable = available.sort(() => Math.random() - 0.5);
    
    // 已認領的按日期排序
    const sortedClaimed = claimed.sort((a: Artwork, b: Artwork) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // 合併：可認領的在前（隨機），已認領的在後（按日期）
    const sorted = [...shuffledAvailable, ...sortedClaimed];

    setArtworks(sorted);
    setCategories(cats);
    setIsLoading(false);
  };

  const setCategory = (cat: string) => {
    setSearchParams({ category: cat });
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
    }
    setLocalFavorites(newFavorites);
    
    try {
        await db.toggleFavorite(user.id, artId);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Hero / Intro */}
      <div className="mb-10 text-center">
        <p className="text-gray-400 max-w-xl mx-auto">
          白角刺青 | 台南刺青 | 右上角MENU有更多功能
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex overflow-x-auto no-scrollbar gap-3 mb-8 pb-2 items-center sm:justify-center">
        <div className="flex items-center text-gray-500 mr-2"><Filter size={16} /></div>
        {categories.map((cat: string) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === cat 
                ? 'bg-primary text-black' 
                : 'bg-card text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {cat === 'All' ? '全部' : cat}
          </button>
        ))}
        {/* Favorites Filter */}
        {user && (
            <button
                onClick={() => setCategory('Favorites')}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                selectedCategory === 'Favorites'
                    ? 'bg-pink-600 text-white' 
                    : 'bg-card text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
                <Heart size={14} className="fill-current" /> 我的收藏
            </button>
        )}
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
                <LazyImage 
                  src={artwork.imageUrl} 
                  alt={artwork.title}
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${artwork.status === ArtworkStatus.CLAIMED ? 'opacity-50 grayscale' : ''}`}
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Content on Hover */}
                <div className="absolute bottom-0 left-0 p-4 w-full translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-white font-bold truncate">{artwork.title}</h3>
                  <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-300">{artwork.category}</p>
                      {/* Price hint */}
                      {artwork.specialPrice && (
                          <span className="text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">特價</span>
                      )}
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  artwork.status === ArtworkStatus.CLAIMED ? 'bg-red-900/80 text-red-200' : 'bg-green-900/80 text-green-200'
                }`}>
                  {artwork.status === ArtworkStatus.CLAIMED ? '已認領' : '未認領'}
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
        <div className="text-center py-20 text-gray-500">
          找不到相關設計。
        </div>
      )}
    </div>
  );
};

export default Home;
