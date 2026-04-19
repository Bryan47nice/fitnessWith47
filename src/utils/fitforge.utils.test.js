// ─────────────────────────────────────────────────────────────
// FitForge — GWT Unit Tests (Vitest)
// ─────────────────────────────────────────────────────────────
// Note: getWeekStart uses new Date(dateStr) which parses as UTC
// midnight, then applies local-timezone day arithmetic. Tests
// assume a UTC+N (≥0) environment (e.g. Taiwan UTC+8).
// ─────────────────────────────────────────────────────────────

import { describe, test, expect, beforeEach } from "vitest";
import {
  getWeekStart,
  calcBMI,
  getGoalTitle,
  getGoalProgress,
  detectNewPR,
  canSaveWorkout,
  canSaveGoal,
  filterCalendarEvents,
  getNextClass,
  formatRestTime,
  getNeglectedExercises,
  getLastSessionSets,
  paceFromTimeDist,
  toMinPerKm,
} from "./fitforge.utils.js";

// ─── 一、getWeekStart ──────────────────────────────────────────────────────

describe("getWeekStart()", () => {
  test("TC-W1 週三輸入，回傳該週一", () => {
    // Given: 2026-03-04 is a Wednesday (March 2 is Monday in 2026)
    // When
    const result = getWeekStart("2026-03-04");
    // Then: Monday of that week
    expect(result).toBe("2026-03-02");
  });

  test("TC-W2 週一本身不偏移", () => {
    // Given: 2026-03-02 is Monday
    // When
    const result = getWeekStart("2026-03-02");
    // Then: same date returned
    expect(result).toBe("2026-03-02");
  });

  test("TC-W3 週日回到前一個週一", () => {
    // Given: 2026-03-08 is Sunday
    // When
    const result = getWeekStart("2026-03-08");
    // Then: previous Monday (2026-03-02)
    expect(result).toBe("2026-03-02");
  });
});

// ─── 二、getGoalProgress ──────────────────────────────────────────────────

