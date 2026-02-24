import { useState, useEffect } from "react";

const STORAGE_KEY_WORKOUTS = "fitforge_workouts";
const STORAGE_KEY_BODY = "fitforge_body";
const STORAGE_KEY_STREAK = "fitforge_streak";

const defaultExercises = [
  "臥推 Bench Press", "深蹲 Squat", "硬舉 Deadlift", "引體向上 Pull-up",
  "肩推 Shoulder Press", "划船 Barbell Row", "二頭彎舉 Bicep Curl",
  "三頭下壓 Tricep Pushdown", "腿推 Leg Press", "飛鳥 Cable Fly"
];

function useStorage(key, init) {
  const [val, setVal] = useState(() => {
    try {
      const r = window.storage ? null : JSON.parse(localStorage.getItem(key) || "null");
      return r ?? init;
    } catch { return init; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [val, key]);
  return [val, setVal];
}

export default function FitForge() {
  const [tab, setTab] = useState("dashboard");
  const [workouts, setWorkouts] = useStorage(STORAGE_KEY_WORKOUTS, []);
  const [bodyData, setBodyData] = useStorage(STORAGE_KEY_BODY, []);
  const [streak, setStreak] = useStorage(STORAGE_KEY_STREAK, { count: 0, lastDate: null });

  // Workout form state
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10));
  const [wExercise, setWExercise] = useState(defaultExercises[0]);
  const [wCustom, setWCustom] = useState("");
  const [wSets, setWSets] = useState([{ reps: "", weight: "" }]);
  const [wNote, setWNote] = useState("");
  const [savedAnim, setSavedAnim] = useState(false);

  // Body form state
  const [bDate, setBDate] = useState(new Date().toISOString().slice(0, 10));
  const [bWeight, setBWeight] = useState("");
  const [bHeight, setBHeight] = useState("");
  const [bChest, setBChest] = useState("");
  const [bWaist, setBWaist] = useState("");
  const [bHip, setBHip] = useState("");
  const [bArm, setBArm] = useState("");
  const [bThigh, setBThigh] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  // Streak calc
  useEffect(() => {
    const todayWorked = workouts.some(w => w.date === today);
    if (todayWorked && streak.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
      setStreak({ count: newCount, lastDate: today });
    }
  }, [workouts]);

  function addSet() { setWSets([...wSets, { reps: "", weight: "" }]); }
  function removeSet(i) { setWSets(wSets.filter((_, idx) => idx !== i)); }
  function updateSet(i, field, val) {
    const s = [...wSets]; s[i] = { ...s[i], [field]: val }; setWSets(s);
  }

  function saveWorkout() {
    const name = wCustom.trim() || wExercise;
    const entry = { id: Date.now(), date: wDate, exercise: name, sets: wSets, note: wNote };
    setWorkouts([entry, ...workouts]);
    setWSets([{ reps: "", weight: "" }]);
    setWNote("");
    setWCustom("");
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 1500);
  }

  function saveBody() {
    const entry = { id: Date.now(), date: bDate, weight: bWeight, height: bHeight, chest: bChest, waist: bWaist, hip: bHip, arm: bArm, thigh: bThigh };
    setBodyData([entry, ...bodyData]);
    setBWeight(""); setBHeight(""); setBChest(""); setBWaist(""); setBHip(""); setBArm(""); setBThigh("");
  }

  const recentWorkouts = workouts.slice(0, 5);
  const latestBody = bodyData[0];
  const workoutDays = new Set(workouts.map(w => w.date)).size;
  const totalSets = workouts.reduce((a, w) => a + w.sets.length, 0);

  // BMI
  let bmi = null;
  if (latestBody?.weight && latestBody?.height) {
    const h = parseFloat(latestBody.height) / 100;
    bmi = (parseFloat(latestBody.weight) / (h * h)).toFixed(1);
  }

  const tabs = [
    { id: "dashboard", label: "儀表板", icon: "⚡" },
    { id: "workout", label: "訓練記錄", icon: "💪" },
    { id: "body", label: "身材數據", icon: "📏" },
    { id: "history", label: "歷史紀錄", icon: "📋" },
  ];

  const styles = {
    app: {
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e8e4dc",
      fontFamily: "'Barlow Condensed', 'Noto Sans TC', sans-serif",
      position: "relative",
      overflow: "hidden",
    },
    bg: {
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
      background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,90,0,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 90% 90%, rgba(255,180,0,0.07) 0%, transparent 60%)",
    },
    header: {
      position: "relative", zIndex: 10,
      padding: "24px 20px 0",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    logo: {
      fontSize: "28px", fontWeight: 900, letterSpacing: "0.05em",
      background: "linear-gradient(90deg, #ff6a00, #ffd700)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
      textTransform: "uppercase",
    },
    streakBadge: {
      background: streak.count > 0 ? "linear-gradient(135deg, #ff6a00, #ff2d00)" : "#1a1a22",
      padding: "6px 14px", borderRadius: "20px",
      fontSize: "14px", fontWeight: 700, letterSpacing: "0.05em",
      border: "1px solid rgba(255,106,0,0.3)",
      display: "flex", alignItems: "center", gap: "6px",
    },
    nav: {
      position: "relative", zIndex: 10,
      display: "flex", gap: "4px",
      padding: "16px 16px 0",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    },
    navBtn: (active) => ({
      flex: 1, padding: "10px 4px", border: "none", cursor: "pointer",
      background: active ? "rgba(255,106,0,0.15)" : "transparent",
      color: active ? "#ff6a00" : "#888",
      borderBottom: active ? "2px solid #ff6a00" : "2px solid transparent",
      fontSize: "12px", fontWeight: 700, letterSpacing: "0.04em",
      transition: "all 0.2s",
    }),
    content: {
      position: "relative", zIndex: 10,
      padding: "20px 16px 100px",
      maxWidth: "480px", margin: "0 auto",
    },
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "16px", padding: "20px",
      marginBottom: "16px",
      backdropFilter: "blur(10px)",
    },
    statRow: {
      display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "16px",
    },
    stat: {
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "12px", padding: "16px 12px", textAlign: "center",
    },
    statNum: { fontSize: "28px", fontWeight: 900, color: "#ff6a00", lineHeight: 1 },
    statLabel: { fontSize: "11px", color: "#888", marginTop: "4px", letterSpacing: "0.05em" },
    sectionTitle: {
      fontSize: "13px", fontWeight: 700, color: "#888",
      letterSpacing: "0.1em", textTransform: "uppercase",
      marginBottom: "12px",
    },
    label: { fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" },
    input: {
      width: "100%", background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
      padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
      outline: "none", boxSizing: "border-box",
      fontFamily: "inherit",
    },
    select: {
      width: "100%", background: "#12121a",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
      padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
      outline: "none", boxSizing: "border-box",
    },
    btn: {
      width: "100%", padding: "14px", border: "none", borderRadius: "12px",
      background: "linear-gradient(135deg, #ff6a00, #ff9500)",
      color: "#fff", fontSize: "16px", fontWeight: 800,
      cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
      marginTop: "8px", transition: "transform 0.1s, opacity 0.1s",
    },
    btnSecondary: {
      padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
      background: "transparent", color: "#888", fontSize: "13px",
      cursor: "pointer", fontFamily: "inherit",
    },
    setRow: {
      display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px",
    },
    setInput: {
      flex: 1, background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
      padding: "8px 12px", color: "#e8e4dc", fontSize: "15px",
      outline: "none", textAlign: "center", fontFamily: "inherit",
    },
    setLabel: { fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" },
    deleteBtn: {
      background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.2)",
      borderRadius: "8px", padding: "8px 10px", color: "#ff5555",
      cursor: "pointer", fontSize: "14px",
    },
    workoutItem: {
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "12px", padding: "14px 16px", marginBottom: "8px",
    },
    bodyGrid: {
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
    },
    bmiBar: {
      height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.08)",
      marginTop: "8px", overflow: "hidden",
    },
    historyDate: {
      fontSize: "11px", color: "#666", letterSpacing: "0.06em",
      textTransform: "uppercase", marginBottom: "6px",
    },
    tag: {
      display: "inline-block", padding: "3px 10px",
      background: "rgba(255,106,0,0.15)", border: "1px solid rgba(255,106,0,0.25)",
      borderRadius: "20px", fontSize: "12px", color: "#ff9500", marginRight: "6px",
    },
  };

  const getBmiColor = (b) => {
    if (!b) return "#888";
    const v = parseFloat(b);
    if (v < 18.5) return "#60a5fa";
    if (v < 24) return "#4ade80";
    if (v < 28) return "#facc15";
    return "#f87171";
  };

  const getBmiLabel = (b) => {
    if (!b) return "";
    const v = parseFloat(b);
    if (v < 18.5) return "體重過輕";
    if (v < 24) return "標準體重";
    if (v < 28) return "體重過重";
    return "肥胖";
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet" />
      <div style={styles.app}>
        <div style={styles.bg} />

        <div style={styles.header}>
          <div style={styles.logo}>FitForge</div>
          <div style={styles.streakBadge}>
            🔥 {streak.count} 天連續
          </div>
        </div>

        <div style={styles.nav}>
          {tabs.map(t => (
            <button key={t.id} style={styles.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>
              <div>{t.icon}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>

        <div style={styles.content}>

          {/* DASHBOARD */}
          {tab === "dashboard" && (
            <div>
              <div style={styles.statRow}>
                <div style={styles.stat}>
                  <div style={styles.statNum}>{workoutDays}</div>
                  <div style={styles.statLabel}>訓練天數</div>
                </div>
                <div style={styles.stat}>
                  <div style={styles.statNum}>{totalSets}</div>
                  <div style={styles.statLabel}>總組數</div>
                </div>
                <div style={styles.stat}>
                  <div style={{ ...styles.statNum, color: bmi ? getBmiColor(bmi) : "#ff6a00" }}>{bmi || "—"}</div>
                  <div style={styles.statLabel}>BMI</div>
                </div>
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
                    <div style={{ textAlign: "right", fontSize: "13px", color: "#888", lineHeight: "1.8" }}>
                      {latestBody.chest && <div>胸 {latestBody.chest}cm</div>}
                      {latestBody.waist && <div>腰 {latestBody.waist}cm</div>}
                      {latestBody.hip && <div>臀 {latestBody.hip}cm</div>}
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
                      {w.sets.map((s, i) => (
                        <span key={i} style={styles.tag}>
                          {s.reps ? `${s.reps}下` : ""}{s.weight ? ` × ${s.weight}kg` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ ...styles.card, borderColor: "rgba(255,106,0,0.2)", background: "rgba(255,106,0,0.05)" }}>
                <div style={{ fontSize: "13px", color: "#888", lineHeight: "1.8" }}>
                  💡 <strong style={{ color: "#ff9500" }}>今日提醒</strong><br />
                  {streak.count >= 3 ? `🔥 你已經連續訓練 ${streak.count} 天了！保持下去！` : "今天有訓練嗎？記錄你的每一次努力！"}
                </div>
              </div>
            </div>
          )}

          {/* WORKOUT */}
          {tab === "workout" && (
            <div>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>新增訓練</div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={styles.label}>日期</label>
                  <input type="date" style={styles.input} value={wDate} onChange={e => setWDate(e.target.value)} />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={styles.label}>選擇動作</label>
                  <select style={styles.select} value={wExercise} onChange={e => setWExercise(e.target.value)}>
                    {defaultExercises.map(ex => <option key={ex}>{ex}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={styles.label}>自訂動作名稱（可選）</label>
                  <input style={styles.input} placeholder="輸入其他動作..." value={wCustom} onChange={e => setWCustom(e.target.value)} />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <label style={{ ...styles.label, marginBottom: 0 }}>訓練組數</label>
                    <button style={styles.btnSecondary} onClick={addSet}>+ 新增一組</button>
                  </div>
                  {wSets.map((s, i) => (
                    <div key={i}>
                      <div style={styles.setRow}>
                        <div style={{ textAlign: "center", color: "#ff6a00", fontWeight: 900, fontSize: "18px", minWidth: "24px" }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <input type="number" style={styles.setInput} placeholder="次數" value={s.reps} onChange={e => updateSet(i, "reps", e.target.value)} />
                          <div style={styles.setLabel}>次數 (reps)</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <input type="number" style={styles.setInput} placeholder="重量" value={s.weight} onChange={e => updateSet(i, "weight", e.target.value)} />
                          <div style={styles.setLabel}>重量 (kg)</div>
                        </div>
                        {wSets.length > 1 && (
                          <button style={styles.deleteBtn} onClick={() => removeSet(i)}>✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={styles.label}>備註（可選）</label>
                  <input style={styles.input} placeholder="例：感覺很好、需要加重..." value={wNote} onChange={e => setWNote(e.target.value)} />
                </div>

                <button style={{ ...styles.btn, transform: savedAnim ? "scale(0.97)" : "scale(1)", opacity: savedAnim ? 0.8 : 1 }} onClick={saveWorkout}>
                  {savedAnim ? "✓ 已儲存！" : "💾 儲存訓練"}
                </button>
              </div>
            </div>
          )}

          {/* BODY */}
          {tab === "body" && (
            <div>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>記錄身材數據</div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={styles.label}>日期</label>
                  <input type="date" style={styles.input} value={bDate} onChange={e => setBDate(e.target.value)} />
                </div>

                <div style={styles.bodyGrid}>
                  {[
                    ["體重", "kg", bWeight, setBWeight],
                    ["身高", "cm", bHeight, setBHeight],
                    ["胸圍", "cm", bChest, setBChest],
                    ["腰圍", "cm", bWaist, setBWaist],
                    ["臀圍", "cm", bHip, setBHip],
                    ["手臂圍", "cm", bArm, setBArm],
                    ["大腿圍", "cm", bThigh, setBThigh],
                  ].map(([label, unit, val, setter]) => (
                    <div key={label}>
                      <label style={styles.label}>{label} ({unit})</label>
                      <input type="number" style={styles.input} placeholder={`輸入${label}`} value={val} onChange={e => setter(e.target.value)} />
                    </div>
                  ))}
                </div>

                <button style={styles.btn} onClick={saveBody}>📏 儲存身材數據</button>
              </div>

              {bodyData.length > 0 && (
                <div style={styles.card}>
                  <div style={styles.sectionTitle}>身材趨勢</div>
                  {bodyData.slice(0, 5).map((b, i) => (
                    <div key={b.id} style={{ ...styles.workoutItem, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "20px", fontWeight: 900, color: i === 0 ? "#ff6a00" : "#e8e4dc" }}>
                          {b.weight}kg
                        </div>
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                          {b.chest && `胸${b.chest} `}{b.waist && `腰${b.waist} `}{b.hip && `臀${b.hip}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "#666" }}>{b.date}</div>
                        {i === 0 && <div style={{ fontSize: "11px", color: "#ff6a00", marginTop: "2px" }}>最新</div>}
                        {i > 0 && bodyData[i - 1]?.weight && (
                          <div style={{ fontSize: "13px", color: parseFloat(b.weight) < parseFloat(bodyData[i - 1].weight) ? "#4ade80" : "#f87171", fontWeight: 700 }}>
                            {parseFloat(b.weight) < parseFloat(bodyData[i - 1].weight) ? "↓" : "↑"}
                            {Math.abs(parseFloat(b.weight) - parseFloat(bodyData[i - 1].weight)).toFixed(1)}kg
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HISTORY */}
          {tab === "history" && (
            <div>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>所有訓練紀錄</div>
                {workouts.length === 0 && (
                  <div style={{ color: "#555", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>還沒有訓練紀錄</div>
                )}
                {workouts.map(w => (
                  <div key={w.id} style={{ ...styles.workoutItem, marginBottom: "10px" }}>
                    <div style={styles.historyDate}>{w.date}</div>
                    <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>{w.exercise}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: w.note ? "8px" : 0 }}>
                      {w.sets.map((s, i) => (
                        <span key={i} style={styles.tag}>
                          第{i + 1}組 {s.reps ? `${s.reps}下` : ""}{s.weight ? ` × ${s.weight}kg` : ""}
                        </span>
                      ))}
                    </div>
                    {w.note && <div style={{ fontSize: "13px", color: "#888", fontStyle: "italic" }}>📝 {w.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
