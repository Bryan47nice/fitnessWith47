import { useState } from "react";
import { createPortal } from "react-dom";
import { getNeglectedExercises, groupWorkoutsByDate, getWeekBounds, formatDateLabel } from "../utils/fitforge.utils.js";
import { exerciseCategories } from "../constants/fitforge.constants.js";

// ─── Part colour map ─────────────────────────────────────────────────────────
const PART_COLOR = {
  胸:   "#ef4444",  // red
  背:   "#3b82f6",  // blue
  肩:   "#eab308",  // yellow
  腿:   "#22c55e",  // green
  手臂: "#a855f7",  // purple
  核心: "#06b6d4",  // cyan
  有氧: "#ec4899",  // pink
  伸展: "#84cc16",  // lime-green
};

const PART_BG = {
  胸:   "rgba(239,68,68,0.18)",
  背:   "rgba(59,130,246,0.18)",
  肩:   "rgba(234,179,8,0.18)",
  腿:   "rgba(34,197,94,0.18)",
  手臂: "rgba(168,85,247,0.18)",
  核心: "rgba(6,182,212,0.18)",
  有氧: "rgba(236,72,153,0.18)",
  伸展: "rgba(132,204,22,0.18)",
};

function getPartForExercise(name, customExercises = []) {
  const preset = exerciseCategories.find(c => c.exercises.includes(name));
  if (preset) return preset.label;
  const custom = customExercises.find(e => e.name === name);
  if (custom && custom.category && PART_COLOR[custom.category]) return custom.category;
  return null;
}

function PartBadge({ part }) {
  if (!part) return null;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "10px",
      fontSize: "11px",
      fontWeight: 700,
      background: PART_BG[part] || "rgba(255,255,255,0.1)",
      color: PART_COLOR[part] || "#aaa",
      border: `1px solid ${PART_COLOR[part] ? PART_COLOR[part] + "44" : "transparent"}`,
      flexShrink: 0,
    }}>
      {part}
    </span>
  );
}

// ─── Day group component ──────────────────────────────────────────────────────
function DayGroup({ date, items, personalBests, coachDays, customExercises }) {
  const isCoachDay = coachDays.includes(date);
  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.03)",
      overflow: "hidden",
    }}>
      {/* Date header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 14px",
        background: "rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#e8e4dc" }}>
          {formatDateLabel(date)}
        </span>
        {isCoachDay && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
            background: "rgba(255,215,0,0.18)", color: "#ffd700",
            border: "1px solid rgba(255,215,0,0.3)",
          }}>🏅 教練課</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
          {items.length} 個動作
        </span>
      </div>

      {/* Exercise rows */}
      <div style={{ padding: "8px 14px" }}>
        {items.map((w, i) => {
          const part = getPartForExercise(w.exercise, customExercises);
          const isPR = personalBests?.[w.exercise] &&
            w.sets?.some(s => parseFloat(s.weight) >= personalBests[w.exercise].weight);
          const totalSets = w.sets?.length || 0;
          const maxWeight = w.sets
            ? Math.max(...w.sets.map(s => parseFloat(s.weight) || 0))
            : 0;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              paddingTop: 6, paddingBottom: 6,
              borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              {/* Part colour dot */}
              {part && (
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: PART_COLOR[part] || "#888",
                  boxShadow: `0 0 4px ${PART_COLOR[part] || "#888"}`,
                }} />
              )}

              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: "#e8e4dc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {w.exercise}
              </span>

              {isPR && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ffd700", flexShrink: 0 }}>
                  🏆 PR
                </span>
              )}

              <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>
                {totalSets > 0 ? `${totalSets} 組` : ""}
                {maxWeight > 0 ? ` · ${maxWeight} kg` : ""}
              </span>

              <PartBadge part={part} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Summary stats bar ────────────────────────────────────────────────────────
