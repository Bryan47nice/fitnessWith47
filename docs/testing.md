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
| `canSaveGoal(targetValue, deadline, goalType, latestBMI, opts)` | 儲存目標按鈕是否可用（opts 含 frequencyMode、targetExercise） | 無 |
| `filterCalendarEvents(events, keyword)` | 依關鍵字篩選 Google Calendar 事件 | 無 |
| `getNextClass(upcomingClasses)` | 回傳最近一筆即將到來的課程，無則回傳 null | 無 |
| `getNeglectedExercises(workouts, thresholdDays, limit)` | 回傳超過門檻天數未練的動作清單，依最久未練排序 | 無 |
| `formatRestTime(seconds)` | 將秒數格式化為 "m:ss" 字串（例：90 → "1:30"） | 無 |
| `getLastSessionSets(exercise, workouts)` | 回傳該動作最近一次訓練的 sets 副本，無紀錄時回傳 null | 無 |

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

**TC-G11 訓練頻率目標（累計模式）：計算所有訓練日去重總天數**
- Given：`{ type: "frequency", targetValue: 20, frequencyMode: "cumulative", startValue: 0 }`，workouts 含 10 筆記錄但僅 8 個不同日期
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `40`（8 個不同訓練日 / 20 目標 * 100 = 40%）

**TC-G12 有氧目標：使用 cardioMap 計算進度**
- Given：`{ type: "cardio", targetExercise: "跑步機", startValue: 0, targetValue: 10, goalDirection: "increase" }`，`cardioMap["跑步機"].reps = 5`
- When：呼叫 `getGoalProgress(goal, context)`
- Then：回傳 `50`（(5-0)/(10-0)*100）

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

**TC-T4 訓練頻率目標（每週模式）**
- Given：`{ type: "frequency", targetValue: 4, frequencyMode: "weekly" }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"訓練頻率目標：每週 4 天"`

**TC-T4b 訓練頻率目標（累計模式）**
- Given：`{ type: "frequency", targetValue: 20, frequencyMode: "cumulative" }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"訓練頻率目標：累計 20 天"`

**TC-T5 動作 PR 目標**
- Given：`{ type: "exercise_pr", targetExercise: "深蹲", targetValue: 120 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"深蹲 目標：120 kg"`

**TC-T6 未知目標類型，回傳預設文字**
- Given：`{ type: "unknown_type", targetValue: 99 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"目標"`（fallback）

**TC-T7 有氧目標標題（duration_min 時間單位）**
- Given：`{ type: "cardio", targetExercise: "跑步機", targetCardioMetric: "duration_min", targetValue: 45 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"跑步機 目標：45 分鐘"`

**TC-T8 有氧目標標題（distance_km 距離單位）**
- Given：`{ type: "cardio", targetExercise: "慢跑", targetCardioMetric: "distance_km", targetValue: 5 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"慢跑 目標：5 km"`

**TC-T9 有氧目標無 targetExercise 時標題使用預設「有氧」**
- Given：`{ type: "cardio", targetExercise: "", targetCardioMetric: "distance_km", targetValue: 3 }`
- When：呼叫 `getGoalTitle(goal)`
- Then：回傳 `"有氧 目標：3 km"`（fallback to "有氧"）

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

**TC-V3b saveWorkout — 有氧 set 填入時間時啟用**
- Given：`exercise = "慢跑"`，`sets = [{ duration: "30", speed: "", incline: "" }]`
- When：呼叫 `canSaveWorkout("慢跑", sets)`
- Then：回傳 `true`

**TC-V3c saveWorkout — 有氧 set 填入速度時啟用**
- Given：`exercise = "跑步機"`，`sets = [{ duration: "", speed: "10", incline: "" }]`
- When：呼叫 `canSaveWorkout("跑步機", sets)`
- Then：回傳 `true`

**TC-V3d saveWorkout — 有氧 set 全空時禁用**
- Given：`exercise = "游泳"`，`sets = [{ duration: "", speed: "", incline: "" }]`
- When：呼叫 `canSaveWorkout("游泳", sets)`
- Then：回傳 `false`

