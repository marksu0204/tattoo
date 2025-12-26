
import liff from '@line/liff';
import { User, UserRole } from '../types';

// 您的 LINE LIFF ID
const MY_LIFF_ID: string = '2008577726-oMLazLyj'; 

// 【進階設定】您的 LINE User ID (U開頭的字串)
// 填入這裡後，該 LINE 帳號登入將直接擁有「管理員權限」
// 如何取得？請看 Console (F12) 印出的黃色訊息
const ADMIN_LINE_USER_ID: string = 'U3f776ca26872cbdf129ab2ca59f863ab'; // 例如: 'U1234567890abcdef1234567890abcdef'

export const lineService = {
  // Initialize LIFF
  init: async (): Promise<User | null> => {
    try {
      if (!MY_LIFF_ID || MY_LIFF_ID === 'YOUR_LIFF_ID_HERE') {
        console.warn('LIFF ID is not set yet. LINE Login will not work.');
        return null;
      }

      await liff.init({ liffId: MY_LIFF_ID });

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        
        // 幫您印出 ID，方便您設定管理員
        console.log(`%c🔑 您的 LINE User ID 是: ${profile.userId}`, 'color: yellow; font-size: 14px; background: black; padding: 4px;');

        // 判斷是否為超級管理員
        const role = (profile.userId === ADMIN_LINE_USER_ID) ? UserRole.ADMIN : UserRole.MEMBER;

        return {
          id: profile.userId,
          name: profile.displayName,
          avatarUrl: profile.pictureUrl,
          role: role,
          lineUserId: profile.userId
        } as User;
      }
      return null;
    } catch (error) {
      console.error('LIFF Init Error:', error);
      return null;
    }
  },

  // Trigger Login
  login: () => {
    if (!MY_LIFF_ID || MY_LIFF_ID === 'YOUR_LIFF_ID_HERE') {
      alert('請先在 src/services/lineService.ts 設定您的 LINE LIFF ID，然後重新打包上傳！');
      return;
    }

    try {
      if (!liff.id) { 
        alert('LINE 初始化失敗 (liff.id 為空)，請檢查 Console 錯誤訊息');
        return;
      }

      if (!liff.isLoggedIn()) {
        liff.login();
      }
    } catch (error) {
      console.error('LIFF Login Error:', error);
      alert('無法啟動 LINE 登入，請檢查 Console 錯誤訊息');
    }
  },

  // Logout
  logout: () => {
    if (liff.id && liff.isLoggedIn()) {
      liff.logout();
    }
  }
};
