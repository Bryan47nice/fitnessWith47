# FitForge — 專案規範

## Idea / Bug 捕捉

對話中若偵測到功能想法、bug 描述、或改善建議（「我想要」「可以加」「這個壞了」「排夜行做」等），主動詢問「要加進 backlog 嗎？」，用戶確認後直接執行 `/capture` 流程。

---

## Versioning Rules

> 詳細版號規則、Changelog 同步、APP_VERSION 四步驟見 `.claude/rules/versioning.md`（碰到 `FitForge.jsx` / `docs/product.md` 時自動載入）。

---

## 開發流程（五層 Agent）

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
6. Commit + push（**先跑 `git status` 確認無漏掉的 modified 檔案，再 stage + commit**）
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

**每次 Dev 完成後（Full Mode 步驟 2、Quick Mode 步驟 1），主對話必須啟動 Review Agent（`.claude/agents/review.md`）。**

> Review Agent 定義與完整 prompt 見 `.claude/agents/review.md`。
> **不得**在 Review Agent 回報通過前啟動 QA Agent。

---

### QA Agent 啟動時機（強制）

**每次 Review Agent 通過後（Full Mode 步驟 3 → 4、Quick Mode 步驟 2 → 3），主對話必須啟動 QA Agent（`.claude/agents/qa.md`）。**

> QA Agent 定義與完整 prompt 見 `.claude/agents/qa.md`。
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

**步驟 7 文案選定後，主對話必須啟動 Deploy Agent（`.claude/agents/deploy.md`），並在 prompt 中帶入 `{RC_TITLE}` / `{RC_BODY}` / `{RC_BUTTON}` / `{FCM_TITLE}` / `{FCM_BODY}` / `{VERSION}`。**

> Deploy Agent 定義、執行步驟與回報格式見 `.claude/agents/deploy.md`。

---

## 關鍵檔案地圖

| 檔案 | 用途 |
|------|------|
| `src/components/FitForge.jsx` | 主邏輯（2500+ 行，核心業務邏輯） |
| `src/firebase.js` | Firebase 初始化（SDK config） |
| `src/components/App.jsx` | Auth routing wrapper |
| `src/components/Login.jsx` | 登入頁 UI（含 IS_PREVIEW 測試帳號按鈕，只在 preview channel 顯示） |
| `functions/index.js` | Cloud Functions（排程推播提醒） |
| `scripts/seed-test-account.cjs` | 建立/重置測試帳號資料（preview@fitforgetest.dev，Firebase REST API） |
| `docs/overnight-prompt.md` | Overnight Agent 執行規則（自動化開發流程） |
| `docs/overnight-backlog.md` | Overnight 任務狀態（pending / in-progress / completed） |
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

> 完整 schema 與安全規範見 `.claude/rules/firestore.md`（碰到 `firestore.rules` / `src/firebase.js` / `functions/index.js` 時自動載入）。

---

## LocalStorage Keys 登記表

新增 localStorage 使用時必須在此登記，避免命名衝突：

| Key | 用途 |
|-----|------|
| `popup_seen_{title}` | Remote Config 彈窗顯示計數（title 為彈窗標題） |
| `popup_seen_body_overwrite_v121` | 身材頁籤一次性說明彈窗 |
| `body_migrated_date_key_v122` | 身材資料遷移旗標（v1.2.2 一次性遷移） |
| `ex_active_tag` | 上次選擇的動作部位 Tag（胸/背/肩/腿/手臂/核心/有氧/伸展/自訂） |
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

> 完整測試規範、Test ID 格式、GWT 寫法見 `.claude/rules/testing.md`（碰到 `src/utils/**` 時自動載入）。

## 程式碼風格規範

> 樣式、彈窗、破壞性操作、PR 動畫規範見 `.claude/rules/style.md`（碰到 `src/components/**` 時自動載入）。
