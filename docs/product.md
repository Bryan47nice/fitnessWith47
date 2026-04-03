# FitForge — 產品與技術文件

> **版本歷史見下方第八節。技術開發流程規範見 `CLAUDE.md`。測試規格見 `docs/testing.md`。**

---

## 一、產品概覽

| 項目 | 內容 |
|------|------|
| 產品名稱 | FitForge（健身追蹤） |
| 正式網址 | https://fitnesswith47.web.app |
| 平台 | PWA（Progressive Web App），支援安裝至手機桌面 |
| 語言 | 繁體中文 |
| 目標用戶 | 自主訓練的健身愛好者，需要記錄訓練、身材、設定目標 |

---

## 二、技術架構

### Tech Stack

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19 + Vite 7 |
| 資料庫 | Firebase Firestore（即時同步，onSnapshot） |
| 身份驗證 | Firebase Auth（Google 登入） |
| 雲端函式 | Firebase Cloud Functions（推播排程） |
| 推播通知 | Firebase Cloud Messaging（FCM）+ Service Worker |
| 動態設定 | Firebase Remote Config |
| 圖表 | Recharts v3 |
| PWA | vite-plugin-pwa（Workbox） |
| 樣式 | 全部 inline styles，Glassmorphism 設計語言 |
| 建構輸出 | `build/`（非 dist/） |
| TypeScript | 無（純 JSX） |
| 測試框架 | Vitest v4 + jsdom |

### 元件層級

```
FitForge (React PWA)
├── Auth Layer        → App.jsx + Login.jsx
├── Main Shell        → FitForge.jsx（2500+ 行，所有 state 集中管理）
├── Tab Components    → DashboardTab / WorkoutTab / BodyTab / GoalsTab
├── Pure Utils        → fitforge.utils.js（可測試純函式）
├── Firebase          → Auth / Firestore / FCM / Remote Config / Functions
└── PWA               → Service Worker + FCM push
```

### State 流向

```
Firestore ──onSnapshot──▶ FitForge.jsx（state 集中管理）
                               │
                    ┌──────────┼──────────────┐
                    ▼          ▼              ▼
              DashboardTab  WorkoutTab     BodyTab
                                           GoalsTab
                    ↑ props         ↑ callbacks（setState / async save）
```

FitForge.jsx 負責：所有 Firestore 讀寫、state 管理、computed values（`latestBody`、`prMap`、`cardioMap`、`latestBMI`），再透過 props 下傳給各 Tab。

### 身份驗證

- 唯一登入方式：**Google Sign-In**（`signInWithPopup`）
- App.jsx 監聽 `onAuthStateChanged`，等 Auth 初始化後才渲染頁面，避免閃爍
- 偵測到 LINE / Facebook / Instagram / WeChat / Snapchat / Android 原生瀏覽器時，顯示「請改用 Chrome/Safari 開啟」提示，含複製連結按鈕

---

## 三、功能規格（4 個 Tab）

### 3.1 儀表板（DashboardTab）

**定位：** 一眼掌握健身全貌的總覽頁

| 功能區塊 | 說明 |
|---------|------|
| 下次課程卡片 | 從 Google Calendar 抓取含關鍵字的最近課程，顯示課程名稱與距今天數 |
| Calendar 連結管理 | 連結 / 重新同步 / 中斷連結按鈕；關鍵字篩選器（預設「健身」）|
| 統計卡片 | 累計訓練天數、本週訓練天數、最新 BMI |
| 訓練量趨勢圖 | 日 / 週 / 月切換，Recharts 折線圖 |
| 最新身材數據 | 最新體重、BMI 進度條（含標準範圍色帶）、其他測量值 |
| 個人 PR 清單 | 可折疊，每個動作的最高重量與日期 |
| 近期訓練 | 最新 5 筆訓練，顯示動作、日期、各組內容 |
| 激勵文字 Card | 連續訓練 ≥ 3 天顯示連續天數里程碑；未達標顯示提醒文案 |

**BMI 色彩分類：**
| 範圍 | 顏色 | 分類 |
|------|------|------|
| < 18.5 | 藍色 | 體重過輕 |
| 18.5–24 | 綠色 | 標準體重 |
| 24–28 | 黃色 | 體重過重 |
| > 28 | 紅色 | 肥胖 |

**Props 輸入：** `workouts, bodyData, prMap, volumePeriod, streak, nextClass, calendarConnected, calendarKeyword`

---

### 3.2 訓練日誌（WorkoutTab）

**定位：** 記錄與查閱每次訓練的核心頁

