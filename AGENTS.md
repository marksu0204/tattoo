# INKFLOW — Codex / Agent 專案規則

> 完整交接內容請先閱讀：**[docs/INKFLOW_PROJECT_HANDOFF.md](docs/INKFLOW_PROJECT_HANDOFF.md)**

## 技術棧摘要

- **Frontend：** React 19、TypeScript、Vite 7、Tailwind 4、react-router-dom 7（`tattoo-web/`）
- **Backend：** PHP 單入口 `tattoo-web api/api.php` + `includes/*.php`、MySQL/MariaDB（PDO）
- **Package manager：** npm（`package-lock.json`）
- **Tests：** Vitest（前端 utils）、PHP CLI tests（`tattoo-web api/tests/`）

## 常用指令（先進入 `tattoo-web/`）

```bash
cd tattoo-web
npm install          # 僅在使用者明確授權安裝依賴後執行
npm run dev          # Vite，預設 port 5173
npm run build        # tsc -b && vite build
npm run lint
npm run test         # vitest run
```

Windows 中文路徑建置問題可改用 `tattoo-web/build.ps1`。

PHP 測試範例（`tattoo-web api/`）：

```bash
cd "tattoo-web api"
php tests/member_lifecycle_test.php
php tests/security_final_reachable_api_test.php
```

## 主要目錄

| 路徑 | 說明 |
|------|------|
| `tattoo-web/src/` | React 原始碼 |
| `tattoo-web/src/services/mockBackend.ts` | 前端 API 客戶端 |
| `tattoo-web api/api.php` | 後端 API 入口 |
| `tattoo-web api/includes/` | PHP 模組 |
| `tattoo-web api/tests/` | PHP 測試 |
| `.agents/skills/` | 專案 Skill |

## 開發前必讀

1. **[docs/INKFLOW_PROJECT_HANDOFF.md](docs/INKFLOW_PROJECT_HANDOFF.md)** — 架構、API、DB、權限、Analytics
2. **`git status`** — 保留使用者既有修改，不要覆蓋未提交工作
3. 任務相關的 `includes/*.php` 或 `components/*.tsx`

## 安全與環境

- **不得**讀取、輸出或 commit `.env*`、private config 實值、token、API key、cookie
- **不得**擅自 deploy、連 production DB、或發送真實 LINE 推播
- **不得**未經使用者明確授權安裝或更新依賴
- 環境變數名稱見交接文件 §6；實際值由使用者本機／伺服器提供
- 正式資料庫 migration／deploy 需使用者**明確授權**

## 程式慣例

- **PHP：** 新邏輯優先放 `includes/`；brand 由 server host／admin context 解析，勿信任 client `brand_id`
- **Member lifecycle：** `first_seen_at` write-once；勿 backfill legacy
- **Attribution：** prefer UNKNOWN；`member_acquisition_attributions` immutable
- **React：** lazy routes（`App.tsx`）；品牌用 `BrandContext` / `AdminBrandContext`
- **API 呼叫：** 統一經 `mockBackend.ts`；admin 請求帶 Bearer + brand header
- **Analytics：** UTM 用 `attribution.ts`；事件用 `tracking.ts` + 後端 `artwork_events`

## 測試與驗證

修改後依範圍執行：

- Frontend：`npx tsc -b`、`npx vitest run`、必要時 `npx vite build`
- Backend：相關 `php tests/*_test.php`、`php -l` 語法檢查
- 安全相關改動：跑 `security_*_test.php`

不確定是否通過時，**回報未驗證項目**，不要假設成功。

## Git / Commit / Deploy

- **不要**自動 commit、push、deploy
- 完成後提供 `git diff` 摘要
- 若工作區在任務前已有修改，**保留**並在回報中列出

## 專案 Skill

位置：**`.agents/skills/`**

| Skill | 何時使用 |
|-------|----------|
| `inkflow-webapp-testing` | 使用者**明確要求** Playwright 本機自動化測試 |
| `safe-algorithmic-art` | 使用者**明確要求** p5.js／generative art |

未明確要求時，**不要**啟動 Playwright 或安裝額外瀏覽器依賴。

## 不確定時

- 標示「尚待確認」
- **不要**將規劃中功能寫成已完成
- **不要**猜測 API 欄位、DB constraint 或 production 設定
