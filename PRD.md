# FitForge - 產品需求文件 (PRD)

**版本**: 1.0
**日期**: 2026-02-24
**狀態**: 現行版本

---

## 1. 產品概覽

### 1.1 產品名稱

**FitForge**（健身鍛造）— 個人健身追蹤 Progressive Web App

### 1.2 產品願景

打造一款輕量、好用的個人健身追蹤工具，讓使用者能在手機上隨手記錄每次訓練、追蹤身材變化，並透過連續訓練挑戰維持長期運動習慣。

### 1.3 目標用戶

- 有固定重訓習慣的健身愛好者
- 想要追蹤身材數據變化的使用者
- 使用 Google 帳號且習慣跨裝置同步資料的用戶
- 偏好手機操作的用戶（行動優先設計）

### 1.4 產品定位

| 維度 | 描述 |
|------|------|
| 平台 | PWA（可安裝至手機主畫面） |
| 語言 | 繁體中文 |
| 部署 | Google Firebase Hosting |
| 網址 | fitnesswith47.web.app |

---

## 2. 技術架構

### 2.1 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| UI 框架 | React | 19.2.0 |
| 建構工具 | Vite | 7.3.1 |
| 後端服務 | Firebase | 12.9.0 |
| 身份驗證 | Firebase Auth (Google OAuth) | — |
| 資料庫 | Cloud Firestore | — |
| PWA | vite-plugin-pwa | 1.2.0 |
| 部署 | Firebase Hosting | — |

### 2.2 系統架構圖

```
使用者裝置
└── FitForge PWA (React 19 + Vite)
    ├── Service Worker (離線快取)
    ├── Firebase Auth (Google OAuth 登入)
    └── Firestore SDK (即時資料同步)
            ↕
    Google Firebase Cloud
    ├── Firebase Auth 服務
    ├── Cloud Firestore 資料庫
    └── Firebase Hosting (靜態資源)
```

### 2.3 Firestore 資料結構

```
users/
  {userId}/
    workouts/
      {docId}/
        date:      string (YYYY-MM-DD)
        exercise:  string (動作名稱)
        sets:      Array<{ reps: number, weight: number }>
        note:      string (訓練備註)
        createdAt: Timestamp

    bodyData/
      {docId}/
        date:   string (YYYY-MM-DD)
        weight: number (kg)
        height: number (cm)
        chest:  number (cm)
        waist:  number (cm)
        hip:    number (cm)
        arm:    number (cm)
        thigh:  number (cm)
        createdAt: Timestamp

    meta/
      streak/
        count:    number (連續天數)
        lastDate: string (YYYY-MM-DD)
```

### 2.4 Firestore 安全規則

- 使用者只能讀寫自己的資料（`request.auth.uid == userId`）
- 未登入用戶無法存取任何資料
- 規則路徑：`users/{userId}/{document=**}`

---

## 3. 功能需求

### 3.1 身份驗證模組

#### 3.1.1 登入頁面

**功能說明**：使用者首次進入或登出後看到的頁面。

**需求清單**：

| ID | 需求 | 優先級 |
|----|------|--------|
| AUTH-01 | 提供 Google 帳號一鍵登入按鈕 | P0 |
| AUTH-02 | 使用 Firebase Google OAuth 重定向流程 | P0 |
| AUTH-03 | 登入後自動跳轉至主應用頁面 | P0 |
| AUTH-04 | 在應用內瀏覽器（LINE、Facebook、Instagram、WeChat 等）顯示警告提示，引導用戶至外部瀏覽器開啟 | P1 |
| AUTH-05 | 展示應用四大核心功能介紹（作為登入誘因） | P2 |

**功能介紹文案**（登入頁展示）：
1. 💪 記錄訓練組數與重量
2. 📏 追蹤身材數據與 BMI
3. 🔥 連續訓練天數挑戰
4. ☁️ 雲端同步，跨裝置使用

#### 3.1.2 認證狀態管理

| ID | 需求 | 優先級 |
|----|------|--------|
| AUTH-06 | 應用啟動時顯示 Loading 動畫（BadgeLogo）直到認證狀態確認 | P0 |
| AUTH-07 | 已登入用戶直接進入主應用，無需重新登入 | P0 |
| AUTH-08 | 未登入用戶只能看到登入頁，無法存取主應用 | P0 |

---

### 3.2 主應用模組（FitForge）

主應用分為四個標籤頁，底部導航切換。

#### 3.2.1 儀表板（Dashboard）

**頁面入口**：⚡ 圖示，預設開啟頁面

