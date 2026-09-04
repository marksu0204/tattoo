# INKFLOW 專案開發交接文件

> 給 Codex / 後續開發者使用的唯讀盤點與交接紀錄。
> **本文件不取代正式 runbook；動態行為以程式碼與測試為準。**

---

## 1. 文件資訊

| 項目 | 內容 |
|------|------|
| **最後更新日期** | 2026-09-04 |
| **Repository 路徑** | `C:\Users\Administrator\Desktop\mark-program\TATTOOAPP120260813` |
| **Git branch** | `main`（已由 `.git/HEAD` 與 `git branch --show-current` 確認） |
| **檢查時 commit SHA** | `ba53118823b8657c77e9065d9c11a2a049021c69` |
| **Git 狀態摘要** | `main...origin/main [ahead 1]`；工作區含大量已修改與未追蹤檔案（見 §20） |
| **文件整理範圍** | 靜態唯讀盤點：`tattoo-web/`（前端）、`tattoo-web api/`（PHP API）、根目錄 `.agents/` |
| **尚未動態驗證** | 未在本任務中啟動 Vite / PHP server / Playwright；未連線 production DB；未執行 deploy |

**資訊可信度標記（全文適用）：**

- ✅ **已由程式碼確認**
- 📄 **由既有文件／聊天提供，尚未由程式碼確認**
- ❓ **尚待確認**
- 🚧 **規劃中，尚未實作**

---

## 2. 專案用途

**✅ 已由程式碼確認（綜合 UI 文案、路由、API action）：**

INKFLOW 是一套**多品牌刺青工作室**的公開網站 + 會員／管理後台系統，目前程式碼中可見品牌：

| 品牌 code | 公開網域（bootstrap） | 狀態線索 |
|-----------|----------------------|----------|
| `whitehorn` | `inkflow.work` | `isActive: true`（frontend bootstrap） |
| `gujiguji` | `gujiguji.inkflow.work` | bootstrap `isActive: false`；DB 為 runtime 權威 |

**核心使用者與流程：**

1. **訪客／潛在客戶**：瀏覽認領圖作品集 → 作品詳情 → LINE／Instagram 聯繫 →（可選）2D 刺青預覽
2. **LINE 會員**：LIFF 登入 → 收藏作品 → 預約行事曆 → 個人資料
3. **管理員**：後台管理作品、預約、會員、LINE 推播、Analytics V2、會員成長、Meta 廣告 CSV、品牌設定

**❓ 尚待確認：** 完整商業 KPI、定價策略、線下作業 SOP（程式碼僅反映系統能力，非營運文件）。

---

## 3. 技術架構

| 層級 | 技術 | 版本／備註 | 依據 |
|------|------|------------|------|
| 前端框架 | React | `^19.2.0` | ✅ `tattoo-web/package.json` |
| 語言 | TypeScript | `~5.9.3` | ✅ `package.json` |
| 建置 | Vite | `^7.3.2` | ✅ `package.json` |
| 路由 | react-router-dom | `^7.9.6` | ✅ `package.json` |
| CSS | Tailwind CSS | `^4.1.17` + PostCSS | ✅ `package.json`, `tailwind.config.js` |
| 3D | three, @react-three/fiber, @react-three/drei | ✅ `package.json` |
| LINE | @line/liff | `^2.27.3` | ✅ `package.json` |
| AI（後台工具） | @google/genai | ✅ `geminiService.ts` |
| 後端 | PHP + PDO | 單檔入口 `api.php` | ✅ |
| 資料庫 | MySQL / MariaDB | ❓ 本機是否用 SQLite 僅限 PHP unit tests |
| 套件管理 | **npm** | ✅ `package-lock.json` 存在 |
| 單元測試（前端） | Vitest | `^4.1.10` | ✅ |
| E2E（可選） | Playwright | devDependency | ✅；專案 Skill 提及 |
| Hosting 線索 | Apache + `.htaccess` SPA fallback | ✅ `public/.htaccess` |
| 私有設定 | Cloudways `private_html/inkflow_private_config.php` | ✅ example 檔 |

