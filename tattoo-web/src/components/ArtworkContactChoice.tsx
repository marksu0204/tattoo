import React from 'react';
import { Calendar, Instagram, MessageCircle, X } from 'lucide-react';

interface ArtworkContactChoiceProps {
  open: boolean;
  onClose: () => void;
  artworkTitle: string;
  priceLabel: string;
  sizeLabel: string;
  isNegotiating?: boolean;
  showBookAppointment?: boolean;
  bookingCtaTitle?: string;
  bookingCtaSubtitle?: string;
  bookingCtaIcon?: 'calendar' | 'line';
  bookingCtaDisabled?: boolean;
  onLineClick: () => void;
  onBookClick?: () => void;
  onInstagramClick?: () => void;
  showLine?: boolean;
  showInstagram: boolean;
}

const ArtworkContactChoice: React.FC<ArtworkContactChoiceProps> = ({
  open,
  onClose,
  artworkTitle,
  priceLabel,
  sizeLabel,
  isNegotiating = false,
  showBookAppointment = false,
  bookingCtaTitle = '查看可預約日期',
  bookingCtaSubtitle = '已經有興趣，直接看看可以預約的時間',
  bookingCtaIcon = 'calendar',
  bookingCtaDisabled = false,
  onLineClick,
  onBookClick,
  onInstagramClick,
  showLine = true,
  showInstagram,
}) => {
  if (!open) return null;

  const handleLineClick = () => {
    onLineClick();
  };

  const handleBookClick = () => {
    if (bookingCtaDisabled) return;
    onBookClick?.();
  };

  const handleInstagramClick = () => {
    onInstagramClick?.();
  };

  return (
    <div className="fixed inset-0 z-[130]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-white/10 px-4 pt-4 shadow-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="artwork-contact-choice-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 id="artwork-contact-choice-title" className="text-white font-bold text-lg">
              想怎麼進一步？
            </h3>
            {isNegotiating && (
              <p className="text-sm text-amber-300/90 mt-1">此作品目前洽談中</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 mb-4 space-y-1.5 text-sm">
          <p className="text-white font-medium truncate">{artworkTitle}</p>
          <p className="text-gray-400">預估價格：<span className="text-gray-200">{priceLabel}</span></p>
          <p className="text-gray-400">建議尺寸：<span className="text-gray-200">{sizeLabel}</span></p>
        </div>

        <div className="space-y-3">
          {showLine && (
          <button
            type="button"
            onClick={handleLineClick}
            className="w-full rounded-xl bg-[#06c755] hover:bg-[#05b34c] text-white font-bold py-3.5 flex flex-col items-center justify-center gap-0.5 shadow-lg shadow-green-900/20"
          >
            <span className="flex items-center gap-2">
              <MessageCircle size={20} />
              {isNegotiating ? 'LINE 詢問候補' : 'LINE 詢問'}
            </span>
            <span className="text-[11px] font-normal opacity-90">
              想先詢問尺寸、位置或其他細節
            </span>
          </button>
          )}

          {/* Secondary: 查看可預約日期 */}
          {showBookAppointment && onBookClick && (
            <button
              type="button"
              onClick={handleBookClick}
              disabled={bookingCtaDisabled}
              aria-busy={bookingCtaDisabled}
              className={`w-full rounded-xl font-bold py-3 flex flex-col items-center justify-center gap-0.5 ${
                bookingCtaDisabled
                  ? 'bg-gray-800/80 border-2 border-white/10 text-gray-400 cursor-not-allowed opacity-80'
                  : bookingCtaIcon === 'line'
                  ? 'bg-[#06c755] hover:bg-[#05b34c] text-white shadow-lg shadow-green-900/20'
                  : 'bg-primary/15 hover:bg-primary/25 border-2 border-primary/50 text-primary'
              }`}
            >
              <span className="flex items-center gap-2">
                {bookingCtaIcon === 'line' ? <MessageCircle size={18} /> : <Calendar size={18} />}
                {bookingCtaTitle}
              </span>
              <span className={`text-[11px] font-normal ${bookingCtaIcon === 'line' ? 'opacity-90' : 'text-primary/80'}`}>
                {bookingCtaSubtitle}
              </span>
            </button>
          )}

          {/* Tertiary: Instagram */}
          {showInstagram && onInstagramClick && (
            <button
              type="button"
              onClick={handleInstagramClick}
              className="w-full rounded-xl border border-white/10 bg-gray-800/60 hover:bg-gray-700/80 text-gray-200 font-medium py-2.5 flex items-center justify-center gap-2"
            >
              <Instagram size={18} />
              Instagram 私訊
            </button>
          )}
        </div>
        {(showLine || showInstagram) && (
        <p className="text-[10px] text-gray-500 text-center mt-3">LINE / Instagram 點擊後將自動複製詢問訊息</p>
        )}
      </div>
    </div>
  );
};

export default ArtworkContactChoice;
