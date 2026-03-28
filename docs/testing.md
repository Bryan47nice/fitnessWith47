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
| `filterCalendarEvents(events, keyword)` | 依關鍵字篩選 Google Calendar 事件 | 無 |
| `getNextClass(upcomingClasses)` | 回傳最近一筆即將到來的課程，無則回傳 null | 無 |

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

**TC-G8 訓練頻率目標：本週已訓練天數計算進度**
- Given：`{ type: "frequency", startValue: 0, targetValue: 4 }`，`today = "2026-03-04"`，workouts 含 2 個不同日期（同週）
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（2/4 天 = 50%）

**TC-G9 動作 PR 目標：prMap 有紀錄時計算進度**
- Given：`{ type: "exercise_pr", targetExercise: "深蹲", startValue: 80, targetValue: 100 }`，`prMap["深蹲"].weight = 90`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（(90-80)/(100-80)*100）

**TC-G10 身材圍度目標：使用 latestBody 對應部位計算進度**
- Given：`{ type: "body_measurement", targetBodyPart: "waist", startValue: 90, targetValue: 80, goalDirection: "decrease" }`，`latestBody.waist = "85"`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（(90-85)/(90-80)*100）

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

**TC-T4 訓練頻率目標**
- Given：`{ type: "frequency", targetValue: 4 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"訓練頻率目標：4 天/週"`

**TC-T5 動作 PR 目標**
- Given：`{ type: "exercise_pr", targetExercise: "深蹲", targetValue: 120 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"深蹲 目標：120 kg"`

**TC-T6 未知目標類型，回傳預設文字**
- Given：`{ type: "unknown_type", targetValue: 99 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"目標"`（fallback）

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

**TC-B3 缺少體重，不計算**
- Given：`weight = null, height = 175`
- When：呼叫 `calcBMI(null, 175)`
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

### 八、`filterCalendarEvents(events, keyword)` — Google Calendar 事件篩選

**TC-FC1 關鍵字完全符合 summary 時回傳對應事件**
- Given：events 含兩筆不同 summary，keyword 符合其中一筆
- When：呼叫 `filterCalendarEvents(events, "瑜珈")`
- Then：回傳長度 1，且 summary 為 `"瑜珈課"`

**TC-FC2 大小寫不敏感匹配**
- Given：event.summary = `"Yoga Class"`，keyword = `"yoga"`
- When：呼叫 `filterCalendarEvents(events, "yoga")`
- Then：回傳長度 1（大小寫忽略）

**TC-FC3 無符合項目時回傳空陣列**
- Given：events 不含符合 keyword 的項目
- When：呼叫 `filterCalendarEvents(events, "瑜珈")`
- Then：回傳 `[]`

**TC-FC4 events 非陣列時回傳空陣列**
- Given：`events = null`，keyword = `"課"`
- When：呼叫 `filterCalendarEvents(null, "課")`
- Then：回傳 `[]`

**TC-FC5 keyword 為空字串時回傳空陣列**
- Given：valid events array，`keyword = ""`
- When：呼叫 `filterCalendarEvents(events, "")`
- Then：回傳 `[]`

**TC-FC6 event 沒有 summary 欄位時不崩潰**
- Given：第一筆 event 無 summary，第二筆有 summary = `"有氧訓練"`，keyword = `"有氧"`
- When：呼叫 `filterCalendarEvents(events, "有氧")`
- Then：回傳長度 1，summary 為 `"有氧訓練"`

---

### 九、`getNextClass(upcomingClasses)` — 最近課程查詢

**TC-NC1 空陣列時回傳 null**
- Given：`upcomingClasses = []`
- When：呼叫 `getNextClass([])`
- Then：回傳 `null`

**TC-NC2 非陣列輸入時回傳 null**
- Given：`upcomingClasses = null`
- When：呼叫 `getNextClass(null)`
- Then：回傳 `null`

**TC-NC3 單一課程時直接回傳該課程**
- Given：`upcomingClasses` 僅含一筆課程物件
- When：呼叫 `getNextClass(upcomingClasses)`
- Then：回傳該唯一課程物件

**TC-NC4 多課程時回傳最近的那個**
- Given：三筆課程，startDateTime 分別為 4/7、4/5、4/10
- When：呼叫 `getNextClass(upcomingClasses)`
- Then：回傳 4/5 的課程（最早）

**TC-NC5 startDateTime 為毫秒數字時仍正確比較**
- Given：兩筆課程，startDateTime 為毫秒 timestamp，分別對應 4/10 和 4/8
- When：呼叫 `getNextClass(upcomingClasses)`
- Then：回傳 4/8 的課程（timestamp 較小）

---

## 新增測試的標準流程

新增業務邏輯時，若符合以下條件，須同步補測試：

1. **純函式**：輸入輸出明確、無副作用 → 直接加到 `fitforge.utils.js` + 補測試
2. **布林判斷**（disabled、條件顯示）→ 抽成 `canXxx()` 函式並加測試
3. **localStorage 讀寫** → 在 `TC-L` 區塊補案例

> UI 互動（按鈕點擊、Sheet 開關）與 Firestore 操作目前不在測試範圍內。
