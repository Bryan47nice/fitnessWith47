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
  getWeekStart, calcBMI,
  getGoalProgress as _getGoalProgress,
  detectNewPR,
} from "../utils/fitforge.utils.js";
import styles from "../styles/fitforge.styles.js";
import DashboardTab from "./tabs/DashboardTab.jsx";
import WorkoutTab from "./tabs/WorkoutTab.jsx";
import BodyTab from "./tabs/BodyTab.jsx";
import GoalsTab from "./tabs/GoalsTab.jsx";

const APP_VERSION = "1.4.5";

const exerciseCategories = [
  { label: "胸", exercises: ["臥推", "上斜臥推", "雙槓撐體", "飛鳥", "胸推機", "蝴蝶機", "伏地挺身"] },
  { label: "背", exercises: ["引體向上", "划船", "滑輪下拉", "單手啞鈴划船", "坐姿划船機"] },
  { label: "肩", exercises: ["肩推", "側平舉", "前平舉", "面拉"] },
  { label: "腿", exercises: ["深蹲", "硬舉", "腿推", "腿彎舉", "腿伸展", "保加利亞分腿蹲", "啞鈴弓箭步"] },
  { label: "手臂", exercises: ["二頭彎舉", "三頭下壓"] },
  { label: "核心", exercises: ["棒式", "捲腹", "俄羅斯轉體"] },
  { label: "有氧", exercises: ["跑步機", "慢跑", "室內健走", "橢圓機", "樓梯機", "騎車", "跳繩", "游泳"] },
];