describe("getGoalProgress()", () => {
  test("TC-G1 增加型目標，進行到一半", () => {
    // Given
    const goal = { type: "weight", startValue: 60, targetValue: 70, goalDirection: "increase" };
    const context = { latestBody: { weight: "65" } };
    // When
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(50);
  });

  test("TC-G2 減少型目標，進行到一半", () => {
    // Given
    const goal = { type: "weight", startValue: 80, targetValue: 60, goalDirection: "decrease" };
    const context = { latestBody: { weight: "70" } };
    // When
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(50);
  });

  test("TC-G3 超過目標不超過 100", () => {
    // Given
    const goal = { type: "weight", startValue: 60, targetValue: 70, goalDirection: "increase" };
    const context = { latestBody: { weight: "80" } };
    // When
    const result = getGoalProgress(goal, context);
    // Then: capped at 100
    expect(result).toBe(100);
  });

  test("TC-G4 尚未開始，低於起始值，回傳 0", () => {
    // Given
    const goal = { type: "weight", startValue: 60, targetValue: 70, goalDirection: "increase" };
    const context = { latestBody: { weight: "55" } };
    // When
    const result = getGoalProgress(goal, context);
    // Then: floored at 0
    expect(result).toBe(0);
  });

  test("TC-G5 舊目標無 goalDirection，自動 fallback 判斷減少型", () => {
    // Given: goalDirection is null, targetValue < startValue → auto-decrease
    const goal = { type: "weight", startValue: 80, targetValue: 60, goalDirection: null };
    const context = { latestBody: { weight: "70" } };
    // When
    const result = getGoalProgress(goal, context);
    // Then: treated as decrease type, 50%
    expect(result).toBe(50);
  });

  test("TC-G6 BMI 目標進度計算", () => {
    // Given
    const goal = { type: "bmi", startValue: 25, targetValue: 22, goalDirection: "decrease" };
    const context = { latestBMI: 23.5 };
    // When: (25 - 23.5) / (25 - 22) * 100 = 1.5/3*100 = 50
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBeCloseTo(50, 5);
  });

  test("TC-G7 startValue === targetValue，current 已達回傳 100", () => {
    // Given
    const goal = { type: "weight", startValue: 70, targetValue: 70, goalDirection: "increase" };
    const context = { latestBody: { weight: "70" } };
    // When
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(100);
  });

  test("TC-G8 訓練頻率目標：本週已訓練天數計算進度", () => {
    // Given: frequency goal target 4 days/week, today is Wednesday 2026-03-04
    const goal = { type: "frequency", startValue: 0, targetValue: 4, goalDirection: "increase" };
    // workouts: 2 distinct dates within the week of 2026-03-02
    const context = {
      today: "2026-03-04",
      workouts: [
        { date: "2026-03-02", exercise: "深蹲" },
        { date: "2026-03-02", exercise: "臥推" }, // same date, counts as 1
        { date: "2026-03-03", exercise: "硬舉" },
      ],
    };
    // When: 2 distinct training days / 4 target = 50%
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(50);
  });

  test("TC-G9 動作 PR 目標：prMap 有紀錄時計算進度", () => {
    // Given: exercise_pr goal for 深蹲, start 80 kg → target 100 kg, current PR 90 kg
    const goal = { type: "exercise_pr", targetExercise: "深蹲", startValue: 80, targetValue: 100, goalDirection: "increase" };
    const context = { prMap: { 深蹲: { weight: 90, date: "2026-03-01" } } };
    // When: (90 - 80) / (100 - 80) * 100 = 50%
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(50);
  });

  test("TC-G10 身材圍度目標：使用 latestBody 對應部位計算進度", () => {
    // Given: waist goal decrease from 90 cm to 80 cm, current 85 cm
    const goal = { type: "body_measurement", targetBodyPart: "waist", startValue: 90, targetValue: 80, goalDirection: "decrease" };
    const context = { latestBody: { waist: "85" } };
    // When: (90 - 85) / (90 - 80) * 100 = 50%
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(50);
  });

  test("TC-G11 訓練頻率目標（累計模式）：計算所有訓練日去重總天數", () => {
    // Given: frequency goal with cumulative mode, targeting 20 total days
    const goal = { type: "frequency", targetValue: 20, frequencyMode: "cumulative", startValue: 0, goalDirection: "increase" };
    // workouts: 3 distinct dates (one date has 2 records, counts as 1)
    const context = {
      today: "2026-03-28",
      workouts: [
        { date: "2026-01-05", exercise: "深蹲" },
        { date: "2026-01-10", exercise: "臥推" },
        { date: "2026-01-10", exercise: "硬舉" }, // same date, counts as 1
        { date: "2026-02-03", exercise: "肩推" },
        { date: "2026-02-03", exercise: "引體向上" }, // same date, counts as 1
        { date: "2026-03-01", exercise: "深蹲" },
        { date: "2026-03-15", exercise: "臥推" },
        { date: "2026-03-20", exercise: "跑步機" },
        { date: "2026-03-25", exercise: "深蹲" },
        { date: "2026-03-27", exercise: "硬舉" },
      ],
    };
    // When: 8 distinct training days / 20 target = 40%  (startValue=0, so use increase formula: (8-0)/(20-0)*100)
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(40);
  });

  test("TC-G12 有氧目標：使用 cardioMap 計算進度", () => {
    // Given: cardio goal for 跑步機, start 0 km → target 10 km, current cardioMap shows 5
    const goal = { type: "cardio", targetExercise: "跑步機", startValue: 0, targetValue: 10, goalDirection: "increase" };
    const context = { cardioMap: { 跑步機: { reps: 5, date: "2026-03-27" } } };
    // When: (5 - 0) / (10 - 0) * 100 = 50%
    const result = getGoalProgress(goal, context);
    // Then
    expect(result).toBe(50);
  });
});

// ─── 三、getGoalTitle ─────────────────────────────────────────────────────

