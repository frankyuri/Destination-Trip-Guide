# Destination Trip Guide

日本行程。前端使用 React、TypeScript、Vite、Leaflet；後端使用 Express、Prisma 與 PostgreSQL。

## 功能

- 每日時間軸、交通方式與 Google Maps 導航
- Leaflet 地圖與交通類型篩選
- Open-Meteo 16 日天氣預報
- TWD/JPY 匯率換算
- Google Places 附近餐廳（選用）
- 後端代理 Gemini 旅遊提示，API key 不會進入瀏覽器 bundle
- 日本時區 ICS 行事曆匯出
- PWA 離線 app shell 與有限容量地圖 tile cache
- 帳號、旅程、方案、行程與完成進度 API

## 前端開發

```bash
npm ci
copy .env.example .env.local
npm run dev
```

預設網址：`http://localhost:3000/Destination-Trip-Guide/`

常用指令：

```bash
npm run typecheck
npm test
npm run build
npm run check
```

環境變數：

- `VITE_API_BASE_URL`：後端 origin，例如 `http://localhost:3001`
- `VITE_GOOGLE_PLACES_API_KEY`：選用；必須在 Google Cloud 限制 HTTP referrer 與 Places API
- `VITE_BASE_PATH`：部署子路徑，預設 `/Destination-Trip-Guide/`

## 後端開發

```bash
cd backend
npm ci
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Production 必須設定 `DATABASE_URL`、`JWT_SECRET`、`JWT_REFRESH_SECRET`。AI 功能另需 `GEMINI_API_KEY`。建議使用至少 32 個隨機字元且 access/refresh 不同的秘密值。

API 預設網址：`http://localhost:3001/api`。

## 資料庫

Prisma migration 位於 `backend/prisma/migrations`。Seed 直接使用根目錄 `constants.ts` 的 2026 行程，不依賴額外 JSON 目錄。

## 部署

GitHub Actions 會分開執行前端與後端的安裝、型別檢查、驗證與建置。只有 `main` / `master` push 會部署前端到 GitHub Pages；後端需另行部署至可連接 PostgreSQL 的環境，並把網址填入 `VITE_API_BASE_URL` 後重新建置前端。

## 安全注意事項

- 不要把 `.env`、JWT secrets、資料庫 URL 或 Gemini key 提交到 Git。
- Google Places key 是瀏覽器用 key，必須限制允許網域與 API；Gemini key 只能放在後端。
- JSON 匯入會在單一 transaction 內取代指定方案內容，但仍建議先匯出備份。