---

## 4. Repository 目錄導覽

```
TATTOOAPP120260813/
├── docs/                          ← 本交接文件（根目錄）
├── AGENTS.md                      ← Codex 精簡規則
├── .agents/skills/                ← 專案 Skill（見 §16）
├── tattoo-web/                    ← React 前端
│   ├── src/
│   │   ├── App.tsx, main.tsx      ← 路由與入口
│   │   ├── pages/                 ← 頁面
│   │   ├── components/            ← UI（含 AnalyticsTab、MemberGrowthPanel）
│   │   ├── services/              ← mockBackend(API)、tracking、lineService
│   │   ├── context/               ← BrandContext、AdminBrandContext
│   │   ├── hooks/                 ← usePageSeo
│   │   ├── utils/                 ← attribution、SEO、brand、analytics 工具
│   │   └── config/                ← brands bootstrap、3D prototype 設定
│   ├── public/                    ← 靜態資源、.htaccess、robots.txt
│   ├── dist/                      ← build 產物（勿手改）
│   ├── vite.config.ts
│   ├── package.json
│   └── build.ps1                  ← Windows 中文路徑建置 workaround
└── tattoo-web api/                ← PHP 後端
    ├── api.php                    ← 主 API 入口（~4300+ 行）
    ├── analytics_v2_period.php
    ├── includes/                  ← 模組化 PHP（32+ 檔）
    ├── tests/                     ← PHP 邏輯／安全測試（26 檔）
    ├── private/                   ← 設定範例（非 secret）
    └── migrations/                ← 存在；詳細清單 ❓ 尚待確認
```

**刻意不列：** `node_modules/`、`node_modules_old/`、大量 `uploads/` 圖片、`dist_old/` 等。

---

## 5. 本機開發方式

**✅ 由 `tattoo-web/package.json` 確認的指令：**

| 指令 | 用途 |
|------|------|
| `npm install` | 安裝前端依賴（標準 npm；未在 repo 定義其他 package manager） |
| `npm run dev` | 啟動 Vite dev server |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | ESLint |
| `npm run test` | `vitest run`（`src/**/*.test.ts`） |
| `npm run preview` | Vite preview |

**預設 dev port：** ❓ 未在 `vite.config.ts` 覆寫 → Vite 預設 **5173**（✅ 後端 CORS 允許 `localhost:5173`）

**PHP / API 本機需求：**

- 前端 `mockBackend.ts` 以 **`/api.php`** 為 API URL（相對路徑）
- ✅ 需 Web server 將 `tattoo-web api/api.php` 暴露為同網域 `/api.php`（Apache 部署模式）
- ❓ 本機 PHP 內建 server 指令**未**在 repo 定義；請依團隊慣例配置

**Windows 注意事項：**

- ✅ `tattoo-web/build.ps1`：因中文路徑可能導致 Rollup/esbuild 崩潰，會 robocopy 到 `C:\tattoo-web-build` 再 build

**PHP 測試（範例）：**

```bash
cd "tattoo-web api"
php tests/member_lifecycle_test.php
php tests/member_acquisition_attribution_test.php
php tests/security_final_reachable_api_test.php
```

---

## 6. 環境與設定

### 6.1 前端環境變數（名稱 only）

| 變數名 | 用途 | 來源 |
|--------|------|------|
| `VITE_META_PIXEL_ID` | Meta Pixel ID | ✅ `tracking.ts` 讀取 |
| `import.meta.env.PROD` / `DEV` | 追蹤 debug 行為 | ✅ Vite 內建 |

**❓ 尚待確認：** 是否還有其他 `VITE_*`（未開啟 `.env*`；`tattoo-web/.env.production` 在 git status 為 untracked）

### 6.2 後端私有設定（名稱 only）