const INCLINE_EXERCISES = ["跑步機", "慢跑", "室內健走", "橢圓機"];

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
  const [wCalories, setWCalories] = useState("");
  const [batchReps, setBatchReps] = useState("");
  const [batchWeight, setBatchWeight] = useState("");
  const [batchCount, setBatchCount] = useState(3);
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
  const [ewCalories, setEwCalories] = useState("");
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

  function addSet() {
    const empty = isCardio(wExercise)
      ? { duration: "", speed: "", incline: "" }
      : { reps: "", weight: "" };
    setWSets([...wSets, empty]);
  }
  function removeSet(i) { setWSets(wSets.filter((_, idx) => idx !== i)); }
  function updateSet(i, field, val) {
    const s = [...wSets]; s[i] = { ...s[i], [field]: val }; setWSets(s);
  }

  function batchAddSets() {
    const n = Math.min(Math.max(parseInt(batchCount) || 1, 1), 10);
    const newSets = Array.from({ length: n }, () =>
      isCardio(wExercise)
        ? { duration: batchReps, speed: batchWeight, incline: "" }
        : { reps: batchReps, weight: batchWeight }
    );
    setWSets([...wSets, ...newSets]);
    setBatchReps(""); setBatchWeight(""); setBatchCount(3);
  }

  async function saveWorkout() {
    const name = wExercise;
    const isNewPR = !isCardio(name) && detectNewPR(name, wSets, prMap);
    const docData = { date: wDate, exercise: name, sets: wSets, note: wNote, createdAt: serverTimestamp() };
    if (wCalories !== "") docData.calories = parseFloat(wCalories);
    await addDoc(collection(db, "users", user.uid, "workouts"), docData);
    setDoc(doc(db, "userPushTokens", user.uid), { lastWorkoutDate: wDate }, { merge: true }).catch(() => {});
    setWSets(isCardio(name) ? [{ duration: "", speed: "", incline: "" }] : [{ reps: "", weight: "" }]);
    setWNote("");
    setWCalories("");
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
  function ewAddSet() {
    const empty = isCardio(ewExercise)
      ? { duration: "", speed: "", incline: "" }
      : { reps: "", weight: "" };
    setEwSets([...ewSets, empty]);
  }
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
    setEwCalories(workout.calories != null ? String(workout.calories) : "");
    setShowEditWorkout(true);
  }

  function closeEditWorkout() {
    setShowEditWorkout(false);
    setEditWorkoutId(null);
    setEwDate(""); setEwExercise("");
    setEwSets([{ reps: "", weight: "" }]);
    setEwNote(""); setEwCalories(""); setEditSavedAnim(false);
  }

  async function saveEditWorkout() {
    if (!editWorkoutId) return;
    const name = ewExercise;
    const isNewPR = !isCardio(name) && detectNewPR(name, ewSets, prMap);
    const updateData = { date: ewDate, exercise: ewExercise, sets: ewSets, note: ewNote };
    if (ewCalories !== "") updateData.calories = parseFloat(ewCalories);
    await updateDoc(
      doc(db, "users", user.uid, "workouts", editWorkoutId),
      updateData
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

  const latestBody = bodyData[0];
  const existingBodyForDate = bodyData.find(b => b.date === bDate) || null;
  const latestBMI = calcBMI(latestBody?.weight, latestBody?.height);

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

  const getGoalProgress = (goal) =>
    _getGoalProgress(goal, { latestBody, latestBMI, workouts, prMap, today });

  function getCategoryForExercise(name) {
    for (const cat of exerciseCategories) {
      if (cat.exercises.includes(name)) return cat.label;
    }
    if (customExercises.some(e => e.name === name)) return "自訂";
    return "";
  }

  const isCardio = (name) => getCategoryForExercise(name) === "有氧";
  const showIncline = (name) => INCLINE_EXERCISES.includes(name);

  function toMinPerKm(kmh) {
    if (!kmh || isNaN(kmh)) return null;
    const total = 60 / parseFloat(kmh);
    const min = Math.floor(total);
    const sec = Math.round((total - min) * 60);
    return `${min}:${String(sec).padStart(2, "0")} /km`;
  }

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

      <div style={styles.stickyHeader}>
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
          <div style={styles.streakBadge(streak.count)}>
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
      </div>{/* /stickyHeader */}

      <div style={styles.content}>

        {tab === "dashboard" && (
          <DashboardTab
            workouts={workouts}
            bodyData={bodyData}
            prMap={prMap}
            volumePeriod={volumePeriod}
            setVolumePeriod={setVolumePeriod}
            streak={streak}
          />
        )}

        {tab === "workout" && (
          <WorkoutTab
            workouts={workouts}
            customExercises={customExercises}
            pickerDisplayList={pickerDisplayList}
            recentExercises={recentExercises}
            wDate={wDate} setWDate={setWDate}
            wExercise={wExercise} setWExercise={setWExercise}
            wSets={wSets} setWSets={setWSets}
            wNote={wNote} setWNote={setWNote}
            wCalories={wCalories} setWCalories={setWCalories}
            batchReps={batchReps} setBatchReps={setBatchReps}
            batchWeight={batchWeight} setBatchWeight={setBatchWeight}
            batchCount={batchCount} setBatchCount={setBatchCount}
            savedAnim={savedAnim}
            exPickerExpanded={exPickerExpanded} setExPickerExpanded={setExPickerExpanded}
            exSearchQuery={exSearchQuery} setExSearchQuery={setExSearchQuery}
            exActiveTag={exActiveTag} setExActiveTag={setExActiveTag}
            showAddCustomEx={showAddCustomEx} setShowAddCustomEx={setShowAddCustomEx}
            newExName={newExName} setNewExName={setNewExName}
            historyGroupMode={historyGroupMode} setHistoryGroupMode={setHistoryGroupMode}
            expandedGroupKeys={expandedGroupKeys} setExpandedGroupKeys={setExpandedGroupKeys}
            saveWorkout={saveWorkout}
            addSet={addSet}
            updateSet={updateSet}
            removeSet={removeSet}
            batchAddSets={batchAddSets}
            deleteWorkout={deleteWorkout}
            openEditWorkout={openEditWorkout}
            addCustomExercise={addCustomExercise}
            deleteCustomExercise={deleteCustomExercise}
            setConfirmDialog={setConfirmDialog}
            streak={streak}
          />
        )}

        {tab === "body" && (
          <BodyTab
            bodyData={bodyData}
            existingBodyForDate={existingBodyForDate}
            bDate={bDate} setBDate={setBDate}
            bWeight={bWeight} setBWeight={setBWeight}
            bHeight={bHeight} setBHeight={setBHeight}
            bChest={bChest} setBChest={setBChest}
            bWaist={bWaist} setBWaist={setBWaist}
            bHip={bHip} setBHip={setBHip}
            bArm={bArm} setBArm={setBArm}
            bThigh={bThigh} setBThigh={setBThigh}
            activeMetric={activeMetric} setActiveMetric={setActiveMetric}
            bSavedAnim={bSavedAnim}
            saveBody={saveBody}
            deleteBodyRecord={deleteBodyRecord}
          />
        )}

        {tab === "goals" && (
          <GoalsTab
            goals={goals}
            today={today}
            getGoalProgress={getGoalProgress}
            showGoalSheet={showGoalSheet} setShowGoalSheet={setShowGoalSheet}
            goalType={goalType} setGoalType={setGoalType}
            goalTargetValue={goalTargetValue} setGoalTargetValue={setGoalTargetValue}
            goalTargetExercise={goalTargetExercise} setGoalTargetExercise={setGoalTargetExercise}
            goalTargetBodyPart={goalTargetBodyPart} setGoalTargetBodyPart={setGoalTargetBodyPart}
            goalDeadline={goalDeadline} setGoalDeadline={setGoalDeadline}
            goalNote={goalNote} setGoalNote={setGoalNote}
            goalCelebAnim={goalCelebAnim}
            latestBMI={latestBMI}
            deleteGoal={deleteGoal}
            saveGoal={saveGoal}
            setPickerTarget={setPickerTarget}
            setShowExPicker={setShowExPicker}
          />
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

            {/* v1.4.5 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#ffd700" }}>v1.4.5</span>
                <span style={{
                  fontSize: "11px", fontWeight: 800, color: "#ff6a00",
                  background: "rgba(255,106,0,0.15)", border: "1px solid rgba(255,106,0,0.3)",
                  borderRadius: "6px", padding: "2px 7px", letterSpacing: "0.05em",
                }}>最新</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-08</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>行事曆標題顯示「共 XX 天」累積訓練天數，格子同一天多筆時右上角顯示數字</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>歷史週/月群組標題顯示組數統計，新增「全展開/收起全部」一鍵按鈕</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>選擇動作後出現「複製上次」捷徑，一鍵帶入上次同動作的組數與重量</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.4.4 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#e8e4dc" }}>v1.4.4</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-08</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#888", flexShrink: 0 }}>•</span>
                  <span>訓練日曆支援週視圖——標題下切換月/週，週模式按週導航</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.4.3 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "17px", fontWeight: 900, color: "#e8e4dc" }}>v1.4.3</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-07</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>訓練日誌新增 Google Calendar 風格行事曆，訓練日橘色圓點高亮</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>點擊日期展開當日訓練紀錄，可切換月份瀏覽歷史</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>AI 教練評語：每日根據訓練數據自動生成稱讚或督促語句</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.4.2 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.4.2</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-07</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>儀表板新增訓練一致性行事曆（4 週格狀，訓練日橘色高亮）</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>儀表板新增 🔥 連續訓練天數顯示</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>統計卡「總組數」改為「本週訓練」次數、PR 區塊可折疊</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>頂部 Header 固定於畫面頂端（sticky）</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.4.1 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.4.1</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-05</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>有氧記錄改為單次平面表單，新增距離欄位，移除組數概念</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>重訓快速新增列改為行內格式（次數 下 × 重量 kg × 組數 組）</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ flexShrink: 0 }}>•</span>
                  <span>修正版本記錄：僅最新版標題顯示金色，舊版改為灰色</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.4.0 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.4.0</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-05</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>有氧動作專屬欄位：時間、配速（即時換算分速）、坡度（跑步機等）</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>批次新增組數：一鍵加入 N 組相同參數，大幅提升記錄效率</span>
                </div>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>新增卡路里欄位：可手動記錄本次訓練消耗熱量</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.9 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.9</span>
                <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>2026-03-05</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <div style={{ fontSize: "14px", color: "#c8c4bc", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#ffd700", flexShrink: 0 }}>✨</span>
                  <span>訓練量圖表升級：支援日 / 週 / 月切換（K 線圖風格），並修正 Y 軸數值截斷</span>
                </div>
              </div>
            </div>

            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginBottom: "20px" }} />

            {/* v1.3.8 */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.8</span>
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
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.7</span>
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
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.6</span>
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
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.5</span>
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
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#888" }}>v1.3.4</span>
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
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ textAlign: "center", color: "#ff6a00", fontWeight: 900, fontSize: "18px", minWidth: "24px", paddingTop: "8px" }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                    {isCardio(ewExercise) ? (
                      <>
                        <input type="number" placeholder="時間 (分鐘)" value={s.duration || ""}
                          onChange={e => ewUpdateSet(i, "duration", e.target.value)}
                          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", color: "#e8e4dc", fontSize: "15px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <div>
                          <input type="number" placeholder="速度 (km/h)" value={s.speed || ""}
                            onChange={e => ewUpdateSet(i, "speed", e.target.value)}
                            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", color: "#e8e4dc", fontSize: "15px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                          />
                          {s.speed && <div style={{ fontSize: "10px", color: "#ff6a00", marginTop: "2px", paddingLeft: "2px" }}>→ {toMinPerKm(s.speed)}</div>}
                        </div>
                        {showIncline(ewExercise) && (
                          <input type="number" placeholder="坡度 (%)" value={s.incline || ""}
                            onChange={e => ewUpdateSet(i, "incline", e.target.value)}
                            style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", color: "#e8e4dc", fontSize: "15px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <input type="number" placeholder="次數 (reps)" value={s.reps || ""}
                          onChange={e => ewUpdateSet(i, "reps", e.target.value)}
                          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", color: "#e8e4dc", fontSize: "15px", outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                        <input type="number" placeholder="重量 (kg)" value={s.weight || ""}
                          onChange={e => ewUpdateSet(i, "weight", e.target.value)}
                          style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px", color: "#e8e4dc", fontSize: "15px", outline: "none", textAlign: "center", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      </>
                    )}
                  </div>
                  {ewSets.length > 1 && (
                    <button
                      style={{
                        background: "rgba(255,50,50,0.15)", border: "1px solid rgba(255,50,50,0.2)",
                        borderRadius: "8px", padding: "8px 10px", color: "#ff5555",
                        cursor: "pointer", fontSize: "14px", flexShrink: 0, marginTop: "2px",
                      }}
                      onClick={() => ewRemoveSet(i)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Calories */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", color: "#888", letterSpacing: "0.06em", marginBottom: "6px", display: "block" }}>消耗卡路里（選填）</label>
              <div style={{ position: "relative" }}>
                <input type="number" placeholder="kcal" value={ewCalories}
                  onChange={e => setEwCalories(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px", color: "#e8e4dc", fontSize: "15px", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                />
                <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: "12px" }}>kcal</span>
              </div>
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
