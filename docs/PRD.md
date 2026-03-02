# FitForge — 產品需求文件 (PRD)
**版本：v1.3.8　　最後更新：2026-03-02**

---

## 1. 產品概覽

| 項目 | 內容 |
|------|------|
| 產品名稱 | FitForge（健身追蹤） |
| 正式網址 | https://fitnesswith47.web.app |
| 平台 | PWA（Progressive Web App），支援安裝至手機桌面 |
| 語言 | 繁體中文 |
| 目標用戶 | 自主訓練的健身愛好者，需要記錄訓練、身材、設定目標 |

---

## 2. 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | React 19 + Vite 7 |
| 資料庫 | Firebase Firestore（即時同步） |
| 身份驗證 | Firebase Auth（Google 登入） |
| 雲端函式 | Firebase Cloud Functions（推播排程） |
| 推播通知 | Firebase Cloud Messaging（FCM）+ Service Worker |
| 動態設定 | Firebase Remote Config |
| 圖表 | Recharts v3 |
| PWA | vite-plugin-pwa（Workbox） |
| 樣式 | 全部 inline styles，Glassmorphism 設計語言 |
| 建構輸出 | `build/`（非 dist/） |
| TypeScript | 無（純 JSX） |
| 測試框架 | 無 |

---

## 3. 身份驗證

### 3.1 登入流程
- 唯一登入方式：**Google Sign-In**（`signInWithPopup`）
- App.jsx 監聽 `onAuthStateChanged`，等 Auth 初始化後才渲染頁面，避免閃爍

### 3.2 In-App Browser 偵測
偵測到以下瀏覽器時，顯示「請改用 Chrome/Safari 開啟」提示：
- LINE、Facebook、Instagram、WeChat、Snapchat
- Android 原生瀏覽器（非 Chrome）

提示包含複製連結按鈕，引導用戶改用標準瀏覽器。

---

## 4. 主要功能頁面（4 個 Tab）

### 4.1 儀表板（Dashboard）
**快速統計列：**
- 訓練天數（獨立日期數）
- 總組數
- 最新 BMI 值

**每週訓練量折線圖：**
- 顯示最近 8 週的組數趨勢
- X 軸：週起始日期，Y 軸：總組數

**最新身材數據 Card：**
- 顯示最新體重 + BMI 數值 + BMI 分類標籤
- BMI 進度條：視覺化顯示當前 BMI 位置
- BMI 達標提示：顯示「再增/減 X kg 可達標準體重」或「維持在標準範圍」

**BMI 色彩分類：**
| 範圍 | 顏色 | 分類 |
|------|------|------|
| < 18.5 | 藍色 | 體重過輕 |
| 18.5–24 | 綠色 | 標準體重 |
| 24–28 | 黃色 | 體重過重 |
| > 28 | 紅色 | 肥胖 |

**個人最佳（Top 5 PRs）：**
- 列出個人紀錄前 5 的動作：動作名稱、最大重量、達成日期
- 按重量降序排列

**近期訓練：**
- 最新 5 筆訓練記錄，顯示動作名稱、日期、各組標籤

**激勵文字 Card：**
- 連續訓練 ≥ 3 天：顯示連續天數里程碑
- 未達標：顯示提醒記錄訓練的文案

---

### 4.2 訓練日誌（Workout Log）
此 Tab 包含兩區塊：新增訓練 + 歷史紀錄。

#### 新增訓練表單

**日期欄位：** 預設今天，可手動更改

**動作選擇器（v1.3.2 重設計）：**
- 未展開：顯示已選動作或 placeholder「請選擇或搜尋動作」（v1.3.4）
- 展開後顯示：
  - 搜尋框（即時過濾，不分大小寫）
  - 部位 Tag 列（胸/背/肩/腿/手臂/核心/有氧/自訂，可切換）
  - 最近使用（最多 5 個）
  - 全動作列表（依 Tag 或搜尋結果顯示）
  - 自訂動作可新增、刪除（刪除需確認）
- 預設動作庫（7 大部位，共 35 個動作）
- localStorage 記憶上次選擇的 Tag