**✅ 由 `tattoo-web api/private/inkflow_private_config.example.php` 確認：**

| Key | 用途 |
|-----|------|
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | 首次 SUPER_ADMIN bootstrap（非日常登入） |
| `INKFLOW_RATE_LIMIT_HMAC_SECRET` | Rate limit HMAC |
| `INKFLOW_TRUSTED_PROXY_CIDRS` | 信任 proxy CIDR |
| `LINE_LOGIN_CHANNEL_ID_WHITEHORN`, `LINE_LOGIN_CHANNEL_ID_GUJIGUJI` | LIFF Login |
| `LINE_CHANNEL_TOKEN_*`, `LINE_CHANNEL_SECRET_*` | Messaging API / Webhook |

**部署路徑（example 註解）：** `{app-root}/private_html/inkflow_private_config.php`

### 6.3 環境分類

| 設定 | 本機 | 測試 | 正式 | 備註 |
|------|------|------|------|------|
| Vite env | ✅ | ❓ | ✅ `.env.production` 存在但未追蹤 | 不讀取實際值 |
| Private PHP config | ❓ | ❓ | ✅ Cloudways | example 在 repo |
| GA4 Measurement ID | ✅ 寫在 `index.html` | 同左 | 同左 | 公開 client ID |

---

## 7. 前端架構

### 7.1 入口與 Router

**✅ 確認檔案：** `src/main.tsx`, `src/App.tsx`

- `main.tsx`：legacy hash 正規化、`captureUtmParams()`、`initTracking()`、條件式 `trackPageView()`
- `App.tsx`：`BrandProvider` → 品牌閘道 → `BrowserRouter`

**路由表（lazy pages）：**

| Path | Page | 備註 |
|------|------|------|
| `/` | Home | 作品集 |
| `/artwork/:id` | ArtworkDetail | |
| `/login` | Login | LINE LIFF |
| `/aftercare` | Aftercare | 保養須知 |
| `/preview` | TattooPreview | 2D 刺青預覽 |
| `/3d-preview-test` | Tattoo3DPreviewTest | 3D prototype |
| `/consent`, `/consent/:appointmentId` | ConsentForm | |
| `/appointment`, `/appointment/:appointmentId` | AppointmentView | 敏感公開路由 |
| `/calendar` | CalendarPage | 需登入 |
| `/profile` | UserProfile | 需登入 |
| `/admin` | AdminDashboard | 需 ADMIN + `AdminBrandProvider` |
| `*` | NotFound | |

### 7.2 State 管理

| 機制 | 用途 |
|------|------|
| `AppContext`（App.tsx） | 會員 user、login/logout、LIFF sync |
| `BrandContext` | 公開品牌設定（API merge） |
| `AdminBrandContext` | 後台 effective brand、SUPER_ADMIN 切換 |
| `localStorage` | `inkflow_user`、admin token／identity（見 `adminAuth.ts`） |
| `sessionStorage` | UTM（`inkflow_utm`）、analytics session（`inkflow_session_id`） |

### 7.3 API Service

**✅ 主檔：** `src/services/mockBackend.ts` → `fetch('/api.php?action=...')`

其他：`lineService.ts`（LIFF）、`tracking.ts`（GA/Meta）、`bookingAnalytics.ts`、`geminiService.ts`、`tattoo3dUploadApi.ts`

### 7.4 Responsive / 素材

- ✅ `viewport` 禁止 user-scale（`index.html`）
- ✅ `publicAssetUrl.ts`、`compressPngForUpload.ts` 等處理公開 URL／上傳

---

## 8. 後端與 API

### 8.1 入口

**✅ 單一主入口：** `tattoo-web api/api.php`

- Query：`?action=<name>`
- 早期 handler（switch 外）：`lineWebhook`、`trackOpen`、`sitemap`
- **Switch cases：82 個**（✅ 靜態 grep 計數）
- **可路由 action 總計：85**

