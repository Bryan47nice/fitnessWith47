# /overnight-review

每天早上用這個指令，一次看完昨晚做了什麼、拿到測試連結、知道怎麼驗收。

## 執行步驟

### Step 1 — 讀取報告

```bash
# 找最新一份報告（依修改時間排序，取第一個）
ls -t docs/overnight-report-????????-0[12].md 2>/dev/null | head -1 | xargs cat
cat docs/overnight-backlog.md
# 取得所有 preview channel 的真實 URL（含 hash）
firebase hosting:channel:list 2>/dev/null
```

若找到的是 02 班報告，順帶告知用戶：「同日還有 01 班報告，可執行 `cat docs/overnight-report-YYYYMMDD-01.md` 查看」（將 YYYYMMDD 替換為實際日期）。
若想查看所有歷史報告，可執行 `ls docs/overnight-report-*.md`。

### Step 1.5 — 檢查規劃待核准

讀取 `docs/overnight-backlog.md`，若有 `📝 [規劃完成]` 項目，讀取對應的 `docs/plans/` 文件，在輸出中加入「規劃待核准」區塊（位於驗收 branches 之前）：

```
## 📋 規劃待核准

### {功能名稱}
目標：{一句話}
影響範圍：{檔案列表}
分階段建議：{如有}
📄 完整規劃：docs/plans/YYYY-MM-DD-feature-name.md

→ 核准：「approve {feature-name}」
→ 退回：「reject {feature-name}」或「reject {feature-name} {修改意見}」
```

**收到 approve 指令時：**
在 `docs/overnight-backlog.md` 將對應的 `📝 [規劃完成]` 改為 `✅ [用戶核准]`，回報「✅ 已核准，下次 overnight 將按規劃實作」

**收到 reject 指令時：**
1. 刪除對應 `docs/plans/` 規劃文件
2. 在 backlog 將項目改回 `📋 [需規劃]`，並在後面加上用戶的修改意見
3. 回報「已退回，overnight agent 下次重新規劃時會參考意見」

---

### Step 2 — 整理輸出

以下列格式輸出今日驗收包（不要輸出原始 markdown，重新整理成易讀格式）：

---

## 🌙 Overnight Report — {日期}

### 🧪 測試帳號
- Email：`preview@fitforgetest.dev`
- 密碼：`FitForge2026Preview!`
- 預載資料：10 筆身材記錄（3 個月）、30 筆訓練（臥推/深蹲/硬舉/跑步）
- 如果測試帳號資料不夠新鮮，可執行 `node scripts/seed-test-account.cjs` 重置

---

對每個完成的 branch，輸出一個區塊：

### ✅ Branch {N}：{功能名稱}
**🔗 測試連結**：{從 firebase hosting:channel:list 取得的真實 URL，格式為 https://fitnesswith47--ov-{feature}-{hash}.web.app}
> 在連結頁面底部找「🧪 用測試帳號登入」按鈕直接進入，不需要 Google 帳號
> ⚠️ 若開啟後為黑畫面：請用無痕視窗（Ctrl+Shift+N）開啟；若無痕也黑畫面請等 2 分鐘讓 GitHub Actions 部署完成後再試

**驗收步驟：**
（從 report 取得，或根據功能自動推導）
1. 進入 XXX Tab
2. 執行 XXX 操作
   ✅ 預期：看到 XXX

**要 merge 嗎？** → 告訴我「merge {branch名稱}」或「跳過 {branch名稱}」

---

如果有 In Progress（WIP）branch：

### 🔴 WIP：{功能名稱}
- 做到哪：{說明}
- 剩餘工作：{說明}
- 下次繼續：今晚 overnight agent 會自動接手

---

### 📋 Pending 清單（依優先順序）
列出 backlog 中的 pending 項目，標示優先度。

---

### Step 3 — 等待用戶指令

等用戶逐一說「merge X」或「跳過 X」。

**收到 merge 指令時：**

1. 先執行 `/pre-merge-check {branch-name}`
   - 若結論為 ⚠️：列出疑問，詢問用戶「確認繼續 merge 嗎？」，等待確認後才繼續
   - 若結論為 ✅：直接進行下一步

2. 執行 merge：
```bash
git checkout master
git merge {branch-name} --no-ff -m "merge: {branch-name}"
```

   **若發生 merge 衝突：**
   ```bash
   git merge --abort
   ```
   接著在 `docs/overnight-backlog.md` 的 Pending 區新增一筆：
   ```
   - ⏳ {功能名稱} — 與 {衝突的已合入 branch} 衝突，需在新 master 上重做 | branch: {branch-name}
   ```
   回報用戶：「⚠️ merge 衝突已中止。`{branch-name}` 已記回 backlog，overnight agent 下次會在新 master 上重做。」

   **若 merge 成功：**
   ```bash
   git push origin master
   ```
   回報：「✅ Merged {branch-name}」

3. 所有 branch 都處理完後（merge 或跳過），執行整合測試：
```bash
npm test
```
   - ✅ 全數通過：回報「✅ 整合測試通過，可進行 version bump」
   - ⚠️ 有失敗：回報失敗的測試案例，等待用戶指示

**收到跳過指令時：**
只回報「⏭ 跳過 {branch-name}，branch 保留在本地（不刪除）」，不做任何 git 操作。

---

## 注意事項

- Preview URL 由 `firebase hosting:channel:list` 取得，格式為 `https://fitnessWith47--ov-{feature}-{hash}.web.app`
- URL 在 GitHub Actions 完成後約 2 分鐘生效（push 後觸發）
- 每個 preview channel 有效期 7 天
- **黑畫面處理**：先用無痕視窗（Ctrl+Shift+N）開啟；若無痕正常但一般瀏覽器黑畫面 → DevTools → Application → Service Workers → Unregister → 重整
- 測試帳號登入按鈕只出現在包含 `--ov-` 的 preview URL，生產環境不會顯示
- merge 完所有想要的 branch 後，才做 version bump（product.md 在那時一次更新）
