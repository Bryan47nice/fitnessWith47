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