describe("getGoalTitle()", () => {
  test("TC-T1 體重目標標題", () => {
    // Given
    const goal = { type: "weight", targetValue: 65 };
    // When / Then
    expect(getGoalTitle(goal)).toBe("體重目標：65 kg");
  });

  test("TC-T2 BMI 目標標題（無單位）", () => {
    // Given
    const goal = { type: "bmi", targetValue: 22.5 };
    // When / Then
    expect(getGoalTitle(goal)).toBe("BMI 目標：22.5");
  });

  test("TC-T3 身材圍度目標標題（腰圍）", () => {
    // Given
    const goal = { type: "body_measurement", targetBodyPart: "waist", targetValue: 75 };
    // When / Then
    expect(getGoalTitle(goal)).toBe("腰圍 目標：75 cm");
  });

  test("TC-T4 訓練頻率目標標題（每週模式）", () => {
    // Given: frequency goal with weekly mode
    const goal = { type: "frequency", targetValue: 4, frequencyMode: "weekly" };
    // When
    const result = getGoalTitle(goal);
    // Then
    expect(result).toBe("訓練頻率目標：每週 4 天");
  });

  test("TC-T4b 訓練頻率目標標題（累計模式）", () => {
    // Given: frequency goal with cumulative mode
    const goal = { type: "frequency", targetValue: 20, frequencyMode: "cumulative" };
    // When
    const result = getGoalTitle(goal);
    // Then
    expect(result).toBe("訓練頻率目標：累計 20 天");
  });

  test("TC-T5 動作 PR 目標標題", () => {
    // Given: exercise PR goal for 深蹲 targeting 120 kg
    const goal = { type: "exercise_pr", targetExercise: "深蹲", targetValue: 120 };
    // When
    const result = getGoalTitle(goal);
    // Then
    expect(result).toBe("深蹲 目標：120 kg");
  });

  test("TC-T6 未知目標類型回傳預設文字", () => {
    // Given: goal with an unrecognized type
    const goal = { type: "unknown_type", targetValue: 99 };
    // When
    const result = getGoalTitle(goal);
    // Then: fallback default string
    expect(result).toBe("目標");
  });

  test("TC-T7 有氧目標標題（duration_min 時間單位）", () => {
    // Given: cardio goal targeting duration, exercise "跑步機", metric "duration_min"
    const goal = { type: "cardio", targetExercise: "跑步機", targetCardioMetric: "duration_min", targetValue: 45 };
    // When
    const result = getGoalTitle(goal);
    // Then: unit should be "分鐘"
    expect(result).toBe("跑步機 目標：45 分鐘");
  });

  test("TC-T8 有氧目標標題（distance_km 距離單位）", () => {
    // Given: cardio goal targeting distance, exercise "慢跑", metric "distance_km"
    const goal = { type: "cardio", targetExercise: "慢跑", targetCardioMetric: "distance_km", targetValue: 5 };
    // When
    const result = getGoalTitle(goal);
    // Then: unit should be "km"
    expect(result).toBe("慢跑 目標：5 km");
  });

  test("TC-T9 有氧目標無 targetExercise 時標題使用預設「有氧」", () => {
    // Given: cardio goal with no targetExercise specified
    const goal = { type: "cardio", targetExercise: "", targetCardioMetric: "distance_km", targetValue: 3 };
    // When
    const result = getGoalTitle(goal);
    // Then: falls back to "有氧"
    expect(result).toBe("有氧 目標：3 km");
  });
});

// ─── 四、detectNewPR ──────────────────────────────────────────────────────

describe("detectNewPR()", () => {
  test("TC-P1 首次記錄某動作，視為破紀錄", () => {
    // Given: no prior PR
    const prMap = {};
    const sets = [{ reps: "5", weight: "80" }];
    // When
    const result = detectNewPR("深蹲", sets, prMap);
    // Then
    expect(result).toBe(true);
  });

  test("TC-P2 重量超過既有 PR", () => {
    // Given
    const prMap = { 深蹲: { weight: 100, date: "2026-01-01" } };
    const sets = [{ reps: "3", weight: "105" }];
    // When
    const result = detectNewPR("深蹲", sets, prMap);
    // Then
    expect(result).toBe(true);
  });

  test("TC-P3 重量未超過 PR，不觸發", () => {
    // Given
    const prMap = { 深蹲: { weight: 100, date: "2026-01-01" } };
    const sets = [{ reps: "5", weight: "95" }];
    // When
    const result = detectNewPR("深蹲", sets, prMap);
    // Then
    expect(result).toBe(false);
  });

  test("TC-P4 重量欄位為空，不視為破紀錄", () => {
    // Given: no prior PR, but weight field is empty
    const prMap = {};
    const sets = [{ reps: "10", weight: "" }];
    // When
    const result = detectNewPR("深蹲", sets, prMap);
    // Then
    expect(result).toBe(false);
  });
});

// ─── 五、calcBMI ──────────────────────────────────────────────────────────

describe("calcBMI()", () => {
  test("TC-B1 標準 BMI 計算（70 kg, 175 cm）", () => {
    // Given: weight=70 kg, height=175 cm
    // When: 70 / 1.75² = 22.857… → 22.9
    const result = calcBMI(70, 175);
    // Then
    expect(result).toBe(22.9);
  });

  test("TC-B2 缺少身高，回傳 null", () => {
    // Given
    // When
    const result = calcBMI(70, null);
    // Then
    expect(result).toBeNull();
  });

  test("TC-B3 缺少體重，回傳 null", () => {
    // Given: weight is null, height is provided
    // When
    const result = calcBMI(null, 175);
    // Then: falsy weight guard returns null
    expect(result).toBeNull();
  });
});

