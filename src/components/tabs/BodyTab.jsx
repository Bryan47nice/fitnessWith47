import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { calcBMI } from "../../utils/fitforge.utils.js";
import styles from "../../styles/fitforge.styles.js";

const metricConfig = {
  weight:      { label: "體重",     unit: "kg" },
  bmi:         { label: "BMI",      unit: "" },
  height:      { label: "身高",     unit: "cm" },
  waist:       { label: "腰圍",     unit: "cm" },
  hip:         { label: "臀圍",     unit: "cm" },
  bodyfat:     { label: "體脂率",   unit: "%" },
  muscle_mass: { label: "骨骼肌肉量", unit: "kg" },
  visceral_fat: { label: "內臟脂肪等級", unit: "" },
};

function CustomTooltip({ active, payload, activeMetric }) {
  if (!active || !payload || !payload.length) return null;
  const { date, value } = payload[0].payload;
  return (
    <div style={{
      background: "rgba(18,18,28,0.96)",
      border: "1px solid rgba(255,106,0,0.4)",
      borderRadius: "10px", padding: "10px 14px",
      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      pointerEvents: "none",
    }}>
      <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px", letterSpacing: "0.06em" }}>{date}</div>
      <div style={{ fontSize: "22px", fontWeight: 900, color: "#ff6a00", lineHeight: 1 }}>
        {value}
        <span style={{ fontSize: "13px", fontWeight: 400, color: "#888", marginLeft: "4px" }}>
          {metricConfig[activeMetric].unit}
        </span>
      </div>
    </div>
  );
}

// Metrics where a higher value is better (green ↑, red ↓).
// All other metrics default to lower-is-better (green ↓, red ↑).
const HIGHER_IS_BETTER = new Set(["muscle_mass"]);