**訓練組數（v1.3.4 版面）：**
- 次數（reps）與重量（kg）**上下排列**，不超出畫面寬度
- 可動態新增/移除組
- 刪除按鈕在多組時才顯示

**備註欄位：** 可選填

**儲存按鈕驗證（v1.3.4）：**
- 必須選擇動作（不能為空）
- 至少一組有填入次數或重量
- 不滿足條件：按鈕灰色 + disabled，不顯示額外提示
- 儲存成功：動畫回饋（0.5s 縮放）

**破紀錄偵測（PR Detection）：**
- 若儲存的任一組重量 > 該動作歷史最高，觸發金色 Toast「🏆 NEW PR！」（2.5s）
- 編輯訓練時同樣觸發

#### 歷史紀錄

- 顯示所有訓練記錄，依建立時間降序排列
- 每筆顯示：日期、動作名稱、各組標籤（次數 × 重量）、備註
- 每筆可「編輯」或「刪除」（刪除需確認彈窗）

**分組收合（v1.3.6）：**
- 右上角可切換「依週」／「依月」分組模式（偏好存 localStorage）
- 預設只展開最新一組，點擊群組 Header 可手動收合展開
- 週群組顯示 MM/DD – MM/DD 範圍；月群組顯示 YYYY 年 M 月

**編輯訓練 Bottom Sheet：**
- 可修改：日期、動作、組數、備註
- 使用同樣的動作選擇器（pickerTarget = "editWorkout"）
- 儲存後 1.2s 動畫，自動關閉

---

### 4.3 身材數據（Body Data）

#### 紀錄表單

**欄位：**（全部可選，儲存至少填一個）
- 體重（kg）、身高（cm）
- 胸圍、腰圍、臀圍、手臂圍、大腿圍（cm）

**同日期覆蓋機制（v1.2.2）：**
- Firestore doc ID = 日期字串，自動 upsert
- 切換日期時，自動帶入舊資料
- 若當日已有紀錄，顯示警告「⚠️ 此日期已有紀錄，儲存將覆蓋現有數據」
- 儲存按鈕文字改為「✏️ 更新身材數據」

#### 身材趨勢圖

**8 個指標切換：** 體重、BMI、身高、胸圍、腰圍、臀圍、手臂圍、大腿圍

**折線圖：**
- X 軸：日期（MM-DD），Y 軸：數值
- 只顯示該指標有有效值的資料點
- 需至少 2 筆才顯示圖表
- BMI 圖附 18.5（藍色）和 24（黃色）參考線

**自訂 Tooltip：**
- 深色浮窗，顯示完整日期 + 數值 + 單位

#### 身材紀錄歷史

- 最新 5 筆記錄
- 顯示當前選擇指標的數值（最新一筆橙色標示）
- 概要：胸/腰/臀 圍度
- 漲跌箭頭：對比前一筆，增加顯示紅色↑，減少顯示綠色↓
- 每筆可刪除（需確認）

---

### 4.4 目標追蹤（Goal Tracking）

#### 目標類型（5 種）

| 類型 | 欄位 | 進度計算 |
|------|------|---------|
| 體重目標 | 目標體重（kg）、截止日 | 最新體重 vs 目標 |
| 訓練頻率 | 目標天數/週、截止日 | 本週已訓練天數 vs 目標 |
| 動作 PR | 動作名稱、目標重量（kg）、截止日 | 該動作最大重量 vs 目標 |
| 身材圍度 | 部位（腰/胸/臀/手臂/大腿）、目標值（cm）、截止日 | 最新圍度 vs 目標 |
| BMI 目標 | 目標 BMI 值、截止日 | 當前 BMI vs 目標（需有體重＋身高紀錄） |

**進度方向判斷（v1.3.6）：**
- 儲存目標時自動寫入 `goalDirection`（`increase` / `decrease`）
- 舊目標無此欄位時，以 `targetValue < startValue` 自動 fallback
- 減少型公式：`(start - current) / (start - target) × 100`
- 增加型公式：`(current - start) / (target - start) × 100`

#### 目標卡片顯示

- 目標標題（含動作名稱 or 部位）
- 進度條（6px，依狀態變色）
- 狀態文字與顏色：
  - 已達標：綠色「✓ 已達標！」
  - 已過期：灰色「已過期」
  - 緊急（<7 天）：紅色漸層
  - 正常：橙色漸層