// ─── 六、canSaveWorkout / canSaveGoal（Validation）────────────────────────

describe("canSaveWorkout()", () => {
  test("TC-V1 未選動作時禁用", () => {
    // Given: no exercise selected
    const result = canSaveWorkout("", [{ reps: "10", weight: "80" }]);
    // Then: disabled
    expect(result).toBe(false);
  });

  test("TC-V2 所有組數為空時禁用", () => {
    // Given
    const result = canSaveWorkout("深蹲", [{ reps: "", weight: "" }]);
    // Then: disabled
    expect(result).toBe(false);
  });

  test("TC-V3 動作與至少一組有效時啟用", () => {
    // Given: reps filled, weight empty (valid set)
    const result = canSaveWorkout("深蹲", [{ reps: "10", weight: "" }]);
    // Then: enabled
    expect(result).toBe(true);
  });

  test("TC-V3b 有氧 set 填入時間時啟用", () => {
    // Given: cardio set with duration filled
    const result = canSaveWorkout("慢跑", [{ duration: "30", speed: "", incline: "" }]);
    // Then: enabled
    expect(result).toBe(true);
  });

  test("TC-V3c 有氧 set 填入速度時啟用", () => {
    // Given: cardio set with speed filled
    const result = canSaveWorkout("跑步機", [{ duration: "", speed: "10", incline: "" }]);
    // Then: enabled
    expect(result).toBe(true);
  });

  test("TC-V3d 有氧 set 全空時禁用", () => {
    // Given: cardio set with all fields empty
    const result = canSaveWorkout("游泳", [{ duration: "", speed: "", incline: "" }]);
    // Then: disabled
    expect(result).toBe(false);
  });
});

describe("canSaveGoal()", () => {
  test("TC-V4 無截止日期時禁用", () => {
    // Given
    const result = canSaveGoal("65", "", "weight", null);
    // Then: disabled
    expect(result).toBe(false);
  });

  test("TC-V5 BMI 目標但無身體數據時禁用", () => {
    // Given: BMI goal but no BMI data yet
    const result = canSaveGoal("22", "2026-06-01", "bmi", null);
    // Then: disabled
    expect(result).toBe(false);
  });

  test("TC-V5b 正常目標有值時啟用", () => {
    // Given: all values present
    const result = canSaveGoal("65", "2026-06-01", "weight", null);
    // Then: enabled
    expect(result).toBe(true);
  });

  test("TC-V5c BMI 目標有 BMI 資料時啟用", () => {
    // Given
    const result = canSaveGoal("22", "2026-06-01", "bmi", 24.5);
    // Then: enabled
    expect(result).toBe(true);
  });

  test("TC-V5d 頻率目標 targetValue < 1 時禁用", () => {
    // Given: frequency goal with target value below minimum
    const result = canSaveGoal("0", "2026-06-01", "frequency", null, { frequencyMode: "weekly" });
    // Then: disabled (< 1 is invalid)
    expect(result).toBe(false);
  });

  test("TC-V5e 每週頻率目標 targetValue > 7 時禁用", () => {
    // Given: weekly frequency goal with target value exceeding 7 days
    const result = canSaveGoal("8", "2026-06-01", "frequency", null, { frequencyMode: "weekly" });
    // Then: disabled (> 7 days/week is impossible)
    expect(result).toBe(false);
  });

  test("TC-V5f 累計頻率目標 targetValue > 7 時仍可儲存", () => {
    // Given: cumulative frequency goal with target value above 7 (allowed for cumulative)
    const result = canSaveGoal("30", "2026-12-31", "frequency", null, { frequencyMode: "cumulative" });
    // Then: enabled (cumulative mode is not capped at 7)
    expect(result).toBe(true);
  });

  test("TC-V5g 有氧目標未指定 targetExercise 時禁用", () => {
    // Given: cardio goal with no targetExercise
    const result = canSaveGoal("10", "2026-06-01", "cardio", null, { targetExercise: "" });
    // Then: disabled (cardio requires a target exercise)
    expect(result).toBe(false);
  });

  test("TC-V5h 有氧目標有 targetExercise 時啟用", () => {
    // Given: cardio goal with targetExercise specified
    const result = canSaveGoal("10", "2026-06-01", "cardio", null, { targetExercise: "跑步機" });
    // Then: enabled
    expect(result).toBe(true);
  });
});

