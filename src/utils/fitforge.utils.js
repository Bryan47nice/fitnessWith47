// ─────────────────────────────────────────────────────────────
// FitForge — pure utility functions (no React / Firebase deps)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the Monday date string (YYYY-MM-DD) of the week containing dateStr.
 * Weeks start on Monday (ISO 8601).
 */
export function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates BMI from weight (kg) and height (cm).
 * Returns null when either value is falsy.
 */
export function calcBMI(weight, height) {
  if (!weight || !height) return null;
  const h = parseFloat(height) / 100;
  return parseFloat((parseFloat(weight) / (h * h)).toFixed(1));
}

export const bodyPartLabels = {
  waist:       "腰圍",
  hip:         "臀圍",
  bodyfat:     "體脂率",
  muscle_mass: "骨骼肌肉量",
};

export const bodyPartUnits = {
  waist:       "cm",
  hip:         "cm",
  bodyfat:     "%",
  muscle_mass: "kg",
};

/**
 * Returns the human-readable title for a goal.
 */
export function getGoalTitle(goal) {
  if (goal.type === "weight")           return `體重目標：${goal.targetValue} kg`;
  if (goal.type === "frequency") {
    if (goal.frequencyMode === "cumulative") return `訓練頻率目標：累計 ${goal.targetValue} 天`;
    return `訓練頻率目標：每週 ${goal.targetValue} 天`;
  }
  if (goal.type === "exercise_pr")      return `${goal.targetExercise} 目標：${goal.targetValue} kg`;
  if (goal.type === "body_measurement") {
    const unit = bodyPartUnits[goal.targetBodyPart] || "cm";
    return `${bodyPartLabels[goal.targetBodyPart] || goal.targetBodyPart} 目標：${goal.targetValue} ${unit}`;
  }
  if (goal.type === "bmi")              return `BMI 目標：${goal.targetValue}`;
  if (goal.type === "cardio") {
    const unit = goal.targetCardioMetric === "duration_min" ? "分鐘" : "km";
    return `${goal.targetExercise || "有氧"} 目標：${goal.targetValue} ${unit}`;
  }
  return "目標";
}

/**
 * Calculates goal progress percentage (0–100).
 *
 * @param {Object} goal - Firestore goal document
 * @param {Object} context
 * @param {Object|null} context.latestBody       - latest body record { weight, height, … }
 * @param {number|null} context.latestBMI        - pre-computed BMI value
 * @param {Array}       context.workouts         - all workout documents
 * @param {Object}      context.prMap            - { [exercise]: { weight, date } }
 * @param {Object}      context.cardioMap        - { [exercise]: { reps, date } }
 * @param {string}      context.today            - current date "YYYY-MM-DD"
 */
export function getGoalProgress(goal, context = {}) {
  const { type, targetValue, startValue, targetExercise, targetBodyPart, frequencyMode } = goal;
  const { latestBody = null, latestBMI = null, workouts = [], prMap = {}, cardioMap = {}, today = "" } = context;

  let current = 0;
  if (type === "weight") {
    current = latestBody?.weight ? parseFloat(latestBody.weight) : 0;
  } else if (type === "frequency") {
    if (frequencyMode === "cumulative") {
      // 累計模式：至今訓練總天數（去重日期）
      current = new Set(workouts.map(w => w.date)).size;
    } else {
      // 每週模式：本週訓練天數（startValue 固定為 0，direct ratio）
      const ws = getWeekStart(today);
      current = new Set(workouts.filter(w => w.date >= ws).map(w => w.date)).size;
    }
  } else if (type === "exercise_pr") {
    current = prMap[targetExercise]?.weight ?? 0;
  } else if (type === "body_measurement") {
    current = latestBody?.[targetBodyPart] ? parseFloat(latestBody[targetBodyPart]) : 0;
  } else if (type === "bmi") {
    current = latestBMI ?? 0;
  } else if (type === "cardio") {
    current = cardioMap[targetExercise]?.reps ?? 0;
  }

  // 身體相關目標若尚無量測資料（current=0），無法判斷進度
  if ((type === "weight" || type === "body_measurement" || type === "bmi") && current === 0) {
    return 0;
  }

  const isDecrease = goal.goalDirection === "decrease" ||
    (goal.goalDirection == null && targetValue < startValue);

  // 每週頻率目標：startValue 固定為 0，直接用 current/target
  if (type === "frequency" && frequencyMode !== "cumulative") {
    return Math.min(100, Math.max(0, (current / targetValue) * 100));
  }

  if (startValue === targetValue) return current >= targetValue ? 100 : 0;
  if (isDecrease) {
    return Math.min(100, Math.max(0, (startValue - current) / (startValue - targetValue) * 100));
  }
  return Math.min(100, Math.max(0, (current - startValue) / (targetValue - startValue) * 100));
}

