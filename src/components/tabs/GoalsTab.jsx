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
              <button
                style={{ ...styles.historyDeleteBtn, fontSize: "11px", flexShrink: 0 }}
                onClick={() => deleteGoal(goal.id)}
              >刪除</button>
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

      {/* Goal Add Sheet */}
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
              width: "100%", maxWidth: "480px", maxHeight: "80vh",
              background: "#13131c", borderRadius: "20px 20px 0 0",
              border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <span style={{ fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" }}>新增目標</span>
              <button style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "6px 16px", color: "#e8e4dc", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setShowGoalSheet(false)}>取消</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 20px 32px" }}>
              {/* Goal type pills */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "8px", display: "block" }}>目標類型</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { id: "weight", label: "體重" },
                    { id: "frequency", label: "訓練頻率" },
                    { id: "exercise_pr", label: "動作重量" },
                    { id: "body_measurement", label: "身材圍度" },
                    { id: "bmi", label: "BMI 目標" },
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

              {/* Dynamic fields by goalType */}
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

              {goalType === "bmi" && !latestBMI && (
                <div style={{
                  marginBottom: "14px", padding: "10px 14px",
                  background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.35)",
                  borderRadius: "10px", fontSize: "13px", color: "#ffaa00", lineHeight: "1.5",
                }}>
                  ⚠️ 請先在身材數據頁記錄體重和身高
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>
                  {goalType === "bmi" ? "目標 BMI" : `目標數值（${goalType === "frequency" ? "天/週" : goalType === "body_measurement" ? "cm" : "kg"}）`}
                </label>
                <input
                  type="number"
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  placeholder="輸入目標數值"
                  value={goalTargetValue}
                  onChange={e => setGoalTargetValue(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>截止日期</label>
                <input
                  type="date"
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  value={goalDeadline}
                  onChange={e => setGoalDeadline(e.target.value)}
                />
              </div>

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
                disabled={!canSaveGoal(goalTargetValue, goalDeadline, goalType, latestBMI)}
                style={{ width: "100%", padding: "14px", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #ff6a00, #ff9500)", color: "#fff", fontSize: "16px", fontWeight: 800, cursor: canSaveGoal(goalTargetValue, goalDeadline, goalType, latestBMI) ? "pointer" : "not-allowed", opacity: canSaveGoal(goalTargetValue, goalDeadline, goalType, latestBMI) ? 1 : 0.5, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "inherit" }}
                onClick={saveGoal}
              >
                儲存目標
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
