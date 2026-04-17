# /overnight-preview

為所有本地 `overnight/*` branch 部署 Firebase Hosting Preview Channel，讓用戶直接用瀏覽器測試。

## 執行步驟

1. 讀取 `.env` 取得 `FIREBASE_TOKEN`：
   ```bash
   source .env 2>/dev/null || true
   ```

2. 執行部署腳本（為所有 overnight/* branch build + deploy）：
   ```bash
   export FIREBASE_TOKEN && FIREBASE_TOKEN="$FIREBASE_TOKEN" bash scripts/overnight-preview.sh
   ```

3. 列出所有 Preview Channel 取得正確 URL：
   ```bash
   FIREBASE_TOKEN="$FIREBASE_TOKEN" firebase hosting:channel:list --project fitnesswith47
   ```

4. 輸出結果：每個 branch 對應的完整 Preview URL（格式：`https://fitnesswith47--{channel}-{hash}.web.app`）

## 注意事項

- 若有新的 preview URL，提醒用戶到 Firebase Console → Authentication → Settings → Authorized domains 加入該網域，否則會全黑
- Build 失敗只記錄，不影響其他 branch
- 若 `$FIREBASE_TOKEN` 過期，提示用戶在本機重新執行 `firebase login:ci` 取得新 token，更新 `.env`
