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
  waist: "腰圍",
  chest: "胸圍",
  hip:   "臀圍",
  arm:   "手臂圍",
  thigh: "大腿圍",
};

/**
 * Returns the human-readable title for a goal.
 */
export function getGoalTitle(goal) {
  if (goal.type === "weight")           return `體重目標：${goal.targetValue} kg`;
  if (goal.type === "frequency")        return `訓練頻率目標：${goal.targetValue} 天/週`;
  if (goal.type === "exercise_pr")      return `${goal.targetExercise} 目標：${goal.targetValue} kg`;
  if (goal.type === "body_measurement") return `${bodyPartLabels[goal.targetBodyPart] || goal.targetBodyPart} 目標：${goal.targetValue} cm`;
  if (goal.type === "bmi")              return `BMI 目標：${goal.targetValue}`;
  return "目標";
}

/**
 * Calculates goal progress percentage (0–100).
 *
 * @param {Object} goal - Firestore goal document
 * @param {Object} context
 * @param {Object|null} context.latestBody  - latest body record { weight, height, … }
 * @param {number|null} context.latestBMI  - pre-computed BMI value
 * @param {Array}       context.workouts   - all workout documents
 * @param {Object}      context.prMap      - { [exercise]: { weight, date } }
 * @param {string}      context.today      - current date "YYYY-MM-DD"
 */
export function getGoalProgress(goal, context = {}) {
  const { type, targetValue, startValue, targetExercise, targetBodyPart } = goal;
  const { latestBody = null, latestBMI = null, workouts = [], prMap = {}, today = "" } = context;

  let current = 0;
  if (type === "weight") {
    current = latestBody?.weight ? parseFloat(latestBody.weight) : 0;
  } else if (type === "frequency") {
    const ws = getWeekStart(today);
    current = new Set(workouts.filter(w => w.date >= ws).map(w => w.date)).size;
  } else if (type === "exercise_pr") {
    current = prMap[targetExercise]?.weight ?? 0;
  } else if (type === "body_measurement") {
    current = latestBody?.[targetBodyPart] ? parseFloat(latestBody[targetBodyPart]) : 0;
  } else if (type === "bmi") {
    current = latestBMI ?? 0;
  }

  const isDecrease = goal.goalDirection === "decrease" ||
    (goal.goalDirection == null && targetValue < startValue);

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
  return exercise.trim() !== "" && sets.some(s => s.reps !== "" || s.weight !== "");
}

/**
 * Returns true when the goal save button should be enabled.
 *
 * @param {string|number} targetValue - goal target value
 * @param {string}        deadline    - deadline date string
 * @param {string}        goalType    - goal type (e.g. "bmi", "weight", …)
 * @param {number|null}   latestBMI   - null when no body data exists
 */
export function canSaveGoal(targetValue, deadline, goalType, latestBMI) {
  if (!targetValue || !deadline) return false;
  if (goalType === "bmi" && !latestBMI) return false;
  return true;
}