- 完成率百分比
- 可選備註
- 刪除按鈕（需確認）

#### 排序規則
1. 未完成、未過期（依截止日升序）
2. 已過期
3. 已達標

#### 目標達成慶祝動畫
- 進度達 100% 且尚未慶祝時觸發
- 自動更新 Firestore `celebrated: true`，防止重複觸發

---

## 5. 浮動行動按鈕（FAB）

| 狀態 | 圖示 | 動畫 | 顯示條件 |
|------|------|------|---------|
| 今日未記錄 | 💪 | 脈衝動畫（1.5s 無限循環） | 非訓練日誌 Tab |
| 今日已記錄 | + | 無 | 非訓練日誌 Tab |
| 在訓練日誌 Tab | — | — | **隱藏** |

點擊行為：跳至訓練日誌 Tab、自動展開動作選擇器

---

## 6. 訓練連續天數（Streak）

- 儲存於 Firestore `users/{uid}/meta/streak`：`count`、`lastDate`
- 每次 workouts 變動時自動計算：
  - 若今天有訓練 且 lastDate 不是今天 → 更新
  - 若 lastDate 是昨天 → count + 1，否則 count = 1
- Header 顯示 🔥 N 天 badge（count > 0 時橙紅漸層）

---

## 7. 彈窗系統

### 7.1 Remote Config 活動彈窗

| 參數 | 類型 | 說明 |
|------|------|------|
| `popup_enabled` | BOOLEAN | 主開關 |
| `popup_title` | STRING | 標題 |
| `popup_body` | STRING | 內文（`\n` 換行） |
| `popup_button_text` | STRING | 按鈕文字（預設「我知道了」） |
| `popup_trigger_type` | NUMBER | 0=每次顯示, 1=前 N 次 |
| `popup_trigger_count` | STRING | trigger_type=1 時的 N |

localStorage key 格式：`popup_seen_{title}`（計數器）

### 7.2 一次性系統彈窗

| 觸發條件 | localStorage key |
|---------|----------------|
| 首次進入身材數據 Tab | `popup_seen_body_overwrite_v121` |
| 首次進入目標追蹤 Tab | `popup_seen_goals_intro_v130` |

### 7.3 確認刪除彈窗
- 所有刪除操作（訓練、身材記錄、目標、自訂動作）皆需通過確認彈窗

---

## 8. 跑馬燈（Marquee）

- 位置：導覽列下方
- 由 Remote Config 控制：`marquee_enabled`（開關）、`marquee_texts`（JSON array）
- 動畫：60s 無限橫向捲動
- 互動：點擊可展開 Bottom Sheet 顯示全部文字，Hover 暫停
- 左右漸層遮罩

---

## 9. 推播通知

### 前端流程
1. App 啟動時更新 `userPushTokens/{uid}.lastActiveAt`
2. 若通知權限「已同意」→ 靜默刷新 FCM Token
3. 若通知權限「未決定」→ 3 秒後顯示提示 Banner
4. iOS Safari 等不支援 FCM 的瀏覽器：靜默跳過

### 通知 Banner
- 內容：🔔「開啟通知，3天未訓練時提醒你回來」
- 按鈕：開啟（觸發系統權限請求）、不了（關閉）

### Cloud Function（排程推播）
- 排程：每天 UTC 12:00
- 觸發條件（OR）：
  - `lastActiveAt` 超過 3 天
  - `lastWorkoutDate` 超過 3 天
- 去重：24 小時內不重複發送（`lastNotifiedAt`）
- 失效 Token 自動清除
- 隨機訊息（4 種）

---

## 10. Firestore 資料結構