// ─── 七、localStorage 行為 ────────────────────────────────────────────────

describe("localStorage 行為", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("TC-L1 首次進入目標追蹤 Tab，顯示引導彈窗並寫入 flag", () => {
    // Given: no flag in storage
    const key = "popup_seen_goals_intro_v130";
    expect(localStorage.getItem(key)).toBeNull();
    // When: simulate what FitForge does on first goals-tab visit
    const shouldShow = !localStorage.getItem(key);
    if (shouldShow) localStorage.setItem(key, "1");
    // Then
    expect(shouldShow).toBe(true);
    expect(localStorage.getItem(key)).toBe("1");
  });

  test("TC-L2 再次進入目標追蹤 Tab，不顯示引導彈窗", () => {
    // Given: flag already set
    const key = "popup_seen_goals_intro_v130";
    localStorage.setItem(key, "1");
    // When
    const shouldShow = !localStorage.getItem(key);
    // Then
    expect(shouldShow).toBe(false);
  });

  test("TC-L3 history_group_mode 預設為 'week'", () => {
    // Given: nothing in localStorage
    // When: simulate state initializer
    const mode = localStorage.getItem("history_group_mode") || "week";
    // Then
    expect(mode).toBe("week");
  });

  test("TC-L4 切換分組模式後寫入 localStorage", () => {
    // Given: current mode is "week"
    localStorage.setItem("history_group_mode", "week");
    // When: user clicks "依月"
    localStorage.setItem("history_group_mode", "month");
    // Then
    expect(localStorage.getItem("history_group_mode")).toBe("month");
  });
});

// ─── 八、filterCalendarEvents ─────────────────────────────────────────────

describe("filterCalendarEvents()", () => {
  test("TC-FC1 關鍵字完全符合 summary 時回傳對應事件", () => {
    // Given: events array with two distinct summaries, keyword matches one
    const events = [
      { summary: "瑜珈課", start: { dateTime: "2026-04-01T10:00:00" } },
      { summary: "有氧訓練", start: { dateTime: "2026-04-02T10:00:00" } },
    ];
    const keyword = "瑜珈";
    // When
    const result = filterCalendarEvents(events, keyword);
    // Then: only the matching event is returned
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("瑜珈課");
  });

  test("TC-FC2 大小寫不敏感匹配", () => {
    // Given: event summary in uppercase, keyword in lowercase
    const events = [{ summary: "Yoga Class" }];
    const keyword = "yoga";
    // When
    const result = filterCalendarEvents(events, keyword);
    // Then: case-insensitive match returns the event
    expect(result).toHaveLength(1);
  });

  test("TC-FC3 無符合項目時回傳空陣列", () => {
    // Given: events that don't match the keyword
    const events = [
      { summary: "游泳課" },
      { summary: "重訓課" },
    ];
    const keyword = "瑜珈";
    // When
    const result = filterCalendarEvents(events, keyword);
    // Then: empty array
    expect(result).toHaveLength(0);
  });

  test("TC-FC4 events 非陣列時回傳空陣列", () => {
    // Given: events is not an array
    const events = null;
    const keyword = "課";
    // When
    const result = filterCalendarEvents(events, keyword);
    // Then: guard returns empty array
    expect(result).toEqual([]);
  });

  test("TC-FC5 keyword 為空字串時回傳空陣列", () => {
    // Given: valid events array but no keyword provided
    const events = [{ summary: "瑜珈課" }];
    const keyword = "";
    // When
    const result = filterCalendarEvents(events, keyword);
    // Then: empty keyword guard returns empty array
    expect(result).toEqual([]);
  });

  test("TC-FC6 event 沒有 summary 欄位時不崩潰", () => {
    // Given: an event object missing the summary field
    const events = [{ id: "abc" }, { summary: "有氧訓練" }];
    const keyword = "有氧";
    // When
    const result = filterCalendarEvents(events, keyword);
    // Then: event without summary is skipped, matching event returned
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("有氧訓練");
  });
});

// ─── 九、getNextClass ─────────────────────────────────────────────────────

