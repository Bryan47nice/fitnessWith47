---
name: style-rules
description: FitForge 程式碼風格規範，適用所有 React 元件檔案
paths: src/components/**
---

## 樣式規範（強制）

- **全部使用 inline styles**，禁止新增 CSS 檔案或使用 className
- **設計語言**：Glassmorphism — `backdrop-filter: blur(10px)`、rgba 色彩
- 禁止引入 CSS modules / styled-components / Tailwind

## 彈窗渲染（強制）

- 新增彈窗必須使用 `createPortal` 渲染，避免 z-index 層疊問題

## 破壞性操作（強制）

- 刪除 workout、刪除 body record 等破壞性操作，必須先走 `confirmDialog` 確認流程

## PR 偵測動畫

- 新增訓練時偵測最大重量是否破紀錄，觸發 `prAnim` 金色動畫
