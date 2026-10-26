import React from 'react';
import { useBrand } from '../context/BrandContext';
import { buildLineInquiryUrl, getBrandLineUrl } from '../utils/brandContact';
import { trackLineEntryClick, type LineEntryPlacement } from '../services/tracking';

import { LINE_GREEN } from '../utils/lineEntry';

/** 簡單的對話泡泡圖示（白色），用在 LINE 綠底按鈕上 */
export const LineBubbleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.56 7.25 8.37 7.88.33.07.77.22.88.5.1.25.07.65.03.9l-.14.86c-.04.25-.2 1 .87.54 1.08-.45 5.8-3.42 7.92-5.85C21.38 14.25 22 12.7 22 11c0-4.42-4.48-8-10-8Z" />
  </svg>
);


type Variant = 'pill' | 'block' | 'menu' | 'link';

interface Props {
  placement: LineEntryPlacement;
  variant: Variant;
  label?: string;
  className?: string;
  onClick?: () => void;
  /** 有提供時開啟 LINE 並預填這段訊息（例如客製諮詢格式）；否則開啟加好友連結 */
  message?: string;
}

const VARIANT_CLASS: Record<Variant, string> = {
  // 標題列：與 MENU 同高的小膠囊
  pill: 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-white text-xs font-bold tracking-wide shadow-sm',
  // 內容區的整寬按鈕
  block: 'w-full inline-flex items-center justify-center gap-2 rounded-xl text-white font-bold py-3.5 px-6 transition-opacity hover:opacity-90',
  // MENU 內的一列
  menu: 'flex items-center gap-2 px-3 py-3 rounded-md text-base font-medium border-b border-white/5 text-[#3ddc84] hover:text-white',
  // 文字中的連結
  link: 'inline-flex items-center gap-1 text-[#3ddc84] underline underline-offset-2 hover:text-white',
};

const LineEntryButton: React.FC<Props> = ({ placement, variant, label, className, onClick, message }) => {
  const { brand } = useBrand();
  // 預設為「加好友」網址（line.me/R/ti/p/@id）：非好友會先加好友並收到歡迎訊息；已是好友則直接進入聊天室
  const url = message ? buildLineInquiryUrl(message, brand) : getBrandLineUrl(brand);
  if (!url) return null;

  const filled = variant === 'pill' || variant === 'block';
  const text = label ?? (variant === 'pill' ? 'LINE' : 'LINE 詢問・加入好友');
  const iconSize = variant === 'block' ? 20 : variant === 'pill' ? 16 : 18;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackLineEntryClick(placement);
        onClick?.();
      }}
      className={`${VARIANT_CLASS[variant]} ${className ?? ''}`}
      style={filled ? { backgroundColor: LINE_GREEN } : undefined}
      aria-label={variant === 'pill' ? 'LINE 詢問・加入好友' : undefined}
    >
      <LineBubbleIcon size={iconSize} />
      <span>{text}</span>
    </a>
  );
};

export default LineEntryButton;
