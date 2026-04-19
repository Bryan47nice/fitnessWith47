# FitForge — 健身追蹤 PWA

> 個人健身記錄、體態追蹤、目標管理，All-in-One 漸進式網頁應用程式。

[![Version](https://img.shields.io/badge/version-v1.15.0-ffd700?style=flat-square)](https://fitnesswith47.web.app)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting%20%7C%20Firestore%20%7C%20FCM-orange?style=flat-square&logo=firebase)](https://firebase.google.com)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![PWA](https://img.shields.io/badge/PWA-Installable-5a0fc8?style=flat-square)](https://web.dev/progressive-web-apps/)

**🔗 Live Demo：[fitnesswith47.web.app](https://fitnesswith47.web.app)**

---

## 功能總覽

### 🏋️ 訓練日誌
- 記錄每組訓練（動作、組數、重量、次數、備註）
- 依部位分類：胸 / 背 / 肩 / 腿 / 手臂 / 核心 / 有氧
- 自訂動作並指定分類
- 新增訓練時自動帶入上次的組數與重量
- 動作歷史趨勢圖（最大重量 / 訓練量折線圖）
- 破 PR 偵測，觸發金色動畫慶祝；Dashboard PR 卡片可展開重量趨勢圖
- 日誌折疊收合，快速瀏覽長記錄
- 跑步機記錄：分秒輸入自動計算配速（05:43 /km 格式）

### 🤖 AI 教練回饋
- 依訓練動作與歷史數據產生個人化評語
- 提供重量建議、恢復提醒、動作改善方向

### ⏱ 組間計時器
- 儲存訓練後自動倒數休息時間
- 底部浮動顯示，可調整預設秒數
- 隨時從帳號設定手動觸發

### 📊 體態追蹤
- 記錄體重、身高、腰圍、臀圍
- 體脂率、骨骼肌肉量、內臟脂肪等級
- BMI 計算 + 趨勢圖 + 分類色塊

### 🎯 目標管理
- 支援體重↓ / 體重↑ / 肌肉↑ / 有氧次數 / BMI 等多種目標類型
- 達標 / 逾期視覺化提醒
- 週 / 月頻率雙模式

### 📅 Google Calendar 課程同步
- 連結 Google Calendar，自動過濾健身課程
- Dashboard 顯示「下次上課」倒數
- 課前一天推播提醒

### 🔥 連續訓練天數
- 自動計算訓練連續天數，Header badge 即時顯示
- 支援手動重置（帳號設定）

### 📋 今日訓練建議
- 依部位分析久未訓練的動作，提供均衡訓練建議
- 可依部位篩選，一鍵加入今日計畫
- FAB 速撥選單快速進入

### 🎓 教練課記錄
- 標記每次訓練為教練課，Dashboard 追蹤扣打用量
- 動作庫瀏覽所有教練課動作與學習筆記
- 課堂記錄依日期展開每堂內容

### 📱 PWA + 推播通知
- 可安裝至手機主畫面，全螢幕運行
- Firebase FCM 推播（課前提醒、版本更新）
- Android 桌面小工具（下次上課倒數 + 連續天數）

---

## Tech Stack

| 類別 | 技術 |
|------|------|
| 前端框架 | React 19 + Vite 7 |
| 資料庫 | Firebase Firestore（即時同步） |
| 身份驗證 | Firebase Auth（Google Sign-In） |
| 推播通知 | Firebase Cloud Messaging（FCM） |
| 動態設定 | Firebase Remote Config |
| 排程任務 | Firebase Cloud Functions |
| 圖表 | Recharts v3 |
| PWA | vite-plugin-pwa（Workbox） |
| 樣式 | Inline Styles（Glassmorphism 風格） |
| 測試 | Vitest v4 + jsdom（30+ GWT 測試案例） |
| 部署 | Firebase Hosting |

---

## 專案結構

```
fitnessWith47/
├── src/
│   ├── components/
│   │   ├── FitForge.jsx        # 主元件（狀態管理 + UI 骨架，2500+ 行）
│   │   ├── tabs/               # 四大功能 Tab
│   │   │   ├── DashboardTab.jsx
│   │   │   ├── WorkoutTab.jsx
│   │   │   ├── BodyTab.jsx
│   │   │   └── GoalsTab.jsx
│   │   └── Login.jsx
│   ├── utils/
│   │   ├── fitforge.utils.js       # 純函式工具層（可測試）
│   │   └── fitforge.utils.test.js  # GWT 測試
│   ├── styles/fitforge.styles.js   # Inline style 定義
│   └── firebase.js                 # Firebase SDK 初始化
├── functions/index.js              # Cloud Functions（排程推播）
├── scripts/
│   ├── push-notify.cjs             # FCM 推播指令工具
│   └── rc-update.cjs               # Remote Config 更新工具
├── docs/
│   ├── product.md                  # 產品規格 + 版本歷史
│   └── testing.md                  # GWT 測試文件
└── public/
    ├── firebase-messaging-sw.js    # FCM Service Worker
    └── icons/                      # PWA 圖示
```

---

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 執行單元測試
npm test

# 建構生產版本
npm run build
```

**部署：**

```bash
# 部署前端
npm run build && firebase deploy --only hosting

# 更新 Remote Config 彈窗
node scripts/rc-update.cjs "標題" "內文" "按鈕文字"

# 發送 FCM 推播
node scripts/push-notify.cjs "標題" "內文"
```

> 部署需要已登入 Firebase CLI：`firebase login`

---

## Firestore 資料結構

```
users/{userId}/
  ├── workouts/{id}         → { date, exercise, sets, note, createdAt }
  ├── bodyData/{date}       → { weight, height, waist, hip, bodyfat, muscle_mass, visceral_fat }
  ├── customExercises/{id}  → { name, createdAt }
  ├── goals/{id}            → { type, target, direction, ... }
  └── meta/streak           → { count, lastDate }

userPushTokens/{userId}     → { fcmToken, lastActiveAt }
```

---

## 版本歷史

| 版號 | 日期 | 主要內容 |
|------|------|---------|
| v1.15.0 | 2026-04-19 | 今日訓練建議部位篩選；個人最佳 PR 部位分類篩選 |
| v1.14.1 | 2026-04-18 | 跑步機記錄重設計：分秒輸入 + 自動計算配速 |
| v1.14.0 | 2026-04-18 | 新增訓練自動帶入上次組數與重量；身材歷史超過 5 筆自動折疊 |
| v1.13.0 | 2026-04-10 | FAB 速撥選單 + 今日訓練建議（久未訓練動作一鍵加入計畫） |
| v1.12.0 | 2026-04-08 | 教練課學習記錄：動作庫瀏覽、課堂記錄依日期展開 |
| v1.11.0 | 2026-04-08 | Dashboard PR 卡片重設計：最新 3 筆破紀錄 + 全螢幕 PR 頁 + 趨勢圖 |
| v1.10.0 | 2026-04-07 | 教練課標記功能：訓練日誌標記教練課、Dashboard 扣打進度條 |
| v1.9.4 | 2026-04-04 | 帳號設定新增連續天數重置按鈕 |
| v1.9.0 | 2026-04-02 | 組間計時器：儲存後自動倒數，可調整休息時間 |
| v1.8.1 | 2026-03-29 | 新增體脂率、骨骼肌肉量、內臟脂肪等級指標 |
| v1.8.0 | 2026-03-29 | 目標追蹤重構：有氧目標、頻率雙模式、方向選擇 |
| v1.7.0 | — | Google Calendar 課程同步 + 課前推播提醒 |
| v1.6.2 | — | 動作專屬 AI 教練評語 |
| v1.5.0 | — | 自訂動作支援分類 |
| v1.2.0 | 2026-02-27 | PR 偵測金色動畫 + 週訓練量趨勢圖 |
| v1.0.0 | 2026-02-24 | 初始版本 |

完整版本歷史見 [docs/product.md](docs/product.md)

---

## License

MIT