function SummaryBar({ workouts, label }) {
  const days = new Set(workouts.map(w => w.date)).size;
  const sets = workouts.reduce((a, w) => a + (w.sets?.length || 0), 0);
  const exercises = new Set(workouts.map(w => w.exercise)).size;
  return (
    <div style={{
      display: "flex", gap: 0,
      marginBottom: 14,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden",
      background: "rgba(255,255,255,0.03)",
    }}>
      {[
        { num: days,      unit: "天" },
        { num: exercises, unit: "動作" },
        { num: sets,      unit: "組" },
      ].map(({ num, unit }, i) => (
        <div key={i} style={{
          flex: 1, textAlign: "center",
          padding: "12px 8px",
          borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none",
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#ff6a00", lineHeight: 1 }}>{num}</div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{unit}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function WeeklyDetailModal({
  workouts,
  exerciseCats,       // pass exerciseCategories from constants (optional, for future)
  customExercises = [],
  coachDays = [],
  personalBests = {},
  onClose,
}) {
  const [tab, setTab] = useState("this"); // "this" | "last"

  const thisBounds = getWeekBounds(0);
  const lastBounds = getWeekBounds(1);

  const thisWorkouts = workouts.filter(w => w.date >= thisBounds.from && w.date <= thisBounds.to);
  const lastWorkouts = workouts.filter(w => w.date >= lastBounds.from && w.date <= lastBounds.to);

  const activeWorkouts = tab === "this" ? thisWorkouts : lastWorkouts;
  const activeBounds   = tab === "this" ? thisBounds   : lastBounds;
  const grouped        = groupWorkoutsByDate(activeWorkouts, activeBounds.from, activeBounds.to);

  // ── Part coverage (this week only) ──────────────────────────────────────────
  const coveredParts = new Set(
    thisWorkouts.map(w => getPartForExercise(w.exercise, customExercises)).filter(Boolean)
  );
  const allParts = exerciseCategories.map(c => c.label);

  // ── Neglected exercises (all time, threshold 14 days) ───────────────────────
  const neglected = getNeglectedExercises(workouts, 14, 8);

  return createPortal(
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(10,10,18,0.98)",
      backdropFilter: "blur(12px)",
      zIndex: 9999,
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10,10,18,0.98)",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "#e8e4dc", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}
        >←</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e8e4dc" }}>週訓練詳情</div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        {[
          { key: "this", label: "本週", sub: `${thisBounds.from.slice(5)} – ${thisBounds.to.slice(5)}` },
          { key: "last", label: "上週", sub: `${lastBounds.from.slice(5)} – ${lastBounds.to.slice(5)}` },
        ].map(({ key, label, sub }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1, padding: "12px 8px", border: "none", cursor: "pointer",
              background: tab === key ? "rgba(255,106,0,0.12)" : "transparent",
              color: tab === key ? "#ff6a00" : "#888",
              borderBottom: tab === key ? "2px solid #ff6a00" : "2px solid transparent",
              fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
            <span style={{ fontSize: 10, color: tab === key ? "#ff6a00" : "#555" }}>{sub}</span>
          </button>
        ))}
      </div>

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 180px" }}>
        {/* Summary bar */}
        <SummaryBar workouts={activeWorkouts} label={tab === "this" ? "本週" : "上週"} />

        {/* Day groups */}
        {grouped.length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", fontSize: 14, marginTop: 40 }}>
            {tab === "this" ? "本週尚無訓練紀錄" : "上週尚無訓練紀錄"}
          </div>
        ) : (
          grouped.map(({ date, items }) => (
            <DayGroup
              key={date}
              date={date}
              items={items}
              personalBests={personalBests}
              coachDays={coachDays}
              customExercises={customExercises}
            />
          ))
        )}
      </div>

      {/* ── Fixed bottom: part coverage + neglected ─────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "rgba(10,10,18,0.97)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        padding: "14px 16px calc(14px + env(safe-area-inset-bottom, 0px))",
        zIndex: 10,
      }}>
        {/* Part coverage chips */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
            本週部位覆蓋
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allParts.map(part => {
              const covered = coveredParts.has(part);
              return (
                <span key={part} style={{
                  padding: "3px 10px", borderRadius: 12,
                  fontSize: 12, fontWeight: 700,
                  background: covered ? (PART_BG[part] || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.04)",
                  color: covered ? (PART_COLOR[part] || "#aaa") : "#444",
                  border: `1px solid ${covered ? (PART_COLOR[part] ? PART_COLOR[part] + "55" : "transparent") : "rgba(255,255,255,0.06)"}`,
                  transition: "all 0.2s",
                }}>
                  {covered ? "✓ " : ""}{part}
                </span>
              );
            })}
          </div>
        </div>

        {/* Neglected exercises */}
        {neglected.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              久未訓練（&gt;14 天）
            </div>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {neglected.map(({ name, daysAgo }) => {
                const part = getPartForExercise(name, customExercises);
                return (
                  <div key={name} style={{
                    flexShrink: 0,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                    padding: "6px 10px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#ccc", maxWidth: 80, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {part && <PartBadge part={part} />}
                      <span style={{ fontSize: 10, color: "#666" }}>{daysAgo}天</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