**需求清單**：

| ID | 需求 | 優先級 |
|----|------|--------|
| DASH-01 | 顯示累計訓練天數統計 | P0 |
| DASH-02 | 顯示累計訓練總組數 | P0 |
| DASH-03 | 顯示當前 BMI 值（依最新體重與身高計算） | P0 |
| DASH-04 | 顯示最新身材數據摘要 | P1 |
| DASH-05 | 顯示近期訓練記錄（最多前 5 筆） | P1 |
| DASH-06 | 顯示每日激勵提示文字 | P2 |
| DASH-07 | 顯示連續訓練天數（🔥 火焰圖示） | P0 |
| DASH-08 | 連續訓練 3 天以上顯示特殊激勵訊息 | P2 |

**BMI 計算規則**：
`BMI = 體重(kg) ÷ (身高(m))²`

#### 3.2.2 訓練記錄（Workout）

**頁面入口**：💪 圖示

**需求清單**：

| ID | 需求 | 優先級 |
|----|------|--------|
| WO-01 | 提供日期選擇器，預設為今日 | P0 |
| WO-02 | 提供預定義動作下拉選單（10 種標準動作） | P0 |
| WO-03 | 支援自訂動作名稱輸入 | P1 |
| WO-04 | 動態組數管理：可新增組數 | P0 |
| WO-05 | 動態組數管理：可移除組數 | P0 |
| WO-06 | 每組記錄次數（reps）和重量（kg） | P0 |
| WO-07 | 提供訓練備註輸入欄位 | P1 |
| WO-08 | 儲存後顯示成功動畫（"✓ 已儲存！"） | P2 |
| WO-09 | 資料同步至 Firebase Firestore | P0 |
| WO-10 | 儲存後自動更新連續訓練天數 | P0 |

**預定義動作清單**：

| # | 動作名稱 |
|---|----------|
| 1 | 臥推 |
| 2 | 深蹲 |
| 3 | 硬舉 |
| 4 | 引體向上 |
| 5 | 肩推 |
| 6 | 划船 |
| 7 | 二頭彎舉 |
| 8 | 三頭下壓 |
| 9 | 腿推 |
| 10 | 飛鳥 |

#### 3.2.3 身材數據（Body）

**頁面入口**：📏 圖示

**需求清單**：

| ID | 需求 | 優先級 |
|----|------|--------|
| BODY-01 | 提供 7 個身體數據輸入欄位 | P0 |
| BODY-02 | 顯示歷史身材數據列表 | P0 |
| BODY-03 | 顯示體重趨勢（與上次記錄比較，顯示 ↑↓ 箭頭） | P1 |
| BODY-04 | 資料同步至 Firebase Firestore | P0 |
| BODY-05 | 依日期排序顯示歷史記錄 | P0 |

**身體數據欄位**：

| 欄位 | 單位 |
|------|------|
| 體重 | kg |
| 身高 | cm |
| 胸圍 | cm |
| 腰圍 | cm |
| 臀圍 | cm |
| 手臂圍 | cm |
| 大腿圍 | cm |

#### 3.2.4 歷史紀錄（History）

**頁面入口**：📋 圖示

**需求清單**：

| ID | 需求 | 優先級 |
|----|------|--------|
| HIST-01 | 顯示所有訓練歷史記錄 | P0 |
| HIST-02 | 按日期分組顯示 | P0 |
| HIST-03 | 展示每次訓練的動作名稱、組數、次數、重量詳細資訊 | P0 |
| HIST-04 | 依日期降序排列（最新在前） | P0 |

---

### 3.3 連續訓練追蹤系統（Streak）

| ID | 需求 | 優先級 |
|----|------|--------|
| STK-01 | 每次記錄訓練後自動計算連續訓練天數 | P0 |
| STK-02 | 比對昨日是否有訓練記錄以決定是否累加 streak | P0 |
| STK-03 | 若超過一天未訓練，streak 重設為 1 | P0 |
| STK-04 | Streak 數據持久化至 Firestore（meta/streak） | P0 |
| STK-05 | 儀表板顯示當前 streak 計數與 🔥 圖示 | P0 |

---

## 4. 非功能需求

### 4.1 Progressive Web App (PWA)

| ID | 需求 |
|----|------|
| PWA-01 | 支援安裝至手機主畫面（Add to Home Screen） |
| PWA-02 | 支援離線快取（Service Worker） |
| PWA-03 | 提供 192x192 和 512x512 PWA 圖示 |
| PWA-04 | 顯示模式：standalone（全屏，無瀏覽器 UI） |
| PWA-05 | 方向鎖定：portrait（直向） |
| PWA-06 | Service Worker 自動更新（autoUpdate） |

