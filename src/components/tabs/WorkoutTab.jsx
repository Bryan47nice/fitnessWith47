import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getWeekStart, canSaveWorkout, getLastSessionSets, paceFromTimeDist, toMinPerKm } from "../../utils/fitforge.utils.js";
import { exerciseCategories, INCLINE_EXERCISES, RUNNING_EXERCISES } from "../../constants/fitforge.constants.js";
import styles from "../../styles/fitforge.styles.js";

function getCategoryForExercise(name, customExercises) {
  for (const cat of exerciseCategories) {
    if (cat.exercises.includes(name)) return cat.label;
  }
  const custom = customExercises.find(e => e.name === name);
  if (custom) return custom.category || "自訂";
  return "";
}

function isCardio(name, customExercises) {
  return getCategoryForExercise(name, customExercises) === "有氧";
}

function showIncline(name) {
  return INCLINE_EXERCISES.includes(name);
}

function isRunning(name) {
  return RUNNING_EXERCISES.includes(name);
}


export default function WorkoutTab({
  // Data
  workouts, customExercises, pickerDisplayList, recentExercises,
  // Workout form state
  wDate, setWDate, wExercise, setWExercise, wSets, setWSets,
  wNote, setWNote, wCalories, setWCalories,
  batchReps, setBatchReps, batchWeight, setBatchWeight, batchCount, setBatchCount,
  savedAnim,
  // Picker state
  exPickerExpanded, setExPickerExpanded, exSearchQuery, setExSearchQuery,
  exActiveTag, setExActiveTag, showAddCustomEx, setShowAddCustomEx,
  newExName, setNewExName,
  newExCategory, setNewExCategory,
  newExCustomCategoryInput, setNewExCustomCategoryInput,
  userCustomCategories,
  // History state
  historyGroupMode, setHistoryGroupMode, expandedGroupKeys, setExpandedGroupKeys,
  expandedDayKeys, setExpandedDayKeys,
  // Handlers
  saveWorkout, addSet, updateSet, removeSet, batchAddSets,
  deleteWorkout, openEditWorkout,
  addCustomExercise, deleteCustomExercise, updateCustomExercise, setConfirmDialog,
  // Editing custom exercise
  editingExId, setEditingExId, editingExName, setEditingExName,
  editingExCategory, setEditingExCategory,
  editingExCustomCategoryInput, setEditingExCustomCategoryInput,
  // History filter
  historyExFilter, setHistoryExFilter,
  historyActiveCategory, setHistoryActiveCategory,
  // Streak
  streak,
  // AI refresh
  aiRefreshKey,
  // Coach days
  coachDays, toggleCoachDay, toggleWorkoutCoach,
  // Today's plan
  todayPlan, setTodayPlan,
}) {
  const MONTHS_ZH = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
  const toLocalDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = toLocalDateStr();

  // ── Calendar state ──
  const [calView, setCalView] = useState("month"); // "month" | "week"
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [calWeekStart, setCalWeekStart] = useState(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const d = new Date(now);
    d.setDate(now.getDate() - (now.getDay() + 6) % 7); // Monday
    return d;
  });
  const [selectedCalDate, setSelectedCalDate] = useState(null);

  // ── AI comment state ──
  const [aiComment, setAiComment] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Exercise AI comment state ──
  const [exAiComment, setExAiComment] = useState(null);
  const [exAiLoading, setExAiLoading] = useState(false);
  const [coachToast, setCoachToast] = useState(null); // toast message string
  const coachToastTimer = useRef(null);
  const historyRef = useRef(null);

  // Calendar computation
  const { year, month } = calMonth;
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const workoutDateSet = new Set(workouts.map(w => w.date));
  const workoutDateCount = workouts.reduce((map, w) => {
    map.set(w.date, (map.get(w.date) || 0) + 1);
    return map;
  }, new Map());
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthDays = [...workoutDateSet].filter(d => d.startsWith(monthPrefix)).length;
  const weekStartStr = toLocalDateStr(calWeekStart);
  const weekEndDate = new Date(calWeekStart); weekEndDate.setDate(calWeekStart.getDate() + 6);
  const weekEndStr = toLocalDateStr(weekEndDate);
  const weekDays = [...workoutDateSet].filter(d => d >= weekStartStr && d <= weekEndStr).length;
  const totalDays = calView === "month" ? monthDays : weekDays;
  const calGrid = [];
  for (let i = 0; i < firstDayOfWeek; i++) calGrid.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calGrid.push({ day: d, dateStr, hasWorkout: workoutDateSet.has(dateStr), isToday: dateStr === todayStr });
  }
  while (calGrid.length % 7 !== 0) calGrid.push(null);

  const prevMonth = () => setCalMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
  );
  const nextMonth = () => setCalMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
  );
  const prevWeek = () => setCalWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setCalWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  // Week view grid (7 days from calWeekStart)
  const weekGrid = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(calWeekStart);
    d.setDate(calWeekStart.getDate() + i);
    const dateStr = toLocalDateStr(d);
    return { day: d.getDate(), dateStr, hasWorkout: workoutDateSet.has(dateStr), isToday: dateStr === todayStr };
  });
  const weekLabel = (() => {
    const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    const end = new Date(calWeekStart); end.setDate(calWeekStart.getDate() + 6);
    return `${fmt(calWeekStart)} – ${fmt(end)}`;
  })();

  const fetchAiComment = async () => {
    setAiLoading(true);
    setAiComment(null);
    try {
      const fns = getFunctions(getApp(), "asia-east1");
      const genComment = httpsCallable(fns, "generateFitnessComment");
      const thirtyDaysAgo = toLocalDateStr(new Date(Date.now() - 30 * 86400000));
      const recentCount = new Set(workouts.filter(w => w.date >= thirtyDaysAgo).map(w => w.date)).size;
      const result = await genComment({
        streak: streak?.count || 0,
        lastDate: streak?.lastDate || null,
        recentCount,
        todayStr,
      });
      const comment = result.data.comment;
      localStorage.setItem(`ai_fitness_comment_${todayStr}`, comment);
      setAiComment(comment);
    } catch {
      setAiComment("今天 AI 教練暫時離線，但你的訓練精神永不缺席！");
    }
    setAiLoading(false);
  };

  useEffect(() => {
    const cached = localStorage.getItem(`ai_fitness_comment_${todayStr}`);
    if (cached) { setAiComment(cached); return; }
    fetchAiComment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiRefreshKey]);

  const fetchExAiComment = async (exerciseName) => {
    setExAiLoading(true);
    setExAiComment(null);
    try {
      const fns = getFunctions(getApp(), "asia-east1");
      const genComment = httpsCallable(fns, "generateFitnessComment");
      const exHistory = workouts
        .filter(w => w.exercise === exerciseName)
        .slice(0, 10)
        .map(w => ({ date: w.date, sets: w.sets }));
      const result = await genComment({ exercise: exerciseName, exerciseHistory: exHistory, todayStr });
      localStorage.setItem(`ai_ex_comment_${exerciseName}_${todayStr}`, result.data.comment);
      setExAiComment(result.data.comment);
    } catch {
      setExAiComment("AI 教練暫時離線，繼續加油！");
    }
    setExAiLoading(false);
  };

  useEffect(() => {
    if (!historyExFilter) { setExAiComment(null); return; }
    const cacheKey = `ai_ex_comment_${historyExFilter}_${todayStr}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setExAiComment(cached); return; }
    fetchExAiComment(historyExFilter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyExFilter]);

  const cardio = (name) => isCardio(name, customExercises);

  return (
    <>
    <div>
      {/* ── 訓練日曆（Google Calendar 風格）── */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={calView === "month" ? prevMonth : prevWeek} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer", padding: "4px 10px", lineHeight: 1 }}>◀</button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#e8e4dc", textAlign: "center" }}>
              {calView === "month" ? `${year} 年 ${MONTHS_ZH[month]}` : weekLabel}
              {totalDays > 0 && (
                <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "#666" }}>共 {totalDays} 天</span>
              )}
              {(streak?.count || 0) > 0 && (
                <span style={{ marginLeft: 6, fontSize: 13, fontWeight: 700, color: "#ff6a00" }}>🔥 {streak.count} 天</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["month", "week"].map(v => (
                <button key={v} onClick={() => setCalView(v)} style={{
                  padding: "2px 10px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, fontWeight: calView === v ? 700 : 400,
                  border: calView === v ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                  background: calView === v ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                  color: calView === v ? "#ff6a00" : "#888",
                }}>{v === "month" ? "月" : "週"}</button>
              ))}
            </div>
          </div>
          <button onClick={calView === "month" ? nextMonth : nextWeek} style={{ background: "none", border: "none", color: "#888", fontSize: 18, cursor: "pointer", padding: "4px 10px", lineHeight: 1 }}>▶</button>
        </div>

        {/* 星期標題 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
          {["一", "二", "三", "四", "五", "六", "日"].map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#555", paddingBottom: 6, fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {/* 日期格子 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {(calView === "month" ? calGrid : weekGrid).map((cell, i) => {
            if (!cell) return <div key={i} />;
            const { day, dateStr, hasWorkout, isToday } = cell;
            const isSelected = selectedCalDate === dateStr;
            const dayCount = workoutDateCount.get(dateStr) || 0;
            return (
              <div
                key={dateStr}
                onClick={() => {
                  const next = selectedCalDate === dateStr ? null : dateStr;
                  setSelectedCalDate(next);
                  if (next) setTimeout(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
                style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "3px 0", cursor: "pointer" }}
              >
                <div style={{ position: "relative" }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: hasWorkout ? 800 : 400,
                    background: hasWorkout
                      ? "rgba(255,106,0,0.85)"
                      : isSelected ? "rgba(255,255,255,0.12)" : "transparent",
                    color: hasWorkout ? "#fff" : isToday ? "#ff6a00" : "#c8c4bc",
                    border: isToday && !hasWorkout ? "1.5px solid #ff6a00" : "1.5px solid transparent",
                    boxShadow: hasWorkout && isToday ? "0 0 10px rgba(255,106,0,0.5)" : "none",
                    transition: "background 0.15s",
                  }}>
                    {day}
                  </div>
                  {dayCount >= 2 && (
                    <div style={{
                      position: "absolute", top: -3, right: -3,
                      width: 14, height: 14, borderRadius: "50%",
                      background: "#fff", color: "#ff6a00",
                      fontSize: 9, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      lineHeight: 1,
                    }}>{dayCount}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AI 教練評語 ── */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#888", letterSpacing: "0.05em" }}>AI 教練評語</div>
          <button
            onClick={() => { localStorage.removeItem(`ai_fitness_comment_${todayStr}`); fetchAiComment(); }}
            disabled={aiLoading}
            style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: aiLoading ? "default" : "pointer", padding: "2px 4px" }}
          >↻ 重新生成</button>
        </div>
        {aiLoading ? (
          <div style={{ fontSize: 14, color: "#555", fontStyle: "italic" }}>🤖 AI 教練正在分析你的訓練數據...</div>
        ) : (
          <div style={{ fontSize: 15, color: "#c8c4bc", lineHeight: 1.6 }}>🤖 {aiComment || "—"}</div>
        )}
      </div>

      {/* ── 新增訓練 ── */}
      <div style={styles.card}>
        <div style={styles.sectionTitle}>新增訓練</div>

        <div style={{ marginBottom: "12px" }}>
          <label style={styles.label}>日期</label>
          <input type="date" style={styles.input} value={wDate} onChange={e => setWDate(e.target.value)} />
        </div>

        {!exPickerExpanded ? (
          <div style={{ marginBottom: "12px" }}>
            <label style={styles.label}>動作</label>
            <button
              style={{ ...styles.exPickerTrigger, color: wExercise ? "#e8e4dc" : "#555" }}
              onClick={() => setExPickerExpanded(true)}
            >
              <span>{wExercise || "請選擇或搜尋動作"}</span>
              <span style={{ color: "#666", fontSize: "12px" }}>▼ {wExercise ? "更換" : "選擇"}</span>
            </button>
            {(() => {
              const last = wExercise ? workouts.find(w => w.exercise === wExercise) : null;
              if (!last) return null;
              return (
                <button
                  onClick={() => setWSets(JSON.parse(JSON.stringify(last.sets)))}
                  style={{
                    marginTop: 6, padding: "4px 10px", borderRadius: 20,
                    background: "rgba(255,106,0,0.08)",
                    border: "1px solid rgba(255,106,0,0.25)",
                    color: "#cc5500", fontSize: 12, cursor: "pointer",
                    fontFamily: "inherit", display: "inline-block",
                  }}>
                  ↩ 複製上次（{last.date}，{last.sets?.length || 0} 組）
                </button>
              );
            })()}
          </div>
        ) : (
          <div style={{ marginBottom: "12px" }}>
            {/* 搜尋框 */}
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <input
                autoFocus
                style={{ ...styles.input, paddingRight: "36px" }}
                placeholder="搜尋或選擇動作..."
                value={exSearchQuery}
                onChange={e => setExSearchQuery(e.target.value)}
              />
              {exSearchQuery && (
                <button
                  onClick={() => setExSearchQuery("")}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: "#888", fontSize: "16px", cursor: "pointer",
                  }}
                >✕</button>
              )}
            </div>

            {/* 部位 Tag 列 */}
            <div style={{
              display: "flex", gap: "8px", overflowX: "auto",
              WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
              paddingBottom: "4px", marginBottom: "10px",
            }}>
              {[...exerciseCategories.map(c => c.label), ...userCustomCategories, "自訂"].map(tag => (
                <button key={tag} onClick={() => {
                  const next = exActiveTag === tag ? null : tag;
                  setExActiveTag(next);
                  if (next) localStorage.setItem("ex_active_tag", next);
                  else localStorage.removeItem("ex_active_tag");
                  setExSearchQuery("");
                }}
                  style={{
                    flexShrink: 0, padding: "5px 12px", borderRadius: "20px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: "13px", fontWeight: exActiveTag === tag ? 700 : 400,
                    border: exActiveTag === tag ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                    background: exActiveTag === tag ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                    color: exActiveTag === tag ? "#ff6a00" : "#888",
                  }}>
                  {tag}
                </button>
              ))}
            </div>

            {/* 今日計畫 chips */}
            {todayPlan && todayPlan.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <div style={{ fontSize: "11px", color: "#666", marginBottom: "6px", letterSpacing: "0.06em" }}>今日計畫</div>
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", paddingBottom: "2px" }}>
                  {todayPlan.map(name => {
                    const done = workouts.some(w => w.exercise === name && w.date === todayStr);
                    return (
                      <button
                        key={name}
                        onClick={() => setWExercise(name)}
                        style={{
                          flexShrink: 0, padding: "5px 12px", borderRadius: "20px", cursor: "pointer",
                          fontFamily: "inherit", fontSize: "13px",
                          background: done ? "rgba(255,255,255,0.04)" : "rgba(255,106,0,0.12)",
                          border: `1px solid ${done ? "rgba(255,255,255,0.08)" : "rgba(255,106,0,0.35)"}`,
                          color: done ? "#555" : "#ff6a00",
                        }}
                      >
                        {done ? `✓ ${name}` : name}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setTodayPlan([])}
                    style={{
                      flexShrink: 0, padding: "5px 10px", borderRadius: "20px", cursor: "pointer",
                      fontFamily: "inherit", fontSize: "12px",
                      background: "transparent", border: "1px solid rgba(255,255,255,0.06)",
                      color: "#444",
                    }}
                  >✕</button>
                </div>
              </div>
            )}

            {/* 動作列表 */}
            <div style={{
              maxHeight: "220px", overflowY: "auto", WebkitOverflowScrolling: "touch",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", background: "#12121a",
            }}>
              {!exSearchQuery && !exActiveTag && recentExercises.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: "13px" }}>
                  輸入動作名稱或選擇部位開始
                </div>
              )}
              {!exSearchQuery && !exActiveTag && recentExercises.length > 0 && (
                <div style={{ padding: "8px 14px 4px", fontSize: "11px", color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  最近使用
                </div>
              )}

              {pickerDisplayList.map(ex => (
                <button key={ex.name} onClick={() => {
                  const newIsCardio = getCategoryForExercise(ex.name, customExercises) === "有氧";
                  const curIsCardio = getCategoryForExercise(wExercise, customExercises) === "有氧";
                  let nextSets = wSets;
                  if (newIsCardio !== curIsCardio) {
                    nextSets = newIsCardio ? [{ duration: "", duration_sec: "", distance: "", speed: "", incline: "" }] : [];
                  }
                  if (nextSets.length === 0) {
                    const lastSets = getLastSessionSets(ex.name, workouts);
                    if (lastSets) nextSets = lastSets;
                  }
                  setWSets(nextSets);
                  setWExercise(ex.name);
                  setExPickerExpanded(false);
                  setExSearchQuery("");
                }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    width: "100%", padding: "11px 14px",
                    background: wExercise === ex.name ? "rgba(255,106,0,0.12)" : "transparent",
                    border: "none", borderLeft: wExercise === ex.name ? "3px solid #ff6a00" : "3px solid transparent",
                    color: wExercise === ex.name ? "#ff9500" : "#e8e4dc",
                    fontSize: "15px", textAlign: "left", cursor: "pointer",
                    fontFamily: "inherit", boxSizing: "border-box",
                  }}>
                  {ex.category && (
                    <span style={{
                      fontSize: "10px", fontWeight: 700, color: "#666",
                      background: "rgba(255,255,255,0.06)", borderRadius: "4px",
                      padding: "2px 6px", flexShrink: 0, letterSpacing: "0.04em",
                    }}>{ex.category}</span>
                  )}
                  {editingExId === ex.id ? null : ex.name}
                  {ex.id && editingExId === ex.id && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", paddingTop: "2px" }}
                    >
                      <input
                        autoFocus
                        style={{ ...styles.input, padding: "6px 10px", fontSize: "13px" }}
                        placeholder="動作名稱..."
                        value={editingExName}
                        onChange={e => setEditingExName(e.target.value)}
                      />
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#666", flexShrink: 0 }}>分類：</span>
                        {[...exerciseCategories.map(c => c.label), ...userCustomCategories, "自訂"].map(cat => (
                          <button key={cat}
                            onClick={() => { setEditingExCategory(cat); setEditingExCustomCategoryInput(""); }}
                            style={{
                              padding: "2px 8px", borderRadius: "12px", fontSize: "11px",
                              border: editingExCategory === cat ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                              background: editingExCategory === cat ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                              color: editingExCategory === cat ? "#ff6a00" : "#888",
                              cursor: "pointer", fontFamily: "inherit",
                            }}>{cat}</button>
                        ))}
                        <button
                          onClick={() => setEditingExCategory("__new__")}
                          style={{
                            padding: "2px 8px", borderRadius: "12px", fontSize: "11px",
                            border: editingExCategory === "__new__" ? "1px solid #ff6a00" : "1px dashed rgba(255,255,255,0.2)",
                            background: editingExCategory === "__new__" ? "rgba(255,106,0,0.1)" : "transparent",
                            color: editingExCategory === "__new__" ? "#ff6a00" : "#666",
                            cursor: "pointer", fontFamily: "inherit",
                          }}>＋ 新分類</button>
                      </div>
                      {editingExCategory === "__new__" && (
                        <input
                          style={{ ...styles.input, padding: "5px 10px", fontSize: "12px" }}
                          placeholder="輸入新分類名稱..."
                          value={editingExCustomCategoryInput}
                          onChange={e => setEditingExCustomCategoryInput(e.target.value)}
                        />
                      )}
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => updateCustomExercise()}
                          style={{
                            flex: 1, padding: "6px", border: "none", borderRadius: "6px",
                            background: "linear-gradient(135deg,#ff6a00,#ff9500)",
                            color: "#fff", fontSize: "12px", fontWeight: 800,
                            cursor: "pointer", fontFamily: "inherit",
                          }}>儲存</button>
                        <button
                          onClick={() => { setEditingExId(null); setEditingExName(""); setEditingExCategory("自訂"); setEditingExCustomCategoryInput(""); }}
                          style={{
                            padding: "6px 10px", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: "6px", background: "transparent",
                            color: "#888", fontSize: "12px", cursor: "pointer", fontFamily: "inherit",
                          }}>取消</button>
                      </div>
                    </div>
                  )}
                  {ex.id && !editingExId && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: "4px", flexShrink: 0 }}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingExId(ex.id);
                          setEditingExName(ex.name);
                          setEditingExCategory(ex.category || "自訂");
                          setEditingExCustomCategoryInput("");
                        }}
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.14)", borderRadius: "6px",
                          color: "#aaa", fontSize: "11px", padding: "2px 8px",
                          cursor: "pointer", fontFamily: "inherit",
                        }}>
                        編輯
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setConfirmDialog({
                            message: `確認刪除自訂動作「${ex.name}」？`,
                            onConfirm: async () => {
                              await deleteCustomExercise(ex.id);
                              setConfirmDialog(null);
                            },
                          });
                        }}
                        style={{
                          background: "rgba(255,50,50,0.12)",
                          border: "1px solid rgba(255,50,50,0.2)", borderRadius: "6px",
                          color: "#ff5555", fontSize: "11px", padding: "2px 8px",
                          cursor: "pointer", fontFamily: "inherit",
                        }}>
                        刪除
                      </button>
                    </div>
                  )}
                </button>
              ))}

              {/* 所有 Tag：底部新增動作按鈕 */}
              {exActiveTag && !exSearchQuery && (
                <div style={{ padding: "8px 14px 12px", borderTop: pickerDisplayList.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  {showAddCustomEx ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <input
                        autoFocus
                        style={{ ...styles.input, padding: "8px 12px", fontSize: "14px" }}
                        placeholder="動作名稱..."
                        value={newExName}
                        onChange={e => setNewExName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { addCustomExercise(); setShowAddCustomEx(false); }
                          if (e.key === "Escape") { setShowAddCustomEx(false); setNewExName(""); setNewExCategory("自訂"); setNewExCustomCategoryInput(""); }
                        }}
                      />
                      {/* 分類選擇列 */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "#666", flexShrink: 0 }}>分類：</span>
                        {[...exerciseCategories.map(c => c.label), ...userCustomCategories, "自訂"].map(cat => (
                          <button key={cat}
                            onClick={() => { setNewExCategory(cat); setNewExCustomCategoryInput(""); }}
                            style={{
                              padding: "3px 10px", borderRadius: "14px", fontSize: "12px",
                              border: newExCategory === cat ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                              background: newExCategory === cat ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                              color: newExCategory === cat ? "#ff6a00" : "#888",
                              cursor: "pointer", fontFamily: "inherit",
                            }}>{cat}</button>
                        ))}
                        <button
                          onClick={() => setNewExCategory("__new__")}
                          style={{
                            padding: "3px 10px", borderRadius: "14px", fontSize: "12px",
                            border: newExCategory === "__new__" ? "1px solid #ff6a00" : "1px dashed rgba(255,255,255,0.2)",
                            background: newExCategory === "__new__" ? "rgba(255,106,0,0.1)" : "transparent",
                            color: newExCategory === "__new__" ? "#ff6a00" : "#666",
                            cursor: "pointer", fontFamily: "inherit",
                          }}>＋ 新分類</button>
                      </div>
                      {newExCategory === "__new__" && (
                        <input
                          autoFocus
                          style={{ ...styles.input, padding: "6px 10px", fontSize: "13px" }}
                          placeholder="輸入新分類名稱..."
                          value={newExCustomCategoryInput}
                          onChange={e => setNewExCustomCategoryInput(e.target.value)}
                        />
                      )}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={{
                            flex: 1, padding: "8px 12px", border: "none", borderRadius: "8px",
                            background: "linear-gradient(135deg,#ff6a00,#ff9500)",
                            color: "#fff", fontSize: "13px", fontWeight: 800,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                          onClick={() => { addCustomExercise(); setShowAddCustomEx(false); }}
                        >新增</button>
                        <button
                          style={{
                            padding: "8px 10px", border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: "8px", background: "transparent",
                            color: "#888", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                          }}
                          onClick={() => { setShowAddCustomEx(false); setNewExName(""); setNewExCategory("自訂"); setNewExCustomCategoryInput(""); }}
                        >取消</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNewExCategory(exActiveTag || "自訂"); setShowAddCustomEx(true); }}
                      style={{
                        width: "100%", padding: "8px", background: "rgba(255,106,0,0.08)",
                        border: "1px dashed rgba(255,106,0,0.3)", borderRadius: "8px",
                        color: "#ff9500", fontSize: "13px", fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                      ＋ 新增動作
                    </button>
                  )}
                </div>
              )}

              {exSearchQuery && pickerDisplayList.length === 0 && (
                <div style={{ padding: "20px", textAlign: "center", color: "#555", fontSize: "13px" }}>
                  沒有找到「{exSearchQuery}」相關動作
                </div>
              )}
            </div>

            {/* 取消按鈕 */}
            <button
              onClick={() => { setExPickerExpanded(false); setExSearchQuery(""); }}
              style={{ ...styles.btnSecondary, marginTop: "8px", width: "100%", textAlign: "center" }}>
              取消選擇
            </button>
          </div>
        )}

        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <label style={{ ...styles.label, marginBottom: 0 }}>{cardio(wExercise) ? "有氧記錄" : "訓練組數"}</label>
            {!cardio(wExercise) && (
              <button style={styles.btnSecondary} onClick={addSet}>+ 新增一組</button>
            )}
          </div>

          {/* 有氧模式：單次平面表單 */}
          {cardio(wExercise) ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {/* 時間（分 + 秒） */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="number" min={0} style={{ ...styles.setInput, flex: 1, textAlign: "center" }} placeholder="分" value={wSets[0]?.duration || ""} onChange={e => updateSet(0, "duration", e.target.value)} />
                <span style={{ color: "#888", fontSize: "13px", flexShrink: 0 }}>分</span>
                <input type="number" min={0} max={59} style={{ ...styles.setInput, flex: 1, textAlign: "center" }} placeholder="秒" value={wSets[0]?.duration_sec || ""} onChange={e => updateSet(0, "duration_sec", e.target.value)} />
                <span style={{ color: "#888", fontSize: "13px", flexShrink: 0 }}>秒</span>
              </div>
              {/* 距離 + 自動配速 */}
              <div>
                <input type="number" style={styles.setInput} placeholder="距離（km）" value={wSets[0]?.distance || ""} onChange={e => updateSet(0, "distance", e.target.value)} />
                {isRunning(wExercise) && wSets[0]?.duration && wSets[0]?.distance && (
                  <div style={{ fontSize: "11px", color: "#ff6a00", marginTop: "4px", paddingLeft: "2px" }}>
                    ⚡ 配速 {paceFromTimeDist(wSets[0].duration, wSets[0].duration_sec, wSets[0].distance)}
                  </div>
                )}
              </div>
              {/* 速度（非跑步有氧才顯示） */}
              {!isRunning(wExercise) && (
                <div>
                  <input type="number" style={styles.setInput} placeholder="速度（km/h）" value={wSets[0]?.speed || ""} onChange={e => updateSet(0, "speed", e.target.value)} />
                  {wSets[0]?.speed && <div style={{ fontSize: "10px", color: "#ff6a00", marginTop: "2px", paddingLeft: "2px" }}>→ {toMinPerKm(wSets[0].speed)}</div>}
                </div>
              )}
              {showIncline(wExercise) && (
                <div>
                  <input type="number" style={styles.setInput} placeholder="坡度（%）" value={wSets[0]?.incline || ""} onChange={e => updateSet(0, "incline", e.target.value)} />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 重訓模式：快速新增列 */}
              <div style={{ display: "flex", gap: "4px", alignItems: "center", marginBottom: "8px" }}>
                <input
                  type="number" placeholder="次數" value={batchReps}
                  onChange={e => setBatchReps(e.target.value)}
                  style={{ ...styles.setInput, flex: 1 }}
                />
                <span style={{ color: "#666", fontSize: "11px", flexShrink: 0 }}>下 ×</span>
                <input
                  type="number" placeholder="重量" value={batchWeight}
                  onChange={e => setBatchWeight(e.target.value)}
                  style={{ ...styles.setInput, flex: 1 }}
                />
                <span style={{ color: "#666", fontSize: "11px", flexShrink: 0 }}>kg ×</span>
                <input
                  type="number" min={1} max={10} value={batchCount}
                  onChange={e => setBatchCount(e.target.value)}
                  style={{ ...styles.setInput, width: "40px", textAlign: "center", flex: "none" }}
                />
                <span style={{ color: "#666", fontSize: "11px", flexShrink: 0 }}>組</span>
                <button onClick={batchAddSets} style={styles.btnSecondary}>套用</button>
              </div>

              {/* 逐組列表 */}
              {wSets.map((s, i) => (
                <div key={i}>
                  <div style={styles.setRow}>
                    <div style={{ textAlign: "center", color: "#ff6a00", fontWeight: 900, fontSize: "18px", minWidth: "24px", flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="number" style={styles.setInput} placeholder="次數" value={s.reps || ""} onChange={e => updateSet(i, "reps", e.target.value)} />
                        <span style={{ color: "#555", fontSize: "12px", flexShrink: 0 }}>下</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <input type="number" style={styles.setInput} placeholder="重量" value={s.weight || ""} onChange={e => updateSet(i, "weight", e.target.value)} />
                        <span style={{ color: "#555", fontSize: "12px", flexShrink: 0 }}>kg</span>
                      </div>
                    </div>
                    <button style={styles.deleteBtn} onClick={() => removeSet(i)}>✕</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={styles.label}>消耗卡路里（選填）</label>
          <div style={{ position: "relative" }}>
            <input type="number" style={styles.input} placeholder="kcal"
              value={wCalories} onChange={e => setWCalories(e.target.value)} />
            <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: "12px" }}>kcal</span>
          </div>
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label style={styles.label}>記錄（可選）</label>
          <textarea
            style={{ ...styles.input, resize: "none", minHeight: "72px" }}
            placeholder="例：感覺很好、需要加重..."
            value={wNote}
            onChange={e => setWNote(e.target.value)}
          />
        </div>

        {(() => {
          const canSave = cardio(wExercise)
            ? (wExercise.trim() !== "" && !!wSets[0]?.duration)
            : canSaveWorkout(wExercise, wSets);
          return (
            <button
              style={{
                ...styles.btn,
                transform: savedAnim ? "scale(0.97)" : "scale(1)",
                opacity: canSave ? (savedAnim ? 0.8 : 1) : 0.4,
                cursor: canSave ? "pointer" : "not-allowed",
                background: canSave ? styles.btn.background : "#333",
              }}
              onClick={canSave ? saveWorkout : undefined}
              disabled={!canSave}
            >
              {savedAnim ? "✓ 已儲存！" : "💾 儲存訓練"}
            </button>
          );
        })()}
      </div>

      {/* ── 歷史紀錄 ── */}
      <div ref={historyRef} style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={styles.sectionTitle}>所有訓練紀錄</div>
          <div style={{ display: "flex", gap: "6px" }}>
            {["week", "month"].map(mode => (
              <button key={mode} onClick={() => {
                setHistoryGroupMode(mode);
                localStorage.setItem("history_group_mode", mode);
                setExpandedGroupKeys(null);
                setExpandedDayKeys(null);
              }} style={{
                padding: "5px 12px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: historyGroupMode === mode ? 700 : 400,
                border: historyGroupMode === mode ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                background: historyGroupMode === mode ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                color: historyGroupMode === mode ? "#ff6a00" : "#888",
              }}>{mode === "week" ? "依週" : "依月"}</button>
            ))}
          </div>
        </div>
        {/* ── 日期篩選 chip ── */}
        {selectedCalDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 10px 4px 12px", borderRadius: 20,
              background: "rgba(255,106,0,0.15)", border: "1px solid rgba(255,106,0,0.4)",
              fontSize: 12, color: "#ff9955", fontWeight: 700,
            }}>
              📅 {selectedCalDate}
              <button onClick={() => setSelectedCalDate(null)} style={{
                background: "none", border: "none", color: "#ff9955", cursor: "pointer",
                fontSize: 14, padding: "0 2px", lineHeight: 1, fontFamily: "inherit",
              }}>✕</button>
            </div>
          </div>
        )}

        {/* ── 動作篩選列（兩層）── */}
        {workouts.length > 0 && (() => {
          const usedCategories = [...new Set(
            workouts.map(w => getCategoryForExercise(w.exercise, customExercises) || "自訂")
          )];
          const allCats = [...exerciseCategories.map(c => c.label), "自訂", ...userCustomCategories];
          const availableCategories = allCats.filter(c => usedCategories.includes(c));
          const exercisesInCategory = historyActiveCategory
            ? [...new Set(
                workouts
                  .filter(w => (getCategoryForExercise(w.exercise, customExercises) || "自訂") === historyActiveCategory)
                  .map(w => w.exercise)
              )]
            : [];
          const tagBtn = (label, active, onClick) => (
            <button key={label} onClick={onClick} style={{
              padding: "4px 12px", borderRadius: "14px", fontSize: "12px", fontFamily: "inherit",
              border: active ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
              background: active ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
              color: active ? "#ff6a00" : "#888",
              cursor: "pointer", whiteSpace: "nowrap",
            }}>{label}</button>
          );
          return (
            <>
              {/* 第一層：部位分類 */}
              <div style={{ overflowX: "auto", marginBottom: "8px", paddingBottom: "2px" }}>
                <div style={{ display: "flex", gap: "6px", minWidth: "max-content" }}>
                  {tagBtn("全部", !historyActiveCategory, () => {
                    setHistoryActiveCategory(null);
                    setHistoryExFilter(null);
                  })}
                  {availableCategories.map(cat =>
                    tagBtn(cat, historyActiveCategory === cat, () => {
                      setHistoryActiveCategory(historyActiveCategory === cat ? null : cat);
                      setHistoryExFilter(null);
                    })
                  )}
                </div>
              </div>
              {/* 第二層：該分類下的動作 */}
              {historyActiveCategory && exercisesInCategory.length > 0 && (
                <div style={{ overflowX: "auto", marginBottom: "12px", paddingBottom: "2px" }}>
                  <div style={{ display: "flex", gap: "6px", minWidth: "max-content" }}>
                    {exercisesInCategory.map(ex =>
                      tagBtn(ex, historyExFilter === ex, () =>
                        setHistoryExFilter(historyExFilter === ex ? null : ex)
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ── 進度圖表（動作篩選時顯示）── */}
        {historyExFilter && (() => {
          const isCardioEx = getCategoryForExercise(historyExFilter, customExercises) === "有氧";
          const exProgressData = workouts
            .filter(w => w.exercise === historyExFilter)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(w => ({
              date: w.date.slice(5),
              value: isCardioEx
                ? Math.max(...(w.sets?.map(s => parseFloat(s.duration) || 0) || [0]))
                : Math.max(...(w.sets?.map(s => parseFloat(s.weight) || 0) || [0])),
            }))
            .filter(d => d.value > 0);
          if (exProgressData.length < 2) return null;
          return (
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "12px 8px 8px", marginBottom: "14px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px", paddingLeft: "4px" }}>
                {historyExFilter} · {isCardioEx ? "最長時間趨勢" : "最大重量趨勢"}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={exProgressData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "#888" }}
                    itemStyle={{ color: "#ff9500" }}
                    formatter={v => [`${v} ${isCardioEx ? "min" : "kg"}`]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#ff6a00" strokeWidth={2} dot={{ fill: "#ff6a00", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* ── 動作專屬 AI 教練 ── */}
        {historyExFilter && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "14px 16px", marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#888" }}>🤖 AI 教練 · {historyExFilter}</div>
              <button
                onClick={() => { localStorage.removeItem(`ai_ex_comment_${historyExFilter}_${todayStr}`); fetchExAiComment(historyExFilter); }}
                disabled={exAiLoading}
                style={{ background: "none", border: "none", color: "#555", fontSize: 12, cursor: exAiLoading ? "default" : "pointer", padding: "2px 4px", fontFamily: "inherit" }}
              >↻ 重新生成</button>
            </div>
            {exAiLoading
              ? <div style={{ fontSize: 14, color: "#555", fontStyle: "italic" }}>🤖 分析訓練數據中...</div>
              : <div style={{ fontSize: 14, color: "#c8c4bc", lineHeight: 1.6 }}>{exAiComment || "—"}</div>
            }
          </div>
        )}

        {workouts.length === 0 && (
          <div style={{ color: "#555", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
            還沒有訓練紀錄
          </div>
        )}
        {workouts.length > 0 && (() => {
          const filteredWorkouts = workouts.filter(w => {
            if (selectedCalDate && w.date !== selectedCalDate) return false;
            if (historyExFilter) return w.exercise === historyExFilter;
            if (historyActiveCategory) return (getCategoryForExercise(w.exercise, customExercises) || "自訂") === historyActiveCategory;
            return true;
          });
          const groupMap = new Map();
          filteredWorkouts.forEach(w => {
            let key, label;
            if (historyGroupMode === "week") {
              key = getWeekStart(w.date);
              const monday = new Date(key + 'T00:00:00');
              const sunday = new Date(monday);
              sunday.setDate(monday.getDate() + 6);
              const fmt = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
              label = `${fmt(monday)} – ${fmt(sunday)}`;
            } else {
              const [y, m] = w.date.split('-');
              key = `${y}-${m}`;
              label = `${y} 年 ${parseInt(m)} 月`;
            }
            if (!groupMap.has(key)) groupMap.set(key, { key, label, items: [] });
            groupMap.get(key).items.push(w);
          });
          const workoutGroups = Array.from(groupMap.values())
            .sort((a, b) => b.key.localeCompare(a.key))
            .map(g => {
              const sortedItems = [...g.items].sort((a, b) =>
                b.date !== a.date
                  ? b.date.localeCompare(a.date)
                  : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
              );
              const dayMap = new Map();
              sortedItems.forEach(w => {
                if (!dayMap.has(w.date)) dayMap.set(w.date, []);
                dayMap.get(w.date).push(w);
              });
              const days = Array.from(dayMap.entries()).map(([date, items]) => ({
                date,
                items,
                totalSets: items.reduce((sum, w) => sum + (w.sets?.length || 0), 0),
              }));
              return {
                ...g,
                items: sortedItems,
                totalSets: sortedItems.reduce((sum, w) => sum + (w.sets?.length || 0), 0),
                days,
              };
            });
          const allExpanded = workoutGroups.length > 0 && workoutGroups.every(g =>
            expandedGroupKeys !== null && expandedGroupKeys.has(g.key)
          );
          const toggleAllExpanded = () => {
            if (allExpanded) setExpandedGroupKeys(new Set());
            else setExpandedGroupKeys(new Set(workoutGroups.map(g => g.key)));
          };
          return <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={toggleAllExpanded} style={{
                padding: "4px 10px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#888",
              }}>{allExpanded ? "收起全部" : "全展開"}</button>
            </div>
            {workoutGroups.map((group, idx) => {
            const isOpen = expandedGroupKeys === null
              ? idx === 0
              : expandedGroupKeys.has(group.key);
            return (
              <div key={group.key} style={{ marginBottom: "4px" }}>
                <div onClick={() => {
                  setExpandedGroupKeys(prev => {
                    const base = prev ?? new Set(workoutGroups[0] ? [workoutGroups[0].key] : []);
                    const next = new Set(base);
                    if (isOpen) next.delete(group.key);
                    else next.add(group.key);
                    return next;
                  });
                }} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.07)",
                  borderLeft: "3px solid rgba(255,106,0,0.5)",
                  cursor: "pointer",
                  marginBottom: isOpen ? "8px" : 0,
                }}>
                  <span style={{ fontSize: "13px", color: "#cc9966", fontWeight: 700 }}>
                    {group.label}（{group.items.length} 筆 · {group.totalSets} 組）
                  </span>
                  <span style={{ color: "#888", fontSize: "12px" }}>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && group.days.map((day, dayIdx) => {
                  const isDayOpen = expandedDayKeys === null
                    ? idx === 0 && dayIdx === 0
                    : expandedDayKeys.has(day.date);
                  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
                  const d = new Date(day.date + 'T00:00:00');
                  const weekday = WEEKDAYS[d.getDay()];
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  const dateLabel = `${mm}/${dd}（週${weekday}）`;
                  const isCoachDay = coachDays?.includes(day.date);
                  const coachCount = isCoachDay ? day.items.filter(w => w.isCoach !== false).length : 0;
                  const dayEmoji = isCoachDay ? (coachCount > 0 ? "🏅" : "💪") : "📅";
                  return (
                    <div key={day.date} style={{ marginBottom: "4px", marginLeft: "10px" }}>
                      <div onClick={() => {
                        setExpandedDayKeys(prev => {
                          const base = prev ?? new Set(
                            workoutGroups[0]?.days[0] ? [workoutGroups[0].days[0].date] : []
                          );
                          const next = new Set(base);
                          if (isDayOpen) next.delete(day.date);
                          else next.add(day.date);
                          return next;
                        });
                      }} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "7px 12px", borderRadius: "8px",
                        background: isCoachDay ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        border: isCoachDay ? "1px solid rgba(255,215,0,0.25)" : "1px solid rgba(255,255,255,0.06)",
                        marginBottom: isDayOpen ? "6px" : 0,
                      }}>
                        <span style={{ fontSize: "13px", color: "#bbb", fontWeight: 600, flex: 1, minWidth: 0 }}>
                          {dayEmoji} {dateLabel} · {day.items.length} 個動作 · {day.totalSets} 組
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleCoachDay?.(day.date); }}
                            style={{
                              width: "28px", height: "28px",
                              borderRadius: "50%", cursor: "pointer",
                              background: "transparent",
                              border: isCoachDay ? "1px solid rgba(255,215,0,0.5)" : "1px solid rgba(255,255,255,0.1)",
                              color: isCoachDay ? "#ffd700" : "#555",
                              fontSize: "13px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "inherit", lineHeight: 1,
                            }}
                          >{isCoachDay ? "✕" : "🏅"}</button>
                          <span style={{ color: "#555", fontSize: "11px" }}>{isDayOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {isDayOpen && day.items.map(w => (
                        <div key={w.id} style={{ ...styles.workoutItem, marginBottom: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ fontSize: "17px", fontWeight: 700 }}>{w.exercise}</div>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              {coachDays?.includes(day.date) && (() => {
                                const isCoach = w.isCoach ?? true;
                                return (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleWorkoutCoach?.(w.id, isCoach);
                                      const msg = isCoach ? "💪 已標記為自主練習" : "🏅 已標記為教練課內容";
                                      setCoachToast(msg);
                                      clearTimeout(coachToastTimer.current);
                                      coachToastTimer.current = setTimeout(() => setCoachToast(null), 1800);
                                    }}
                                    style={{
                                      display: "flex", alignItems: "center", gap: 4,
                                      padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                                      border: isCoach ? "1px solid rgba(255,215,0,0.35)" : "1px solid rgba(255,255,255,0.12)",
                                      background: isCoach ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.05)",
                                      color: isCoach ? "#ffd700" : "#888",
                                      fontSize: 12, fontWeight: 700, lineHeight: 1,
                                      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                                      transition: "all 0.15s",
                                    }}
                                  >
                                    <span>{isCoach ? "🏅" : "💪"}</span>
                                    <span>{isCoach ? "上課" : "自練"}</span>
                                  </button>
                                );
                              })()}
                              <button style={styles.historyActionBtn} onClick={() => openEditWorkout(w)}>編輯</button>
                              <button style={styles.historyDeleteBtn} onClick={() => deleteWorkout(w.id)}>刪除</button>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: w.note ? "8px" : 0 }}>
                            {w.sets?.map((s, i) => {
                              if (s.duration !== undefined) {
                                const durationLabel = s.duration
                                  ? `${s.duration}分${String(parseInt(s.duration_sec || 0)).padStart(2, "0")}秒`
                                  : null;
                                const paceLabel = paceFromTimeDist(s.duration, s.duration_sec, s.distance)
                                  || (s.speed ? toMinPerKm(s.speed) : null);
                                const parts = [
                                  durationLabel,
                                  s.distance && `${s.distance} km`,
                                  paceLabel,
                                  s.incline && `坡度${s.incline}%`,
                                ].filter(Boolean);
                                return <span key={i} style={styles.tag}>{parts.join(" · ") || "—"}</span>;
                              }
                              return (
                                <span key={i} style={styles.tag}>
                                  第{i + 1}組 {s.reps ? `${s.reps}下` : ""}{s.weight ? ` × ${s.weight}kg` : ""}
                                </span>
                              );
                            })}
                          </div>
                          {w.note && <div style={{ fontSize: "13px", color: "#888", fontStyle: "italic", whiteSpace: "pre-wrap", marginTop: 2 }}>📝 {w.note}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}</>
        })()}
      </div>
    </div>

    {/* Coach toggle toast */}
    {coachToast && createPortal(
      <div style={{
        position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
        background: "rgba(30,30,46,0.96)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "#e8e4dc", padding: "10px 22px", borderRadius: "24px",
        fontWeight: 700, fontSize: "14px",
        zIndex: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        pointerEvents: "none", whiteSpace: "nowrap",
        fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
      }}>
        {coachToast}
      </div>,
      document.body
    )}
    </>
  );
}