describe("getNextClass()", () => {
  test("TC-NC1 空陣列時回傳 null", () => {
    // Given: no upcoming classes
    const upcomingClasses = [];
    // When
    const result = getNextClass(upcomingClasses);
    // Then
    expect(result).toBeNull();
  });

  test("TC-NC2 非陣列輸入時回傳 null", () => {
    // Given: input is not an array
    const upcomingClasses = null;
    // When
    const result = getNextClass(upcomingClasses);
    // Then
    expect(result).toBeNull();
  });

  test("TC-NC3 單一課程時直接回傳該課程", () => {
    // Given: only one upcoming class
    const cls = { title: "瑜珈課", startDateTime: new Date("2026-04-05T10:00:00"), rawDate: "2026-04-05" };
    const upcomingClasses = [cls];
    // When
    const result = getNextClass(upcomingClasses);
    // Then: the only class is returned
    expect(result).toBe(cls);
  });

  test("TC-NC4 多課程時回傳最近的那個", () => {
    // Given: three classes at different times
    const cls1 = { title: "瑜珈課", startDateTime: new Date("2026-04-07T10:00:00"), rawDate: "2026-04-07" };
    const cls2 = { title: "有氧課", startDateTime: new Date("2026-04-05T09:00:00"), rawDate: "2026-04-05" };
    const cls3 = { title: "重訓課", startDateTime: new Date("2026-04-10T08:00:00"), rawDate: "2026-04-10" };
    const upcomingClasses = [cls1, cls2, cls3];
    // When
    const result = getNextClass(upcomingClasses);
    // Then: earliest startDateTime is cls2
    expect(result).toBe(cls2);
  });

  test("TC-NC5 startDateTime 為毫秒數字時仍正確比較", () => {
    // Given: startDateTime stored as millisecond timestamps
    const cls1 = { title: "課A", startDateTime: new Date("2026-04-10T08:00:00").getTime() };
    const cls2 = { title: "課B", startDateTime: new Date("2026-04-08T08:00:00").getTime() };
    const upcomingClasses = [cls1, cls2];
    // When
    const result = getNextClass(upcomingClasses);
    // Then: cls2 has the earlier timestamp
    expect(result).toBe(cls2);
  });
});

// ─── 十、getNeglectedExercises ────────────────────────────────────────────
describe("getNeglectedExercises()", () => {
  test("TC-NE1 超過門檻天數的動作被回傳", () => {
    // Given: one workout done 20 days before today (2026-04-09), threshold = 14
    const workouts = [
      { exercise: "深蹲", date: "2026-03-20" },
    ];
    // When
    const result = getNeglectedExercises(workouts, 14, 10);
    // Then: 深蹲 is neglected (20 days ago >= 14 threshold)
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].name).toBe("深蹲");
    expect(result[0].daysAgo).toBeGreaterThanOrEqual(14);
  });

  test("TC-NE2 未超過門檻天數的動作不被回傳", () => {
    // Given: one workout done 5 days before today (recent), threshold = 14
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentDate = new Date(today);
    recentDate.setDate(recentDate.getDate() - 5);
    const dateStr = recentDate.toISOString().slice(0, 10);
    const workouts = [{ exercise: "臥推", date: dateStr }];
    // When
    const result = getNeglectedExercises(workouts, 14, 10);
    // Then: 臥推 is not neglected (only 5 days ago)
    expect(result).toHaveLength(0);
  });

  test("TC-NE3 同一動作多筆紀錄時取最新日期", () => {
    // Given: 深蹲 has two records, one older and one newer (5 days ago, within threshold)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recent = new Date(today);
    recent.setDate(recent.getDate() - 5);
    const recentStr = recent.toISOString().slice(0, 10);
    const workouts = [
      { exercise: "深蹲", date: "2026-01-01" }, // old
      { exercise: "深蹲", date: recentStr },     // newer, within threshold
    ];
    // When
    const result = getNeglectedExercises(workouts, 14, 10);
    // Then: 深蹲 is NOT neglected because last date is recent
    const found = result.find(e => e.name === "深蹲");
    expect(found).toBeUndefined();
  });

  test("TC-NE4 回傳結果依 daysAgo 降序排列（最久未練排首位）", () => {
    // Given: 三個動作，距今天數分別約 30、20、15 天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
    const d20 = new Date(today); d20.setDate(d20.getDate() - 20);
    const d15 = new Date(today); d15.setDate(d15.getDate() - 15);
    const workouts = [
      { exercise: "臥推",   date: d20.toISOString().slice(0, 10) },
      { exercise: "深蹲",   date: d30.toISOString().slice(0, 10) },
      { exercise: "肩推",   date: d15.toISOString().slice(0, 10) },
    ];
    // When
    const result = getNeglectedExercises(workouts, 14, 10);
    // Then: sorted by daysAgo descending (深蹲 first, 肩推 last)
    expect(result[0].name).toBe("深蹲");
    expect(result[result.length - 1].name).toBe("肩推");
  });

  test("TC-NE5 limit 參數限制回傳數量", () => {
    // Given: 5 exercises all neglected (30 days ago), limit = 3
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d30 = new Date(today); d30.setDate(d30.getDate() - 30);
    const dateStr = d30.toISOString().slice(0, 10);
    const workouts = [
      { exercise: "深蹲",   date: dateStr },
      { exercise: "臥推",   date: dateStr },
      { exercise: "硬舉",   date: dateStr },
      { exercise: "肩推",   date: dateStr },
      { exercise: "引體向上", date: dateStr },
    ];
    // When
    const result = getNeglectedExercises(workouts, 14, 3);
    // Then: at most 3 results returned
    expect(result).toHaveLength(3);
  });

  test("TC-NE6 空 workouts 陣列時回傳空陣列", () => {
    // Given: no workouts at all
    const workouts = [];
    // When
    const result = getNeglectedExercises(workouts, 14, 10);
    // Then: nothing to return
    expect(result).toHaveLength(0);
  });
});