| 功能區塊 | 說明 |
|---------|------|
| 訓練日曆 | 月視圖，標記有訓練的日期，點擊切換查看日 |
| 當日訓練詳情 | 點選日期後顯示該日所有動作與組數 |
| AI 教練評語 | Cloud Function 生成當日訓練回饋（依動作種類客製化）|
| 新增訓練表單 | 日期 + 動作 + 組數（重量/次數）+ 備註 |
| 動作選擇器 | 搜尋框 + 部位 Tag 列（胸/背/肩/腿/手臂/核心/有氧/自訂）+ 最近使用（最多 5 個）；localStorage 記憶上次 Tag |
| 訓練組數 | reps / kg 上下排列；可動態新增/移除組；刪除按鈕多組時才顯示 |
| 儲存驗證 | 必須選動作 + 至少一組有填值；不滿足時按鈕 disabled（無額外提示） |
| 自訂動作管理 | 新增、編輯（名稱/分類）、刪除（需確認） |
| PR 偵測動畫 | 儲存時偵測最大重量是否破紀錄，觸發金色 🏆 Toast（2.5s） |
| 訓練歷史 | 依日期 / 週 / 月分組，支援篩選特定動作 + 趨勢圖 |
| 編輯訓練 Bottom Sheet | 可修改日期、動作、組數、備註；儲存後 1.2s 動畫自動關閉 |

**預設動作庫：** 7 大部位，共 35 個動作

**Props 輸入（41 個）：** 訓練表單 state、動作選擇器 state、歷史篩選 state、自訂動作 state、所有處理函式

---

### 3.3 身材數據（BodyTab）

**定位：** 追蹤身體組成變化的量測記錄頁

| 功能區塊 | 說明 |
|---------|------|
| 身材輸入表單 | 日期 + 體重 + 身高 + 腰圍 + 臀圍 + 體脂率 + 骨骼肌肉量 + 內臟脂肪等級（全部可選，至少填一個） |
| 覆寫警告 | 同日期已有紀錄時提示「⚠️ 此日期已有紀錄，儲存將覆蓋現有數據」，按鈕文字改為「✏️ 更新身材數據」 |
| 指標切換 | 體重 / BMI / 身高 / 腰圍 / 臀圍 / 體脂率 / 骨骼肌肉量 8 種指標 |
| 趨勢折線圖 | Recharts，至少 2 筆才顯示；BMI 圖加 18.5（藍色）/ 24（黃色）參考線 |
| 歷史紀錄清單 | 最新 5 筆，最新值突出顯示，漲跌箭頭（增加紅色↑，減少綠色↓） |
| 刪除紀錄 | 單筆刪除（走 confirmDialog 流程）|

**Firestore 欄位（v1.8.1）：** `weight, height, waist, hip, bodyfat, muscle_mass, visceral_fat, createdAt`
（doc ID = 日期字串，同日自動 upsert）

**Props 輸入（22 個）：** 身材表單 state、activeMetric、saveBody、deleteBodyRecord

---

### 3.4 目標追蹤（GoalsTab）

**定位：** 設定健身目標並即時追蹤進度

| 功能區塊 | 說明 |
|---------|------|
| 目標清單 | 排序：進行中（截止日近優先）→ 已過期 → 已達標 |
| 進度條 | 橙色（進行中）/ 紅色（剩 7 天）/ 灰色（過期）/ 綠色（達標）|
| 達成慶祝動畫 | 彩旗粒子爆炸 + 慶祝文案，`celebrated` flag 防重複觸發 |
| 新增/編輯目標 | Bottom sheet，包含類型、目標值、截止日期、備註、方向 |
| 目標類型 | 體重、訓練頻率（每週/累計）、動作重量 PR、身材測量、BMI、有氧 |
| 方向設定 | 自動判斷（targetValue vs startValue）或手動覆蓋增加/減少 |
| 動作選擇 | exercise_pr / cardio 類型可透過 ExPicker 選擇動作 |
| 身材部位選擇 | 腰圍 / 臀圍 / 體脂率 / 骨骼肌肉量 |

**目標進度計算邏輯（`getGoalProgress`）：**
```
current = 取得對應最新量測值
若 body 類目標且 current = 0 → return 0（資料未載入防護）
isDecrease = goalDirection === "decrease" || (targetValue < startValue)
進度 = isDecrease
  ? (startValue - current) / (startValue - targetValue)
  : (current - startValue) / (targetValue - startValue)
```

**Props 輸入（32 個）：** 目標清單 state、目標表單 state、getGoalProgress 函式

---

## 四、跨頁共用功能

### 浮動行動按鈕（FAB）

