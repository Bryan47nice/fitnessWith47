# /pre-merge-check

merge overnight branch 前的安全檢查。驗證異動檔案是否符合功能範圍、APP_VERSION 未被修改、並偵測與本 session 已 merge branch 的潛在衝突。

**用法：** `/pre-merge-check overnight/YYYY-MM-DD/feature-name`

---

## 執行步驟

### Step 1 — 解析功能範圍

從 branch 名稱第三段（kebab-case）推斷本次功能範疇。

例：
- `overnight/2026-04-19/rest-timer-sound` → 計時器音效相關
- `overnight/2026-04-19/pr-category-filter` → PR 分類篩選相關
- `overnight/2026-04-19/treadmill-pace` → 跑步機配速相關

### Step 2 — 列出異動檔案

```bash
git diff master...{branch} --name-only
```

逐一判斷每個檔案是否符合功能範疇：

| 符號 | 意義 |
|------|------|
| ✅ | 符合預期（功能邏輯、對應測試、樣式等） |
| ⚠️ | 疑問：此功能不應動到這個檔案，需說明理由 |

常見合理檔案範圍：
- `src/components/FitForge.jsx` — 幾乎所有功能都會動
- `src/utils/fitforge.utils.js` + `src/utils/fitforge.utils.test.js` — 新增純函式時
- `docs/overnight-backlog.md` — overnight agent 更新狀態時
- `docs/testing.md` — QA agent 補測試文件時

不應出現的檔案（若出現需特別說明）：
- `src/components/Login.jsx`（除非功能本身與登入相關）
- `firestore.rules`（除非功能涉及新 collection）
- `.env` / `firebase.json` / `vite.config.js`

### Step 3 — 確認 APP_VERSION 未被修改

```bash
git diff master...{branch} -- src/components/FitForge.jsx | grep "APP_VERSION"
```

- 無輸出 → ✅ APP_VERSION 未動
- 有輸出 → ⚠️ overnight agent 不應修改版號，標記警告

### Step 4 — 偵測潛在衝突

比對此 branch 異動的檔案 vs **本 session 中已成功 merge 的 branch** 異動的檔案。

```bash
# 取得本 branch 異動檔案
git diff master...{branch} --name-only

# 取得最近一次 merge commit 的異動檔案（本 session 已 merge 的）
git diff HEAD~1...HEAD --name-only
```

若有重疊檔案 → ⚠️ 警告：`{檔案名}` 與剛合入的 `{已 merge branch}` 都有異動，merge 時可能發生衝突

若本 session 尚未 merge 任何 branch → 跳過此步驟

### Step 5 — 輸出結論

```
🔍 pre-merge-check：overnight/YYYY-MM-DD/feature-name
功能範疇：{推斷的功能說明}

異動檔案：
  ✅ src/components/FitForge.jsx    — 符合（功能邏輯）
  ✅ src/utils/fitforge.utils.js    — 符合（新增純函式）
  ✅ src/utils/fitforge.utils.test.js — 符合（對應測試）

APP_VERSION：✅ 未修改
衝突風險：✅ 無（或 ⚠️ 與 {branch} 有重疊檔案）

結論：✅ 可安全 merge
```

若有任何 ⚠️：

```
結論：⚠️ 有 {N} 個疑問，請確認後告訴我是否繼續 merge
```

等用戶確認後再繼續，不自行決定。
