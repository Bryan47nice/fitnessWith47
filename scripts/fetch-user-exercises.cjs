#!/usr/bin/env node
// fetch-user-exercises.cjs — 撈出指定用戶的自訂動作列表
// 用法：node scripts/fetch-user-exercises.cjs
// 需要：firebase CLI 已登入（firebase projects:list 可正常執行）

const https = require("https");
const { execSync } = require("child_process");

const PROJECT_ID = "fitnesswith47";
const TARGET_EMAIL = "bryan472017@gmail.com";

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
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

// ── 取得 Firebase CLI access token ──────────────────────────────────────────

function getAccessToken() {
  try {
    const token = execSync("firebase auth:print-access-token 2>/dev/null", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (!token) throw new Error("empty token");
    return token;
  } catch {
    console.error("❌ 無法取得 Firebase CLI access token，請確認已執行 firebase login");
    process.exit(1);
  }
}

// ── 以 email 查詢 UID ────────────────────────────────────────────────────────

async function getUidByEmail(token, email) {
  const body = JSON.stringify({ email: [email] });
  const res = await request(
    {
      hostname: "identitytoolkit.googleapis.com",
      path: `/v1/projects/${PROJECT_ID}/accounts:lookup`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
    body
  );
  if (res.status !== 200 || !res.body.users?.length) {
    console.error("❌ 找不到用戶：", email, res.body);
    process.exit(1);
  }
  return res.body.users[0].localId;
}

// ── 讀取 Firestore collection ────────────────────────────────────────────────

async function getCustomExercises(token, uid) {
  const path = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/customExercises`;
  const res = await request({
    hostname: "firestore.googleapis.com",
    path,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status !== 200) {
    console.error("❌ Firestore 讀取失敗：", res.body);
    process.exit(1);
  }
  return res.body.documents || [];
}

// ── 解析 Firestore 文件 ──────────────────────────────────────────────────────

function parseDoc(doc) {
  const fields = doc.fields || {};
  return {
    name: fields.name?.stringValue || "",
    category: fields.category?.stringValue || "自訂",
  };
}

// ── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 查詢用戶：${TARGET_EMAIL}\n`);

  const token = getAccessToken();
  const uid = await getUidByEmail(token, TARGET_EMAIL);
  console.log(`✅ UID：${uid}\n`);

  const docs = await getCustomExercises(token, uid);
  if (!docs.length) {
    console.log("⚠️  此用戶沒有自訂動作");
    return;
  }

  const exercises = docs.map(parseDoc).filter(e => e.name);

  // 依分類分組輸出
  const grouped = {};
  for (const ex of exercises) {
    if (!grouped[ex.category]) grouped[ex.category] = [];
    grouped[ex.category].push(ex.name);
  }

  console.log(`📋 共找到 ${exercises.length} 個自訂動作：\n`);
  for (const [cat, names] of Object.entries(grouped)) {
    console.log(`  【${cat}】`);
    names.forEach(n => console.log(`    - ${n}`));
  }

  console.log("\n── 原始陣列格式（方便複製進 constants.js）──");
  for (const [cat, names] of Object.entries(grouped)) {
    console.log(`// ${cat}`);
    console.log(JSON.stringify(names, null, 2));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