export default function BodyTab({
  bodyData, existingBodyForDate,
  bDate, setBDate,
  bWeight, setBWeight, bHeight, setBHeight,
  bWaist, setBWaist, bHip, setBHip,
  bBodyfat, setBBodyfat, bMuscleMass, setBMuscleMass, bVisceralFat, setBVisceralFat,
  activeMetric, setActiveMetric,
  bSavedAnim,
  saveBody, deleteBodyRecord,
}) {
  const [showAllBody, setShowAllBody] = useState(false);
  const chartPoints = bodyData
    .filter(b => {
      if (activeMetric === "bmi") {
        return parseFloat(b.weight) > 0 && parseFloat(b.height) > 0;
      }
      const v = parseFloat(b[activeMetric]);
      return !isNaN(v) && b[activeMetric] !== "" && b[activeMetric] != null;
    })
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(b => {
      let value;
      if (activeMetric === "bmi") {
        const h = parseFloat(b.height) / 100;
        value = parseFloat((parseFloat(b.weight) / (h * h)).toFixed(1));
      } else {
        value = parseFloat(b[activeMetric]);
      }
      return { date: b.date, value, label: b.date.slice(5) };
    });

  return (
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
            ["腰圍", "cm", bWaist, setBWaist],
            ["臀圍", "cm", bHip, setBHip],
            ["體脂率", "%", bBodyfat, setBBodyfat],
            ["骨骼肌肉量", "kg", bMuscleMass, setBMuscleMass],
            ["內臟脂肪等級", "1–30", bVisceralFat, setBVisceralFat],
          ].map(([label, unit, val, setter]) => (
            <div key={label}>
              <label style={styles.label}>{label} ({unit})</label>
              <input type="number" style={styles.input} placeholder={`輸入${label}`} value={val} onChange={e => setter(e.target.value)} />
            </div>
          ))}
        </div>

        {existingBodyForDate && (
          <div style={{
            marginBottom: "10px", padding: "10px 14px",
            background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.35)",
            borderRadius: "10px", fontSize: "13px", color: "#ffaa00", lineHeight: "1.5",
          }}>
            ⚠️ 此日期已有紀錄，儲存將覆蓋現有數據
          </div>
        )}
        <button
          style={{ ...styles.btn, transform: bSavedAnim ? "scale(0.97)" : "scale(1)", opacity: bSavedAnim ? 0.8 : 1 }}
          onClick={saveBody}
        >
          {bSavedAnim ? "✓ 已儲存！" : existingBodyForDate ? "✏️ 更新身材數據" : "📏 儲存身材數據"}
        </button>
      </div>

      {bodyData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>身材趨勢</div>

          {/* Metric selector pills */}
          <div style={{
            display: "flex", gap: "8px", overflowX: "auto",
            WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
            msOverflowStyle: "none", paddingBottom: "4px", marginBottom: "16px",
          }}>
            {Object.entries(metricConfig).map(([key, cfg]) => {
              const isActive = activeMetric === key;
              return (
                <button key={key} onClick={() => setActiveMetric(key)} style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: "20px",
                  border: isActive ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                  background: isActive ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                  color: isActive ? "#ff6a00" : "#888",
                  fontSize: "13px", fontWeight: isActive ? 700 : 400,
                  cursor: "pointer", letterSpacing: "0.03em",
                  fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                }}>
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Line chart or empty state */}
          {chartPoints.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartPoints} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#666", fontSize: 11, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={activeMetric === "bmi" ? [14, 35] : ["auto", "auto"]}
                  tick={{ fill: "#666", fontSize: 11, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  content={<CustomTooltip activeMetric={activeMetric} />}
                  cursor={{ stroke: "rgba(255,106,0,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }}
                />
                {activeMetric === "bmi" && (
                  <>
                    <ReferenceLine y={18.5} stroke="#60a5fa" strokeDasharray="4 3" strokeWidth={1}
                      label={{ value: "18.5", position: "insideRight", fill: "#60a5fa", fontSize: 10 }} />
                    <ReferenceLine y={24} stroke="#facc15" strokeDasharray="4 3" strokeWidth={1}
                      label={{ value: "24", position: "insideRight", fill: "#facc15", fontSize: 10 }} />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ff6a00"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#ff6a00", strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: "#ff9500", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: "120px", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "8px",
              color: "#555", borderRadius: "12px",
              border: "1px dashed rgba(255,255,255,0.08)", marginBottom: "16px",
            }}>
              <div style={{ fontSize: "28px", opacity: 0.4 }}>📈</div>
              <div style={{ fontSize: "13px", letterSpacing: "0.04em" }}>
                至少需要 2 筆紀錄才能顯示趨勢圖
              </div>
              <div style={{ fontSize: "11px", color: "#444" }}>
                {metricConfig[activeMetric].label} 目前只有 {chartPoints.length} 筆有效數據
              </div>
            </div>
          )}

          {bodyData.slice(0, showAllBody ? bodyData.length : 5).map((b, i) => {
            const cfg = metricConfig[activeMetric];
            const val = parseFloat(b[activeMetric]);
            const newerVal = parseFloat(bodyData[i - 1]?.[activeMetric]);
            const hasDiff = i > 0 && !isNaN(val) && !isNaN(newerVal);
            // val is the older record; newerVal is the more-recent record
            // val > newerVal → metric decreased from older to newer (went DOWN)
            const wentDown = val > newerVal;
            const isGoodChange = HIGHER_IS_BETTER.has(activeMetric) ? !wentDown : wentDown;
            const diffColor = isGoodChange ? "#4ade80" : "#f87171";
            return (
              <div key={b.id} style={{ ...styles.workoutItem, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 900, color: i === 0 ? "#ff6a00" : "#e8e4dc" }}>
                    {b[activeMetric] ? `${b[activeMetric]}${cfg.unit}` : "—"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                    {b.waist && `腰${b.waist} `}{b.hip && `臀${b.hip} `}{b.bodyfat && `脂${b.bodyfat}% `}{b.muscle_mass && `肌${b.muscle_mass}kg`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "#666" }}>{b.date}</div>
                  {i === 0 && <div style={{ fontSize: "11px", color: "#ff6a00", marginTop: "2px" }}>最新</div>}
                  {hasDiff && (
                    <div style={{ fontSize: "13px", fontWeight: 700, color: diffColor }}>
                      {wentDown ? "↓" : "↑"}
                      {Math.abs(val - newerVal).toFixed(1)}{cfg.unit}
                    </div>
                  )}
                  <button
                    style={{ ...styles.historyDeleteBtn, fontSize: "11px", marginTop: "6px" }}
                    onClick={() => deleteBodyRecord(b.id)}
                  >
                    刪除
                  </button>
                </div>
              </div>
            );
          })}
          {bodyData.length > 5 && (
            <button
              onClick={() => setShowAllBody(v => !v)}
              style={{
                width: "100%", marginTop: "8px", padding: "8px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px", color: "#666", fontSize: "13px",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {showAllBody ? "收合" : `顯示全部 ${bodyData.length} 筆紀錄`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