### 8.2 Action 摘要表（分類）

| 類別 | Actions（摘錄） | Auth |
|------|-----------------|------|
| 公開品牌 | `getPublicBrandContext`, `getPublicBrandConfig` | Host brand |
| Admin 登入／上下文 | `adminLogin`, `getAdminContext`, admin users CRUD | Bearer admin token |
| 作品 | `getArtworks`, `getArtwork`, `saveArtwork`, `deleteArtwork`, `recordView`, `recordArtworkEvent` | 混合 |
| 預約 | `getAppointments`, `saveAppointment`, `completeAppointment`, … | Admin / member |
| 會員 | `syncUser`, `toggleFavorite`, `getUserAppointments` | LINE token |
| Analytics | `getAnalytics`, `getAnalyticsV2`, `getMemberGrowthAnalytics`, labels CRUD | Admin |
| LINE 推播 | `sendLineBroadcast`, audience preview, history | Admin |
| Meta 廣告 | CSV preview/import, attribution daily, export | Admin |
| Webhook | `lineWebhook`（簽章驗證） | LINE signature |

**完整 82 action 清單：** 見 explore 盤點結果或 `api.php` `case` 區塊。

### 8.3 認證模型

| 類型 | 機制 | 檔案 |
|------|------|------|
| 公開 API | HTTP Host → brand（`brand_context.php`） | ✅ |
| LINE 會員 | `lineAccessToken` → LINE verify → server userId | `line_login.php`, `syncUser` |
| Admin | Bearer token → `admin_sessions` | `admin_auth.php` |
| Admin brand scope | Header `X-Inkflow-Admin-Brand` + server 驗證 | `adminFetch.ts`, PHP |

### 8.4 錯誤處理

- JSON `{ error: '...' }` + HTTP status（401/403/503 等）
- `handleResponse()` 解析 PHP 回應（前端）
- Rate limit / lock lifecycle（admin login）

---

## 9. 資料庫

> **僅依 migration／CREATE TABLE／PHP 推斷；未連線 production。**

### 9.1 核心資料表

| 資料表 | 用途 | PK / 重要約束 |
|--------|------|----------------|
| `brands` | 多品牌 | `id`; `code` unique（bootstrap seed） |
| `users` | LINE 會員 | `id` (LINE userId); `brand_id`; **`first_seen_at` NULL=legacy** |
| `artworks` | 認領圖 | `id`; `brand_id` |
| `artwork_events` | Analytics 事件流水 | `id`; **`event_id` UNIQUE**; `session_id`; UTM 欄位 |
| `appointments` | 預約 | `brand_id`; public token 欄位（migration） |
| `line_friend_events` | LINE follow/unfollow log | **`line_event_id` UNIQUE** |
| `member_acquisition_attributions` | 新會員 first-touch attribution | **`UNIQUE(brand_id,user_id)`** immutable |
| `admin_users`, `admin_sessions`, `admin_brand_access` | 後台帳號 | email unique; token_hash unique |
| `member_tags`, `user_tags` | CRM 標籤 | |
| `line_broadcasts`, `line_broadcast_recipients`, `line_broadcast_clicks` | LINE 推播 | idempotency index（brand-scoped migration） |
| `analytics_labels` | Source/Campaign/Content 命名 | brand-scoped |
| `meta_ad_daily`, `meta_ad_imports` | Meta 廣告 CSV | brand-scoped |
| `availability_windows` | 可預約時段 | |

### 9.2 `artwork_events` 重要欄位（✅ api.php migration）

`event_id`, `session_id`, `brand_id`, `utm_*`, `meta_campaign_id`, booking 相關欄位, `created_at`

### 9.3 `member_acquisition_attributions`（✅ includes/member_acquisition_attribution.php）

`session_id`, UTM 欄位, `touch_at`, `attribution_method`, `confidence`; **無 PII**

---

## 10. 使用者角色與權限