// ─── 十一、formatRestTime ─────────────────────────────────────────────────
describe("formatRestTime()", () => {
  test("TC-F1 標準秒數 90s 格式化為 1:30", () => {
    // Given: seconds = 90
    // When:
    const result = formatRestTime(90);
    // Then:
    expect(result).toBe("1:30");
  });

  test("TC-F2 零秒格式化為 0:00", () => {
    // Given: seconds = 0
    // When:
    const result = formatRestTime(0);
    // Then:
    expect(result).toBe("0:00");
  });

  test("TC-F3 個位數秒補零 65s 格式化為 1:05", () => {
    // Given: seconds = 65
    // When:
    const result = formatRestTime(65);
    // Then:
    expect(result).toBe("1:05");
  });
});

// ─── 十二、getLastSessionSets ─────────────────────────────────────────────
describe("getLastSessionSets()", () => {
  test("TC-LS1 有歷史紀錄時回傳最新一次的 sets 副本", () => {
    // Given: two workouts for 深蹲, with different dates; the more recent is 2026-04-10
    const workouts = [
      { exercise: "深蹲", date: "2026-03-01", sets: [{ reps: "5", weight: "80" }] },
      { exercise: "深蹲", date: "2026-04-10", sets: [{ reps: "3", weight: "100" }, { reps: "3", weight: "105" }] },
    ];
    // When:
    const result = getLastSessionSets("深蹲", workouts);
    // Then: returns the sets from the most recent workout (2026-04-10)
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ reps: "3", weight: "100" });
    expect(result[1]).toEqual({ reps: "3", weight: "105" });
  });

  test("TC-LS2 回傳的是副本，修改不影響原始資料", () => {
    // Given: one workout for 臥推 with a set
    const originalSet = { reps: "8", weight: "70" };
    const workouts = [
      { exercise: "臥推", date: "2026-04-01", sets: [originalSet] },
    ];
    // When: obtain copy and mutate it
    const result = getLastSessionSets("臥推", workouts);
    result[0].weight = "999";
    // Then: original set object is not mutated
    expect(originalSet.weight).toBe("70");
  });

  test("TC-LS3 找不到該動作的歷史紀錄時回傳 null", () => {
    // Given: workouts contain only 深蹲, but we query 硬舉
    const workouts = [
      { exercise: "深蹲", date: "2026-04-01", sets: [{ reps: "5", weight: "80" }] },
    ];
    // When:
    const result = getLastSessionSets("硬舉", workouts);
    // Then: no match, return null
    expect(result).toBeNull();
  });

  test("TC-LS4 空 workouts 陣列時回傳 null", () => {
    // Given: no workouts at all
    const workouts = [];
    // When:
    const result = getLastSessionSets("深蹲", workouts);
    // Then:
    expect(result).toBeNull();
  });

  test("TC-LS5 exercise 為空字串時回傳 null", () => {
    // Given: exercise name is empty
    const workouts = [
      { exercise: "深蹲", date: "2026-04-01", sets: [{ reps: "5", weight: "80" }] },
    ];
    // When:
    const result = getLastSessionSets("", workouts);
    // Then: guard returns null for empty exercise
    expect(result).toBeNull();
  });

  test("TC-LS6 workouts 非陣列時回傳 null", () => {
    // Given: workouts is not an array
    // When:
    const result = getLastSessionSets("深蹲", null);
    // Then: guard returns null
    expect(result).toBeNull();
  });

  test("TC-LS7 符合動作但 sets 為空陣列的紀錄被略過", () => {
    // Given: one workout has empty sets, another has valid sets
    const workouts = [
      { exercise: "深蹲", date: "2026-04-12", sets: [] },
      { exercise: "深蹲", date: "2026-04-10", sets: [{ reps: "5", weight: "90" }] },
    ];
    // When:
    const result = getLastSessionSets("深蹲", workouts);
    // Then: empty-sets record is skipped; valid sets from 2026-04-10 are returned
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ reps: "5", weight: "90" });
  });
});

