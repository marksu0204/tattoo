
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Artwork, ArtworkStatus, LINE_ID, UserRole } from '../types';
import { useApp } from '../App';
import { ArrowLeft, MessageCircle, Calendar, Layers, LogIn, Heart } from 'lucide-react';

const ArtworkDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useApp();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      const all = await db.getArtworks();
      const found = all.find(a => a.id === id);
      setArtwork(found || null);
      setIsLoading(false);
      
      // 記錄瀏覽次數
      if (found) {
        db.recordView(id);
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

  const handleBookNow = () => {
      if (!user) {
          if(window.confirm('請先登入以進行預約。前往登入頁面？')) {
              navigate('/login');
          }
          return;
      }
      // Navigate to calendar with artwork data
      navigate('/calendar', { state: { artwork } });
  };

  const handleLineConsult = (e: React.MouseEvent) => {
      // Auto copy message to clipboard for better UX
      if (artwork) {
          const text = `你好！我對這張作品 "${artwork.title}" (ID: ${artwork.id}) 有興趣，請問還有嗎？`;
          navigator.clipboard.writeText(text).catch(() => {});
      }
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!user) {
          if(window.confirm('請先登入才能使用收藏功能！前往登入頁面？')) {
              navigate('/login');
          }
          return;
      }
      if (!artwork) return;
      
      // 保存當前狀態以便失敗時恢復
      const previousState = isFavorited;
      
      // 立即更新本地狀態以提供即時反饋
      setIsFavorited(!isFavorited);
      
      try {
          await db.toggleFavorite(user.id, artwork.id);
          await refreshUser(); // Update global user state to reflect new favorites
      } catch (error) {
          // 如果失敗，恢復到之前的狀態
          setIsFavorited(previousState);
          console.error("Toggle favorite failed", error);
      }
  };

  if (isLoading) return <div className="pt-20 text-center text-gray-500">載入中...</div>;
  if (!artwork) return <div className="pt-20 text-center text-gray-500">找不到此作品</div>;

  const isAvailable = artwork.status === ArtworkStatus.AVAILABLE;

  // LINE Message generation
  // Format: https://line.me/R/oaMessage/@{LINE_ID}/?{message}
  const messageText = `你好！我對這張作品 "${artwork.title}" (ID: ${artwork.id}) 有興趣，請問還有嗎？`;
  const encodedMessage = encodeURIComponent(messageText);
  // Ensure LINE_ID does NOT have @, we add it here. Slash before ? is important.
  const lineUrl = `https://line.me/R/oaMessage/@${LINE_ID}/?${encodedMessage}`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-400 hover:text-white mb-6">
        <ArrowLeft size={20} className="mr-2" /> 返回
      </button>

      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        {/* Image Section */}
        <div className="relative rounded-xl overflow-hidden bg-card shadow-2xl">
           <img 
            src={artwork.imageUrl} 
            alt={artwork.title} 
            className={`w-full h-auto object-cover ${!isAvailable ? 'grayscale opacity-70' : ''}`} 
          />
          {!isAvailable && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="bg-red-600 text-white px-6 py-2 rounded-full text-xl font-bold uppercase rotate-[-12deg] border-2 border-white">
                    已認領
                </span>
             </div>
          )}
          {isAvailable && artwork.specialPrice && (
              <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded font-bold shadow-lg animate-pulse">
                  特價中
              </div>
          )}
          {/* Favorite Button */}
          <button
            onClick={toggleFavorite}
            className={`absolute top-4 right-4 p-3 rounded-full transition-all hover:scale-110 z-10 shadow-lg ${
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
          <div className="mb-6">
            <span className="inline-block px-3 py-1 bg-gray-800 text-primary text-xs rounded-full mb-3">
              {artwork.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{artwork.title}</h1>
            <p className="text-gray-300 leading-relaxed text-lg">
              {artwork.description}
            </p>
          </div>

          <div className="space-y-6">
            {/* Price - Only if logged in */}
            {user && (
              <div className="bg-card p-4 rounded-lg border border-white/5">
                <p className="text-sm text-gray-500 mb-1">預估價格</p>
                {artwork.specialPrice ? (
                    <div className="flex items-baseline gap-3">
                        <p className="text-3xl font-bold text-red-500">NT$ {artwork.specialPrice.toLocaleString()}</p>
                        <p className="text-lg text-gray-500 line-through">NT$ {artwork.price?.toLocaleString()}</p>
                    </div>
                ) : (
                    <p className="text-2xl font-bold text-primary">NT$ {artwork.price?.toLocaleString()}</p>
                )}
                
                {user.role === UserRole.GUEST && (
                     <p className="text-xs text-gray-600 mt-1">* 登入以查看會員專屬價格</p>
                )}
              </div>
            )}

            {!user && (
                 <button
                   onClick={() => navigate('/login')}
                   className="w-full bg-[#06C755] hover:bg-[#05b34d] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-all hover:scale-[1.02] shadow-lg"
                 >
                   <LogIn className="mr-3" size={20} />
                   LINE 登入查看價格
                 </button>
            )}

            {/* Actions */}
            {isAvailable ? (
              <div className="space-y-3">
                  {/* Tattoo Preview Button - 只有有 PNG 時顯示 */}
                  {artwork.pngUrl && (
                    <button 
                      onClick={() => navigate(`/preview?artworkId=${artwork.id}`)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-all hover:scale-[1.02] shadow-lg shadow-purple-900/30"
                    >
                      <Layers className="mr-3" size={24} />
                      刺青預覽模擬
                    </button>
                  )}

                  {/* Book Appointment Button */}
                  <button 
                    onClick={handleBookNow}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-colors border border-white/10"
                  >
                    <Calendar className="mr-3" size={24} />
                    挑選想刺青的日期
                  </button>

                  {/* LINE Button */}
                  <a 
                    href={lineUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={handleLineConsult}
                    className="w-full bg-[#06c755] hover:bg-[#05b34c] text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center transition-transform hover:scale-[1.02] shadow-lg shadow-green-900/20"
                  >
                    <MessageCircle className="mr-3" size={24} />
                    LINE 諮詢
                  </a>
                  <p className="text-[10px] text-gray-500 text-center">點擊後將自動複製詢問訊息</p>
              </div>
            ) : (
               <button 
                disabled
                className="w-full bg-gray-700 text-gray-400 font-bold py-4 px-6 rounded-xl cursor-not-allowed flex items-center justify-center"
              >
                此圖已售出
              </button>
            )}

            <div className="flex flex-wrap gap-2 mt-6">
                {artwork.tags.map(tag => (
                    <span key={tag} className="text-xs text-gray-500">#{tag}</span>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtworkDetail;