**TC-V4 saveGoal — 無截止日期時禁用**
- Given：`targetValue = "65"`, `deadline = ""`
- When：呼叫 `canSaveGoal("65", "", "weight", null)`
- Then：回傳 `false`

**TC-V5 saveGoal — BMI 目標但無身體數據時禁用**
- Given：`goalType = "bmi"`, `latestBMI = null`
- When：呼叫 `canSaveGoal("22", "2026-06-01", "bmi", null)`
- Then：回傳 `false`

**TC-V5b saveGoal — 正常目標有值時啟用**
- Given：`targetValue = "65"`, `deadline = "2026-06-01"`, `goalType = "weight"`, `latestBMI = null`
- When：呼叫 `canSaveGoal("65", "2026-06-01", "weight", null)`
- Then：回傳 `true`

**TC-V5c saveGoal — BMI 目標有 BMI 資料時啟用**
- Given：`goalType = "bmi"`, `latestBMI = 24.5`
- When：呼叫 `canSaveGoal("22", "2026-06-01", "bmi", 24.5)`
- Then：回傳 `true`

**TC-V5d saveGoal — 頻率目標 targetValue < 1 時禁用**
- Given：`goalType = "frequency"`, `targetValue = "0"`, `frequencyMode = "weekly"`
- When：呼叫 `canSaveGoal("0", "2026-06-01", "frequency", null, { frequencyMode: "weekly" })`
- Then：回傳 `false`（值低於最小值 1）

**TC-V5e saveGoal — 每週頻率目標 targetValue > 7 時禁用**
- Given：`goalType = "frequency"`, `targetValue = "8"`, `frequencyMode = "weekly"`
- When：呼叫 `canSaveGoal("8", "2026-06-01", "frequency", null, { frequencyMode: "weekly" })`
- Then：回傳 `false`（每週不可能超過 7 天）

**TC-V5f saveGoal — 累計頻率目標 targetValue > 7 時仍可儲存**
- Given：`goalType = "frequency"`, `targetValue = "30"`, `frequencyMode = "cumulative"`
- When：呼叫 `canSaveGoal("30", "2026-12-31", "frequency", null, { frequencyMode: "cumulative" })`
- Then：回傳 `true`（累計模式無上限）

**TC-V5g saveGoal — 有氧目標未指定 targetExercise 時禁用**
- Given：`goalType = "cardio"`, `opts.targetExercise = ""`
- When：呼叫 `canSaveGoal("10", "2026-06-01", "cardio", null, { targetExercise: "" })`
- Then：回傳 `false`（有氧目標必須指定動作）

**TC-V5h saveGoal — 有氧目標有 targetExercise 時啟用**
- Given：`goalType = "cardio"`, `opts.targetExercise = "跑步機"`
- When：呼叫 `canSaveGoal("10", "2026-06-01", "cardio", null, { targetExercise: "跑步機" })`
- Then：回傳 `true`

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

### 十、`getNeglectedExercises(workouts, thresholdDays, limit)` — 久未練動作查詢

**TC-NE1 超過門檻天數的動作被回傳**
- Given：workouts 含一筆「深蹲」，距今約 20 天，threshold = 14
- When：呼叫 `getNeglectedExercises(workouts, 14, 10)`
- Then：回傳陣列包含「深蹲」，且 `daysAgo >= 14`

**TC-NE2 未超過門檻天數的動作不被回傳**
- Given：workouts 含一筆「臥推」，距今僅 5 天，threshold = 14
- When：呼叫 `getNeglectedExercises(workouts, 14, 10)`
- Then：回傳空陣列（5 天 < 14 天門檻）

**TC-NE3 同一動作多筆紀錄時取最新日期**
- Given：「深蹲」有兩筆記錄，一舊一新（新的距今 5 天），threshold = 14
- When：呼叫 `getNeglectedExercises(workouts, 14, 10)`
- Then：深蹲不在回傳結果中（以最新日期計算，5 天 < 14 天）