| 角色 | 前端 | 後端驗證 |
|------|------|----------|
| **訪客** | 瀏覽公開頁 | Host brand guard |
| **LINE 會員** | `/calendar`, `/profile`, 收藏 | `syncUser` LINE token；favorites 需 token |
| **ADMIN** | `/admin` 入口（前端 role 檢查） | `requireAdmin()` + brand effective ID |
| **SUPER_ADMIN** | 品牌切換 UI | `is_super_admin` + `getAdminContext` |
| **BRAND_ADMIN** | 單品牌後台 | `admin_brand_access` |

**⚠️ 潛在風險（需改動時复查）：** 任何僅前端隱藏但 API 未驗證的路由；以 `security_*_test.php` 為 regression gate。

**✅ `getAnalyticsV2` vs `getMemberGrowthAnalytics`：** 前者 SUPER_ADMIN；後者 BRAND_ADMIN 可讀（依 prior implementation）。

---

## 11. 核心功能流程

> 本節的「已實作」表示可在程式碼中找到對應頁面與 API；本次未執行動態或端到端驗收，不代表正式環境已驗收完成。

| 流程 | 狀態 | 證據 |
|------|------|------|
| 瀏覽認領圖／Home | ✅ 已實作（本次未動態驗證） | `Home.tsx`, `getArtworks` |
| 作品詳情／價格尺寸 | ✅ 已實作（本次未動態驗證） | `ArtworkDetail.tsx`, artworks 欄位 migration |
| 收藏 | ✅ 已實作（本次未動態驗證） | `toggleFavorite` |
| LINE／IG 聯繫 | ✅ 已實作（本次未動態驗證） | `trackArtworkContact`, artwork_events |
| LINE 會員登入 | ✅ 已實作（本次未動態驗證） | LIFF + `syncUser` |
| 預約／行事曆 | ✅ 已實作（本次未動態驗證） | `CalendarPage`, appointments API |
| 後台作品管理 | ✅ 已實作（本次未動態驗證） | `AdminDashboard` |
| Analytics V2 後台 | ✅ 已實作（本次未動態驗證） | `AnalyticsTab.tsx`, `getAnalyticsV2` |
| 會員成長 KPI | ✅ 已實作（本次未動態驗證） | `MemberGrowthPanel`, `getMemberGrowthAnalytics` |
| Member acquisition attribution | ✅ 資料基礎（無 UI） | `member_acquisition_attribution.php`, syncUser hook |
| 2D 刺青預覽 | ✅ 已實作（本次未動態驗證） | `TattooPreview.tsx` |
| 3D 預覽 | 🚧 prototype | `Tattoo3DPreviewTest.tsx`, admin upload API |
| 折價券／CRM 完整流程 | 🚧 規劃中 | 僅見 member_tags；無 coupon 表 |
| 客製圖手動開單 | ❓ 尚待確認 | 可能有 appointment 手動建立；無獨立「開單」模組名 |

---

## 12. Analytics 與廣告追蹤

### 12.1 GA4（✅ 程式碼確認）

- **載入：** `index.html` gtag.js（Measurement ID 寫於 HTML）
- **事件：** `tracking.ts` → `trackGaEvent()`
  - 作品瀏覽：`view_item`
  - 聯繫：`generate_lead`
- **敏感路由：** appointment/consent + token hash → 關閉 auto page_view

### 12.2 Meta Pixel（✅）

- Env：`VITE_META_PIXEL_ID`
- 作品瀏覽：`ViewContent`
- 聯繫：`Contact`
- 初始化：`initTracking()` / `fbq`

### 12.3 去重與 correlation

| 機制 | 用途 |
|------|------|
| `trackOnce` + `dedupeSet` | 前端事件去重 |
| `contactLockMap`（1200ms） | 聯繫雙击防重 |
| `event_id` UUID | 後端 artwork_events 冪等 |
| `session_id` UUID | sessionStorage；同步至 API |
| UTM | `captureUtmParams()` → sessionStorage → events / syncUser acquisitionContext |

