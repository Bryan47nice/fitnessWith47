# FitForge — GWT 測試文件

## 測試框架

| 項目 | 說明 |
|------|------|
| 框架 | **Vitest v4**（與 Vite 原生整合，零額外配置） |
| 環境 | `jsdom`（支援 localStorage 模擬） |
| 執行 | `npm test` |
| 測試檔位置 | `src/utils/fitforge.utils.test.js` |
| 工具函式位置 | `src/utils/fitforge.utils.js` |

---

## 可測函式清單

| 函式 | 說明 | 副作用 |
|------|------|--------|
| `getWeekStart(dateStr)` | 回傳該週週一的日期字串 | 無 |
| `calcBMI(weight, height)` | 計算 BMI，缺值回傳 null | 無 |
| `getGoalTitle(goal)` | 回傳目標的顯示標題 | 無 |
| `getGoalProgress(goal, context)` | 計算目標進度百分比（0–100） | 無 |
| `detectNewPR(exercise, sets, prMap)` | 偵測是否有新 PR | 無 |
| `canSaveWorkout(exercise, sets)` | 儲存訓練按鈕是否可用 | 無 |
| `canSaveGoal(targetValue, deadline, goalType, latestBMI)` | 儲存目標按鈕是否可用 | 無 |

> 所有函式從 `FitForge.jsx` 抽取後，`FitForge.jsx` 改為 import 使用，行為不變。

---

## GWT 測試案例

### 一、`getWeekStart(dateStr)` — 週起始計算

**TC-W1 週三輸入，回傳該週一**
- Given：`dateStr = "2026-03-04"`（週三）
- When：呼叫 `getWeekStart("2026-03-04")`
- Then：回傳 `"2026-03-02"`（週一）

**TC-W2 週一本身不偏移**
- Given：`dateStr = "2026-03-02"`（週一）
- When：呼叫 `getWeekStart("2026-03-02")`
- Then：回傳 `"2026-03-02"`（同日）

**TC-W3 週日回到前一個週一**
- Given：`dateStr = "2026-03-08"`（週日）
- When：呼叫 `getWeekStart("2026-03-08")`
- Then：回傳 `"2026-03-02"`（前一個週一）

---

### 二、`getGoalProgress(goal, context)` — 目標進度計算

**TC-G1 增加型目標，進行到一半**
- Given：`{ type: "weight", startValue: 60, targetValue: 70, goalDirection: "increase" }`，`context.latestBody.weight = 65`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（%）

