---
name: testing-rules
description: FitForge 測試規範，適用純函式工具層與測試檔案
paths: src/utils/**
---

## 測試規範

- 執行：`npm test`（Vitest，不需 build）
- 純函式與布林判斷邏輯必須放在 `src/utils/fitforge.utils.js`，並補對應測試
- 新增測試案例時，同步更新 `docs/testing.md` 的 GWT 表格
- UI 互動與 Firestore 操作不在測試範圍

## Test ID 格式

`TC-{字母}{數字}`，字母對應函式：
- W = getWeekStart
- G = getGoalProgress
- T = getGoalTitle
- P = detectNewPR
- B = calcBMI
- V = canSave*

## GWT 格式（強制）

每個 test 必須包含三段註解：

```js
// Given: <前置條件>
// When: <執行動作>
// Then: <預期結果>
```

`docs/testing.md` 格式：`**TC-XN**` 標題 + 中文 Given/When/Then 條列
