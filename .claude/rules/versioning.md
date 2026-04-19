---
name: versioning-rules
description: FitForge 版號與 Changelog 更新規範，適用主元件與產品文件
paths: src/components/FitForge.jsx, docs/product.md
---

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