**快取策略**：
- Google Fonts：CacheFirst，最長快取 1 年
- 靜態資源（js、css、html、ico、png、svg）：全域預快取

### 4.2 效能需求

| ID | 需求 |
|----|------|
| PERF-01 | 使用 Vite 建構，確保快速載入 |
| PERF-02 | 程式碼分割與 Tree Shaking 最小化 bundle 大小 |
| PERF-03 | Firestore 即時監聽（onSnapshot），確保資料即時同步 |
| PERF-04 | 應用最大寬度 480px，行動裝置優先設計 |

### 4.3 安全性需求

| ID | 需求 |
|----|------|
| SEC-01 | Firestore 安全規則確保用戶資料隔離 |
| SEC-02 | Firebase 設定透過環境變數（.env）管理，不硬編碼 |
| SEC-03 | 未認證用戶無法存取任何資料或頁面 |

### 4.4 無障礙與相容性

| ID | 需求 |
|----|------|
| A11Y-01 | 符合 WCAG 色彩對比標準 |
| A11Y-02 | 按鈕觸控目標尺寸 ≥ 44px |
| A11Y-03 | 語意化 HTML 結構 |
| A11Y-04 | 支援 iPhone notch（viewport-fit=cover） |
| A11Y-05 | Apple PWA 支援（apple-mobile-web-app-capable） |

---

## 5. 設計規範

### 5.1 色彩系統

| 用途 | 色碼 |
|------|------|
| 背景主色 | `#0a0a0f` |
| 文字主色 | `#e8e4dc` |
| 品牌主色（橙） | `#ff6a00` |
| 品牌輔色（金） | `#ffd700` |
| 品牌漸層 | `linear-gradient(90deg, #ff6a00, #ffd700)` |
| 次要文字 | `#888888` |
| 禁用文字 | `#666666` |
| 卡片背景 | `rgba(255, 255, 255, 0.04)` |

### 5.2 背景效果

- 固定深色背景（`#0a0a0f`）
- 兩層徑向漸層光暈：
  - 頂部：`rgba(255, 90, 0, 0.12)` 橙色光
  - 右下：`rgba(255, 180, 0, 0.07)` 金色光

### 5.3 字體

| 用途 | 字體 |
|------|------|
| 英文標題 | Barlow Condensed（Google Fonts） |
| 中文正文 | Noto Sans TC（Google Fonts） |

### 5.4 UI 元件規範

| 元件 | 樣式規範 |
|------|----------|
| 卡片 | 半透明背景 + 毛玻璃邊框效果 |
| 輸入框 | 深色背景 + 細邊框 |
| 主要按鈕 | 品牌漸層背景 + 懸停縮放效果 |
| 標籤 | 小型彩色徽章 |

### 5.5 品牌 Logo（BadgeLogo）

SVG 圓形徽章設計：
- 深色圓形背景（`#0a0a0f`）
- 橙金漸層圓環
- 中央大型「47」數字（290px 字體）
- -30° 旋轉條形銅鈴圖形（左右大號 + 小號銅片）
- 底部「FITNESS」文字

---

## 6. 使用者流程

### 6.1 首次使用流程

```
開啟應用
    ↓
Loading 畫面（BadgeLogo 動畫）
    ↓
未登入 → 登入頁面
    ↓
點擊「Google 登入」
    ↓
Google OAuth 重定向
    ↓
登入成功 → 主應用（儀表板）
```

### 6.2 記錄訓練流程

```
主應用 → 點擊「💪 Workout」
    ↓
選擇日期
    ↓
選擇動作（預定義 or 自訂）
    ↓
新增組數 → 輸入次數和重量
    ↓
（可選）填寫備註
    ↓
點擊「儲存」
    ↓
✓ 儲存成功動畫
    ↓
Firestore 同步 + Streak 更新
```

### 6.3 記錄身材數據流程

```
主應用 → 點擊「📏 Body」
    ↓
填入各項身體數據（可選填）
    ↓
點擊「儲存」
    ↓
Firestore 同步
    ↓
顯示歷史記錄 + 體重趨勢
```

---

## 7. 資料需求