| 狀態 | 圖示 | 動畫 | 顯示條件 |
|------|------|------|---------|
| 今日未記錄 | 💪 | 脈衝動畫（1.5s 無限循環） | 非訓練日誌 Tab |
| 今日已記錄 | + | 無 | 非訓練日誌 Tab |
| 在訓練日誌 Tab | — | — | **隱藏** |

點擊行為：跳至訓練日誌 Tab、自動展開動作選擇器

### 訓練連續天數（Streak）

- 儲存於 Firestore `users/{uid}/meta/streak`：`count`、`lastDate`
- 每次 workouts 變動時自動計算
- Header 顯示 🔥 N 天 badge（count > 0 時橙紅漸層）

### 彈窗系統

**Remote Config 活動彈窗：**

| 參數 | 類型 | 說明 |
|------|------|------|
| `popup_enabled` | BOOLEAN | 主開關 |
| `popup_title` | STRING | 標題 |
| `popup_body` | STRING | 內文（`\n` 換行） |
| `popup_button_text` | STRING | 按鈕文字（預設「我知道了」） |
| `popup_trigger_type` | NUMBER | 0=每次顯示, 1=前 N 次 |
| `popup_trigger_count` | STRING | trigger_type=1 時的 N |

localStorage key 格式：`popup_seen_{title}`（計數器）

**一次性系統彈窗：**

| 觸發條件 | localStorage key |
|---------|----------------|
| 首次進入身材數據 Tab | `popup_seen_body_overwrite_v121` |
| 首次進入目標追蹤 Tab | `popup_seen_goals_intro_v130` |

所有彈窗使用 `createPortal` 渲染；所有刪除操作走 `confirmDialog` 確認流程。

### 跑馬燈（Marquee）

- 位置：導覽列下方，由 Remote Config 控制（`marquee_enabled` / `marquee_texts`）
- 動畫：60s 無限橫向捲動；Hover 暫停；點擊展開 Bottom Sheet

### 推播通知

**前端流程：** App 啟動 → 更新 `lastActiveAt` → 若已同意靜默刷新 Token，否則 3 秒後顯示提示 Banner

**Cloud Function（排程，UTC 12:00）：** `lastActiveAt` 或 `lastWorkoutDate` 超過 3 天 → 發送提醒（24 小時去重）

---

## 五、資料層

### Firestore 資料結構

```
users/{userId}/
  ├── workouts/{id}          { date, exercise, sets[], note, createdAt }
  ├── bodyData/{date}        { weight, height, waist, hip, bodyfat,
  │                            muscle_mass, visceral_fat, createdAt }
  │                            ↑ doc ID = 日期字串（upsert 模式）
  ├── customExercises/{id}   { name, createdAt }
  ├── goals/{id}             { type, targetValue, startValue, goalDirection,
  │                            deadline, celebrated, completedAt, ... }
  ├── meta/streak            { count, lastDate }
  └── meta/calendarSync      { keyword }

userPushTokens/{userId}      { fcmToken, lastActiveAt, lastNotifiedAt }
```

**安全規則：** `users/{userId}/**` 及 `userPushTokens/{userId}` 只允許對應 userId 的已登入用戶讀寫，無匿名存取。

### LocalStorage 完整清單

| Key | 用途 |
|-----|------|
| `last_seen_changelog` | 已閱讀的版本號（用於 NEW badge 偵測） |
| `ex_active_tag` | 上次選擇的部位 Tag |
| `popup_seen_body_overwrite_v121` | 身材覆蓋說明彈窗（一次性） |
| `body_migrated_date_key_v122` | 身材資料遷移旗標（一次性） |
| `popup_seen_goals_intro_v130` | 目標追蹤引導彈窗（一次性） |
| `history_group_mode` | 歷史紀錄分組模式（"week" / "month"） |
| `popup_seen_{title}` | Remote Config 彈窗顯示計數 |

---

## 六、純函式工具層

**檔案：** `src/utils/fitforge.utils.js`（對應測試：`src/utils/fitforge.utils.test.js`，62 個案例）

| 函式 | 用途 |
|------|------|
| `getWeekStart(dateStr)` | 取得日期所在週的週一（ISO 8601） |
| `calcBMI(weight, height)` | 計算 BMI |
| `bodyPartLabels` | 身體部位中文標籤對應表（常數） |
| `bodyPartUnits` | 身體部位單位對應表（常數） |
| `getGoalTitle(goal)` | 生成目標顯示標題文案 |
| `getGoalProgress(goal, context)` | 計算目標進度百分比 0–100 |
| `detectNewPR(exercise, sets, prMap)` | 偵測是否新 PR |
| `canSaveWorkout(exercise, sets)` | 驗證訓練表單是否可儲存 |
| `canSaveGoal(targetValue, deadline, ...)` | 驗證目標表單是否可儲存 |
| `filterCalendarEvents(events, keyword)` | 以關鍵字篩選 Calendar 事件 |
| `getNextClass(upcomingClasses)` | 取得最近一堂課程 |

