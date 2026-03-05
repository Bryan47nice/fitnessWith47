import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, setDoc, serverTimestamp, deleteDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { fetchAndActivate, getBoolean, getString, getNumber } from "firebase/remote-config";
import { getToken } from "firebase/messaging";
import { db, auth, remoteConfig, getAppMessaging } from "../firebase";
import {
  getWeekStart, calcBMI, bodyPartLabels,
  getGoalTitle, getGoalProgress as _getGoalProgress,
  detectNewPR, canSaveWorkout, canSaveGoal,
} from "../utils/fitforge.utils.js";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from "recharts";

const APP_VERSION = "1.3.9";

const exerciseCategories = [
  { label: "胸", exercises: ["臥推", "上斜臥推", "雙槓撐體", "飛鳥", "胸推機", "蝴蝶機", "伏地挺身"] },
  { label: "背", exercises: ["引體向上", "划船", "滑輪下拉", "單手啞鈴划船", "坐姿划船機"] },
  { label: "肩", exercises: ["肩推", "側平舉", "前平舉", "面拉"] },
  { label: "腿", exercises: ["深蹲", "硬舉", "腿推", "腿彎舉", "腿伸展", "保加利亞分腿蹲", "啞鈴弓箭步"] },
  { label: "手臂", exercises: ["二頭彎舉", "三頭下壓"] },
  { label: "核心", exercises: ["棒式", "捲腹", "俄羅斯轉體"] },
  { label: "有氧", exercises: ["跑步機", "慢跑", "室內健走", "橢圓機", "樓梯機", "騎車", "跳繩", "游泳"] },
];