**TC-G2 減少型目標（goalDirection = "decrease"），進行到一半**
- Given：`{ type: "weight", startValue: 80, targetValue: 60, goalDirection: "decrease" }`，`latestBody.weight = 70`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`

**TC-G3 超過目標不超過 100**
- Given：`{ startValue: 60, targetValue: 70, goalDirection: "increase" }`，`latestBody.weight = 80`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `100`（上限）

**TC-G4 尚未開始，低於起始值**
- Given：`{ startValue: 60, targetValue: 70, goalDirection: "increase" }`，`latestBody.weight = 55`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `0`（下限）

**TC-G5 舊目標無 goalDirection，fallback 自動判斷減少型**
- Given：`{ startValue: 80, targetValue: 60, goalDirection: null }`，`latestBody.weight = 70`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（targetValue < startValue 自動視為減少型）

**TC-G6 BMI 目標**
- Given：`{ type: "bmi", startValue: 25, targetValue: 22, goalDirection: "decrease" }`，`context.latestBMI = 23.5`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（(25-23.5)/(25-22)*100）

**TC-G7 startValue === targetValue，current 已達**
- Given：`{ startValue: 70, targetValue: 70 }`，`latestBody.weight = 70`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `100`

---

### 三、`getGoalTitle(goal)` — 目標標題文字

**TC-T1 體重目標**
- Given：`{ type: "weight", targetValue: 65 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"體重目標：65 kg"`

**TC-T2 BMI 目標**
- Given：`{ type: "bmi", targetValue: 22.5 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"BMI 目標：22.5"`（無單位）

**TC-T3 身材圍度目標**
- Given：`{ type: "body_measurement", targetBodyPart: "waist", targetValue: 75 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"腰圍 目標：75 cm"`

---

### 四、`detectNewPR(exercise, sets, prMap)` — PR 破紀錄偵測

**TC-P1 首次記錄某動作，視為破紀錄**
- Given：`prMap = {}`，`sets = [{ weight: "80" }]`，exercise = `"深蹲"`
- When：呼叫 `detectNewPR("深蹲", sets, prMap)`
- Then：回傳 `true`

**TC-P2 重量超過既有 PR**
- Given：`prMap["深蹲"] = { weight: 100 }`，`sets = [{ weight: "105" }]`
- When：呼叫 `detectNewPR("深蹲", sets, prMap)`
- Then：回傳 `true`

**TC-P3 重量未超過 PR，不觸發**
- Given：`prMap["深蹲"] = { weight: 100 }`，`sets = [{ weight: "95" }]`
- When：呼叫 `detectNewPR("深蹲", sets, prMap)`
- Then：回傳 `false`

**TC-P4 重量欄位為空，不視為破紀錄**
- Given：`prMap = {}`，`sets = [{ reps: "10", weight: "" }]`
- When：呼叫 `detectNewPR("深蹲", sets, prMap)`
- Then：回傳 `false`

---

### 五、`calcBMI(weight, height)` — BMI 計算

**TC-B1 標準計算**
- Given：`weight = 70, height = 175`
- When：呼叫 `calcBMI(70, 175)`
- Then：回傳 `22.9`（70 / 1.75² = 22.857…，取一位小數）

**TC-B2 缺少身高，不計算**
- Given：`weight = 70, height = null`
- When：呼叫 `calcBMI(70, null)`
- Then：回傳 `null`

---

### 六、Validation — 儲存按鈕禁用邏輯

**TC-V1 saveWorkout — 未選動作時禁用**
- Given：`exercise = ""`，sets 有效
- When：呼叫 `canSaveWorkout("", sets)`
- Then：回傳 `false`

**TC-V2 saveWorkout — 所有組數為空時禁用**
- Given：`exercise = "深蹲"`，`sets = [{ reps: "", weight: "" }]`
- When：呼叫 `canSaveWorkout("深蹲", sets)`
- Then：回傳 `false`

**TC-V3 saveWorkout — 動作與至少一組有效時啟用**
- Given：`exercise = "深蹲"`，`sets = [{ reps: "10", weight: "" }]`
- When：呼叫 `canSaveWorkout("深蹲", sets)`
- Then：回傳 `true`

**TC-V4 saveGoal — 無截止日期時禁用**
- Given：`targetValue = "65"`, `deadline = ""`
- When：呼叫 `canSaveGoal("65", "", "weight", null)`
- Then：回傳 `false`

**TC-V5 saveGoal — BMI 目標但無身體數據時禁用**
- Given：`goalType = "bmi"`, `latestBMI = null`
- When：呼叫 `canSaveGoal("22", "2026-06-01", "bmi", null)`
- Then：回傳 `false`

---

### 七、localStorage 行為

**TC-L1 首次進入目標追蹤 Tab，顯示引導彈窗並寫入 flag**
- Given：`localStorage.getItem("popup_seen_goals_intro_v130") === null`
- When：模擬 FitForge 切換到目標追蹤 Tab 的行為
- Then：`shouldShow = true`，且 localStorage 寫入 `"1"`

**TC-L2 再次進入目標追蹤 Tab，不顯示引導彈窗**
- Given：`localStorage.getItem("popup_seen_goals_intro_v130") === "1"`
- When：模擬同上
- Then：`shouldShow = false`

**TC-L3 history_group_mode 預設為 "week"**
- Given：`localStorage.getItem("history_group_mode") === null`
- When：模擬元件初始化邏輯
- Then：`mode = "week"`

**TC-L4 切換分組模式後寫入 localStorage**
- Given：目前模式為 `"week"`
- When：`localStorage.setItem("history_group_mode", "month")`
- Then：`localStorage.getItem("history_group_mode") === "month"`

---

## 新增測試的標準流程

新增業務邏輯時，若符合以下條件，須同步補測試：

1. **純函式**：輸入輸出明確、無副作用 → 直接加到 `fitforge.utils.js` + 補測試
2. **布林判斷**（disabled、條件顯示）→ 抽成 `canXxx()` 函式並加測試
3. **localStorage 讀寫** → 在 `TC-L` 區塊補案例

> UI 互動（按鈕點擊、Sheet 開關）與 Firestore 操作目前不在測試範圍內。