/**
 * Detects whether the given sets include a new personal record for the exercise.
 *
 * @param {string} exercise - exercise name
 * @param {Array}  sets     - array of { reps: string, weight: string }
 * @param {Object} prMap    - { [exercise]: { weight: number, date: string } }
 * @returns {boolean}
 */
export function detectNewPR(exercise, sets, prMap) {
  return sets.some(s => {
    const wt = parseFloat(s.weight);
    return !isNaN(wt) && wt > 0 && (!prMap[exercise] || wt > prMap[exercise].weight);
  });
}

/**
 * Returns true when the workout log save button should be enabled.
 *
 * @param {string} exercise - selected exercise name
 * @param {Array}  sets     - array of { reps: string, weight: string }
 */
export function canSaveWorkout(exercise, sets) {
  return exercise.trim() !== "" && sets.some(s =>
    s.reps || s.weight || s.duration || s.speed
  );
}

/**
 * Returns true when the goal save button should be enabled.
 *
 * @param {string|number} targetValue       - goal target value
 * @param {string}        deadline          - deadline date string
 * @param {string}        goalType          - goal type (e.g. "bmi", "weight", …)
 * @param {number|null}   latestBMI         - null when no body data exists
 * @param {Object}        [opts]            - additional options
 * @param {string}        [opts.frequencyMode] - "weekly" | "cumulative"
 * @param {string}        [opts.targetExercise] - required for cardio type
 */
export function canSaveGoal(targetValue, deadline, goalType, latestBMI, opts = {}) {
  if (!targetValue || !deadline) return false;
  if (goalType === "bmi" && !latestBMI) return false;
  if (goalType === "frequency") {
    const val = parseFloat(targetValue);
    if (isNaN(val) || val < 1) return false;
    if (opts.frequencyMode !== "cumulative" && val > 7) return false;
  }
  if (goalType === "cardio" && !opts.targetExercise) return false;
  return true;
}

/**
 * Filters Google Calendar API event objects, keeping only those whose
 * summary (title) contains the given keyword (case-insensitive).
 *
 * @param {Array}  events  - array of Google Calendar event objects
 * @param {string} keyword - keyword to match against event.summary
 * @returns {Array} filtered events
 */
export function filterCalendarEvents(events, keyword) {
  if (!Array.isArray(events) || !keyword) return [];
  const lower = keyword.toLowerCase();
  return events.filter(e => (e.summary || "").toLowerCase().includes(lower));
}

/**
 * Returns the nearest upcoming class from an array of class objects,
 * or null if the array is empty.
 *
 * @param {Array} upcomingClasses - array of { title, startDateTime (ms or Date), rawDate }
 * @returns {Object|null} the class with the earliest startDateTime, or null
 */
export function getNextClass(upcomingClasses) {
  if (!Array.isArray(upcomingClasses) || upcomingClasses.length === 0) return null;
  return upcomingClasses.reduce((earliest, cur) => {
    const t = (cur.startDateTime instanceof Date ? cur.startDateTime : new Date(cur.startDateTime)).getTime();
    const et = (earliest.startDateTime instanceof Date ? earliest.startDateTime : new Date(earliest.startDateTime)).getTime();
    return t < et ? cur : earliest;
  });
}
