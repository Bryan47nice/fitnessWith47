# FitForge — 專案規範

## Versioning Rules（版號迭代規則）

採用 Semantic Versioning（X.Y.Z）：

- **X（Major）**：核心邏輯變更（例：從純 Local 轉為 Firebase 雲端、UI 框架大翻新）
- **Y（Minor）**：新增模組（例：新增 AI 覆盤分析、新增歷史記錄視圖、新增音樂播放器）
- **Z（Patch）**：細微調整（例：修復 CSS 跑版、優化現有功能行為、文字修正、bug fix）

## Changelog 同步規則（強制）

**每次修改 `APP_VERSION` 時，必須同步更新 App 內的 Changelog modal。**

- Changelog modal 位於 `src/components/FitForge.jsx`，搜尋 `showChangelog` 可定位
- 新版本條目加在最頂端，標上「最新」badge，舊的「最新」badge 一併移除
- 格式參考既有條目（版號、日期、✨ 或 • 條列說明）
- 版號、日期、說明文字需與 `MEMORY.md` 版本記錄一致

## APP_VERSION 更新三步驟（強制）

1. 修改 `FitForge.jsx` 頂部的 `APP_VERSION` 常數
2. 更新同檔案內的 Changelog modal（搜尋 `showChangelog` 定位）
3. 更新 `MEMORY.md` 的版本記錄區塊

---

## 關鍵檔案地圖

| 檔案 | 用途 |
|------|------|
| `src/components/FitForge.jsx` | 主邏輯（2500+ 行，核心業務邏輯） |
| `src/firebase.js` | Firebase 初始化（SDK config） |
| `src/components/App.jsx` | Auth routing wrapper |
| `src/components/Login.jsx` | 登入頁 UI |
| `functions/index.js` | Cloud Functions（排程推播提醒） |
| `public/firebase-messaging-sw.js` | FCM Service Worker |
| `firestore.rules` | Firestore 安全規則 |
| `vite.config.js` | Vite 建構設定（含 PWA plugin） |

---

## Tech Stack

- **前端框架**：React 19 + Vite 7
- **建構輸出**：`build/`（不是 `dist/`）
- **Firebase SDK**：v12 modular（Auth、Firestore、Functions、FCM、Remote Config、Hosting）
- **圖表**：Recharts v3
- **PWA**：vite-plugin-pwa（Workbox）
- **TypeScript**：無（純 JSX）
- **測試框架**：無
- **樣式**：全部 inline styles（無 CSS module / styled-components）

---

## 建構與部署指令

```bash
npm run dev                          # 本地開發伺服器
npm run build                        # 建構（輸出至 build/）
firebase deploy --only hosting       # 部署前端（需先 build）
firebase deploy --only functions     # 部署 Cloud Functions
```

> 部署前端前必須先執行 `npm run build`。

---

## Firestore 資料結構

```
users/{userId}/
  ├── workouts/{id}           → { date, exercise, sets, note, createdAt }
  ├── bodyData/{date}         → { weight, height, chest, waist, hip, arm, thigh, createdAt }
  │                              ↑ date 字串為 doc ID（v1.2.2 起，同日覆蓋機制）
  ├── customExercises/{id}    → { name, createdAt }
  └── meta/streak             → { count, lastDate }

userPushTokens/{userId}       → { fcmToken, lastActiveAt, lastNotifiedAt }
```

---

## LocalStorage Keys 登記表

新增 localStorage 使用時必須在此登記，避免命名衝突：

| Key | 用途 |
|-----|------|
| `popup_seen_{title}` | Remote Config 彈窗顯示計數（title 為彈窗標題） |
| `popup_seen_body_overwrite_v121` | 身材頁籤一次性說明彈窗 |
| `body_migrated_date_key_v122` | 身材資料遷移旗標（v1.2.2 一次性遷移） |
| `ex_active_tag` | 上次選擇的動作部位 Tag（胸/背/肩/腿/手臂/核心/有氧/自訂） |

---

## Remote Config 參數清單

| 參數 | 類型 | 說明 |
|------|------|------|
| `popup_enabled` | BOOLEAN | 入口彈窗主開關 |
| `popup_title` | STRING | 彈窗標題 |
| `popup_body` | STRING | 彈窗內文（`\n` 換行） |
| `popup_button_text` | STRING | 按鈕文字 |
| `popup_trigger_type` | NUMBER | 0=每次顯示、1=前 N 次 |
| `popup_trigger_count` | STRING | trigger_type=1 時的 N 值 |
| `marquee_enabled` | BOOLEAN | 頂部跑馬燈開關 |
| `marquee_texts` | STRING | 跑馬燈訊息（JSON array 格式） |

---

## 程式碼風格規範

- **樣式**：全部使用 inline styles，禁止新增 CSS 檔案或 class-based 樣式
- **設計語言**：Glassmorphism（`backdrop-filter: blur(10px)`、rgba 色彩）
- **彈窗**：用 `createPortal` 渲染，避免 z-index 問題
- **破壞性操作**：必須走 `confirmDialog` 確認流程（刪除 workout、刪除 body record 等）
- **PR 偵測動畫**：新增訓練時偵測最大重量是否破紀錄，觸發 `prAnim` 金色動畫