**TC-NE4 回傳結果依 daysAgo 降序排列（最久未練排首位）**
- Given：三個動作，距今天數分別約 30、20、15 天，皆超過 threshold = 14
- When：呼叫 `getNeglectedExercises(workouts, 14, 10)`
- Then：結果第一筆為 30 天（深蹲），最後一筆為 15 天（肩推）

**TC-NE5 limit 參數限制回傳數量**
- Given：5 個動作皆距今 30 天（皆超過 threshold），limit = 3
- When：呼叫 `getNeglectedExercises(workouts, 14, 3)`
- Then：回傳陣列長度為 3

**TC-NE6 空 workouts 陣列時回傳空陣列**
- Given：`workouts = []`
- When：呼叫 `getNeglectedExercises([], 14, 10)`
- Then：回傳 `[]`

---

### 十一、`formatRestTime(seconds)` — 休息計時器格式化

**TC-F1 標準秒數 90s 格式化為 1:30**
- Given：`seconds = 90`
- When：呼叫 `formatRestTime(90)`
- Then：回傳 `"1:30"`

**TC-F2 零秒格式化為 0:00**
- Given：`seconds = 0`
- When：呼叫 `formatRestTime(0)`
- Then：回傳 `"0:00"`

**TC-F3 個位數秒補零 65s 格式化為 1:05**
- Given：`seconds = 65`
- When：呼叫 `formatRestTime(65)`
- Then：回傳 `"1:05"`（秒數不足兩位數時補零）

---

### 十二、`getLastSessionSets(exercise, workouts)` — 上次訓練組數查詢

**TC-LS1 有歷史紀錄時回傳最新一次的 sets 副本**
- Given：workouts 含兩筆「深蹲」，日期分別為 2026-03-01 與 2026-04-10
- When：呼叫 `getLastSessionSets("深蹲", workouts)`
- Then：回傳 2026-04-10 的 sets（較新的那筆），長度為 2

**TC-LS2 回傳的是副本，修改不影響原始資料**
- Given：workouts 含一筆「臥推」，sets 有一組 `{ reps: "8", weight: "70" }`
- When：取得結果後將 `result[0].weight` 改為 `"999"`
- Then：原始 sets 物件的 weight 仍為 `"70"`（回傳的是淺拷貝）

**TC-LS3 找不到該動作的歷史紀錄時回傳 null**
- Given：workouts 僅含「深蹲」，查詢「硬舉」
- When：呼叫 `getLastSessionSets("硬舉", workouts)`
- Then：回傳 `null`

**TC-LS4 空 workouts 陣列時回傳 null**
- Given：`workouts = []`
- When：呼叫 `getLastSessionSets("深蹲", [])`
- Then：回傳 `null`

**TC-LS5 exercise 為空字串時回傳 null**
- Given：`exercise = ""`，workouts 有有效紀錄
- When：呼叫 `getLastSessionSets("", workouts)`
- Then：回傳 `null`（空字串 guard）

**TC-LS6 workouts 非陣列時回傳 null**
- Given：`workouts = null`
- When：呼叫 `getLastSessionSets("深蹲", null)`
- Then：回傳 `null`

**TC-LS7 符合動作但 sets 為空陣列的紀錄被略過**
- Given：workouts 含兩筆「深蹲」，2026-04-12 的 sets 為空，2026-04-10 有有效 sets
- When：呼叫 `getLastSessionSets("深蹲", workouts)`
- Then：回傳 2026-04-10 的 sets（空 sets 紀錄被略過）

---

## 新增測試的標準流程

新增業務邏輯時，若符合以下條件，須同步補測試：

1. **純函式**：輸入輸出明確、無副作用 → 直接加到 `fitforge.utils.js` + 補測試
2. **布林判斷**（disabled、條件顯示）→ 抽成 `canXxx()` 函式並加測試
3. **localStorage 讀寫** → 在 `TC-L` 區塊補案例

> UI 互動（按鈕點擊、Sheet 開關）與 Firestore 操作目前不在測試範圍內。