### 7.1 訓練記錄欄位

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| date | string | 是 | YYYY-MM-DD 格式 |
| exercise | string | 是 | 動作名稱（預定義或自訂） |
| sets | array | 是 | 組數陣列，每組含 reps 和 weight |
| sets[].reps | number | 是 | 次數 |
| sets[].weight | number | 是 | 重量（kg） |
| note | string | 否 | 訓練備註 |
| createdAt | Timestamp | 是 | 建立時間（自動） |

### 7.2 身材數據欄位

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| date | string | 是 | YYYY-MM-DD 格式 |
| weight | number | 否 | 體重（kg） |
| height | number | 否 | 身高（cm） |
| chest | number | 否 | 胸圍（cm） |
| waist | number | 否 | 腰圍（cm） |
| hip | number | 否 | 臀圍（cm） |
| arm | number | 否 | 手臂圍（cm） |
| thigh | number | 否 | 大腿圍（cm） |
| createdAt | Timestamp | 是 | 建立時間（自動） |

### 7.3 連續訓練 Meta 資料

| 欄位 | 類型 | 說明 |
|------|------|------|
| count | number | 當前連續訓練天數 |
| lastDate | string | 最後一次訓練日期（YYYY-MM-DD） |

---

## 8. 部署配置

### 8.1 建構設定

| 項目 | 值 |
|------|-----|
| 建構工具 | Vite |
| 建構輸出目錄 | `dist/` |
| 建構指令 | `npm run build` |
| 開發指令 | `npm run dev` |
| 預覽指令 | `npm run preview` |

### 8.2 Firebase 部署

| 項目 | 值 |
|------|-----|
| 專案 ID | fitnesswith47 |
| Hosting 來源 | dist/ |
| SPA 路由重寫 | 所有路由指向 index.html |
| 部署域名 | fitnesswith47.web.app |

### 8.3 環境變數

透過 `.env` 檔案管理以下 Firebase 設定（不可提交至版控）：

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

---

## 9. 版本資訊

### 9.1 現行版本功能範圍（v1.0）

- [x] Google OAuth 登入 / 登出
- [x] 儀表板（統計、BMI、近期記錄、激勵）
- [x] 訓練記錄（預定義動作、自訂動作、組數管理）
- [x] 身材數據記錄與趨勢追蹤
- [x] 完整歷史記錄瀏覽
- [x] 連續訓練天數追蹤（Streak）
- [x] Firebase 雲端即時同步
- [x] PWA 安裝支援
- [x] Service Worker 離線快取
- [x] In-App 瀏覽器偵測提示

### 9.2 未來可擴展功能（Backlog）

- [ ] 訓練圖表分析（體重曲線、訓練量趨勢）
- [ ] 訓練計畫 / 課表功能
- [ ] 動作個人最高紀錄（PR）追蹤
- [ ] 訓練記錄刪除 / 編輯功能
- [ ] 身材數據刪除 / 編輯功能
- [ ] 資料匯出（CSV / PDF）
- [ ] 推播通知（每日訓練提醒）
- [ ] 多語言支援（英文、簡體中文）
- [ ] 深色 / 淺色主題切換
- [ ] 社群分享功能（分享訓練成果）

---

## 10. 附錄

### 10.1 檔案結構

```
fitnessWith47/
├── src/
│   ├── components/
│   │   ├── FitForge.jsx     # 主應用組件（24KB，核心業務邏輯）
│   │   ├── Login.jsx        # 登入頁面
│   │   └── BadgeLogo.jsx    # SVG 品牌徽章（Loading 動畫）
│   ├── firebase.js          # Firebase SDK 初始化設定
│   ├── App.jsx              # 根組件（認證狀態路由）
│   ├── main.jsx             # React 入口點
│   ├── index.css            # 全局樣式
│   └── App.css              # 應用樣式
├── public/
│   ├── icons/
│   │   ├── icon-192.png     # PWA 圖示
│   │   └── icon-512.png     # PWA 圖示（高解析度）
│   ├── logo.svg             # 品牌 Logo SVG
│   └── vite.svg
├── dist/                    # 建構輸出（自動生成）
├── package.json             # 依賴設定
├── vite.config.js           # Vite + PWA 設定
├── firebase.json            # Firebase 部署設定
├── firestore.rules          # Firestore 安全規則
├── generate-icons.mjs       # PWA 圖示生成腳本
├── .env                     # Firebase 環境變數（不提交）
└── .gitignore
```

### 10.2 應用名稱說明

- **FitForge**：Fitness（健身）+ Forge（鍛造），寓意「透過持續訓練鍛造更好的自己」
- **47**：品牌識別數字，體現於品牌徽章中央
- **徽章設計**：條形銅鈴圖形象徵重量訓練器材