```
users/{userId}/
├── workouts/{autoId}
│   ├── date: string (YYYY-MM-DD)
│   ├── exercise: string
│   ├── sets: Array<{ reps: string, weight: string }>
│   ├── note: string
│   └── createdAt: Timestamp
│
├── bodyData/{date}       ← doc ID = 日期字串（upsert 模式）
│   ├── date: string
│   ├── weight, height, chest, waist, hip, arm, thigh: string
│   └── createdAt: Timestamp
│
├── customExercises/{autoId}
│   ├── name: string
│   └── createdAt: Timestamp
│
├── goals/{autoId}
│   ├── type: "weight" | "frequency" | "exercise_pr" | "body_measurement" | "bmi"
│   ├── targetValue: number
│   ├── startValue: number
│   ├── unit: string
│   ├── goalDirection: "increase" | "decrease"   ← v1.3.6 新增
│   ├── targetExercise?: string
│   ├── targetBodyPart?: string
│   ├── deadline: string (YYYY-MM-DD)
│   ├── note: string
│   ├── celebrated: boolean
│   ├── completedAt: Timestamp | null
│   └── createdAt: Timestamp
│
└── meta/streak
    ├── count: number
    └── lastDate: string

userPushTokens/{userId}
├── fcmToken: string
├── lastActiveAt: Timestamp
├── lastWorkoutDate: string
└── lastNotifiedAt: Timestamp
```

---

## 11. Firestore 安全規則

- `users/{userId}/**`：只允許該 userId 的已登入用戶讀寫
- `userPushTokens/{userId}`：只允許該 userId 的已登入用戶讀寫
- 無匿名存取

---

## 12. LocalStorage 完整清單

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

## 13. 版本更新規則

語義化版號 **X.Y.Z**：

| 位 | 觸發條件 | 範例 |
|----|---------|------|
| X（Major）| 核心架構大翻新 | Local → Firebase |
| Y（Minor）| 新增模組/頁面 | 新增目標追蹤 Tab |
| Z（Patch）| Bug fix、UI 微調 | CSS 修正、文字調整 |

**每次更新版號必須同步：**
1. `FitForge.jsx` 頂部 `APP_VERSION` 常數
2. 同檔案 Changelog modal（搜尋 `showChangelog`）
3. `MEMORY.md` 版本記錄

---

## 14. 版本歷程

| 版本 | 日期 | 主要內容 |
|------|------|---------|
| v1.3.8 | 2026-03-02 | 首頁跑馬燈恢復常駐顯示、移除今日提醒卡片，有氧動作新增室內健走、慢跑、橢圓機、樓梯機、游泳 |
| v1.3.7 | 2026-03-02 | 新增 Vitest 單元測試套件（30 個 GWT 測試覆蓋核心業務邏輯） |
| v1.3.6 | 2026-03-01 | 新增 BMI 目標類型、修正目標進度方向計算、歷史紀錄依週／月分組收合 |
| v1.3.5 | 2026-03-01 | 優化推播通知圖示，Android 狀態列現在顯示正確的 FitForge 圖示 |
| v1.3.4 | 2026-03-01 | FAB 優化（訓練頁隱藏、已記錄改顯示「+」）；動作預設留空＋儲存禁用驗證；組數輸入框改上下排列 |
| v1.3.3 | 2026-03-01 | 目標追蹤頁首次進入引導彈窗 |
| v1.3.2 | 2026-03-01 | 動作選擇器重設計（搜尋＋部位 Tag＋最近使用）；自訂動作整合；FAB 升級 |
| v1.3.1 | 2026-03-01 | 版本通知機制（頭像紅點＋NEW badge） |
| v1.3.0 | 2026-03-01 | 訓練日誌合併；新增目標追蹤 Tab |
| v1.2.6 | 2026-03-01 | BMI 達標提示＋BMI 趨勢折線（含參考線） |
| v1.2.5 | 2026-03-01 | 移除重複浮動脈衝按鈕 |
| v1.2.4 | 2026-02-28 | 跑馬燈＋通知 Banner |
| v1.2.3 | 2026-02-28 | Footer 版本號與版權聲明 |
| v1.2.2 | 2026-02-28 | 身材數據同日覆蓋 bug 修正；日期為 doc ID |
| v1.2.1 | 2026-02-28 | 趨勢圖日期排序修正；同日覆蓋機制 |
| v1.2.0 | 2026-02-27 | PR 追蹤金色提示；儀表板週訓練量趨勢圖 |
| v1.1.0 | 2026-02-27 | 身材趨勢折線圖；訓練/身材紀錄編輯刪除 |
| v1.0.0 | 2026-02-24 | 初始版本 |
