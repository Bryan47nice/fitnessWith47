import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, serverTimestamp, deleteDoc, updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { fetchAndActivate, getBoolean, getString, getNumber } from "firebase/remote-config";
import { db, auth, remoteConfig } from "../firebase";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip,
} from "recharts";

const exerciseCategories = [
  {
    label: "胸部",
    exercises: [
      "臥推 Bench Press",
      "上斜臥推 Incline Bench Press",
      "雙槓撐體 Dips",
      "飛鳥 Cable Fly",
    ],
  },
  {
    label: "背部",
    exercises: [
      "硬舉 Deadlift",
      "引體向上 Pull-up",
      "划船 Barbell Row",
      "滑輪下拉 Lat Pulldown",
      "單手啞鈴划船 One-Arm DB Row",
    ],
  },
  {
    label: "肩部",
    exercises: [
      "肩推 Shoulder Press",
      "側平舉 Lateral Raise",
      "前平舉 Front Raise",
      "面拉 Face Pull",
    ],
  },
  {
    label: "腿部",
    exercises: [
      "深蹲 Squat",
      "腿推 Leg Press",
      "腿彎舉 Leg Curl",
      "腿伸展 Leg Extension",
      "保加利亞分腿蹲 Bulgarian Split Squat",
    ],
  },
  {
    label: "手臂",
    exercises: [
      "二頭彎舉 Bicep Curl",
      "三頭下壓 Tricep Pushdown",
    ],
  },
  {
    label: "核心",
    exercises: [
      "棒式 Plank",
      "捲腹 Crunch",
      "俄羅斯轉體 Russian Twist",
    ],
  },
  {
    label: "有氧",
    exercises: [
      "跑步機 Treadmill",
      "騎車 Cycling",
      "跳繩 Jump Rope",
    ],
  },
];

const metricConfig = {
  weight: { label: "體重",   unit: "kg" },
  chest:  { label: "胸圍",   unit: "cm" },
  waist:  { label: "腰圍",   unit: "cm" },
  hip:    { label: "臀圍",   unit: "cm" },
  arm:    { label: "手臂圍", unit: "cm" },
  thigh:  { label: "大腿圍", unit: "cm" },
};

