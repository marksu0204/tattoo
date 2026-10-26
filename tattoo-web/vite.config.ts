/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * 本機開發（npm run dev）時，把 /api.php 與 /uploads 轉送到正式站。
 * - 只影響 dev server，不影響 npm run build 的產物。
 * - 注意：後端與資料庫是「正式環境」，在本機按儲存／上架／推播都會寫入正式資料。
 * - 可用環境變數 INKFLOW_DEV_API_TARGET 改成其他後端（例如 staging）。
 */
const DEV_API_TARGET = process.env.INKFLOW_DEV_API_TARGET || 'https://inkflow.work';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    proxy: {
      '/api.php': { target: DEV_API_TARGET, changeOrigin: true, secure: true },
      '/uploads': { target: DEV_API_TARGET, changeOrigin: true, secure: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/node_modules_old/**', 'dist/**'],
  },
});