### 12.4 Analytics V2（後台）

- ✅ Server-side session 漏斗、UTM attribution dimensions、Meta CSV 匯入
- ✅ `AnalyticsTab`：網站分析 / 會員成長 / Meta 廣告資料

### 12.5 規劃中（不可寫成已完成）

- 🚧 Acquisition attribution **Dashboard**（資料表已有，UI 刻意未做）
- 🚧 完整「廣告 → 新會員 → booking」漏斗報表

---

## 13. 已完成、開發中與待辦

### 13.1 已由程式碼確認完成

- 多品牌 Host 解析 + DB presentation merge
- Analytics V2 + booking funnel events
- Member Growth Dashboard V1
- Member lifecycle（`first_seen_at`, `line_friend_events`）
- Member acquisition attribution foundation（syncUser capture）
- LINE Broadcast V2（messages JSON, audience filter）
- Admin 帳號／品牌設定／安全 phase tests
- 前端 Vitest utils 測試（16 檔）

### 13.2 已實作但仍需驗證

- Member Growth Panel request loop hotfix（`memberGrowthFetch.ts`）
- Vitest exclude `node_modules_old`
- 3D prototype 校正／上傳流程（需實機／資產）

### 13.3 尚未完成或暫停

- ❓ Git 工作區大量 untracked 檔案整理
- GUJIGUJI 品牌正式 activation（bootstrap inactive）

### 13.4 未來規劃

- 🚧 客製圖手動開單（若指獨立 workflow）
- 🚧 折價券／完整 CRM
- 🚧 Acquisition attribution 報表 UI
- 🚧 作品頁轉換率 A/B（未見程式）

---

## 14. 已知問題與技術債

| 問題 | 影響 | 證據 | 建議 | 需動態測試 |
|------|------|------|------|------------|
| Windows 中文路徑 build 問題 | 本機 build 失敗 | `build.ps1` | 使用英文暫存路徑 | 是 |
| `node_modules_old/` 存在 | Vitest 掃描風險 | vite.config exclude | 刪除或 ignore | 是 |
| 工作區 untracked 與 modified 混雜 | 部署／交接混淆 | git status | 整理 .gitignore / commit 策略 | 否 |
| `api.txt`、根目錄 `inkflow_private_config.php` untracked | 根目錄檔目前未追蹤、未被 ignore，且不是目前程式引用的正式位置；未檢查內容，視為疑似敏感檔 | git status、`includes/private_config.php` 引用路徑 | 禁止加入版本控制；由使用者確認來源與處置 | 否 |
| `tsconfig.app.json` strict: false | 型別安全 | tsconfig | 漸進收紧 | 否 |
| Request-time DB migration 於 api.php | MariaDB metadata 風險歷史 | 註解 L687+ | 重大 schema 改用手動 migration | 是 |
| 3D prototype 複雜度高 | 維護成本 | Tattoo3DPreviewTest.tsx 1300+ 行 | 文件化／拆分 | 是 |

---

## 15. 安全限制

1. **不得** commit `.env*`、private config 實檔、`api.txt` 等含 secret 的檔案
2. **不得**在文件、log、測試 artifact 輸出 token／password／cookie
3. **正式** DB 寫入、deploy、推播發送需使用者明確授權
4. 測試優先：localhost、PHP sqlite tests、Vitest unit tests
5. **不得**任意 kill 不明程序（Playwright skill 亦要求）
6. 修改資料前說明影響與 rollback

---

## 16. 已安裝的專案 Skill

**路徑：** `.agents/skills/`（✅ repo 根目錄存在）

| Skill | 觸發用途 | 不應觸發 | 安全限制 |
|-------|----------|----------|----------|
| **inkflow-webapp-testing** | 使用者明確要求 Playwright 自動化測試 | 一般 UI 檢視、production、真實訂單／付款 | 僅 localhost；禁 `.env*`；禁未授權 mutating test |
| **safe-algorithmic-art** | 明確要求 p5.js／generative art | Midjourney、一般修圖、未要求之 INKFLOW 整合 | 不擅自改 production；禁 shell 自動化 |

