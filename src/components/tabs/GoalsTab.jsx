import { createPortal } from "react-dom";
import { getGoalTitle, bodyPartLabels, canSaveGoal } from "../../utils/fitforge.utils.js";
import styles from "../../styles/fitforge.styles.js";

export default function GoalsTab({
  goals, today, getGoalProgress,
  showGoalSheet, setShowGoalSheet,
  goalType, setGoalType,
  goalTargetValue, setGoalTargetValue,
  goalTargetExercise, setGoalTargetExercise,
  goalTargetBodyPart, setGoalTargetBodyPart,
  goalDeadline, setGoalDeadline,
  goalNote, setGoalNote,
  goalCelebAnim,
  latestBMI,
  deleteGoal, saveGoal,
  editingGoalId, openEditGoal,
  goalFrequencyMode, setGoalFrequencyMode,
  goalCardioMetric, setGoalCardioMetric,
  goalDirectionOverride, setGoalDirectionOverride,
  setPickerTarget, setShowExPicker,
}) {
  const sortedGoals = [...goals].sort((a, b) => {
    const aProg = getGoalProgress(a);
    const bProg = getGoalProgress(b);
    const aComplete = aProg >= 100;
    const bComplete = bProg >= 100;
    const aExpired = !aComplete && a.deadline < today;
    const bExpired = !bComplete && b.deadline < today;
    if (aComplete !== bComplete) return aComplete ? 1 : -1;
    if (aExpired !== bExpired) return aExpired ? 1 : -1;
    return a.deadline.localeCompare(b.deadline);
  });

  // Determine target value label based on goal type
  function getTargetLabel() {
    if (goalType === "bmi") return "目標 BMI";
    if (goalType === "frequency") return goalFrequencyMode === "cumulative" ? "目標天數（累計）" : "目標天數（天/週，1–7）";
    if (goalType === "body_measurement") return "目標數值（cm）";
    if (goalType === "cardio") return goalCardioMetric === "duration_min" ? "目標時長（分鐘）" : "目標距離（km）";
    return "目標數值（kg）";
  }

  const canSave = canSaveGoal(goalTargetValue, goalDeadline, goalType, latestBMI, {
    frequencyMode: goalFrequencyMode,
    targetExercise: goalTargetExercise,
  });

  // Direction pill style
  function dirPillStyle(dir) {
    const active = goalDirectionOverride === dir;
    return {
      padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
      fontFamily: "inherit", fontSize: "13px", fontWeight: active ? 700 : 400,
      border: active ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
      background: active ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
      color: active ? "#ff6a00" : "#888",
    };
  }

  // Mode pill style (frequency / cardio)
  function modePillStyle(active) {
    return {
      padding: "6px 14px", borderRadius: "20px", cursor: "pointer",
      fontFamily: "inherit", fontSize: "13px", fontWeight: active ? 700 : 400,
      border: active ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
      background: active ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
      color: active ? "#ff6a00" : "#888",
    };
  }

  return (
    <div>
      {goals.length === 0 && (
        <div style={styles.card}>
          <div style={{ textAlign: "center", padding: "32px 0", color: "#555" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎯</div>
            <div style={{ fontSize: "15px" }}>設定你的第一個目標，開始追蹤進度！</div>
          </div>
        </div>
      )}

      {sortedGoals.map(goal => {
        const progress = getGoalProgress(goal);
        const isComplete = progress >= 100;
        const isExpired = !isComplete && goal.deadline < today;
        const daysLeft = Math.ceil((new Date(goal.deadline) - new Date(today)) / 86400000);
        const isUrgent = !isComplete && !isExpired && daysLeft <= 7;
        const barColor = isComplete ? "#4ade80" : isExpired ? "#555" : isUrgent ? "#f87171" : "#ff6a00";
        return (
          <div key={goal.id} style={{ ...styles.card, marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: isComplete ? "#4ade80" : "#e8e4dc", flex: 1, paddingRight: "8px" }}>
                {getGoalTitle(goal)}
              </div>
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                <button
                  style={{ ...styles.historyDeleteBtn, fontSize: "11px", background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)", color: "#aaa" }}
                  onClick={() => openEditGoal(goal)}
                >✏️ 編輯</button>
                <button
                  style={{ ...styles.historyDeleteBtn, fontSize: "11px" }}
                  onClick={() => deleteGoal(goal.id)}
                >刪除</button>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.08)", marginBottom: "8px", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "3px", transition: "width 0.5s",
                width: `${progress}%`,
                background: isComplete ? "linear-gradient(90deg,#4ade80,#22c55e)" : isExpired ? "#555" : isUrgent ? "linear-gradient(90deg,#f87171,#ef4444)" : "linear-gradient(90deg,#ff6a00,#ff9500)",
              }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
              <span style={{ color: barColor, fontWeight: 700 }}>
                {isComplete ? "✓ 已達標！" : isExpired ? "已過期" : daysLeft === 0 ? "今天截止" : `距截止還有 ${daysLeft} 天`}
              </span>
              <span style={{ color: "#666" }}>{Math.round(progress)}%</span>
            </div>

            {goal.note ? (
              <div style={{ fontSize: "12px", color: "#666", marginTop: "6px", fontStyle: "italic" }}>📝 {goal.note}</div>
            ) : null}
          </div>
        );
      })}

      <button style={styles.btn} onClick={() => setShowGoalSheet(true)}>
        + 新增目標
      </button>

      {/* Goal Add / Edit Sheet */}
      {showGoalSheet && createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9994,
            background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={() => setShowGoalSheet(false)}
        >
          <div
            style={{
              width: "100%", maxWidth: "480px", maxHeight: "85vh",
              background: "#13131c", borderRadius: "20px 20px 0 0",
              border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" }}>
                {editingGoalId ? "編輯目標" : "新增目標"}
              </span>
              <button style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "6px 16px", color: "#e8e4dc", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setShowGoalSheet(false)}>取消</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 20px 32px" }}>
              {/* Goal type pills — hidden in edit mode */}
              {!editingGoalId && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "8px", display: "block" }}>目標類型</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {[
                      { id: "weight", label: "體重" },
                      { id: "frequency", label: "訓練頻率" },
                      { id: "exercise_pr", label: "動作重量" },
                      { id: "body_measurement", label: "身材圍度" },
                      { id: "bmi", label: "BMI 目標" },
                      { id: "cardio", label: "🏃 有氧目標" },
                    ].map(t => (
                      <button key={t.id} onClick={() => setGoalType(t.id)} style={{
                        padding: "7px 14px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: goalType === t.id ? 700 : 400,
                        border: goalType === t.id ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                        background: goalType === t.id ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                        color: goalType === t.id ? "#ff6a00" : "#888",
                      }}>{t.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Frequency mode selector */}
              {goalType === "frequency" && !editingGoalId && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "8px", display: "block" }}>計算方式</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={modePillStyle(goalFrequencyMode === "weekly")} onClick={() => setGoalFrequencyMode("weekly")}>每週達標</button>
                    <button style={modePillStyle(goalFrequencyMode === "cumulative")} onClick={() => setGoalFrequencyMode("cumulative")}>截止前累計</button>
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
                    {goalFrequencyMode === "weekly"
                      ? "每週追蹤是否達到目標天數（1–7 天）"
                      : "追蹤從現在到截止日共訓練幾天"}
                  </div>
                </div>
              )}

              {/* Exercise PR: exercise selector */}
              {goalType === "exercise_pr" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>選擇動作</label>
                  <button style={{ width: "100%", background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", fontFamily: "inherit", boxSizing: "border-box" }}
                    onClick={() => { setPickerTarget("goal"); setShowExPicker(true); }}>
                    <span>{goalTargetExercise}</span>
                    <span style={{ color: "#666", fontSize: "12px" }}>▼</span>
                  </button>
                </div>
              )}

              {/* Body measurement: body part selector */}
              {goalType === "body_measurement" && (
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "8px", display: "block" }}>部位</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {Object.entries(bodyPartLabels).map(([key, label]) => (
                      <button key={key} onClick={() => setGoalTargetBodyPart(key)} style={{
                        padding: "6px 12px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px",
                        border: goalTargetBodyPart === key ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                        background: goalTargetBodyPart === key ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                        color: goalTargetBodyPart === key ? "#ff6a00" : "#888",
                      }}>{label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cardio: exercise + metric selector */}
              {goalType === "cardio" && (
                <>
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>選擇動作</label>
                    <button style={{ width: "100%", background: "#12121a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", fontFamily: "inherit", boxSizing: "border-box" }}
                      onClick={() => { setPickerTarget("goal"); setShowExPicker(true); }}>
                      <span>{goalTargetExercise}</span>
                      <span style={{ color: "#666", fontSize: "12px" }}>▼</span>
                    </button>
                  </div>
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "8px", display: "block" }}>追蹤指標</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={modePillStyle(goalCardioMetric === "distance_km")} onClick={() => setGoalCardioMetric("distance_km")}>距離（km）</button>
                      <button style={modePillStyle(goalCardioMetric === "duration_min")} onClick={() => setGoalCardioMetric("duration_min")}>時長（分鐘）</button>
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
                      {goalCardioMetric === "distance_km"
                        ? "追蹤該動作最遠距離（記錄時在 reps 填 km 數）"
                        : "追蹤該動作最長時間（記錄時在 reps 填分鐘數）"}
                    </div>
                  </div>
                </>
              )}

              {/* BMI warning */}
              {goalType === "bmi" && !latestBMI && (
                <div style={{
                  marginBottom: "14px", padding: "10px 14px",
                  background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.35)",
                  borderRadius: "10px", fontSize: "13px", color: "#ffaa00", lineHeight: "1.5",
                }}>
                  ⚠️ 請先在身材數據頁記錄體重和身高
                </div>
              )}

              {/* Target value */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>
                  {getTargetLabel()}
                </label>
                <input
                  type="number"
                  min={goalType === "frequency" && goalFrequencyMode !== "cumulative" ? "1" : undefined}
                  max={goalType === "frequency" && goalFrequencyMode !== "cumulative" ? "7" : undefined}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  placeholder="輸入目標數值"
                  value={goalTargetValue}
                  onChange={e => setGoalTargetValue(e.target.value)}
                />
              </div>

              {/* Deadline */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>截止日期</label>
                <input
                  type="date"
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  value={goalDeadline}
                  onChange={e => setGoalDeadline(e.target.value)}
                />
              </div>

              {/* Goal direction */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "8px", display: "block" }}>目標方向</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button style={dirPillStyle("increase")} onClick={() => setGoalDirectionOverride(goalDirectionOverride === "increase" ? null : "increase")}>↑ 增加</button>
                  <button style={dirPillStyle("decrease")} onClick={() => setGoalDirectionOverride(goalDirectionOverride === "decrease" ? null : "decrease")}>↓ 減少</button>
                </div>
                {!goalDirectionOverride && (
                  <div style={{ fontSize: "12px", color: "#555", marginTop: "6px" }}>不選則根據目標數值自動判斷</div>
                )}
              </div>

              {/* Note */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>備註（可選）</label>
                <input
                  type="text"
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  placeholder="備註..."
                  value={goalNote}
                  onChange={e => setGoalNote(e.target.value)}
                />
              </div>

              <button
                disabled={!canSave}
                style={{ width: "100%", padding: "14px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #ff6a00, #ff9500)", color: "#fff", fontSize: "16px", fontWeight: 800, cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.5, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "inherit" }}
                onClick={saveGoal}
              >
                {editingGoalId ? "儲存變更" : "儲存目標"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Goal Celebration Animation */}
      {goalCelebAnim && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(0,0,0,0.88)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "16px",
        }}>
          <style>{`@keyframes gp { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)} }`}</style>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${10 + (i * 37) % 80}%`,
              top: `${10 + (i * 53) % 80}%`,
              width: "10px", height: "10px", borderRadius: "50%",
              background: i % 3 === 0 ? "#ffd700" : i % 3 === 1 ? "#ff6a00" : "#fff",
              "--tx": `${(i % 2 === 0 ? 1 : -1) * (20 + i * 3)}px`,
              "--ty": `${-(30 + i * 4)}px`,
              animation: `gp ${0.8 + ((i * 17) % 10) * 0.1}s ease-out ${((i * 7) % 5) * 0.1}s forwards`,
            }} />
          ))}
          <div style={{ fontSize: "72px", lineHeight: 1 }}>🎉</div>
          <div style={{ fontSize: "34px", fontWeight: 900, background: "linear-gradient(135deg,#ffd700,#ff9500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            目標達成！
          </div>
          <div style={{ fontSize: "15px", color: "#888" }}>繼續保持 💪</div>
        </div>,
        document.body
      )}
    </div>
  );
}
