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

## 開發流程（三層 Agent）

### 三層 Agent 職責

| Agent | 角色 | 說明 |
|-------|------|------|
| Plan Agent | 規劃 | Plan Mode + Explore subagent，輸出計畫後等用戶核准 |
| Dev Agent | 實作 | 主對話執行功能開發 |
| QA Agent | 測試 | 功能完成後由主對話啟動，跑測試 + 補 GWT |

### 完整開發流程（七步驟）

```
1. Plan Mode（Plan + Explore agents）→ 用戶核准計畫
2. Dev（主對話）→ 實作功能
3. QA Agent（subagent）→ 跑測試 + 補 GWT
4. Version bump（/version-bump skill）
5. Commit + push
6. 輸出三組文案選項（Changelog / RC / FCM）
7. 用戶選完 → Build + deploy + RC 更新 + FCM 推播
```

### QA Agent 啟動時機（強制）

**每次功能實作完成後（步驟 2 → 步驟 3），主對話必須以 `Agent tool, subagent_type: general-purpose` 啟動 QA Agent。**

QA Agent 固定任務（依序執行）：
1. 執行 `npm test`，確認現有測試全數通過
2. 讀取 `src/utils/fitforge.utils.js`（全部匯出函式）與 `src/utils/fitforge.utils.test.js`（現有測試）
3. 找出**沒有對應測試的純函式**
4. 若有未覆蓋函式：在 `fitforge.utils.test.js` 補寫 GWT 測試，同步更新 `docs/testing.md`
5. 補完後再跑一次 `npm test` 確認通過
6. 回報：「✅ QA 完成：共 X 個測試，新增 Y 個案例」或「⚠️ 測試失敗：[錯誤描述]」

QA Agent 測試規範：
- Test ID 格式：`TC-{字母}{數字}`（W=getWeekStart, G=getGoalProgress, T=getGoalTitle, P=detectNewPR, B=calcBMI, V=canSave*）
- 每個 test 必須有 `// Given:` / `// When:` / `// Then:` 三段註解
- 只測純函式；UI 互動與 Firestore 不在範圍
- `docs/testing.md` 格式：`**TC-XN**` 標題 + 中文 Given/When/Then 條列

### QA Agent Prompt 範本

啟動 QA Agent 時使用以下 prompt（貼入 Agent tool 的 prompt 欄位）：

```
你是 FitForge 專案的 QA Agent。請依序完成以下任務：

1. 執行 `npm test`，確認所有測試通過。
2. 讀取 `src/utils/fitforge.utils.js`（全部匯出函式）與 `src/utils/fitforge.utils.test.js`（現有測試）。
3. 找出有哪些匯出的純函式尚未有對應的測試 describe block。
4. 若有未覆蓋的函式，依照現有 GWT 格式補寫測試：
   - Test ID 接續現有最大編號
   - 每個 test 含 // Given: / // When: / // Then: 註解
   - 同步更新 docs/testing.md 的對應 GWT 表格
5. 補完後再執行一次 `npm test`，確認全數通過。
6. 最後輸出：「✅ QA 完成：共 X 個測試，新增 Y 個案例」或「⚠️ 測試失敗：[錯誤描述]」
```

> **不得**在 QA Agent 回報通過前進行 version bump。

---

## 功能完成後固定輸出（強制，不可省略）

每次功能實作完成、版本 bump、commit + push 之後，**必須**輸出以下三組各兩個選項讓用戶選擇：

1. **Changelog 條目**（App 內版本記錄文案，兩個選項）
2. **Remote Config 彈窗文案**（標題 / 內文 / 按鈕文字，兩個選項）
3. **FCM 推播文案**（標題 / 內文，兩個選項）

等用戶三項都選完後，依序執行：
1. `npm run build`
2. `firebase deploy --only hosting`
3. Remote Config REST API 更新（trigger_type=1, trigger_count=1）
4. `node scripts/push-notify.cjs "<標題>" "<內文>"`

> **不得**在用戶選擇前自行 build / deploy / 推播。

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
| `src/utils/fitforge.utils.js` | 純函式工具層（可測試的業務邏輯） |
| `src/utils/fitforge.utils.test.js` | Vitest GWT 測試（30 個案例） |
| `docs/testing.md` | GWT 測試案例完整文件 |

---

## Tech Stack

- **前端框架**：React 19 + Vite 7
- **建構輸出**：`build/`（不是 `dist/`）
- **Firebase SDK**：v12 modular（Auth、Firestore、Functions、FCM、Remote Config、Hosting）
- **圖表**：Recharts v3
- **PWA**：vite-plugin-pwa（Workbox）
- **TypeScript**：無（純 JSX）
- **測試框架**：Vitest v4 + jsdom（`npm test`）
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
| `popup_seen_goals_intro_v130` | 目標追蹤頁首次進入引導彈窗（v1.3.3 新增） |

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

## 測試規範

- 執行：`npm test`（Vitest，不需 build）
- 純函式與布林判斷邏輯必須放在 `src/utils/fitforge.utils.js`，並補對應測試
- 新增測試案例時，同步更新 `docs/testing.md` 的 GWT 表格
- UI 互動與 Firestore 操作目前不在測試範圍

---

## 程式碼風格規範

- **樣式**：全部使用 inline styles，禁止新增 CSS 檔案或 class-based 樣式
- **設計語言**：Glassmorphism（`backdrop-filter: blur(10px)`、rgba 色彩）
- **彈窗**：用 `createPortal` 渲染，避免 z-index 問題
- **破壞性操作**：必須走 `confirmDialog` 確認流程（刪除 workout、刪除 body record 等）
- **PR 偵測動畫**：新增訓練時偵測最大重量是否破紀錄，觸發 `prAnim` 金色動畫