---

## 七、外部整合

| 整合項目 | 用途 | 實作位置 |
|---------|------|---------|
| **Google Calendar** | 同步課程、顯示下次上課 | `FitForge.jsx` connectGoogleCalendar / filterCalendarEvents |
| **FCM 推播** | 訓練提醒、版本更新通知 | `functions/index.js` + `public/firebase-messaging-sw.js` |
| **Remote Config** | 控制入口彈窗（標題/內文/按鈕/觸發次數）、跑馬燈 | `FitForge.jsx` Remote Config fetch |
| **Android PWA Widget** | 桌面小工具顯示下次上課倒數 + 連續天數 | PWA manifest + Widget API |

---

## 八、版本歷史

> **這份表格是跨電腦開發的版本歷史 source of truth（透過 GitHub 同步）。**
> 每次 version bump 時，在最頂端新增一行。

| 版號 | 日期 | 主要內容 |
|------|------|---------|
| v1.9.1 | 2026-04-03 | 組間計時器新增手動啟動入口：在帳號設定面板加入「⏱ 組間計時」快速啟動按鈕，隨時可觸發休息倒數 |
| v1.9.0 | 2026-04-02 | 組間計時器 — 儲存訓練後自動倒數，底部浮動顯示，可調整預設休息時間 |
| v1.8.3 | 2026-03-31 | 訓練日誌新增日期折疊，每天訓練一鍵收合，大幅減少捲動距離 |
| v1.8.2 | 2026-03-29 | 修正降低型目標在 bodyData 載入前被誤判為已達標 |
| v1.8.1 | 2026-03-29 | 身材記錄新增體脂率、骨骼肌肉量、內臟脂肪等級三項體組成指標 |
| v1.8.0 | 2026-03-29 | 目標追蹤優化：有氧目標類型、頻率雙模式、目標可編輯、目標方向選擇 |
| v1.7.0 | — | Google Calendar 課程同步，Dashboard 顯示下次上課時間，前一天晚上推播提醒 |
| v1.6.2 | — | 訓練日誌部位分類兩層篩選 + 動作專屬 AI 教練評語 |
| v1.6.1 | — | 訓練組數 UX：預設空組數、組數輸入加單位標籤 |
| v1.6.0 | — | 自訂動作編輯分類名稱、備註改多行、歷史篩選動作趨勢圖 |
| v1.5.0 | — | 自訂動作支援分類指定，新增時選部位或建立新分類 |
| v1.3.8 | 2026-03-02 | 首頁跑馬燈恢復常駐顯示、移除今日提醒卡片，有氧動作新增室內健走、慢跑等 |
| v1.3.7 | 2026-03-02 | 新增 Vitest 單元測試套件（30 個 GWT 測試覆蓋核心業務邏輯） |
| v1.3.6 | 2026-03-01 | 新增 BMI 目標類型、修正目標進度方向計算、歷史紀錄依週／月分組收合 |
| v1.3.5 | 2026-03-01 | 優化推播通知圖示，Android 狀態列現在顯示正確的 FitForge 圖示 |
| v1.3.4 | 2026-03-01 | FAB 優化；動作預設留空＋儲存禁用驗證；組數輸入框改上下排列 |
| v1.3.3 | 2026-03-01 | 目標追蹤頁首次進入引導彈窗 |
| v1.3.2 | 2026-03-01 | 動作選擇器重設計（搜尋＋部位 Tag＋最近使用）；自訂動作整合；FAB 升級 |
| v1.3.1 | 2026-03-01 | 版本通知機制（頭像紅點＋NEW badge） |
| v1.3.0 | 2026-03-01 | 訓練日誌合併；新增目標追蹤 Tab |
| v1.2.6 | 2026-03-01 | BMI 達標提示＋BMI 趨勢折線（含參考線） |
| v1.2.4 | 2026-02-28 | 跑馬燈＋通知 Banner |
| v1.2.2 | 2026-02-28 | 身材數據同日覆蓋 bug 修正；日期為 doc ID |
| v1.2.0 | 2026-02-27 | PR 追蹤金色提示；儀表板週訓練量趨勢圖 |
| v1.1.0 | 2026-02-27 | 身材趨勢折線圖；訓練/身材紀錄編輯刪除 |
| v1.0.0 | 2026-02-24 | 初始版本 |
