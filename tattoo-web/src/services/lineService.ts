
import liff from '@line/liff';
import { User, UserRole } from '../types';

type InitSettledListener = () => void;

let initSettledForLiffId: string | null | undefined;
let liffInitSettled = false;
const initSettledListeners = new Set<InitSettledListener>();

function notifyInitSettled() {
  initSettledListeners.forEach((listener) => listener());
}

function markLiffInitSettled(liffId: string | null | undefined) {
  initSettledForLiffId = liffId;
  liffInitSettled = true;
  notifyInitSettled();
}

export const lineService = {
  init: async (liffId: string | null | undefined): Promise<User | null> => {
    if (initSettledForLiffId !== liffId) {
      liffInitSettled = false;
      initSettledForLiffId = liffId;
    }

    try {
      if (!liffId) {
        console.warn('LIFF ID is not configured for this brand. LINE Login will not work.');
        return null;
      }

      await liff.init({ liffId });

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();

        return {
          id: profile.userId,
          name: profile.displayName,
          avatarUrl: profile.pictureUrl,
          role: UserRole.MEMBER,
          lineUserId: profile.userId,
        } as User;
      }
      return null;
    } catch (error) {
      console.error('LIFF Init Error:', error);
      return null;
    } finally {
      markLiffInitSettled(liffId);
    }
  },

  /** True once App's single LIFF init attempt has settled for this liffId (UX signal only). */
  isLiffInitSettled: (liffId: string | null | undefined): boolean => {
    if (!liffId?.trim()) {
      return true;
    }
    return liffInitSettled && initSettledForLiffId === liffId;
  },

  onLiffInitSettled: (listener: InitSettledListener): (() => void) => {
    initSettledListeners.add(listener);
    return () => {
      initSettledListeners.delete(listener);
    };
  },

  login: (liffId: string | null | undefined, redirectUri?: string) => {
    if (!liffId) {
      alert('LINE Login 尚未設定');
      return;
    }

    try {
      if (!liff.id) {
        alert('LINE 初始化失敗 (liff.id 為空)，請檢查 Console 錯誤訊息');
        return;
      }

      if (!liff.isLoggedIn()) {
        if (redirectUri) {
          liff.login({ redirectUri });
        } else {
          liff.login();
        }
      }
    } catch (error) {
      console.error('LIFF Login Error:', error);
      alert('無法啟動 LINE 登入，請檢查 Console 錯誤訊息');
    }
  },

  logout: () => {
    if (liff.id && liff.isLoggedIn()) {
      liff.logout();
    }
  },

  /** Short-lived LIFF session token — send to backend only, never persist. */
  getAccessToken: (): string | null => {
    try {
      if (!liff.id || !liff.isLoggedIn()) {
        return null;
      }
      const token = liff.getAccessToken();
      return token && token.trim() !== '' ? token : null;
    } catch {
      return null;
    }
  },
};