// ─── 十三、toMinPerKm ────────────────────────────────────────────────────
describe("toMinPerKm()", () => {
  test("TC-M1 標準速度 10 km/h 轉為配速 06:00 /km", () => {
    // Given: speed = 10 km/h
    // When: 60 / 10 = 6.0 min/km → 6分0秒
    const result = toMinPerKm(10);
    // Then:
    expect(result).toBe("06:00 /km");
  });

  test("TC-M2 速度 12 km/h 轉為配速 05:00 /km", () => {
    // Given: speed = 12 km/h
    // When: 60 / 12 = 5.0 min/km → 5分0秒
    const result = toMinPerKm(12);
    // Then:
    expect(result).toBe("05:00 /km");
  });

  test("TC-M3 非整除速度產生正確秒數（8 km/h → 07:30 /km）", () => {
    // Given: speed = 8 km/h
    // When: 60 / 8 = 7.5 min/km → 7分30秒
    const result = toMinPerKm(8);
    // Then:
    expect(result).toBe("07:30 /km");
  });

  test("TC-M4 速度為 0 時回傳 null", () => {
    // Given: speed = 0（無效輸入）
    // When:
    const result = toMinPerKm(0);
    // Then: 無法計算，回傳 null
    expect(result).toBeNull();
  });

  test("TC-M5 速度為 null 時回傳 null", () => {
    // Given: speed = null
    // When:
    const result = toMinPerKm(null);
    // Then: 無法計算，回傳 null
    expect(result).toBeNull();
  });

  test("TC-M6 速度為字串數字時仍正確計算（'10' → 06:00 /km）", () => {
    // Given: speed = "10"（字串形式，來自表單輸入）
    // When: parseFloat("10") = 10，60 / 10 = 6.0
    const result = toMinPerKm("10");
    // Then:
    expect(result).toBe("06:00 /km");
  });
});

// ─── 十四、paceFromTimeDist ───────────────────────────────────────────────
describe("paceFromTimeDist()", () => {
  test("TC-PC1 標準配速計算：20分0秒跑3.39km", () => {
    // Given: 20分鐘整，3.39km
    // When:
    const result = paceFromTimeDist("20", "0", "3.39");
    // Then: pace = 20/3.39 ≈ 5.90 min/km = 5分54秒
    expect(result).toBe("05:54 /km");
  });

  test("TC-PC2 含秒數配速計算：20分30秒跑3.5km", () => {
    // Given: 20分30秒，3.5km
    // When:
    const result = paceFromTimeDist("20", "30", "3.5");
    // Then: total = 20.5 min, pace = 20.5/3.5 ≈ 5.857 min/km = 5分51秒
    expect(result).toBe("05:51 /km");
  });

  test("TC-PC3 分鐘數為個位數時補前導零", () => {
    // Given: 5分鐘，1km（配速剛好5:00）
    // When:
    const result = paceFromTimeDist("5", "0", "1");
    // Then: 格式含前導零
    expect(result).toBe("05:00 /km");
  });

  test("TC-PC4 距離為 0 時回傳 null", () => {
    // Given: distance = 0
    // When:
    const result = paceFromTimeDist("20", "0", "0");
    // Then: 無法計算，回傳 null
    expect(result).toBeNull();
  });

  test("TC-PC5 時間為空時回傳 null", () => {
    // Given: no duration provided
    // When:
    const result = paceFromTimeDist("", "", "3.5");
    // Then: 無法計算，回傳 null
    expect(result).toBeNull();
  });

  test("TC-PC6 duration_sec 為 undefined 時預設 0 秒", () => {
    // Given: duration_sec not provided (old data)
    // When:
    const result = paceFromTimeDist("10", undefined, "2");
    // Then: treats as 10 min, pace = 10/2 = 5 min/km = 05:00
    expect(result).toBe("05:00 /km");
  });
});
