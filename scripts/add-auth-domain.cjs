#!/usr/bin/env node
// add-auth-domain.cjs — 自動將 Firebase Hosting Preview 網域加入 Firebase Auth 授權清單
// 用法：node scripts/add-auth-domain.cjs <domain> [<domain2> ...]
// 環境變數：FIREBASE_TOKEN（firebase login:ci 產生的 refresh token）

const https = require("https");

const PROJECT_ID = "fitnesswith47";
const CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const res = await request({
    hostname: "oauth2.googleapis.com",
    path: "/token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }, body);

  if (!res.access_token) throw new Error(`取得 access token 失敗：${JSON.stringify(res)}`);
  return res.access_token;
}

async function getAuthorizedDomains(accessToken) {
  const res = await request({
    hostname: "identitytoolkit.googleapis.com",
    path: `/admin/v2/projects/${PROJECT_ID}/config`,
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.error) throw new Error(`取得授權網域失敗：${JSON.stringify(res.error)}`);
  return res.authorizedDomains || [];
}

async function setAuthorizedDomains(accessToken, domains) {
  const body = JSON.stringify({ authorizedDomains: domains });
  const res = await request({
    hostname: "identitytoolkit.googleapis.com",
    path: `/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains`,
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  }, body);
  if (res.error) throw new Error(`更新授權網域失敗：${JSON.stringify(res.error)}`);
  return res;
}

async function main() {
  const newDomains = process.argv.slice(2);
  if (newDomains.length === 0) {
    console.error("用法：node scripts/add-auth-domain.cjs <domain> [<domain2> ...]");
    process.exit(1);
  }

  const refreshToken = process.env.FIREBASE_TOKEN;
  if (!refreshToken) {
    console.error("❌ 環境變數 FIREBASE_TOKEN 未設定");
    process.exit(1);
  }

  const accessToken = await getAccessToken(refreshToken);
  const current = await getAuthorizedDomains(accessToken);

  const toAdd = newDomains.filter(d => !current.includes(d));
  if (toAdd.length === 0) {
    console.log("✅ 所有網域已在授權清單中，無需更新");
    return;
  }

  const updated = [...current, ...toAdd];
  await setAuthorizedDomains(accessToken, updated);
  toAdd.forEach(d => console.log(`✅ 已加入授權網域：${d}`));
}

main().catch(e => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
