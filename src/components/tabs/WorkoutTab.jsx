import { getWeekStart, canSaveWorkout } from "../../utils/fitforge.utils.js";
import { exerciseCategories, INCLINE_EXERCISES } from "../../constants/fitforge.constants.js";
import styles from "../../styles/fitforge.styles.js";

function getCategoryForExercise(name, customExercises) {
  for (const cat of exerciseCategories) {
    if (cat.exercises.includes(name)) return cat.label;
  }
  if (customExercises.some(e => e.name === name)) return "自訂";
  return "";
}

function isCardio(name, customExercises) {
  return getCategoryForExercise(name, customExercises) === "有氧";
}

function showIncline(name) {
  return INCLINE_EXERCISES.includes(name);
}

function toMinPerKm(kmh) {
  if (!kmh || isNaN(kmh)) return null;
  const total = 60 / parseFloat(kmh);
  const min = Math.floor(total);
  const sec = Math.round((total - min) * 60);
  return `${min}:${String(sec).padStart(2, "0")} /km`;
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
  // History state
  historyGroupMode, setHistoryGroupMode, expandedGroupKeys, setExpandedGroupKeys,
  // Handlers
  saveWorkout, addSet, updateSet, removeSet, batchAddSets,
  deleteWorkout, openEditWorkout,
  addCustomExercise, deleteCustomExercise, setConfirmDialog,
}) {
  const cardio = (name) => isCardio(name, customExercises);

  return (
    <div>
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
              {["胸", "背", "肩", "腿", "手臂", "核心", "有氧", "自訂"].map(tag => (
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
                  if (newIsCardio !== curIsCardio) {
                    setWSets(newIsCardio ? [{ duration: "", distance: "", speed: "", incline: "" }] : [{ reps: "", weight: "" }]);
                  }
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
                  {ex.name}
                  {ex.category === "自訂" && (
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
                        marginLeft: "auto", background: "rgba(255,50,50,0.12)",
                        border: "1px solid rgba(255,50,50,0.2)", borderRadius: "6px",
                        color: "#ff5555", fontSize: "11px", padding: "2px 8px",
                        cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      }}>
                      刪除
                    </button>
                  )}
                </button>
              ))}

              {/* 自訂 Tag：底部新增按鈕 */}
              {exActiveTag === "自訂" && (
                <div style={{ padding: "8px 14px 12px", borderTop: pickerDisplayList.length > 0 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  {showAddCustomEx ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        autoFocus
                        style={{ ...styles.input, flex: 1, padding: "8px 12px", fontSize: "14px" }}
                        placeholder="動作名稱..."
                        value={newExName}
                        onChange={e => setNewExName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") { addCustomExercise(); setShowAddCustomEx(false); }
                          if (e.key === "Escape") { setShowAddCustomEx(false); setNewExName(""); }
                        }}
                      />
                      <button
                        style={{
                          padding: "8px 12px", border: "none", borderRadius: "8px",
                          background: "linear-gradient(135deg,#ff6a00,#ff9500)",
                          color: "#fff", fontSize: "13px", fontWeight: 800,
                          cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                        }}
                        onClick={() => { addCustomExercise(); setShowAddCustomEx(false); }}
                      >新增</button>
                      <button
                        style={{
                          padding: "8px 10px", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "8px", background: "transparent",
                          color: "#888", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                        }}
                        onClick={() => { setShowAddCustomEx(false); setNewExName(""); }}
                      >取消</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddCustomEx(true)}
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
              <div>
                <input type="number" style={styles.setInput} placeholder="時間（分鐘）*" value={wSets[0]?.duration || ""} onChange={e => updateSet(0, "duration", e.target.value)} />
              </div>
              <div>
                <input type="number" style={styles.setInput} placeholder="距離（km）" value={wSets[0]?.distance || ""} onChange={e => updateSet(0, "distance", e.target.value)} />
              </div>
              <div>
                <input type="number" style={styles.setInput} placeholder="速度（km/h）" value={wSets[0]?.speed || ""} onChange={e => updateSet(0, "speed", e.target.value)} />
                {wSets[0]?.speed && <div style={{ fontSize: "10px", color: "#ff6a00", marginTop: "2px", paddingLeft: "2px" }}>→ {toMinPerKm(wSets[0].speed)}</div>}
              </div>
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
                      <div>
                        <input type="number" style={styles.setInput} placeholder="次數 (reps)" value={s.reps || ""} onChange={e => updateSet(i, "reps", e.target.value)} />
                      </div>
                      <div>
                        <input type="number" style={styles.setInput} placeholder="重量 (kg)" value={s.weight || ""} onChange={e => updateSet(i, "weight", e.target.value)} />
                      </div>
                    </div>
                    {wSets.length > 1 && (
                      <button style={styles.deleteBtn} onClick={() => removeSet(i)}>✕</button>
                    )}
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
          <label style={styles.label}>備註（可選）</label>
          <input style={styles.input} placeholder="例：感覺很好、需要加重..." value={wNote} onChange={e => setWNote(e.target.value)} />
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
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={styles.sectionTitle}>所有訓練紀錄</div>
          <div style={{ display: "flex", gap: "6px" }}>
            {["week", "month"].map(mode => (
              <button key={mode} onClick={() => {
                setHistoryGroupMode(mode);
                localStorage.setItem("history_group_mode", mode);
                setExpandedGroupKeys(null);
              }} style={{
                padding: "5px 12px", borderRadius: "20px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: historyGroupMode === mode ? 700 : 400,
                border: historyGroupMode === mode ? "1px solid #ff6a00" : "1px solid rgba(255,255,255,0.12)",
                background: historyGroupMode === mode ? "rgba(255,106,0,0.2)" : "rgba(255,255,255,0.04)",
                color: historyGroupMode === mode ? "#ff6a00" : "#888",
              }}>{mode === "week" ? "依週" : "依月"}</button>
            ))}
          </div>
        </div>
        {workouts.length === 0 && (
          <div style={{ color: "#555", fontSize: "14px", textAlign: "center", padding: "20px 0" }}>
            還沒有訓練紀錄
          </div>
        )}
        {workouts.length > 0 && (() => {
          const groupMap = new Map();
          workouts.forEach(w => {
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
          const workoutGroups = Array.from(groupMap.values());
          return workoutGroups.map((group, idx) => {
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
                  background: "rgba(255,255,255,0.05)", cursor: "pointer",
                  marginBottom: isOpen ? "8px" : 0,
                }}>
                  <span style={{ fontSize: "13px", color: "#aaa", fontWeight: 600 }}>
                    {group.label}（{group.items.length} 筆）
                  </span>
                  <span style={{ color: "#666", fontSize: "12px" }}>{isOpen ? "▲" : "▼"}</span>
                </div>
                {isOpen && group.items.map(w => (
                  <div key={w.id} style={{ ...styles.workoutItem, marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={styles.historyDate}>{w.date}</div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button style={styles.historyActionBtn} onClick={() => openEditWorkout(w)}>編輯</button>
                        <button style={styles.historyDeleteBtn} onClick={() => deleteWorkout(w.id)}>刪除</button>
                      </div>
                    </div>
                    <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>{w.exercise}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: w.note ? "8px" : 0 }}>
                      {w.sets?.map((s, i) => {
                        if (s.duration !== undefined) {
                          const parts = [
                            s.duration && `${s.duration}分鐘`,
                            s.distance && `${s.distance} km`,
                            s.speed && `${s.speed} km/h`,
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
                    {w.note && <div style={{ fontSize: "13px", color: "#888", fontStyle: "italic" }}>📝 {w.note}</div>}
                  </div>
                ))}
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