export default function FitForge({ user }) {
  const [tab, setTab] = useState("dashboard");
  const [workouts, setWorkouts] = useState([]);
  const [bodyData, setBodyData] = useState([]);
  const [streak, setStreak] = useState({ count: 0, lastDate: null });
  const [loading, setLoading] = useState(true);

  // Custom exercises from Firestore
  const [customExercises, setCustomExercises] = useState([]);
  const [newExName, setNewExName] = useState("");
  const [showManageEx, setShowManageEx] = useState(false);
  const [showExPicker, setShowExPicker] = useState(false);
  const [editingExId, setEditingExId] = useState(null);
  const [editingExName, setEditingExName] = useState("");

  // Activity popup state (null = hidden, object = show)
  const [popup, setPopup] = useState(null);

  // Workout form state
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10));
  const [wExercise, setWExercise] = useState(exerciseCategories[0].exercises[0]);
  const [wCustom, setWCustom] = useState("");
  const [wSets, setWSets] = useState([{ reps: "", weight: "" }]);
  const [wNote, setWNote] = useState("");
  const [savedAnim, setSavedAnim] = useState(false);
  const [prAnim, setPrAnim] = useState(false);

  // More Panel state
  const [showMorePanel, setShowMorePanel] = useState(false);

  // Quick-Log FAB state
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [quickExercise, setQuickExercise] = useState(exerciseCategories[0].exercises[0]);
  const [quickSets, setQuickSets] = useState([{ reps: "", weight: "" }]);
  const [quickAnim, setQuickAnim] = useState(false);
  const [pickerTarget, setPickerTarget] = useState("workout"); // "workout" | "quick" | "editWorkout"

  // Edit workout sheet state
  const [showEditWorkout, setShowEditWorkout] = useState(false);
  const [editWorkoutId, setEditWorkoutId] = useState(null);
  const [ewDate, setEwDate] = useState("");
  const [ewExercise, setEwExercise] = useState("");
  const [ewSets, setEwSets] = useState([{ reps: "", weight: "" }]);
  const [ewNote, setEwNote] = useState("");
  const [editSavedAnim, setEditSavedAnim] = useState(false);

  // Confirmation dialog state: null | { message, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Body form state
  const [bDate, setBDate] = useState(new Date().toISOString().slice(0, 10));
  const [bWeight, setBWeight] = useState("");
  const [bHeight, setBHeight] = useState("");
  const [bChest, setBChest] = useState("");
  const [bWaist, setBWaist] = useState("");
  const [bHip, setBHip] = useState("");
  const [bArm, setBArm] = useState("");
  const [bThigh, setBThigh] = useState("");
  const [activeMetric, setActiveMetric] = useState("weight");

  const today = new Date().toISOString().slice(0, 10);

  // Subscribe to workouts
  useEffect(() => {
    const q = query(
      collection(db, "users", user.uid, "workouts"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setWorkouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user.uid]);

  // Subscribe to body data
  useEffect(() => {
    const q = query(
      collection(db, "users", user.uid, "bodyData"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setBodyData(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user.uid]);

  // Subscribe to streak
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "users", user.uid, "meta", "streak"),
      (snap) => { if (snap.exists()) setStreak(snap.data()); }
    );
    return unsub;
  }, [user.uid]);

  // Fetch Remote Config and maybe show activity popup
  useEffect(() => {
    fetchAndActivate(remoteConfig)
      .then(() => {
        const enabled = getBoolean(remoteConfig, "popup_enabled");
        if (!enabled) return;

        const title       = getString(remoteConfig, "popup_title");
        const body        = getString(remoteConfig, "popup_body");
        const btnText     = getString(remoteConfig, "popup_button_text") || "我知道了";
        const triggerType = getNumber(remoteConfig, "popup_trigger_type");
        const triggerCount = getNumber(remoteConfig, "popup_trigger_count") || 5;

        const showPopup = () => setPopup({ title, body, btnText });

        if (triggerType === 0) {
          showPopup();
        } else if (triggerType === 1) {
          const storageKey = `popup_seen_${title}`;
          const seen = parseInt(localStorage.getItem(storageKey) || "0", 10);
          if (seen < triggerCount) {
            localStorage.setItem(storageKey, String(seen + 1));
            showPopup();
          }
        }
      })
      .catch(() => { /* Remote Config fetch failed silently */ });
  }, []);

  // Subscribe to custom exercises
  useEffect(() => {
    const q = query(
      collection(db, "users", user.uid, "customExercises"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setCustomExercises(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user.uid]);

  // Update streak when workouts change
  useEffect(() => {
    if (loading) return;
    const todayWorked = workouts.some(w => w.date === today);
    if (todayWorked && streak.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const newCount = streak.lastDate === yesterday ? streak.count + 1 : 1;
      setDoc(doc(db, "users", user.uid, "meta", "streak"), { count: newCount, lastDate: today });
    }
  }, [workouts, loading]);

  async function addCustomExercise() {
    const name = newExName.trim();
    if (!name) return;
    await addDoc(collection(db, "users", user.uid, "customExercises"), {
      name, createdAt: serverTimestamp(),
    });
    setNewExName("");
  }

  async function deleteCustomExercise(id) {
    await deleteDoc(doc(db, "users", user.uid, "customExercises", id));
  }

  async function renameCustomExercise() {
    const name = editingExName.trim();
    if (!name || !editingExId) return;
    await updateDoc(doc(db, "users", user.uid, "customExercises", editingExId), { name });
    setEditingExId(null);
    setEditingExName("");
  }

  function addSet() { setWSets([...wSets, { reps: "", weight: "" }]); }
  function removeSet(i) { setWSets(wSets.filter((_, idx) => idx !== i)); }
  function updateSet(i, field, val) {
    const s = [...wSets]; s[i] = { ...s[i], [field]: val }; setWSets(s);
  }

  async function saveWorkout() {
    const name = wCustom.trim() || wExercise;
    const isNewPR = wSets.some(s => {
      const wt = parseFloat(s.weight);
      return !isNaN(wt) && wt > 0 && (!prMap[name] || wt > prMap[name].weight);
    });
    await addDoc(collection(db, "users", user.uid, "workouts"), {
      date: wDate, exercise: name, sets: wSets, note: wNote, createdAt: serverTimestamp(),
    });
    setWSets([{ reps: "", weight: "" }]);
    setWNote(""); setWCustom("");
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 1500);
    if (isNewPR) {
      setPrAnim(true);
      setTimeout(() => setPrAnim(false), 2500);
    }
  }

  async function saveQuickWorkout() {
    await addDoc(collection(db, "users", user.uid, "workouts"), {
      date: new Date().toISOString().slice(0, 10),
      exercise: quickExercise,
      sets: quickSets,
      note: "",
      createdAt: serverTimestamp(),
    });
    setQuickSets([{ reps: "", weight: "" }]);
    setQuickAnim(true);
    setTimeout(() => { setQuickAnim(false); setShowQuickLog(false); }, 1200);
  }

  async function saveBody() {
    await addDoc(collection(db, "users", user.uid, "bodyData"), {
      date: bDate, weight: bWeight, height: bHeight, chest: bChest,
      waist: bWaist, hip: bHip, arm: bArm, thigh: bThigh, createdAt: serverTimestamp(),
    });
    setBWeight(""); setBHeight(""); setBChest(""); setBWaist(""); setBHip(""); setBArm(""); setBThigh("");
  }

  // Edit workout set helpers
  function ewAddSet() { setEwSets([...ewSets, { reps: "", weight: "" }]); }
  function ewRemoveSet(i) { setEwSets(ewSets.filter((_, idx) => idx !== i)); }
  function ewUpdateSet(i, field, val) {
    const s = [...ewSets]; s[i] = { ...s[i], [field]: val }; setEwSets(s);
  }

  function openEditWorkout(workout) {
    setEditWorkoutId(workout.id);
    setEwDate(workout.date);
    setEwExercise(workout.exercise);
    setEwSets(workout.sets ? workout.sets.map(s => ({ ...s })) : [{ reps: "", weight: "" }]);
    setEwNote(workout.note || "");
    setShowEditWorkout(true);
  }

  function closeEditWorkout() {
    setShowEditWorkout(false);
    setEditWorkoutId(null);
    setEwDate(""); setEwExercise("");
    setEwSets([{ reps: "", weight: "" }]);
    setEwNote(""); setEditSavedAnim(false);
  }

  async function saveEditWorkout() {
    if (!editWorkoutId) return;
    await updateDoc(
      doc(db, "users", user.uid, "workouts", editWorkoutId),
      { date: ewDate, exercise: ewExercise, sets: ewSets, note: ewNote }
    );
    setEditSavedAnim(true);
    setTimeout(() => { setEditSavedAnim(false); closeEditWorkout(); }, 1200);
  }

  function deleteWorkout(id) {
    setConfirmDialog({
      message: "確認刪除此訓練紀錄？",
      onConfirm: async () => {
        await deleteDoc(doc(db, "users", user.uid, "workouts", id));
        setConfirmDialog(null);
      },
    });
  }

  function deleteBodyRecord(id) {
    setConfirmDialog({
      message: "確認刪除此身材紀錄？",
      onConfirm: async () => {
        await deleteDoc(doc(db, "users", user.uid, "bodyData", id));
        setConfirmDialog(null);
      },
    });
  }

  const recentWorkouts = workouts.slice(0, 5);
  const latestBody = bodyData[0];
  const workoutDays = new Set(workouts.map(w => w.date)).size;
  const totalSets = workouts.reduce((a, w) => a + (w.sets?.length || 0), 0);

  let bmi = null;
  if (latestBody?.weight && latestBody?.height) {
    const h = parseFloat(latestBody.height) / 100;
    bmi = (parseFloat(latestBody.weight) / (h * h)).toFixed(1);
  }

  // bodyData is Firestore DESC order; reverse() puts oldest on left
  const chartPoints = bodyData
    .filter(b => {
      const v = parseFloat(b[activeMetric]);
      return !isNaN(v) && b[activeMetric] !== "" && b[activeMetric] != null;
    })
    .slice()
    .reverse()
    .map(b => ({
      date: b.date,
      value: parseFloat(b[activeMetric]),
      label: b.date.slice(5),   // "MM-DD"
    }));

  const CustomTooltip = ({ active, payload }) => {
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
  };

  // PR Map: key=exercise, value={ weight, date }
  const prMap = {};
  workouts.forEach(w => {
    w.sets?.forEach(s => {
      const wt = parseFloat(s.weight);
      if (!isNaN(wt) && wt > 0) {
        if (!prMap[w.exercise] || wt > prMap[w.exercise].weight) {
          prMap[w.exercise] = { weight: wt, date: w.date };
        }
      }
    });
  });
  const topPRs = Object.entries(prMap)
    .sort(([, a], [, b]) => b.weight - a.weight)
    .slice(0, 5);

  // Weekly volume: past 8 weeks (Mon as week start)
  function getWeekStart(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d.toISOString().slice(0, 10);
  }
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
    exPickerTrigger: {
      width: "100%", background: "#12121a",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
      padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
      outline: "none", boxSizing: "border-box", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      textAlign: "left", fontFamily: "inherit",
    },
    exPickerOverlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center",
    },
    exPickerSheet: {
      width: "100%", maxWidth: "480px", height: "70vh", background: "#13131c",
      borderRadius: "20px 20px 0 0", border: "1px solid rgba(255,255,255,0.1)",
      borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden",
    },
    exPickerHeader: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
      flexShrink: 0,
    },
    exPickerTitle: { fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" },
    exPickerClose: {
      background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "8px", padding: "6px 14px", color: "#e8e4dc",
      fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    },
    exPickerBody: {
      flex: 1, overflowY: "auto", overflowX: "hidden",
      WebkitOverflowScrolling: "touch", padding: "8px 0 24px",
    },
    exPickerCategoryLabel: {
      fontSize: "11px", fontWeight: 700, color: "#666",
      letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px 20px 6px",
    },
    exPickerItem: (isSelected) => ({
      display: "block", width: "100%", padding: "12px 20px",
      background: isSelected ? "rgba(255,106,0,0.12)" : "transparent",
      border: "none", borderLeft: isSelected ? "3px solid #ff6a00" : "3px solid transparent",
      color: isSelected ? "#ff9500" : "#e8e4dc",
      fontSize: "15px", fontWeight: isSelected ? 700 : 400,
      textAlign: "left", cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
    }),
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
    historyActionBtn: {
      padding: "3px 10px",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: "6px", color: "#ccc",
      cursor: "pointer", fontSize: "12px",
      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
    },
    historyDeleteBtn: {
      padding: "3px 10px",
      background: "rgba(255,50,50,0.12)",
      border: "1px solid rgba(255,50,50,0.2)",
      borderRadius: "6px", color: "#ff5555",
      cursor: "pointer", fontSize: "12px",
      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
    },
    confirmCancelBtn: {
      flex: 1, padding: "13px", cursor: "pointer", fontWeight: 700,
      border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px",
      background: "transparent", color: "#888", fontSize: "15px",
      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
    },
    confirmDeleteBtn: {
      flex: 1, padding: "13px", cursor: "pointer", fontWeight: 800,
      border: "none", borderRadius: "12px",
      background: "linear-gradient(135deg, #ff3030, #ff5555)",
      color: "#fff", fontSize: "15px",
      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#ff6a00", fontSize: "22px", fontWeight: 900, letterSpacing: "0.1em", fontFamily: "'Barlow Condensed', sans-serif" }}>
          載入中...
        </div>
      </div>
    );
  }

  const exPickerSheet = (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        zIndex: 9999, display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={() => setShowExPicker(false)}
    >
      <div
        style={{
          width: "100%", maxWidth: "480px", height: "70vh", background: "#13131c",
          borderRadius: "20px 20px 0 0",
          border: "1px solid rgba(255,255,255,0.12)", borderBottom: "none",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" }}>
            選擇動作
          </span>
          <button
            style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px", padding: "6px 16px", color: "#e8e4dc",
              fontSize: "14px", fontWeight: 700, cursor: "pointer",
              fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
            }}
            onClick={() => setShowExPicker(false)}
          >
            取消
          </button>
        </div>
        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 0 32px" }}>
          {exerciseCategories.map(cat => (
            <div key={cat.label}>
              <div style={{
                fontSize: "11px", fontWeight: 700, color: "#555",
                letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px 20px 6px",
              }}>
                {cat.label}
              </div>
              {cat.exercises.map(ex => {
                const currentEx = pickerTarget === "quick" ? quickExercise : pickerTarget === "editWorkout" ? ewExercise : wExercise;
                const sel = currentEx === ex;
                return (
                  <button key={ex} onClick={() => {
                    if (pickerTarget === "quick") setQuickExercise(ex);
                    else if (pickerTarget === "editWorkout") setEwExercise(ex);
                    else setWExercise(ex);
                    setShowExPicker(false);
                  }}
                    style={{
                      display: "block", width: "100%", padding: "13px 20px",
                      background: sel ? "rgba(255,106,0,0.12)" : "transparent",
                      border: "none", borderLeft: sel ? "3px solid #ff6a00" : "3px solid transparent",
                      color: sel ? "#ff9500" : "#e8e4dc",
                      fontSize: "15px", fontWeight: sel ? 700 : 400,
                      textAlign: "left", cursor: "pointer", boxSizing: "border-box",
                      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                    }}>
                    {ex}
                  </button>
                );
              })}
            </div>
          ))}
          {customExercises.length > 0 && (
            <div>
              <div style={{
                fontSize: "11px", fontWeight: 700, color: "#ff9500",
                letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px 20px 6px",
              }}>
                ★ 我的自訂動作
              </div>
              {customExercises.map(ex => {
                const currentEx = pickerTarget === "quick" ? quickExercise : pickerTarget === "editWorkout" ? ewExercise : wExercise;
                const sel = currentEx === ex.name;
                return (
                  <button key={ex.id} onClick={() => {
                    if (pickerTarget === "quick") setQuickExercise(ex.name);
                    else if (pickerTarget === "editWorkout") setEwExercise(ex.name);
                    else setWExercise(ex.name);
                    setShowExPicker(false);
                  }}
                    style={{
                      display: "block", width: "100%", padding: "13px 20px",
                      background: sel ? "rgba(255,106,0,0.12)" : "transparent",
                      border: "none", borderLeft: sel ? "3px solid #ff6a00" : "3px solid transparent",
                      color: sel ? "#ff9500" : "#e8e4dc",
                      fontSize: "15px", fontWeight: sel ? 700 : 400,
                      textAlign: "left", cursor: "pointer", boxSizing: "border-box",
                      fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                    }}>
                    {ex.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div style={styles.app}>
      <div style={styles.bg} />

      <div style={styles.header}>
        <div style={{
          fontSize: "24px", fontWeight: 900, letterSpacing: "0.08em",
          background: "linear-gradient(90deg, #ff6a00, #ffd700)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          FITFORGE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={styles.streakBadge}>
            🔥 {streak.count} 天連續
          </div>
          <button
            onClick={() => setShowMorePanel(true)}
            title={`帳號設定 ${user.displayName || ""}`}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              width: "36px", height: "36px",
              cursor: "pointer", overflow: "hidden", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "16px" }}>👤</span>
            }
          </button>
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

            {/* 每週訓練量趨勢圖 */}
            <div style={styles.card}>
              <div style={styles.sectionTitle}>每週訓練量</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={weeklyPoints} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#666", fontSize: 10, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#666", fontSize: 10, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
                    axisLine={false} tickLine={false} width={28}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const { label, sets } = payload[0].payload;
                      return (
                        <div style={{ background: "rgba(18,18,28,0.96)", border: "1px solid rgba(255,106,0,0.4)", borderRadius: "10px", padding: "8px 14px", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif", pointerEvents: "none" }}>
                          <div style={{ fontSize: "11px", color: "#888", marginBottom: "2px" }}>{label} 週</div>
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

            {/* 個人最佳 PR */}
            {topPRs.length > 0 && (
              <div style={styles.card}>
                <div style={styles.sectionTitle}>個人最佳 PR</div>
                {topPRs.map(([exercise, { weight, date }]) => (
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

            <div style={{ ...styles.card, borderColor: "rgba(255,106,0,0.2)", background: "rgba(255,106,0,0.05)" }}>
              <div style={{ fontSize: "13px", color: "#888", lineHeight: "1.8" }}>
                💡 <strong style={{ color: "#ff9500" }}>今日提醒</strong><br />
                {streak.count >= 3
                  ? `🔥 你已經連續訓練 ${streak.count} 天了！保持下去！`
                  : "今天有訓練嗎？記錄你的每一次努力！"}
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
                <button
                  style={styles.exPickerTrigger}
                  onClick={() => { setPickerTarget("workout"); setShowExPicker(true); }}
                >
                  <span>{wExercise}</span>
                  <span style={{ color: "#666", fontSize: "12px" }}>▼</span>
                </button>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={styles.label}>臨時動作名稱（可選，不儲存）</label>
                <input style={styles.input} placeholder="輸入一次性動作名稱..." value={wCustom} onChange={e => setWCustom(e.target.value)} />
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

              <button
                style={{ ...styles.btn, transform: savedAnim ? "scale(0.97)" : "scale(1)", opacity: savedAnim ? 0.8 : 1 }}
                onClick={saveWorkout}
              >
                {savedAnim ? "✓ 已儲存！" : "💾 儲存訓練"}
              </button>
            </div>

            {/* CUSTOM EXERCISES MANAGEMENT */}
            <div style={styles.card}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: showManageEx ? "16px" : 0,
              }}>
                <div
                  style={{ ...styles.sectionTitle, marginBottom: 0, cursor: "pointer", userSelect: "none" }}
                  onClick={() => setShowManageEx(!showManageEx)}>
                  ★ 我的自訂動作 {customExercises.length > 0 && `(${customExercises.length})`}
                </div>
                <button
                  style={{ ...styles.btnSecondary, fontSize: "18px", padding: "2px 10px", lineHeight: 1 }}
                  onClick={() => setShowManageEx(!showManageEx)}
                >
                  {showManageEx ? "▲" : "▼"}
                </button>
              </div>

              {showManageEx && (
                <div>
                  {/* Add new custom exercise */}
                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                    <input
                      style={{ ...styles.input, marginBottom: 0 }}
                      placeholder="輸入自訂動作名稱..."
                      value={newExName}
                      onChange={e => setNewExName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addCustomExercise()}
                    />
                    <button
                      style={{
                        padding: "10px 16px", border: "none", borderRadius: "10px",
                        background: "linear-gradient(135deg, #ff6a00, #ff9500)",
                        color: "#fff", fontSize: "14px", fontWeight: 800,
                        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                      }}
                      onClick={addCustomExercise}
                    >
                      + 新增
                    </button>
                  </div>

                  {/* List of custom exercises */}
                  {customExercises.length === 0 ? (
                    <div style={{ color: "#555", fontSize: "13px", textAlign: "center", padding: "12px 0" }}>
                      還沒有自訂動作，新增你獨有的訓練動作！
                    </div>
                  ) : (
                    <div>
                      {customExercises.map(ex => (
                        <div key={ex.id} style={{
                          padding: "10px 12px", marginBottom: "8px",
                          background: "rgba(255,106,0,0.06)",
                          border: "1px solid rgba(255,106,0,0.18)",
                          borderRadius: "10px",
                        }}>
                          {editingExId === ex.id ? (
                            /* ── Editing row ── */
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <input
                                style={{ ...styles.input, flex: 1, padding: "7px 12px", fontSize: "14px" }}
                                value={editingExName}
                                onChange={e => setEditingExName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") renameCustomExercise();
                                  if (e.key === "Escape") { setEditingExId(null); setEditingExName(""); }
                                }}
                                autoFocus
                              />
                              <button
                                style={{
                                  padding: "7px 12px", border: "none", borderRadius: "8px",
                                  background: "linear-gradient(135deg,#ff6a00,#ff9500)",
                                  color: "#fff", fontSize: "13px", fontWeight: 800, cursor: "pointer",
                                  whiteSpace: "nowrap", fontFamily: "inherit",
                                }}
                                onClick={renameCustomExercise}
                              >儲存</button>
                              <button
                                style={{
                                  padding: "7px 12px", border: "1px solid rgba(255,255,255,0.15)",
                                  borderRadius: "8px", background: "transparent",
                                  color: "#888", fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
                                }}
                                onClick={() => { setEditingExId(null); setEditingExName(""); }}
                              >取消</button>
                            </div>
                          ) : (
                            /* ── Normal row ── */
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ color: "#ff9500", fontSize: "13px" }}>★</span>
                                <span style={{ fontSize: "14px", fontWeight: 600 }}>{ex.name}</span>
                              </div>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  style={{
                                    padding: "4px 12px",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    borderRadius: "6px", color: "#ccc",
                                    cursor: "pointer", fontSize: "12px", fontFamily: "inherit",
                                  }}
                                  onClick={() => { setEditingExId(ex.id); setEditingExName(ex.name); }}
                                >改名</button>
                                <button
                                  style={{
                                    padding: "4px 12px",
                                    background: "rgba(255,50,50,0.12)",
                                    border: "1px solid rgba(255,50,50,0.2)",
                                    borderRadius: "6px", color: "#ff5555",
                                    cursor: "pointer", fontSize: "12px", fontFamily: "inherit",
                                  }}
                                  onClick={() => deleteCustomExercise(ex.id)}
                                >刪除</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
                        domain={["auto", "auto"]}
                        tick={{ fill: "#666", fontSize: 11, fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: "rgba(255,106,0,0.25)", strokeWidth: 1, strokeDasharray: "4 4" }}
                      />
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

                {bodyData.slice(0, 5).map((b, i) => (
                  <div key={b.id} style={{ ...styles.workoutItem, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
                        <div style={{ fontSize: "13px", fontWeight: 700, color: parseFloat(b.weight) < parseFloat(bodyData[i - 1].weight) ? "#4ade80" : "#f87171" }}>
                          {parseFloat(b.weight) < parseFloat(bodyData[i - 1].weight) ? "↓" : "↑"}
                          {Math.abs(parseFloat(b.weight) - parseFloat(bodyData[i - 1].weight)).toFixed(1)}kg
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={styles.historyDate}>{w.date}</div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button style={styles.historyActionBtn} onClick={() => openEditWorkout(w)}>編輯</button>
                      <button style={styles.historyDeleteBtn} onClick={() => deleteWorkout(w.id)}>刪除</button>
                    </div>
                  </div>
                  <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>{w.exercise}</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: w.note ? "8px" : 0 }}>
                    {w.sets?.map((s, i) => (
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

      {/* NEW PR Toast */}
      {prAnim && (
        <div style={{
          position: "fixed", top: "80px", left: "50%", transform: "translateX(-50%)",
          background: "linear-gradient(135deg, #ffd700, #ff9500)",
          color: "#0a0a0f", padding: "10px 24px", borderRadius: "24px",
          fontWeight: 900, fontSize: "17px", letterSpacing: "0.06em",
          zIndex: 300, boxShadow: "0 4px 24px rgba(255,215,0,0.45)",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          🏆 NEW PR！
        </div>
      )}

      {/* Quick-Log FAB */}
      <button
        style={{
          position: "fixed", bottom: "28px", right: "20px", zIndex: 150,
          width: "56px", height: "56px", borderRadius: "50%", border: "none",
          background: "linear-gradient(135deg, #ff6a00, #ff9500)",
          color: "#fff", fontSize: "28px", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(255,106,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "inherit",
        }}
        onClick={() => setShowQuickLog(true)}
      >
        +
      </button>

    </div>
    {showExPicker && createPortal(exPickerSheet, document.body)}

    {showMorePanel && createPortal(
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
        onClick={() => setShowMorePanel(false)}
      >
        <div
          style={{
            width: "100%", maxWidth: "480px",
            background: "#13131c", borderRadius: "20px 20px 0 0",
            border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
            padding: "0 0 32px",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 10px" }}>
            <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.15)" }} />
          </div>

          {/* User info */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 24px 20px" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              overflow: "hidden", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {user.photoURL
                ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: "22px" }}>👤</span>
              }
            </div>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.02em" }}>
                {user.displayName || "使用者"}
              </div>
              <div style={{ fontSize: "13px", color: "#666", marginTop: "2px" }}>{user.email}</div>
            </div>
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "0 24px" }} />

          {/* Sign out button */}
          <div style={{ padding: "20px 24px 8px" }}>
            <button
              style={{
                width: "100%", padding: "13px", border: "1px solid rgba(255,80,80,0.3)",
                borderRadius: "12px", background: "rgba(255,50,50,0.08)",
                color: "#ff5555", fontSize: "16px", fontWeight: 800,
                cursor: "pointer", letterSpacing: "0.04em",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={() => { setShowMorePanel(false); signOut(auth); }}
            >
              登出 / 切換帳號
            </button>
            <div style={{ fontSize: "12px", color: "#555", textAlign: "center", marginTop: "8px", lineHeight: "1.5" }}>
              登出後可用其他 Google 帳號重新登入
            </div>
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "16px 24px" }} />

          {/* Cancel button */}
          <div style={{ padding: "0 24px" }}>
            <button
              style={{
                width: "100%", padding: "13px", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px", background: "transparent",
                color: "#888", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={() => setShowMorePanel(false)}
            >
              取消
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showQuickLog && createPortal(
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9997,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
        onClick={() => setShowQuickLog(false)}
      >
        <div
          style={{
            width: "100%", maxWidth: "480px", maxHeight: "75vh",
            background: "#13131c", borderRadius: "20px 20px 0 0",
            border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" }}>
              快速記錄
            </span>
            <button
              style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px", padding: "6px 16px", color: "#e8e4dc",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={() => setShowQuickLog(false)}
            >
              取消
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 20px 24px" }}>
            {/* Date display */}
            <div style={{ fontSize: "13px", color: "#666", marginBottom: "16px", letterSpacing: "0.04em" }}>
              今天 · {new Date().toISOString().slice(0, 10)}
            </div>

            {/* Exercise picker trigger */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>
                動作
              </label>
              <button
                style={{
                  width: "100%", background: "#12121a",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                  padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  textAlign: "left", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                  boxSizing: "border-box",
                }}
                onClick={() => { setPickerTarget("quick"); setShowExPicker(true); }}
              >
                <span>{quickExercise}</span>
                <span style={{ color: "#666", fontSize: "12px" }}>▼</span>
              </button>
            </div>

            {/* Sets */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em" }}>訓練組數</label>
                <button
                  style={{
                    padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
                    background: "transparent", color: "#888", fontSize: "13px",
                    cursor: "pointer", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                  }}
                  onClick={() => setQuickSets([...quickSets, { reps: "", weight: "" }])}
                >
                  + 新增一組
                </button>
              </div>
              {quickSets.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ textAlign: "center", color: "#ff6a00", fontWeight: 900, fontSize: "18px", minWidth: "24px" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      style={{
                        flex: 1, width: "100%", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                        padding: "8px 12px", color: "#e8e4dc", fontSize: "15px",
                        outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box",
                      }}
                      placeholder="次數"
                      value={s.reps}
                      onChange={e => {
                        const updated = [...quickSets];
                        updated[i] = { ...updated[i], reps: e.target.value };
                        setQuickSets(updated);
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" }}>次數 (reps)</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      style={{
                        flex: 1, width: "100%", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                        padding: "8px 12px", color: "#e8e4dc", fontSize: "15px",
                        outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box",
                      }}
                      placeholder="重量"
                      value={s.weight}
                      onChange={e => {
                        const updated = [...quickSets];
                        updated[i] = { ...updated[i], weight: e.target.value };
                        setQuickSets(updated);
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" }}>重量 (kg)</div>
                  </div>
                  {quickSets.length > 1 && (
                    <button
                      style={{
                        background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.2)",
                        borderRadius: "8px", padding: "8px 10px", color: "#ff5555",
                        cursor: "pointer", fontSize: "14px",
                      }}
                      onClick={() => setQuickSets(quickSets.filter((_, idx) => idx !== i))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Save button */}
            <button
              style={{
                width: "100%", padding: "14px", border: "none", borderRadius: "12px",
                background: quickAnim
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #ff6a00, #ff9500)",
                color: "#fff", fontSize: "16px", fontWeight: 800,
                cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
                marginTop: "8px", transition: "background 0.3s",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={saveQuickWorkout}
              disabled={quickAnim}
            >
              {quickAnim ? "✓ 已儲存！" : "💾 儲存訓練"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {showEditWorkout && createPortal(
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9996,
          background: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
        onClick={closeEditWorkout}
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
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: "16px", fontWeight: 800, color: "#e8e4dc", letterSpacing: "0.05em" }}>
              編輯訓練
            </span>
            <button
              style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px", padding: "6px 16px", color: "#e8e4dc",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={closeEditWorkout}
            >
              取消
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 20px 24px" }}>
            {/* Date */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>日期</label>
              <input type="date" value={ewDate} onChange={e => setEwDate(e.target.value)}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                  padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
                  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>

            {/* Exercise picker */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>選擇動作</label>
              <button
                style={{
                  width: "100%", background: "#12121a",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                  padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  textAlign: "left", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                  boxSizing: "border-box",
                }}
                onClick={() => { setPickerTarget("editWorkout"); setShowExPicker(true); }}
              >
                <span>{ewExercise}</span>
                <span style={{ color: "#666", fontSize: "12px" }}>▼</span>
              </button>
            </div>

            {/* Sets */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em" }}>訓練組數</label>
                <button
                  style={{
                    padding: "6px 12px", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px",
                    background: "transparent", color: "#888", fontSize: "13px",
                    cursor: "pointer", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                  }}
                  onClick={ewAddSet}
                >
                  + 新增一組
                </button>
              </div>
              {ewSets.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ textAlign: "center", color: "#ff6a00", fontWeight: 900, fontSize: "18px", minWidth: "24px" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" placeholder="次數" value={s.reps}
                      onChange={e => ewUpdateSet(i, "reps", e.target.value)}
                      style={{
                        width: "100%", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                        padding: "8px 12px", color: "#e8e4dc", fontSize: "15px",
                        outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" }}>次數 (reps)</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input type="number" placeholder="重量" value={s.weight}
                      onChange={e => ewUpdateSet(i, "weight", e.target.value)}
                      style={{
                        width: "100%", background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                        padding: "8px 12px", color: "#e8e4dc", fontSize: "15px",
                        outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box",
                      }}
                    />
                    <div style={{ fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" }}>重量 (kg)</div>
                  </div>
                  {ewSets.length > 1 && (
                    <button
                      style={{
                        background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.2)",
                        borderRadius: "8px", padding: "8px 10px", color: "#ff5555",
                        cursor: "pointer", fontSize: "14px",
                      }}
                      onClick={() => ewRemoveSet(i)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Note */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>備註（可選）</label>
              <input type="text" placeholder="訓練備註..." value={ewNote}
                onChange={e => setEwNote(e.target.value)}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
                  padding: "10px 14px", color: "#e8e4dc", fontSize: "15px",
                  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
              />
            </div>

            {/* Save button */}
            <button
              style={{
                width: "100%", padding: "14px", border: "none", borderRadius: "12px",
                background: editSavedAnim
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #ff6a00, #ff9500)",
                color: "#fff", fontSize: "16px", fontWeight: 800,
                cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
                marginTop: "8px", transition: "background 0.3s",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={saveEditWorkout}
              disabled={editSavedAnim}
            >
              {editSavedAnim ? "✓ 已儲存！" : "💾 儲存修改"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {popup && createPortal(
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}
        onClick={() => setPopup(null)}
      >
        <div
          style={{
            width: "100%", maxWidth: "380px",
            background: "#13131c",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Orange accent bar */}
          <div style={{ height: "4px", background: "linear-gradient(90deg,#ff6a00,#ffd700)" }} />

          <div style={{ padding: "24px 24px 28px" }}>
            {/* Title */}
            {popup.title ? (
              <div style={{
                fontSize: "20px", fontWeight: 900, letterSpacing: "0.04em",
                background: "linear-gradient(90deg,#ff6a00,#ffd700)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                marginBottom: popup.body ? "12px" : "20px",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}>
                {popup.title}
              </div>
            ) : null}

            {/* Body */}
            {popup.body ? (
              <div style={{
                fontSize: "15px", color: "#b0aba3", lineHeight: "1.7",
                marginBottom: "24px", whiteSpace: "pre-wrap",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}>
                {popup.body}
              </div>
            ) : null}

            {/* Button */}
            <button
              style={{
                width: "100%", padding: "13px", border: "none", borderRadius: "12px",
                background: "linear-gradient(135deg,#ff6a00,#ff9500)",
                color: "#fff", fontSize: "15px", fontWeight: 800,
                cursor: "pointer", letterSpacing: "0.06em",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={() => setPopup(null)}
            >
              {popup.btnText}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    {confirmDialog && createPortal(
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9995,
          background: "rgba(0,0,0,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}
        onClick={() => setConfirmDialog(null)}
      >
        <div
          style={{
            width: "100%", maxWidth: "340px",
            background: "#13131c",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ height: "4px", background: "linear-gradient(90deg,#ff6a00,#ffd700)" }} />
          <div style={{ padding: "24px 24px 28px" }}>
            <div style={{
              fontSize: "20px", fontWeight: 900, color: "#e8e4dc",
              marginBottom: "8px",
              fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
            }}>
              確認刪除？
            </div>
            <div style={{
              fontSize: "14px", color: "#888", lineHeight: "1.6", marginBottom: "24px",
              fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
            }}>
              {confirmDialog.message}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={styles.confirmCancelBtn} onClick={() => setConfirmDialog(null)}>取消</button>
              <button style={styles.confirmDeleteBtn} onClick={() => confirmDialog.onConfirm()}>刪除</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
