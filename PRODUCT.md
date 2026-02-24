# FITFORGE — Product Overview

**版本**：v1.1
**網址**：https://fitnesswith47.web.app
**最後更新**：2026-02-25

---

## 產品簡介

FITFORGE 是一款以行動裝置為主的個人健身追蹤 Progressive Web App（PWA）。使用者以 Google 帳號登入後，可隨手記錄每次訓練的動作、組數、重量，追蹤身材數據變化，並透過連續訓練天數挑戰維持長期運動習慣。所有資料即時同步至雲端，跨裝置皆可使用。

**目標用戶**：有固定重訓習慣、想用手機快速記錄訓練的健身愛好者。

---

## 目前已有的功能

### 身份驗證
- Google OAuth 一鍵登入
- 帳號資訊面板（顯示頭像、名稱、Email）
- 登出 / 切換帳號
- In-App 瀏覽器偵測（LINE、Facebook 等），提示用戶至外部瀏覽器開啟

### 儀表板
- 累計訓練天數、累計總組數、當前 BMI 三項統計
- 最新身材數據摘要（體重、胸圍、腰圍、臀圍）
- BMI 色彩分級（過輕 / 標準 / 過重 / 肥胖）與進度條
- 近期 5 筆訓練記錄
- 連續訓練天數（🔥 Streak），連續 3 天以上顯示特殊激勵訊息

### 訓練記錄
- 按分類（胸部、背部、肩部、腿部、手臂、核心、有氧）的動作選擇器（Bottom Sheet）
- 臨時動作名稱輸入（一次性使用，不儲存至自訂清單）
- 多組數管理：動態新增 / 移除組數，每組記錄次數（reps）與重量（kg）
- 訓練備註欄位
- 儲存成功動畫（✓ 已儲存！）
- 儲存後自動更新連續訓練天數

### 快速記錄 FAB
- 右下角固定 `+` 按鈕，全頁可用
- 極簡表單：日期固定為今天（不可改）、動作選擇、多組 reps + weight
- 儲存後顯示綠色「✓ 已儲存！」動畫，Sheet 自動關閉

### 自訂動作管理
- 新增個人專屬訓練動作，儲存至雲端
- 動作改名 / 刪除
- 自訂動作出現在動作選擇器的「★ 我的自訂動作」分類

### 身材數據
- 記錄 7 項身體指標：體重、身高、胸圍、腰圍、臀圍、手臂圍、大腿圍
- 歷史數據列表（最近 5 筆），顯示體重趨勢（↑↓ 與變化量）
- 最新一筆標示「最新」

### 歷史紀錄
- 完整訓練歷史，依建立時間降序排列
- 每筆顯示日期、動作名稱、各組次數與重量標籤、備註

### 活動公告系統
- 透過 Firebase Remote Config 遠端控制彈窗顯示
- 支援標題、內文、按鈕文字自訂
- 支援觸發模式：每次開啟（0）或限定次數（1）

### PWA
- 可安裝至手機主畫面，全螢幕運行（standalone）
- Service Worker 離線快取（靜態資源、Google Fonts）
- 新版本自動偵測並強制更新（skipWaiting + clientsClaim）

---

## 技術架構

### 前端
| 項目 | 技術 |
|------|------|
| UI 框架 | React 19 |
| 建構工具 | Vite 7 |
| PWA | vite-plugin-pwa（Workbox generateSW） |
| 樣式 | 純 inline styles（無 CSS framework） |
| 字體 | Barlow Condensed（英文）、Noto Sans TC（中文） |

### Firebase 服務
| 服務 | 用途 |
|------|------|
| **Firebase Authentication** | Google OAuth 登入 / 登出，管理使用者身份 |
| **Cloud Firestore** | 儲存訓練記錄、身材數據、Streak、自訂動作；即時監聽（onSnapshot） |
| **Firebase Hosting** | 靜態 PWA 部署，SPA 路由重寫 |
| **Firebase Remote Config** | 遠端控制活動公告彈窗（開關、標題、內文、觸發條件） |

### Firestore 資料結構
```
users/{userId}/
  workouts/{docId}        訓練記錄（date, exercise, sets, note, createdAt）
  bodyData/{docId}        身材數據（date, weight, height, chest, waist, hip, arm, thigh, createdAt）
  customExercises/{docId} 自訂動作（name, createdAt）
  meta/streak             連續訓練天數（count, lastDate）
```

### 部署
| 項目 | 值 |
|------|-----|
| 專案 ID | fitnesswith47 |
| Hosting 網址 | fitnesswith47.web.app |
| 建構輸出目錄 | `build/` |
| 部署指令 | `npm run build && firebase deploy --only hosting` |

---

## 未來預計新增的功能

| 功能 | 說明 |
|------|------|
| 訓練圖表分析 | 體重曲線、各動作訓練量趨勢折線圖 |
| 個人最高紀錄（PR）追蹤 | 自動標記每個動作的最高重量記錄 |
| 訓練記錄刪除 / 編輯 | 修正錯誤輸入的記錄 |
| 身材數據刪除 / 編輯 | 修正錯誤輸入的體態數據 |
| 訓練計畫 / 課表 | 預先規劃週訓練計畫，記錄時可直接套用 |
| 資料匯出 | 匯出訓練歷史為 CSV 或 PDF |
| 推播通知 | 每日訓練提醒（Firebase Cloud Messaging） |
| 社群分享 | 分享訓練成果圖卡至社群平台 |
| 多語言支援 | 英文介面切換 |