**Reference：** 各 Skill 內 `references/*.md`

**✅ 已確認：** 目前只有上述兩個 Skill 子目錄，共 8 個 Markdown 檔案。

---

## 17. 建議開發流程（Codex）

1. **唯讀分析** — 讀本文件 + 相關原始碼
2. **實作計畫** — 列檔案、API、測試影響
3. **確認範圍** — 等使用者批准（尤其 DB／deploy）
4. **小步修改** — 最小 diff
5. **執行檢查** — `tsc -b`, `vitest`, 相關 PHP tests
6. **Git diff** — 確認無意外檔案
7. **回報** — 已驗證 vs 未驗證
8. **commit / push / deploy** — 僅在使用者明確要求後

---

## 18. 新工作階段交接清單

- [ ] Repository 是否為 `TATTOOAPP120260813`
- [ ] `git status` / branch / 是否 ahead of origin
- [ ] 先讀 `docs/INKFLOW_PROJECT_HANDOFF.md` + `AGENTS.md`
- [ ] 任務涉及前端／後端／DB／正式環境？
- [ ] 是否允許修改程式 vs 僅文件
- [ ] 是否允許執行 tests / build
- [ ] 是否涉及 migration 或 production deploy
- [ ] 完成條件與 regression gates 為何

---

## 19. 重要檔案索引

| 路徑 | 功能 | 修改注意 |
|------|------|----------|
| `tattoo-web/src/App.tsx` | 路由、AppContext | 影響全站導航 |
| `tattoo-web/src/services/mockBackend.ts` | 所有 API 呼叫 | action 名稱需與 PHP 一致 |
| `tattoo-web/src/services/tracking.ts` | GA4/Meta | 勿破壞去重；敏感路由 |
| `tattoo-web/src/utils/attribution.ts` | UTM + acquisitionContext | sessionStorage 契約 |
| `tattoo-web/src/components/AnalyticsTab.tsx` | 後台分析 UI | 與 MemberGrowthPanel 分離 fetch |
| `tattoo-web api/api.php` | API 路由 + migrations | 極大檔；小心 switch case |
| `tattoo-web api/includes/member_lifecycle.php` | first_seen_at 語意 | **不可**随意改 write-once 規則 |
| `tattoo-web api/includes/member_acquisition_attribution.php` | 新會員 attribution | immutable；fail-open |
| `tattoo-web api/includes/admin_auth.php` | 後台權限 | 安全敏感 |
| `tattoo-web api/includes/brand_context.php` | Host brand | 多品牌隔離 |
| `tattoo-web/vite.config.ts` | build + vitest | test include/exclude |

---

## 20. 尚待人工確認

1. Production deploy 正式步驟與 Cloudways 路徑對照
2. 本機 PHP 環境如何與 Vite proxy 串接（若有的話）
3. `tattoo-web/.env.production` 內有哪些 `VITE_*`（**勿貼值**）
4. `migrations/` 目錄完整清單 vs request-time migration 分工
5. Git 工作區大量 untracked 檔案哪些應保留／忽略／提交
6. GUJIGUJI 正式上線時間與 `brands.is_active` 操作方式
7. 是否有独立 staging 環境
8. 「客製圖手動開單」是否指現有 appointment 流程或新需求
9. Playwright E2E 是否已設定 config 檔（devDependency 存在；config ❓）
10. 根目錄 `inkflow_private_config.php` 目前未追蹤、未被 ignore，且不是目前程式引用的正式位置；在未檢查內容的前提下視為疑似敏感檔，禁止加入版本控制，後續必須由使用者確認來源與處置

---

*文件結束 — 如有程式碼變更，請更新 §1 commit SHA 與相關章節。*
