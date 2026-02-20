# AI 網紅工具台

多頁式前端工具（純 HTML/CSS/JS），目前包含：
- 跨平台增長儀表板（Threads / LINE）
- 內容素材庫（可記錄人設、Prompt、腳本與其他資訊）
- 全平台 JSON 存檔（匯出 / 載入）

## 功能總覽

### 1) 跨平台增長儀表板
- 新增 / 編輯 / 刪除紀錄
- 欄位：時間、Threads、LINE、備註
- KPI：平均轉換率、Threads 增長率、LINE 增長率
- 圖表：雙 Y 軸、縮放/平移、點擊定位表格
- 備註事件線：
  - 全域開關
  - 每筆可獨立開關
  - Hover 聚焦（暗化背景，只顯示該事件線）
- 列表功能：
  - 升冪/降冪排序
  - 關鍵字搜尋
  - 全部刪除（含二次確認）

### 2) 內容素材庫
- 新增 / 編輯 / 刪除素材
- 欄位：名稱、類型、標籤、參考連結、內容
- 版型：左側素材列表 + 右側內容瀏覽卡
- 參考連結：
  - 只接受 `http/https`
  - 在瀏覽卡可直接點擊
- 列表功能：
  - 關鍵字搜尋
  - 全部刪除（含二次確認）

### 3) 全平台存檔
- 角色編號為必填，未填不得匯出
- 載入前會：
  - 先檢查是否有未存檔變更
  - 詢問是否先匯出
  - 明確確認「會先清空再載入」
- 載入行為：先清空目前資料，再匯入新資料（避免混雜）

## 專案結構

- `index.html`：多頁 UI（首頁、儀表板、素材庫）
- `style.css`：全站樣式
- `app.js`：主要邏輯（路由、資料、圖表、存檔）
- `sw.js`：Service Worker 快取
- `vendor/chart.umd.min.js`：Chart.js
- `vendor/chartjs-plugin-zoom.min.js`：Chart.js zoom plugin
- `vendor/hammer.min.js`：手勢支援

## 啟動方式

```bash
cd /Users/wise/Documents/rklabs
python3 -m http.server 5173 --bind 127.0.0.1
```

開啟：
- http://127.0.0.1:5173

## 路由

- `#home`：首頁
- `#dashboard`：跨平台增長儀表板
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
    }
  }
}
```

也兼容舊格式：
- 直接使用 `records` 的匯入資料

## 已做測試（本地 smoke）

- `node --check app.js`、`node --check sw.js`
- 主要檔案可正常回應（`index.html` / `app.js` / `style.css` / vendor assets）
- DOM 關鍵 ID 與事件綁定對應檢查
- 匯入/匯出、雙模組資料流與清空匯入流程靜態檢查

## 備註

- 本專案目前未接入自動化 E2E 測試框架。
- 若要加 CI，可建議下一步加入 Playwright 自動測試（匯入/匯出、搜尋、刪除二次確認、路由切換）。
