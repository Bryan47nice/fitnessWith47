import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { getWeekStart } from "../../utils/fitforge.utils.js";
import styles from "../../styles/fitforge.styles.js";

function getBmiColor(b) {
  if (!b) return "#888";
  const v = parseFloat(b);
  if (v < 18.5) return "#60a5fa";
  if (v < 24)   return "#4ade80";
  if (v < 28)   return "#facc15";
  return "#f87171";
}

function getBmiLabel(b) {
  if (!b) return "";
  const v = parseFloat(b);
  if (v < 18.5) return "體重過輕";
  if (v < 24)   return "標準體重";
  if (v < 28)   return "體重過重";
  return "肥胖";
}

function formatClassTime(startDateTime) {
  const d = startDateTime instanceof Date ? startDateTime : new Date(startDateTime);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 週${weekday} ${hh}:${mm}`;
}

function daysUntilClass(startDateTime) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = startDateTime instanceof Date ? startDateTime : new Date(startDateTime);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  return `${diff} 天後`;
}

export default function DashboardTab({ workouts, bodyData, prMap, volumePeriod, setVolumePeriod, streak, nextClass, calendarConnected, calendarKeyword, onConnectCalendar, onSyncCalendar, onDisconnectCalendar, onSaveCalendarKeyword }) {
  const [prExpanded, setPrExpanded] = useState(true);
  const [editingKeyword, setEditingKeyword] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  const workoutDays = new Set(workouts.map(w => w.date)).size;
  const latestBody  = bodyData[0];

  // This week's training days (Mon–Sun)
  const toLocalDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const todayStr   = toLocalDateStr(todayDate);
  const dayOfWeek  = (todayDate.getDay() + 6) % 7; // Mon=0, Sun=6
  const weekStart  = new Date(todayDate);
  weekStart.setDate(todayDate.getDate() - dayOfWeek);
  const thisWeekCount = new Set(
    workouts.filter(w => new Date(w.date + "T00:00:00") >= weekStart).map(w => w.date)
  ).size;

  const recentWorkouts = [...workouts]
    .sort((a, b) =>
      b.date !== a.date
        ? b.date.localeCompare(a.date)
        : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    )
    .slice(0, 5);
  const topPRs = Object.entries(prMap)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .slice(0, 5);

  let bmi = null;
  if (latestBody?.weight && latestBody?.height) {
    const h = parseFloat(latestBody.height) / 100;
    bmi = (parseFloat(latestBody.weight) / (h * h)).toFixed(1);
  }

  // Weekly volume: past 8 weeks
  const weeklyMap = {};
  workouts.forEach(w => {
    const ws = getWeekStart(w.date);
    weeklyMap[ws] = (weeklyMap[ws] || 0) + (w.sets?.length || 0);
  });
  const weeklyPoints = Array.from({ length: 8 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * (7 - i));
    const ws = getWeekStart(d.toISOString().slice(0, 10));
    return { label: ws.slice(5), sets: weeklyMap[ws] || 0 };
  });

  // Daily volume: past 30 days
  const dailyPoints = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const daySets = workouts
      .filter(w => w.date === dateStr)
      .reduce((a, w) => a + (w.sets?.length || 0), 0);
    return { label: dateStr.slice(5), sets: daySets };
  });

  // Monthly volume: past 12 months
  const monthlyMap = {};
  workouts.forEach(w => {
    const month = w.date.slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + (w.sets?.length || 0);
  });
  const monthlyPoints = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    const month = d.toISOString().slice(0, 7);
    return { label: month.slice(2), sets: monthlyMap[month] || 0 };
  });

  const volumePoints = volumePeriod === "day" ? dailyPoints
    : volumePeriod === "month" ? monthlyPoints
    : weeklyPoints;

  return (
    <div>
      {/* 下次上課卡片 */}
      <div style={{ ...styles.card, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={styles.sectionTitle}>下次上課</div>
          {calendarConnected && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={onSyncCalendar}
                title="重新同步"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#888", padding: "2px 4px", lineHeight: 1 }}
              >↻</button>
              <button
                onClick={onDisconnectCalendar}
                title="中斷連結"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#555", padding: "2px 4px", lineHeight: 1 }}
              >✕</button>
            </div>
          )}
        </div>

        {!calendarConnected ? (
          <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 4 }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
              連結 Google Calendar 自動顯示課程時間
            </div>
            <button
              onClick={onConnectCalendar}
              style={{
                background: "linear-gradient(135deg, #4285F4, #34A853)",
                color: "#fff", border: "none", borderRadius: 10,
                padding: "10px 20px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.03em",
              }}
            >
              連結 Google Calendar
            </button>
          </div>
        ) : nextClass ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#e8e4dc", marginBottom: 4 }}>
                {nextClass.title}
              </div>
              <div style={{ fontSize: 13, color: "#aaa" }}>
                {formatClassTime(nextClass.startDateTime)}
              </div>
            </div>
            <div style={{
              background: "rgba(255,106,0,0.15)", borderRadius: 10,
              padding: "6px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#ff6a00", lineHeight: 1 }}>
                {daysUntilClass(nextClass.startDateTime)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#666", paddingTop: 8, textAlign: "center" }}>
            近 30 天沒有排課
          </div>
        )}

        {/* 關鍵字設定列 */}
        {calendarConnected && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {editingKeyword ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { onSaveCalendarKeyword(keywordInput); setEditingKeyword(false); }
                    if (e.key === "Escape") setEditingKeyword(false);
                  }}
                  placeholder="輸入關鍵字"
                  autoFocus
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,106,0,0.4)",
                    borderRadius: 8, padding: "6px 10px", color: "#e8e4dc", fontSize: 13, outline: "none",
                  }}
                />
                <button
                  onClick={() => { onSaveCalendarKeyword(keywordInput); setEditingKeyword(false); }}
                  style={{ background: "#ff6a00", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >儲存</button>
                <button
                  onClick={() => setEditingKeyword(false)}
                  style={{ background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer", padding: "6px 4px" }}
                >✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, color: "#555" }}>篩選關鍵字：</span>
                <span style={{ fontSize: 12, color: "#888", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 8px" }}>
                  {calendarKeyword || "健身"}
                </span>
                <button
                  onClick={() => { setKeywordInput(calendarKeyword || "健身"); setEditingKeyword(true); }}
                  style={{ background: "none", border: "none", color: "#666", fontSize: 12, cursor: "pointer", padding: "2px 4px" }}
                >✏️</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={styles.statRow}>
        <div style={styles.stat}>
          <div style={styles.statNum}>{workoutDays}</div>
          <div style={styles.statLabel}>訓練天數</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statNum}>{thisWeekCount}</div>
          <div style={styles.statLabel}>本週訓練</div>
          <div style={{ fontSize: "11px", color: "#555", marginTop: "1px" }}>/ 7 天</div>
        </div>
        <div style={styles.stat}>
          <div style={{ ...styles.statNum, color: bmi ? getBmiColor(bmi) : "#ff6a00" }}>{bmi || "—"}</div>
          <div style={styles.statLabel}>BMI</div>
        </div>
      </div>

      {/* 訓練量趨勢圖 */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={styles.sectionTitle}>
            {volumePeriod === "day" ? "每日訓練量" : volumePeriod === "week" ? "每週訓練量" : "每月訓練量"}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["D", "day"], ["W", "week"], ["M", "month"]].map(([btnLabel, key]) => (
              <button key={key} onClick={() => setVolumePeriod(key)}
                style={{
                  padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  background: volumePeriod === key ? "#ff6a00" : "rgba(255,255,255,0.08)",
                  color: volumePeriod === key ? "#fff" : "#888",
                  transition: "all 0.15s",
                }}
              >{btnLabel}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={volumePoints} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#666", fontSize: 10, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
              interval={volumePeriod === "day" ? 4 : 1}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#666", fontSize: 10, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
              axisLine={false} tickLine={false} width={36}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const { label, sets } = payload[0].payload;
                const sublabel = volumePeriod === "day" ? label : volumePeriod === "week" ? `${label} 週` : `${label} 月`;
                return (
                  <div style={{ background: "rgba(18,18,28,0.96)", border: "1px solid rgba(255,106,0,0.4)", borderRadius: "10px", padding: "8px 14px", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif", pointerEvents: "none" }}>
                    <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>{sublabel}</div>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "#ff6a00" }}>{sets}<span style={{ fontSize: "12px", fontWeight: 400, color: "#888", marginLeft: "4px" }}>組</span></div>
                  </div>
                );
              }}
              cursor={{ stroke: "rgba(255,106,0,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }}
            />
            <Line type="monotone" dataKey="sets" stroke="#ff6a00" strokeWidth={2}
              dot={{ r: 3, fill: "#ff6a00", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#ff9500", stroke: "#fff", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {latestBody && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>最新身材數據</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "36px", fontWeight: 900, color: "#e8e4dc" }}>
                {latestBody.weight}<span style={{ fontSize: "16px", color: "#888" }}>kg</span>
              </div>
              <div style={{ fontSize: "13px", color: getBmiColor(bmi) }}>{getBmiLabel(bmi)}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "13px", lineHeight: "1.8" }}>
              {latestBody.bodyfat && <div style={{ color: "#888" }}>體脂 {latestBody.bodyfat}%</div>}
              {latestBody.muscle_mass && <div style={{ color: "#888" }}>骨骼肌 {latestBody.muscle_mass}kg</div>}
              {latestBody.visceral_fat && (() => {
                const lv = parseInt(latestBody.visceral_fat);
                const color = lv <= 9 ? "#4ade80" : lv <= 14 ? "#facc15" : "#f87171";
                return <div style={{ color }}>內臟脂 Lv.{latestBody.visceral_fat}</div>;
              })()}
              {latestBody.waist && <div style={{ color: "#888" }}>腰 {latestBody.waist}cm</div>}
            </div>
          </div>
          {bmi && (
            <div style={styles.bmiBar}>
              <div style={{
                height: "100%", width: `${Math.min(100, (parseFloat(bmi) - 10) / 30 * 100)}%`,
                background: getBmiColor(bmi), borderRadius: "3px", transition: "width 0.5s",
              }} />
            </div>
          )}
          {bmi && latestBody?.height && (() => {
            const h = parseFloat(latestBody.height) / 100;
            const bmiVal = parseFloat(bmi);
            const targetLow  = (18.5 * h * h).toFixed(1);
            const targetHigh = (24   * h * h).toFixed(1);
            const cur = parseFloat(latestBody.weight);
            let hint;
            if (bmiVal < 18.5) {
              const diff = (targetLow - cur).toFixed(1);
              hint = `再增 ${diff} kg 可達標準體重`;
            } else if (bmiVal < 24) {
              hint = `維持在標準範圍（${targetLow}–${targetHigh} kg）`;
            } else {
              const diff = (cur - targetHigh).toFixed(1);
              hint = `再減 ${diff} kg 可達標準體重`;
            }
            return (
              <div style={{ fontSize: "12px", color: getBmiColor(bmi), marginTop: "6px", textAlign: "center", letterSpacing: "0.02em" }}>
                {hint}
              </div>
            );
          })()}
        </div>
      )}

      {/* 個人最佳 PR */}
      {topPRs.length > 0 && (
        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: prExpanded ? 8 : 0 }}>
            <div style={styles.sectionTitle}>個人最佳 PR</div>
            <button
              onClick={() => setPrExpanded(v => !v)}
              style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 12, padding: "2px 6px" }}
            >
              {prExpanded ? "▲" : "▼"}
            </button>
          </div>
          {prExpanded && topPRs.map(([exercise, { weight, date }]) => (
            <div key={exercise} style={{ ...styles.workoutItem, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: "15px" }}>{exercise}</div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#ffd700" }}>
                  {weight}<span style={{ fontSize: "13px", fontWeight: 400, color: "#888", marginLeft: "2px" }}>kg</span>
                </div>
                <div style={{ fontSize: "11px", color: "#555" }}>{date}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>近期訓練</div>
        {recentWorkouts.length === 0 && (
          <div style={{ color: "#555", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
            還沒有訓練紀錄，開始記錄你的第一次訓練！
          </div>
        )}
        {recentWorkouts.map(w => (
          <div key={w.id} style={styles.workoutItem}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: "15px" }}>{w.exercise}</span>
              <span style={{ fontSize: "12px", color: "#666" }}>{w.date}</span>
            </div>
            <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {w.sets?.map((s, i) => (
                <span key={i} style={styles.tag}>
                  {s.reps ? `${s.reps}下` : ""}{s.weight ? ` × ${s.weight}kg` : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
