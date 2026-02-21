# AI 網紅工具台

多頁式前端工具（HTML/CSS/TypeScript），目前包含：
- 增長儀表板（使用漏斗前兩層平台，不寫死 Threads / LINE）
- KPI 管理
- 內容素材庫（可記錄人設、Prompt、腳本與其他資訊）
- 全平台 JSON 存檔（匯出 / 載入）
- 跨平台增長 PDF 報告（一鍵匯出）

## 功能總覽

### 1) 增長儀表板
- 內含 3 個子頁：
  - 數據看板
  - 資料管理中心
  - KPI 管理
- 新增紀錄已整合到「新增快照」，只需單一入口輸入
- 欄位：時間、第一層平台、第二層平台、備註（平台名稱由漏斗設定決定）
- KPI：最新轉換率、區間平均轉換率、第一層增長率、第二層增長率（名稱動態）
- 圖表：
  - 粉絲增長趨勢圖（單平台 / 多平台比較切換、平台可選）
  - 整體轉換率趨勢圖（柱狀圖，單位：天）
  - 全圖支援縮放/平移與點擊定位表格
  - 整體轉換率 Y 軸預設 0% ~ 100%，且不低於 0%
- 一鍵匯出 PDF 報告（中文內容，獨立於圖表區）
  - 內容包含：角色編號、統計區間、重點 KPI、平台摘要、兩張趨勢圖、紀錄表格
  - 紀錄為可視化表格（欄位、格線、分頁）
  - 若字型載入失敗，會自動改用離線畫布方式匯出，不中斷流程
- 備註事件線：
  - 全域開關
  - 每筆可獨立開關
  - Hover 聚焦（暗化背景，只顯示該事件線）
- 列表功能（已與漏斗快照列表整合）：
  - 升冪/降冪排序
  - 關鍵字搜尋
  - 全部刪除（含二次確認）
  - 不顯示「漏斗快照摘要」與逐筆轉換率（避免噪音）

### 2) 資料輸入與階層設定（整合於資料管理中心）
- 可自訂平台階層（不限 Threads / LINE）
- 新增快照（時間 + 各平台人數 + 備註）
- 自動計算：
  - 各層級轉換率（A→B）
  - 整體轉換率（第一層→最後一層）
- 列表功能：
  - 關鍵字搜尋
  - 快照與舊紀錄會合併按時間顯示

### 3) KPI 管理
- 新增 / 編輯 / 刪除 KPI
- 欄位：名稱、目標值、關聯數據來源、單位、截止日、備註
- 目前值由紀錄自動同步（不需手動輸入）
- 自動計算進度百分比
- 列表功能：
  - 關鍵字搜尋
  - 全部刪除（含二次確認）

### 4) 內容素材庫
- 新增 / 編輯 / 刪除素材
- 欄位：名稱、類型、標籤、參考連結、內容
- 版型：左側素材列表 + 右側內容瀏覽卡
- 參考連結：
  - 只接受 `http/https`
  - 在瀏覽卡可直接點擊
- 列表功能：
  - 關鍵字搜尋
  - 全部刪除（含二次確認）

### 5) 全平台存檔
- 角色編號為必填，未填不得匯出
- 匯出檔名格式（可排序）：
  - JSON：`角色編號_全平台存檔_YYYY-MM-DD_HH-mm-ss.json`
  - PDF：`角色編號_跨平台增長報告_YYYY-MM-DD_HH-mm-ss.pdf`
- PDF 匯出使用「目前使用者設定區間」的增長資料
- 載入前會：
  - 先檢查是否有未存檔變更
  - 詢問是否先匯出
  - 明確確認「會先清空再載入」
- 載入行為：先清空目前資料，再匯入新資料（避免混雜）

## 專案結構

- `index.html`：多頁 UI（首頁、儀表板、素材庫）
- `style.css`：全站樣式
- `app.ts`：主要邏輯原始碼（TypeScript）
- `app.js`：由 `app.ts` 編譯輸出，供瀏覽器直接載入
- `tsconfig.json`：TypeScript 編譯設定
- `package.json`：TypeScript build/typecheck script
- `sw.js`：Service Worker 快取
- `vendor/chart.umd.min.js`：Chart.js
- `vendor/chartjs-plugin-zoom.min.js`：Chart.js zoom plugin
- `vendor/hammer.min.js`：手勢支援
- `vendor/jspdf.umd.min.js`：PDF 匯出

## 啟動方式

```bash
cd /Users/wise/Documents/rklabs/rklabs
python3 -m http.server 5173 --bind 127.0.0.1
```

開啟：
- http://127.0.0.1:5173

## TypeScript 開發

```bash
cd /Users/wise/Documents/rklabs/rklabs
npm install
```

常用指令：

```bash
npm run build      # app.ts -> app.js
npm run typecheck  # 型別檢查（不輸出）
npm run watch      # 邊改邊編譯
```

目前為漸進轉換第一階段，`app.ts` 已作為主維護檔案；後續可逐步補齊嚴格型別。

## 路由

- `#home`：首頁
- `#dashboard-board`：增長儀表板 - 數據看板
- `#dashboard-records`：增長儀表板 - 資料管理中心
- `#dashboard-kpi`：增長儀表板 - KPI 管理
- `#content`：內容素材庫

## 存檔 JSON 格式（平台級）

```json
{
  "platform": {
    "name": "AI Influencer Toolkit",
    "version": 1,
    "exported_at": "..."
  },
  "meta": {
    "date": "YYYY-MM-DD",
    "timezone": "Asia/Taipei",
    "role_id": "Amy"
  },
  "modules": {
    "dashboard": {
      "records": []
    },
    "content_library": {
      "items": []
    },
    "funnel": {
      "stages": [],
      "snapshots": []
    },
    "kpi": {
      "items": []
    }
  }
}
```

也兼容舊格式：
- 直接使用 `records` 的匯入資料

## 已做測試（本地 smoke）

- `npm run build`、`npm run typecheck`
- `node --check app.js`、`node --check sw.js`
- 主要檔案可正常回應（`index.html` / `app.js` / `style.css` / vendor assets）
- DOM 關鍵 ID 與事件綁定對應檢查
- 匯入/匯出、雙模組資料流與清空匯入流程靜態檢查
- PDF 匯出流程靜態檢查（含中文字型路徑與離線降級流程）

## 備註

- 本專案目前未接入自動化 E2E 測試框架。
- 若要加 CI，可建議下一步加入 Playwright 自動測試（匯入/匯出、搜尋、刪除二次確認、路由切換）。