const metricConfig = {
  weight: { label: "體重",   unit: "kg" },
  bmi:    { label: "BMI",    unit: "" },
  height: { label: "身高",   unit: "cm" },
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
  const [showExPicker, setShowExPicker] = useState(false);
  const [editingExId, setEditingExId] = useState(null);
  const [editingExName, setEditingExName] = useState("");

  // Activity popup state (null = hidden, object = show)
  const [popup, setPopup] = useState(null);

  // Marquee state
  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [marqueeTexts, setMarqueeTexts] = useState([
    "No pain, no gain．堅持就是勝利．鍛鍊的是身體，磨練的是意志．每一滴汗水都算數．今天的努力是明天的實力",
  ]);
  const [marqueePaused, setMarqueePaused] = useState(false);
  const [marqueeSheet, setMarqueeSheet] = useState(false);

  // Workout form state
  const [wDate, setWDate] = useState(new Date().toISOString().slice(0, 10));
  const [wExercise, setWExercise] = useState("");
  const [wSets, setWSets] = useState([{ reps: "", weight: "" }]);
  const [wNote, setWNote] = useState("");
  const [savedAnim, setSavedAnim] = useState(false);
  const [prAnim, setPrAnim] = useState(false);

  // More Panel state
  const [showMorePanel, setShowMorePanel] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [hasNewChangelog, setHasNewChangelog] = useState(
    () => localStorage.getItem("last_seen_changelog") !== APP_VERSION
  );

  // Inline exercise picker state
  const [exPickerExpanded, setExPickerExpanded] = useState(false);
  const [exSearchQuery, setExSearchQuery] = useState("");
  const [exActiveTag, setExActiveTag] = useState(
    () => localStorage.getItem("ex_active_tag") || null
  );
  const [showAddCustomEx, setShowAddCustomEx] = useState(false);
  const [pickerTarget, setPickerTarget] = useState("editWorkout"); // "editWorkout" | "goal"
  const [volumePeriod, setVolumePeriod] = useState("week"); // "day" | "week" | "month"

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

  // Notification permission banner
  const [showNotifBanner, setShowNotifBanner] = useState(false);

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
  const [bSavedAnim, setBSavedAnim] = useState(false);

  // Goals
  const [goals, setGoals] = useState([]);
  const [showGoalSheet, setShowGoalSheet] = useState(false);
  const [goalType, setGoalType] = useState("weight");
  const [goalTargetValue, setGoalTargetValue] = useState("");
  const [goalTargetExercise, setGoalTargetExercise] = useState(exerciseCategories[0].exercises[0]);
  const [goalTargetBodyPart, setGoalTargetBodyPart] = useState("waist");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [goalNote, setGoalNote] = useState("");
  const [goalCelebAnim, setGoalCelebAnim] = useState(false);
  const [historyGroupMode, setHistoryGroupMode] = useState(
    () => localStorage.getItem("history_group_mode") || "week"
  );
  const [expandedGroupKeys, setExpandedGroupKeys] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayWorked = workouts.some(w => w.date === today);

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
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by date DESC (newest date first); tie-break by createdAt DESC
      data.sort((a, b) =>
        b.date !== a.date
          ? b.date.localeCompare(a.date)
          : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      setBodyData(data);
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

        // Marquee
        setMarqueeEnabled(getBoolean(remoteConfig, "marquee_enabled"));
        const mTextsRaw = getString(remoteConfig, "marquee_texts");
        if (mTextsRaw) {
          try {
            const parsed = JSON.parse(mTextsRaw);
            if (Array.isArray(parsed) && parsed.length > 0) setMarqueeTexts(parsed);
          } catch { /* keep default */ }
        }
      })
      .catch(() => { /* Remote Config fetch failed silently */ });
  }, []);

  // Update lastActiveAt and maybe show notification banner
  useEffect(() => {
    setDoc(doc(db, "userPushTokens", user.uid), { lastActiveAt: serverTimestamp() }, { merge: true }).catch(() => {});

    // Check FCM support first, then decide what to do
    getAppMessaging().then(async (messaging) => {
      if (!messaging) return; // browser doesn't support FCM (e.g. iOS Safari)

      const permission = typeof Notification !== "undefined" ? Notification.permission : "denied";
      if (permission === "granted") {
        // Silently refresh token
        try {
          const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY });
          if (token) setDoc(doc(db, "userPushTokens", user.uid), { fcmToken: token }, { merge: true }).catch(() => {});
        } catch (_) { /* ignore */ }
      } else if (permission === "default") {
        // Show in-app banner after a short delay
        setTimeout(() => setShowNotifBanner(true), 3000);
      }
      // "denied" → silent skip
    });
  }, [user.uid]);

  // Pre-fill body form when date changes or bodyData loads — enables overwrite UX
  useEffect(() => {
    const existing = bodyData.find(b => b.date === bDate);
    if (existing) {
      setBWeight(existing.weight || "");
      setBHeight(existing.height || "");
      setBChest(existing.chest || "");
      setBWaist(existing.waist || "");
      setBHip(existing.hip || "");
      setBArm(existing.arm || "");
      setBThigh(existing.thigh || "");
    } else {
      setBWeight(""); setBHeight(""); setBChest(""); setBWaist("");
      setBHip(""); setBArm(""); setBThigh("");
    }
  }, [bDate, bodyData]);

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

  // Subscribe to goals
  useEffect(() => {
    const q = query(
      collection(db, "users", user.uid, "goals"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setGoals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user.uid]);

  // Achievement detection
  useEffect(() => {
    goals.forEach(goal => {
      if (!goal.celebrated && getGoalProgress(goal) >= 100) {
        updateDoc(doc(db, "users", user.uid, "goals", goal.id), {
          celebrated: true,
          completedAt: serverTimestamp(),
        }).catch(() => {});
        setGoalCelebAnim(true);
        setTimeout(() => setGoalCelebAnim(false), 3000);
      }
    });
  }, [goals]);

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

  // Show one-time body overwrite tip when user first visits body tab
  useEffect(() => {
    if (tab !== "body") return;
    const key = "popup_seen_body_overwrite_v121";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    setPopup({
      title: "身材數據更新",
      body: "同一天的身材數據現在改為覆蓋機制，\n切換日期時會自動帶入舊資料，\n方便你修改當天的紀錄。",
      btnText: "知道了",
    });
  }, [tab]);

  // Show one-time goals intro when user first visits goals tab
  useEffect(() => {
    if (tab !== "goals") return;
    const key = "popup_seen_goals_intro_v130";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    setPopup({
      title: "目標追蹤怎麼用？",
      body: "點右上角「＋」新增你的訓練目標：\n\n🏋️ 動作 PR — 設定某個動作的目標重量\n📅 訓練頻率 — 每週要練幾天\n⚖️ 體重目標 — 追蹤體重變化進度\n📏 身材圍度 — 腰圍、胸圍等目標\n\n進度條會根據你的訓練 & 身材紀錄自動更新，達成目標時觸發慶祝動畫！",
      btnText: "來設定第一個目標！",
    });
  }, [tab]);

  // One-time migration: rekey bodyData docs to use date as document ID
  useEffect(() => {
    const migKey = "body_migrated_date_key_v122";
    if (localStorage.getItem(migKey)) return;
    if (bodyData.length === 0) { localStorage.setItem(migKey, "1"); return; }
    const byDate = {};
    for (const r of bodyData) {
      const prev = byDate[r.date];
      if (!prev || (r.createdAt?.seconds || 0) > (prev.createdAt?.seconds || 0))
        byDate[r.date] = r;
    }
    const batch = writeBatch(db);
    for (const r of bodyData)
      batch.delete(doc(db, "users", user.uid, "bodyData", r.id));
    for (const [date, r] of Object.entries(byDate)) {
      const { id, ...data } = r;
      batch.set(doc(db, "users", user.uid, "bodyData", date), data);
    }
    batch.commit().then(() => localStorage.setItem(migKey, "1"));
  }, [bodyData, user.uid]);

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
    const name = wExercise;
    const isNewPR = detectNewPR(name, wSets, prMap);
    await addDoc(collection(db, "users", user.uid, "workouts"), {
      date: wDate, exercise: name, sets: wSets, note: wNote, createdAt: serverTimestamp(),
    });
    setDoc(doc(db, "userPushTokens", user.uid), { lastWorkoutDate: wDate }, { merge: true }).catch(() => {});
    setWSets([{ reps: "", weight: "" }]);
    setWNote("");
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 1500);
    if (isNewPR) {
      setPrAnim(true);
      setTimeout(() => setPrAnim(false), 2500);
    }
  }

  async function saveBody() {
    const hasData = [bWeight, bHeight, bChest, bWaist, bHip, bArm, bThigh].some(v => v !== "");
    if (!hasData) return;
    await setDoc(doc(db, "users", user.uid, "bodyData", bDate), {
      date: bDate, weight: bWeight, height: bHeight, chest: bChest,
      waist: bWaist, hip: bHip, arm: bArm, thigh: bThigh,
      createdAt: serverTimestamp(),
    });
    setBSavedAnim(true);
    setTimeout(() => setBSavedAnim(false), 1500);
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
    const name = ewExercise;
    const isNewPR = detectNewPR(name, ewSets, prMap);
    await updateDoc(
      doc(db, "users", user.uid, "workouts", editWorkoutId),
      { date: ewDate, exercise: ewExercise, sets: ewSets, note: ewNote }
    );
    setEditSavedAnim(true);
    setTimeout(() => { setEditSavedAnim(false); closeEditWorkout(); }, 1200);
    if (isNewPR) {
      setPrAnim(true);
      setTimeout(() => setPrAnim(false), 2500);
    }
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

  function deleteGoal(id) {
    setConfirmDialog({
      message: "確認刪除此目標？",
      onConfirm: async () => {
        await deleteDoc(doc(db, "users", user.uid, "goals", id));
        setConfirmDialog(null);
      },
    });
  }

  async function saveGoal() {
    if (!goalTargetValue || !goalDeadline) return;
    if (goalType === "bmi" && !latestBMI) return;
    const ws = getWeekStart(today);
    let startValue = 0;
    let unit = "kg";
    if (goalType === "weight") {
      startValue = latestBody?.weight ? parseFloat(latestBody.weight) : 0;
      unit = "kg";
    } else if (goalType === "frequency") {
      startValue = new Set(workouts.filter(w => w.date >= ws).map(w => w.date)).size;
      unit = "天/週";
    } else if (goalType === "exercise_pr") {
      startValue = prMap[goalTargetExercise]?.weight ?? 0;
      unit = "kg";
    } else if (goalType === "body_measurement") {
      startValue = latestBody?.[goalTargetBodyPart] ? parseFloat(latestBody[goalTargetBodyPart]) : 0;
      unit = "cm";
    } else if (goalType === "bmi") {
      startValue = latestBMI;
      unit = "";
    }
    const goalDirection = parseFloat(goalTargetValue) < startValue ? "decrease" : "increase";
    await addDoc(collection(db, "users", user.uid, "goals"), {
      type: goalType,
      targetValue: parseFloat(goalTargetValue),
      startValue,
      unit,
      goalDirection,
      ...(goalType === "exercise_pr" ? { targetExercise: goalTargetExercise } : {}),
      ...(goalType === "body_measurement" ? { targetBodyPart: goalTargetBodyPart } : {}),
      deadline: goalDeadline,
      note: goalNote.trim(),
      celebrated: false,
      createdAt: serverTimestamp(),
      completedAt: null,
    });
    setGoalTargetValue(""); setGoalDeadline(""); setGoalNote("");
    setShowGoalSheet(false);
  }

  function shareApp() {
    const APP_URL = "https://fitnesswith47.web.app";
    if (navigator.share) {
      setShowMorePanel(false);
      navigator.share({ title: "FitForge — 健身追蹤 App", text: "我在用 FitForge 追蹤訓練，推薦你也試試！", url: APP_URL });
    } else {
      navigator.clipboard.writeText(APP_URL);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1500);
    }
  }

  async function requestNotificationPermission() {
    setShowNotifBanner(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const messaging = await getAppMessaging();
      if (!messaging) return;
      const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY });
      if (token) setDoc(doc(db, "userPushTokens", user.uid), { fcmToken: token }, { merge: true }).catch(() => {});
    } catch (_) { /* ignore */ }
  }

  function dismissNotifBanner() {
    setShowNotifBanner(false);
  }

  const recentWorkouts = workouts.slice(0, 5);
  const latestBody = bodyData[0];
  const existingBodyForDate = bodyData.find(b => b.date === bDate) || null;
  const workoutDays = new Set(workouts.map(w => w.date)).size;
  const totalSets = workouts.reduce((a, w) => a + (w.sets?.length || 0), 0);

  let bmi = null;
  if (latestBody?.weight && latestBody?.height) {
    const h = parseFloat(latestBody.height) / 100;
    bmi = (parseFloat(latestBody.weight) / (h * h)).toFixed(1);
  }
  const latestBMI = calcBMI(latestBody?.weight, latestBody?.height);

  // Sort by date ASC so chart x-axis goes from oldest (left) to newest (right)
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

  const getGoalProgress = (goal) =>
    _getGoalProgress(goal, { latestBody, latestBMI, workouts, prMap, today });

  function getCategoryForExercise(name) {
    for (const cat of exerciseCategories) {
      if (cat.exercises.includes(name)) return cat.label;
    }
    if (customExercises.some(e => e.name === name)) return "自訂";
    return "";
  }

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

  const recentExercises = (() => {
    const seen = new Set();
    const result = [];
    for (const w of workouts) {
      if (!seen.has(w.exercise)) {
        seen.add(w.exercise);
        result.push(w.exercise);
        if (result.length >= 5) break;
      }
    }
    return result;
  })();

  const allPresetFlat = exerciseCategories.flatMap(cat =>
    cat.exercises.map(e => ({ name: e, category: cat.label }))
  );
  const allCustomFlat = customExercises.map(e => ({ name: e.name, category: "自訂", id: e.id }));

  let pickerDisplayList;
  if (exSearchQuery.trim()) {
    const q = exSearchQuery.trim().toLowerCase();
    pickerDisplayList = [...allPresetFlat, ...allCustomFlat].filter(e =>
      e.name.toLowerCase().includes(q)
    );
  } else if (exActiveTag === "自訂") {
    pickerDisplayList = allCustomFlat;
  } else if (exActiveTag) {
    const cat = exerciseCategories.find(c => c.label === exActiveTag);
    pickerDisplayList = cat ? cat.exercises.map(e => ({ name: e, category: exActiveTag })) : [];
  } else {
    pickerDisplayList = recentExercises.map(name => ({ name, category: getCategoryForExercise(name) }));
  }

  const tabs = [
    { id: "dashboard", label: "儀表板", icon: "⚡" },
    { id: "workout",   label: "訓練日誌", icon: "📋" },
    { id: "body",      label: "身材數據", icon: "📏" },
    { id: "goals",     label: "目標追蹤", icon: "🎯" },
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
      width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
      padding: "7px 10px", color: "#e8e4dc", fontSize: "15px",
      outline: "none", textAlign: "center", fontFamily: "inherit",
    },
    setLabel: { fontSize: "11px", color: "#666", textAlign: "center", marginTop: "2px" },
    deleteBtn: {
      background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.2)",
      borderRadius: "8px", padding: "8px 10px", color: "#ff5555",
      cursor: "pointer", fontSize: "14px", flexShrink: 0,
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
                const currentEx = pickerTarget === "editWorkout" ? ewExercise : pickerTarget === "goal" ? goalTargetExercise : ewExercise;
                const sel = currentEx === ex;
                return (
                  <button key={ex} onClick={() => {
                    if (pickerTarget === "editWorkout") setEwExercise(ex);
                    else if (pickerTarget === "goal") setGoalTargetExercise(ex);
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
                const currentEx = pickerTarget === "editWorkout" ? ewExercise : pickerTarget === "goal" ? goalTargetExercise : ewExercise;
                const sel = currentEx === ex.name;
                return (
                  <button key={ex.id} onClick={() => {
                    if (pickerTarget === "editWorkout") setEwExercise(ex.name);
                    else if (pickerTarget === "goal") setGoalTargetExercise(ex.name);
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
    <style>{`
      @keyframes fitforge-marquee {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      @keyframes fitforge-pulse {
        0%   { box-shadow: 0 0 0 0    rgba(255,106,0,0.7); }
        70%  { box-shadow: 0 0 0 14px rgba(255,106,0,0);   }
        100% { box-shadow: 0 0 0 0    rgba(255,106,0,0);   }
      }
    `}</style>
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
          <div style={{ position: "relative", flexShrink: 0 }}>
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
              }}
            >
              {user.photoURL
                ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: "16px" }}>👤</span>
              }
            </button>
            {hasNewChangelog && (
              <div style={{
                position: "absolute", top: "-2px", right: "-2px",
                width: "10px", height: "10px", borderRadius: "50%",
                background: "#ff3b30", border: "2px solid #0a0a0f",
                pointerEvents: "none",
              }} />
            )}
          </div>
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

      {/* Marquee */}
      {(() => {
        const fullText = [...marqueeTexts, ...marqueeTexts].join("  ·  ");
        return (
          <div
            style={{
              position: "relative", overflow: "hidden", height: "28px",
              background: "rgba(255,106,0,0.05)", cursor: "pointer",
              display: "flex", alignItems: "center",
            }}
            onClick={() => { setMarqueeSheet(true); setMarqueePaused(true); }}
            onMouseEnter={() => setMarqueePaused(true)}
            onMouseLeave={() => { if (!marqueeSheet) setMarqueePaused(false); }}
          >
            <span style={{
              display: "inline-block", whiteSpace: "nowrap",
              fontSize: "11.5px", color: "#5a5a5a", letterSpacing: "0.05em",
              animation: "fitforge-marquee 60s linear infinite",
              animationPlayState: marqueePaused ? "paused" : "running",
            }}>
              {fullText}
            </span>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: "36px",
              background: "linear-gradient(to right, #0a0a0f, transparent)",
              pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0, width: "36px",
              background: "linear-gradient(to left, #0a0a0f, transparent)",
              pointerEvents: "none",
            }} />
          </div>
        );
      })()}

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
                  <label style={{ ...styles.label, marginBottom: 0 }}>訓練組數</label>
                  <button style={styles.btnSecondary} onClick={addSet}>+ 新增一組</button>
                </div>
                {wSets.map((s, i) => (
                  <div key={i}>
                    <div style={styles.setRow}>
                      <div style={{ textAlign: "center", color: "#ff6a00", fontWeight: 900, fontSize: "18px", minWidth: "24px", flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div>
                          <input type="number" style={styles.setInput} placeholder="次數 (reps)" value={s.reps} onChange={e => updateSet(i, "reps", e.target.value)} />
                        </div>
                        <div>
                          <input type="number" style={styles.setInput} placeholder="重量 (kg)" value={s.weight} onChange={e => updateSet(i, "weight", e.target.value)} />
                        </div>
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

              {(() => {
                const canSave = canSaveWorkout(wExercise, wSets);
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

            {/* ── 歷史紀錄（合併自原 history tab） ── */}
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
                  );
                });
              })()}
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
                        content={<CustomTooltip />}
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

                {bodyData.slice(0, 5).map((b, i) => {
                  const cfg = metricConfig[activeMetric];
                  const val = parseFloat(b[activeMetric]);
                  const prevVal = parseFloat(bodyData[i - 1]?.[activeMetric]);
                  const hasDiff = i > 0 && !isNaN(val) && !isNaN(prevVal);
                  return (
                    <div key={b.id} style={{ ...styles.workoutItem, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "20px", fontWeight: 900, color: i === 0 ? "#ff6a00" : "#e8e4dc" }}>
                          {b[activeMetric] ? `${b[activeMetric]}${cfg.unit}` : "—"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                          {b.chest && `胸${b.chest} `}{b.waist && `腰${b.waist} `}{b.hip && `臀${b.hip}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "#666" }}>{b.date}</div>
                        {i === 0 && <div style={{ fontSize: "11px", color: "#ff6a00", marginTop: "2px" }}>最新</div>}
                        {hasDiff && (
                          <div style={{ fontSize: "13px", fontWeight: 700, color: val > prevVal ? "#4ade80" : "#f87171" }}>
                            {val > prevVal ? "↓" : "↑"}
                            {Math.abs(val - prevVal).toFixed(1)}{cfg.unit}
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
              </div>
            )}
          </div>
        )}

        {/* GOALS */}
        {tab === "goals" && (
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
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: "center",
          padding: "20px 0 8px",
          marginTop: "8px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{
            fontSize: "12px",
            color: "#444",
            letterSpacing: "0.08em",
            fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
          }}>
            v{APP_VERSION} · Crafted by 47
          </div>
        </div>
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

      {/* FAB */}
      {tab !== "workout" && (
        <button
          style={{
            position: "fixed", bottom: "28px", right: "20px", zIndex: 150,
            width: "56px", height: "56px", borderRadius: "50%", border: "none",
            background: "linear-gradient(135deg, #ff6a00, #ff9500)",
            color: "#fff", fontSize: todayWorked ? "26px" : "22px", cursor: "pointer",
            boxShadow: "0 4px 20px rgba(255,106,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "inherit",
            animation: !todayWorked ? "fitforge-pulse 1.5s ease-out infinite" : "none",
          }}
          onClick={() => {
            setTab("workout");
            setWDate(today);
            setExPickerExpanded(true);
          }}
        >
          {todayWorked ? "+" : "💪"}
        </button>
      )}


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

          {/* Changelog button */}
          <div style={{ padding: "16px 24px 0" }}>
            <button
              style={{
                width: "100%", padding: "13px 16px", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px", background: "rgba(255,255,255,0.04)",
                color: "#e8e4dc", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.02em",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
              onClick={() => {
                setShowMorePanel(false);
                setShowChangelog(true);
                setHasNewChangelog(false);
                localStorage.setItem("last_seen_changelog", APP_VERSION);
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📋 版本更新記錄</span>
                {hasNewChangelog && (
                  <span style={{
                    fontSize: "11px", fontWeight: 800, color: "#fff",
                    background: "#ff3b30", borderRadius: "10px",
                    padding: "2px 7px", letterSpacing: "0.03em",
                  }}>NEW</span>
                )}
              </span>
              <span style={{ color: "#555", fontSize: "18px" }}>›</span>
            </button>
          </div>

          {/* Share button */}
          <div style={{ padding: "12px 24px 0" }}>
            <button
              style={{
                width: "100%", padding: "13px 16px", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px", background: "rgba(255,255,255,0.04)",
                color: shareCopied ? "#4ade80" : "#e8e4dc", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.02em",
                fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "color 0.2s",
              }}
              onClick={shareApp}
            >
              <span>{shareCopied ? "✓ 已複製連結！" : "🔗 分享給好友"}</span>
              {!shareCopied && <span style={{ color: "#555", fontSize: "18px" }}>›</span>}
            </button>
          </div>

          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "16px 24px 0" }} />

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

    {showChangelog && createPortal(
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
        onClick={() => setShowChangelog(false)}
      >
        <div
          style={{
            width: "100%", maxWidth: "480px", maxHeight: "70vh",
            background: "#13131c", borderRadius: "20px 20px 0 0",
            border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
            padding: "0 0 32px", overflowY: "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 10px" }}>
            <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.15)" }} />
          </div>

          <div style={{ padding: "8px 24px 20px" }}>
            <div style={{ fontSize: "18px", fontWeight: 900, color: "#e8e4dc", letterSpacing: "0.05em", textAlign: "center", marginBottom: "24px" }}>
              版本更新記錄
            </div>

            {/* v1.3.9 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.3.9</span>
                <span style={{
                  fontSize: "11px", fontWeight: 800, color: "#ff6a00",
                  background: "rgba(255,106,0,0.15)", border: "1px solid rgba(255,106,0,0.3)",
                  borderRadius: "6px", padding: "2px 7px", letterSpacing: "0.05em",
                }}>最新</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-05</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>儀表板訓練量圖表新增 D / W / M 切換（日 / 週 / 月三種維度）</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>修正 Y 軸數值顯示截斷問題</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.8 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.3.8</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-02</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>首頁跑馬燈恢復常駐顯示，移除今日提醒卡片</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>有氧動作擴充：新增室內健走、慢跑、橢圓機、樓梯機、游泳</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.7 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.3.7</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-02</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>新增 Vitest 單元測試套件（30 個 GWT 測試覆蓋核心業務邏輯）</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.6 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.3.6</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>新增 BMI 目標類型、修正目標進度方向計算、歷史紀錄依週／月分組收合</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.5 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.3.5</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>優化推播通知圖示，Android 狀態列現在顯示正確的 FitForge 圖示</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.4 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.3.4</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>浮動按鈕優化：在訓練日誌頁自動隱藏，已記錄改顯示「+」；動作選擇預設留空並新增禁用驗證</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>組數輸入框版面修正：次數與重量改為上下排列，避免超出畫面</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.3 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.3</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#888", flexShrink: 0 }}>✨</span>
                  <span>目標追蹤頁新用戶引導：首次進入時自動說明四種目標類型與使用方式</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.2 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.2</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>動作選擇器全面升級：搜尋框 + 部位 Tag + 最近使用，一鍵找到想練的動作</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>自訂動作整合進「自訂」Tag，直接在選擇器內新增 / 刪除</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>浮動按鈕升級：今日已訓練改顯示「✓」，點擊直接進入訓練日誌並展開動作選擇</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.1 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.1</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>新版本通知：頭像紅點提示 + More Panel 內 NEW badge，有更新時自動提醒</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.0 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.0</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>訓練日誌：合併訓練記錄與歷史紀錄，一頁完成新增與管理</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>目標追蹤：設定體重、訓練頻率、動作重量、身材圍度目標，自動追蹤進度，達標觸發慶祝動畫</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.6 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.6</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>BMI 目標體重提示，一眼知道還差幾公斤達標準</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>BMI 歷史趨勢折線，附 18.5 / 24 標準參考線</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.5 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.5</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-01</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>移除右下角重複的浮動按鈕，介面更簡潔</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.4 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.4</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-28</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>頂部跑馬燈公告，支援遠端動態設定內容</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>今日未記錄時顯示浮動脈衝提示按鈕</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.3 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.3</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-28</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>App 底部加入版本號與版權聲明</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.2 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.2</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-28</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>修正身材數據同日多筆重複問題，改用日期為唯一鍵值（覆蓋式寫入）</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.1 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.1</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-28</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>身材趨勢圖 x 軸日期排序修正，補記過去資料不再亂序</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>身材紀錄漲跌箭頭與顏色方向修正</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>同日期身材數據改為覆蓋機制，自動帶入舊資料並提示覆蓋</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.2.0 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.2.0</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-27</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>動作個人最高紀錄（PR）追蹤，破紀錄即時金色提示</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>儀表板週訓練量趨勢圖，8 週進度一覽</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.1.0 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.1.0</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-27</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>身材趨勢折線圖</span>
                </div>
                <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>訓練紀錄與身材紀錄可編輯、刪除</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.0.0 */}
            <div style={{ marginBottom: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.0.0</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-02-24</span>
              </div>
              <div style={{ fontSize: "14px", color: "#888", display: "flex", gap: "8px" }}>
                <span style={{ flexShrink: 0 }}>•</span>
                <span>初始版本上線</span>
              </div>
            </div>

            <button
              style={{
                width: "100%", padding: "13px", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "12px", background: "transparent",
                color: "#888", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
              }}
              onClick={() => setShowChangelog(false)}
            >
              關閉
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

    {/* Marquee Bottom Sheet */}
    {marqueeSheet && createPortal(
      <div
        style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.65)" }}
        onClick={() => { setMarqueeSheet(false); setMarqueePaused(false); }}
      >
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: "#13131c", borderRadius: "20px 20px 0 0",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "16px 24px 40px",
            maxHeight: "70vh", overflowY: "auto",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <div style={{ width: "40px", height: "4px", borderRadius: "2px",
              background: "rgba(255,255,255,0.15)", margin: "0 auto" }} />
          </div>
          <div style={{
            fontSize: "13px", fontWeight: 800, color: "#555",
            letterSpacing: "0.08em", marginBottom: "16px",
            fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
          }}>
            今日勵志語句
          </div>
          {marqueeTexts.map((text, i) => (
            <div key={i} style={{
              fontSize: "14px", color: "#c8c4bc", lineHeight: "1.75",
              padding: "12px 0",
              borderBottom: i < marqueeTexts.length - 1
                ? "1px solid rgba(255,255,255,0.05)" : "none",
              fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
            }}>
              {text}
            </div>
          ))}
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
    {showNotifBanner && createPortal(
      <div style={{
        position: "fixed", bottom: "72px", left: "50%", transform: "translateX(-50%)",
        zIndex: 9990, width: "calc(100% - 32px)", maxWidth: "400px",
        background: "#13131c",
        border: "1px solid rgba(255,106,0,0.35)",
        borderRadius: "16px",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        fontFamily: "'Barlow Condensed','Noto Sans TC',sans-serif",
      }}>
        <span style={{ fontSize: "22px", flexShrink: 0 }}>🔔</span>
        <div style={{ flex: 1, fontSize: "13px", color: "#b0aba3", lineHeight: "1.5" }}>
          開啟通知，3天未訓練時提醒你回來
        </div>
        <button
          onClick={requestNotificationPermission}
          style={{
            flexShrink: 0, padding: "7px 14px", border: "none", borderRadius: "10px",
            background: "linear-gradient(135deg,#ff6a00,#ff9500)",
            color: "#fff", fontSize: "13px", fontWeight: 800, cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          開啟
        </button>
        <button
          onClick={dismissNotifBanner}
          style={{
            flexShrink: 0, padding: "7px 10px", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px", background: "transparent",
            color: "#888", fontSize: "13px", cursor: "pointer",
          }}
        >
          不了
        </button>
      </div>,
      document.body
    )}
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
