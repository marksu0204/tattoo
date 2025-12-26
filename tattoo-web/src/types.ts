
// Mock credentials for Admin
export const ADMIN_CREDENTIALS = {
  email: 'fatedavid@gmail.com',
  password: '$gn01227110'
};

// Replace with your actual LINE ID (without @)
export const LINE_ID = '270vwddw';

// Define types using interfaces/types instead of enums to avoid build errors
export const ArtworkStatus = {
  AVAILABLE: 'AVAILABLE',
  CLAIMED: 'CLAIMED',
} as const;
export type ArtworkStatus = typeof ArtworkStatus[keyof typeof ArtworkStatus];

export const UserRole = {
  GUEST: 'GUEST',
  MEMBER: 'MEMBER', // Logged in via LINE
  ADMIN: 'ADMIN',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pngUrl?: string; // 去背 PNG 檔案，用於刺青預覽功能
  category: string;
  status: ArtworkStatus;
  price?: number; // Original Price
  specialPrice?: number; // Sale Price
  createdAt: string;
  tags: string[];
  viewCount?: number; // 瀏覽次數
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  email?: string;
  lineUserId?: string;
  favorites?: string[]; // Array of Artwork IDs
}

export interface Appointment {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g., "14:00"
  userId?: string; // If null, it's just an open slot
  customerName?: string;
  phoneNumber?: string; // New: Customer Phone Number
  // Status: OPEN (Green), PENDING (Yellow - 待審核), WAITING_PAYMENT (Orange - 待付款), SIGNING (Blue - 簽屬中), SIGNED (Purple - 簽屬完成), BOOKED (Red - 已確認), COMPLETED (Gray - 已完成)
  status: 'OPEN' | 'PENDING' | 'WAITING_PAYMENT' | 'SIGNING' | 'SIGNED' | 'BOOKED' | 'COMPLETED';
  notes?: string;
  // New fields for linking artwork
  artworkId?: string;
  artworkTitle?: string;
  artworkImage?: string;
  // Price fields
  totalPrice?: number; // 總價
  depositPaid?: number; // 已付訂金
  // Consent form fields (後台填寫)
  tattooPosition?: string; // 紋身部位
  tattooSize?: string; // 大小
  tattooColor?: string; // 色彩
  consentNotes?: string; // 其他備註
  // Consent signature fields (客人填寫)
  signatureData?: string; // 簽名圖片 Base64
  signedAt?: string; // 簽署時間
  signerName?: string; // 簽署人姓名
  signerPhone?: string; // 簽署人電話
}
