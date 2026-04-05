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
- 版號、日期、說明文字需與 `docs/product.md` 第八節版本歷史一致

## APP_VERSION 更新四步驟（強制）

1. 修改 `FitForge.jsx` 頂部的 `APP_VERSION` 常數
2. 更新同檔案內的 Changelog modal（搜尋 `showChangelog` 定位）
3. 在 `docs/product.md` 第八節版本歷史最頂端新增一行（含版號、日期、說明）
4. 更新 `MEMORY.md` 的版本記錄區塊（本機 Claude context 用）

---

## 開發流程（三層 Agent）

### 五層 Agent 職責

| Agent | 角色 | 說明 |
|-------|------|------|
| Plan Agent | 規劃 | Plan Mode + Explore subagent，輸出計畫後等用戶核准 |
| Dev Agent | 實作 | 主對話執行功能開發 |
| Review Agent | 審查 | Dev 完成後啟動，檢查規範違反與安全問題 |
| QA Agent | 測試 | Review 通過後啟動，跑測試 + 補 GWT |
| Deploy Agent | 部署 | 文案選定後由主對話啟動，依序 build → deploy → RC → FCM |

### 開發流程：Full Mode vs Quick Mode

依修改規模選擇流程：

| 模式 | 適用情境 | 判斷標準 |
|------|---------|---------|
| **Full Mode** | 新功能、架構調整 | 影響 2 個以上元件、涉及新資料結構或 Firestore schema |
| **Quick Mode** | Bug fix、細微調整 | 單一元件/函式修改、純文字或樣式修正 |

#### Full Mode（八步驟）

```
1. Plan Mode（Plan + Explore agents）→ 用戶核准計畫
2. Dev（主對話）→ 實作功能
3. Review Agent（subagent）→ 規範審查
4. QA Agent（subagent）→ 跑測試 + 補 GWT
5. Version bump（/version-bump skill）
6. Commit + push
7. 輸出三組文案選項（Changelog / RC / FCM）
8. 用戶選完 → Deploy Agent
```

#### Quick Mode（六步驟）

```
1. Dev（主對話）→ 實作功能（跳過 Plan）
2. Review Agent（subagent）→ 規範審查
3. QA Agent（subagent）→ 跑測試 + 補 GWT
4. Version bump（/version-bump skill）
5. Commit + push
6. 輸出三組文案選項 → 用戶選完 → Deploy Agent
```

### Review Agent 啟動時機（強制）

**每次 Dev 完成後（Full Mode 步驟 2、Quick Mode 步驟 1），主對話必須以 `Agent tool, subagent_type: general-purpose` 啟動 Review Agent。**

Review Agent 固定任務（依序執行）：
1. 執行 `git diff HEAD`，取得本次所有變更
2. 逐一檢查以下規範：
   - **LocalStorage**：新增 localStorage key 是否已登記至 `CLAUDE.md` 的 LocalStorage Keys 登記表
   - **樣式規範**：是否有新增 CSS 檔案或 class-based 樣式（違反 inline styles 規範）
   - **破壞性操作**：刪除資料的操作是否有走 `confirmDialog` 流程
   - **彈窗渲染**：新增彈窗是否使用 `createPortal`
   - **純函式**：新增的純函式是否已放入 `fitforge.utils.js`（而非寫在元件內）
   - **安全性**：是否有未驗證的用戶輸入直接寫入 Firestore
3. 回報：「✅ Review 通過，無規範違反」或列出問題清單（需 Dev 修正後重新 Review）

### Review Agent Prompt 範本

啟動 Review Agent 時使用以下 prompt：

```
你是 FitForge 專案的 Review Agent。請依序完成以下審查：

1. 執行 `git diff HEAD`，取得本次所有變更內容。
2. 逐一檢查以下規範是否有違反：
   - LocalStorage：新增的 localStorage key 是否已登記至 CLAUDE.md 的「LocalStorage Keys 登記表」
   - 樣式規範：是否有新增 CSS 檔案或 className（規範要求全部 inline styles）
   - 破壞性操作：刪除資料的操作是否有走 confirmDialog 流程
   - 彈窗渲染：新增彈窗是否使用 createPortal
   - 純函式位置：新增的純函式是否已放入 src/utils/fitforge.utils.js
   - 安全性：是否有未驗證的用戶輸入直接寫入 Firestore
3. 輸出結果：「✅ Review 通過，無規範違反」或條列問題清單。
```

> **不得**在 Review Agent 回報通過前啟動 QA Agent。

---

### QA Agent 啟動時機（強制）

**每次 Review Agent 通過後（Full Mode 步驟 3 → 4、Quick Mode 步驟 2 → 3），主對話必須以 `Agent tool, subagent_type: general-purpose` 啟動 QA Agent。**

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

等用戶三項都選完後，啟動 Deploy Agent 執行部署。

> **不得**在用戶選擇前自行 build / deploy / 推播。

---

## Deploy Agent 設計

### Deploy Agent 啟動時機（強制）

**步驟 7 文案選定後，主對話必須以 `Agent tool, subagent_type: general-purpose` 啟動 Deploy Agent。**

### Deploy Agent 執行步驟（依序，Build / Deploy 失敗即停止）

| 步驟 | 指令 | 失敗處理 |
|------|------|---------|
| 1. Build | `npm run build` | 立即停止，不繼續部署 |
| 2. Deploy Hosting | `firebase deploy --only hosting` | 立即停止，不執行 RC / FCM |
| 3. Remote Config 更新 | `node scripts/rc-update.cjs "{RC_TITLE}" "{RC_BODY}" "{RC_BUTTON}"` | 警告但繼續 FCM |
| 4. FCM 推播 | `node scripts/push-notify.cjs "<title>" "<body>"` | 警告回報，不影響已部署版本 |

### 回報格式

```
✅ Build 完成
✅ Hosting 部署完成（vX.Y.Z）
✅ Remote Config 更新完成
✅ FCM 推播完成（已送出 X 則）
---
🚀 vX.Y.Z 部署完成！
```

### Deploy Agent Prompt 範本

啟動 Deploy Agent 時使用以下 prompt（貼入 Agent tool 的 prompt 欄位，替換大括號內容）：

```
你是 FitForge 專案的 Deploy Agent。請依序執行以下部署步驟，Build 或 Deploy 失敗時立即停止並回報錯誤，不繼續執行後續步驟。所有指令都在 E:\claudecode\fitnessWith47 目錄下執行。不需要讀取任何程式碼或設定檔，直接依序執行以下指令即可。

步驟：
1. `npm run build` — 若失敗，立即停止。
2. `firebase deploy --only hosting` — 若失敗，立即停止。
3. `node scripts/rc-update.cjs "{RC_TITLE}" "{RC_BODY}" "{RC_BUTTON}"` — 若失敗，輸出警告並繼續。
4. `node scripts/push-notify.cjs "{FCM_TITLE}" "{FCM_BODY}"` — 若失敗，輸出警告。
5. 輸出每步驟結果（✅/⚠️），最後一行輸出「🚀 {VERSION} 部署完成！」
```

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
| `docs/product.md` | 產品功能規格 + 技術架構 + 版本歷史（跨電腦 source of truth） |
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
  ├── bodyData/{date}         → { weight, height, waist, hip, bodyfat, muscle_mass, visceral_fat, createdAt }
  │                              ↑ date 字串為 doc ID（v1.2.2 起，同日覆蓋機制）
  │                              ↑ v1.8.1：移除 chest/arm/thigh，新增 bodyfat/muscle_mass/visceral_fat
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
| `rest_timer_duration` | 組間計時器預設秒數（v1.9.0 新增，預設 90） |

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
