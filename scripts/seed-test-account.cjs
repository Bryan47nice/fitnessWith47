#!/usr/bin/env node
// seed-test-account.cjs — 建立測試帳號並填入驗收用假資料
// 用法：node scripts/seed-test-account.cjs
// 可重複執行（idempotent）— 每次重置資料到初始狀態

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── 設定 ────────────────────────────────────────────────────────────────────

const TEST_EMAIL = "preview@fitforgetest.dev";
const TEST_PASSWORD = "FitForge2026Preview!";
const PROJECT_ID = "fitnesswith47";

// 從 .env 讀取 API Key
const envPath = path.join(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf8");
const apiKeyMatch = envContent.match(/VITE_FIREBASE_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error("❌ 找不到 VITE_FIREBASE_API_KEY"); process.exit(1); }
const API_KEY = apiKeyMatch[1].trim();

// ── HTTP 工具 ────────────────────────────────────────────────────────────────

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function authPost(path, body) {
  return request({
    hostname: "identitytoolkit.googleapis.com",
    path: `/v1/accounts:${path}?key=${API_KEY}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
  }, body);
}

function firestorePut(idToken, docPath, fields) {
  const body = { fields };
  const bodyStr = JSON.stringify(body);
  return request({
    hostname: "firestore.googleapis.com",
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
      "Content-Length": Buffer.byteLength(bodyStr),
    },
  }, body);
}

// ── Firestore 欄位格式 ───────────────────────────────────────────────────────

const str = v => ({ stringValue: String(v) });
const num = v => ({ doubleValue: Number(v) });
const ts = () => ({ timestampValue: new Date().toISOString() });
const arr = vals => ({ arrayValue: { values: vals } });
const map = obj => ({ mapValue: { fields: obj } });

// ── 測試資料定義 ─────────────────────────────────────────────────────────────

function generateBodyData() {
  // 10 筆，橫跨 3 個月，有升有降
  const records = [
    { date: "2026-01-15", weight: 75.2, height: 175, waist: 82, hip: 96, bodyfat: 18.5, muscle_mass: 35.2, visceral_fat: 8 },
    { date: "2026-01-29", weight: 74.8, height: 175, waist: 81, hip: 95, bodyfat: 18.2, muscle_mass: 35.4, visceral_fat: 7 },
    { date: "2026-02-10", weight: 74.1, height: 175, waist: 80, hip: 94, bodyfat: 17.8, muscle_mass: 35.8, visceral_fat: 7 },
    { date: "2026-02-20", weight: 73.9, height: 175, waist: 80, hip: 94, bodyfat: 17.5, muscle_mass: 36.0, visceral_fat: 6 },
    { date: "2026-03-01", weight: 73.5, height: 175, waist: 79, hip: 93, bodyfat: 17.2, muscle_mass: 36.3, visceral_fat: 6 },
    { date: "2026-03-12", weight: 73.8, height: 175, waist: 79, hip: 93, bodyfat: 17.3, muscle_mass: 36.2, visceral_fat: 6 },
    { date: "2026-03-22", weight: 73.2, height: 175, waist: 78, hip: 92, bodyfat: 17.0, muscle_mass: 36.5, visceral_fat: 5 },
    { date: "2026-04-01", weight: 72.9, height: 175, waist: 78, hip: 92, bodyfat: 16.8, muscle_mass: 36.7, visceral_fat: 5 },
    { date: "2026-04-10", weight: 72.6, height: 175, waist: 77, hip: 91, bodyfat: 16.5, muscle_mass: 37.0, visceral_fat: 5 },
    { date: "2026-04-17", weight: 72.4, height: 175, waist: 77, hip: 91, bodyfat: 16.3, muscle_mass: 37.2, visceral_fat: 4 },
  ];
  return records.map(r => ({
    docId: r.date,
    fields: {
      date: str(r.date),
      weight: num(r.weight),
      height: num(r.height),
      waist: num(r.waist),
      hip: num(r.hip),
      bodyfat: num(r.bodyfat),
      muscle_mass: num(r.muscle_mass),
      visceral_fat: num(r.visceral_fat),
      createdAt: ts(),
    }
  }));
}

function generateWorkouts() {
  const exercises = [
    { name: "臥推", sets: [[80, 10], [80, 8], [75, 8]] },
    { name: "深蹲", sets: [[100, 8], [100, 8], [90, 10]] },
    { name: "硬舉", sets: [[120, 5], [120, 5], [110, 6]] },
    { name: "肩推", sets: [[50, 10], [50, 9], [45, 10]] },
    { name: "引體向上", sets: [[0, 8], [0, 7], [0, 6]] },
    { name: "跑步", sets: [[0, 30]] }, // 有氧：0kg, 30 min
    { name: "划船機", sets: [[0, 20]] },
  ];

  const dates = [
    "2026-02-17", "2026-02-19", "2026-02-21", "2026-02-24", "2026-02-26",
    "2026-03-01", "2026-03-03", "2026-03-05", "2026-03-08", "2026-03-10",
    "2026-03-12", "2026-03-15", "2026-03-17", "2026-03-19", "2026-03-22",
    "2026-03-24", "2026-03-26", "2026-03-29", "2026-03-31", "2026-04-02",
    "2026-04-04", "2026-04-07", "2026-04-09", "2026-04-11", "2026-04-14",
    "2026-04-16", "2026-04-16", "2026-04-17", "2026-04-17", "2026-04-18",
  ];

  return dates.map((date, i) => {
    const ex = exercises[i % exercises.length];
    const setsVal = ex.sets.map(([kg, reps]) => map({ weight: num(kg), reps: num(reps) }));
    return {
      fields: {
        date: str(date),
        exercise: str(ex.name),
        sets: arr(setsVal),
        note: str(""),
        createdAt: ts(),
      }
    };
  });
}

function generateGoals() {
  // 最新體重 72.4kg，腰圍 77cm，深蹲 PR 100kg（來自 workouts seed 資料）
  return [
    // 體重減重：start 75.2 → target 72.3，current 72.4 → 進度 ~96.6%（接近達標）
    {
      docId: "test-goal-001",
      fields: {
        type: str("weight"),
        startValue: num(75.2),
        targetValue: num(72.3),
        goalDirection: str("decrease"),
        deadline: str("2026-05-31"),
        note: str("春季減重計畫"),
        celebrated: { booleanValue: false },
        completedAt: { nullValue: null },
        createdAt: ts(),
      }
    },
    // 深蹲 PR：start 90 → target 101，current PR 100kg → 進度 ~90.9%（接近達標）
    {
      docId: "test-goal-002",
      fields: {
        type: str("exercise_pr"),
        startValue: num(90),
        targetValue: num(101),
        goalDirection: str("increase"),
        targetExercise: str("深蹲"),
        deadline: str("2026-06-30"),
        note: str("突破深蹲 100kg"),
        celebrated: { booleanValue: false },
        completedAt: { nullValue: null },
        createdAt: ts(),
      }
    },
    // 訓練頻率：每週 4 天目標（進行中，非接近達標，用於對比）
    {
      docId: "test-goal-003",
      fields: {
        type: str("frequency"),
        startValue: num(0),
        targetValue: num(4),
        goalDirection: str("increase"),
        frequencyMode: str("weekly"),
        deadline: str("2026-12-31"),
        note: str(""),
        celebrated: { booleanValue: false },
        completedAt: { nullValue: null },
        createdAt: ts(),
      }
    },
  ];
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔐 建立 / 登入測試帳號...");

  // Step 1: 嘗試建立帳號
  let idToken, uid;
  const signUp = await authPost("signUp", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    returnSecureToken: true,
  });

  if (signUp.status === 200) {
    idToken = signUp.body.idToken;
    uid = signUp.body.localId;
    console.log("✅ 帳號建立成功");
  } else if (signUp.body?.error?.message === "EMAIL_EXISTS") {
    // 帳號已存在，改為登入
    const signIn = await authPost("signInWithPassword", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      returnSecureToken: true,
    });
    if (signIn.status !== 200) {
      console.error("❌ 登入失敗：", signIn.body);
      process.exit(1);
    }
    idToken = signIn.body.idToken;
    uid = signIn.body.localId;
    console.log("✅ 帳號已存在，登入成功");
  } else {
    console.error("❌ 建立帳號失敗：", signUp.body);
    process.exit(1);
  }

  console.log(`   UID: ${uid}`);
  const base = `users/${uid}`;

  // Step 2: 寫入 bodyData（10 筆）
  console.log("\n📊 寫入身材記錄（10 筆）...");
  const bodyRecords = generateBodyData();
  for (const rec of bodyRecords) {
    const res = await firestorePut(idToken, `${base}/bodyData/${rec.docId}`, rec.fields);
    if (res.status !== 200) console.warn(`  ⚠️ bodyData/${rec.docId} 失敗：`, res.body?.error?.message);
    else process.stdout.write(".");
  }
  console.log(" ✅");

  // Step 3: 寫入 workouts（30 筆）
  console.log("💪 寫入訓練記錄（30 筆）...");
  const workouts = generateWorkouts();
  for (let i = 0; i < workouts.length; i++) {
    const docId = `test-workout-${String(i).padStart(3, "0")}`;
    const res = await firestorePut(idToken, `${base}/workouts/${docId}`, workouts[i].fields);
    if (res.status !== 200) console.warn(`  ⚠️ workout-${i} 失敗：`, res.body?.error?.message);
    else process.stdout.write(".");
  }
  console.log(" ✅");

  // Step 4: meta/streak
  console.log("🔥 寫入 streak...");
  await firestorePut(idToken, `${base}/meta/streak`, {
    count: num(7),
    lastDate: str("2026-04-18"),
  });
  console.log("✅");

  // Step 5: customExercises
  console.log("🏷️  寫入自訂動作...");
  await firestorePut(idToken, `${base}/customExercises/test-custom-001`, {
    name: str("壺鈴擺盪"),
    createdAt: ts(),
  });
  await firestorePut(idToken, `${base}/customExercises/test-custom-002`, {
    name: str("TRX 划船"),
    createdAt: ts(),
  });
  console.log("✅");

  // Step 6: coachDays + coachQuota
  console.log("🎓 寫入教練課記錄...");
  for (const d of ["2026-03-10", "2026-03-24", "2026-04-07"]) {
    await firestorePut(idToken, `${base}/coachDays/${d}`, {
      date: str(d),
      createdAt: ts(),
    });
  }
  await firestorePut(idToken, `${base}/meta/coachQuota`, { total: num(18) });
  console.log("✅");

  // Step 7: goals（含兩個接近達標的目標，用於驗收「快到了 🎯」徽章）
  console.log("🎯 寫入目標記錄（3 筆）...");
  const goals = generateGoals();
  for (const goal of goals) {
    const res = await firestorePut(idToken, `${base}/goals/${goal.docId}`, goal.fields);
    if (res.status !== 200) console.warn(`  ⚠️ goals/${goal.docId} 失敗：`, res.body?.error?.message);
    else process.stdout.write(".");
  }
  console.log(" ✅");

  // 完成
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Test account ready!

   Email:    ${TEST_EMAIL}
   Password: ${TEST_PASSWORD}
   UID:      ${uid}

   Data seeded:
   - 10 bodyData records（橫跨 3 個月）
   - 30 workout records（臥推/深蹲/硬舉/跑步...）
   - streak: 7 天
   - 2 customExercises
   - 3 coachDays
   - 3 goals（體重減重 ~97%、深蹲 PR ~91%、訓練頻率進行中）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch(err => { console.error("❌ 錯誤：", err); process.exit(1); });
