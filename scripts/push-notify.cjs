#!/usr/bin/env node
// Usage: node scripts/push-notify.js "<title>" "<body>"
// Broadcasts an FCM push notification to all registered users.
// Uses the stored firebase-tools OAuth token — no service account key needed.

const https = require("https");
const os = require("os");
const path = require("path");
const fs = require("fs");

const PROJECT_ID = "fitnesswith47";
const ICON_URL = "https://fitnesswith47.web.app/icons/icon-192.png";
const BADGE_URL = "https://fitnesswith47.web.app/icons/badge-72.png";
const APP_URL = "https://fitnesswith47.web.app";

// ── helpers ────────────────────────────────────────────────────────────────

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function getStoredToken() {
  const configPath = path.join(
    os.homedir(),
    ".config/configstore/firebase-tools.json"
  );
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const token = config?.tokens?.access_token;
  if (!token) throw new Error("No stored Firebase access token found. Run: firebase login");
  return token;
}

// ── Firestore: read all userPushTokens ────────────────────────────────────

async function getAllTokenDocs(authToken) {
  const result = [];
  let pageToken = null;

  do {
    const queryParams = pageToken ? `?pageToken=${pageToken}` : "";
    const res = await httpsRequest({
      hostname: "firestore.googleapis.com",
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/userPushTokens${queryParams}`,
      method: "GET",
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (res.status !== 200) {
      throw new Error(`Firestore error ${res.status}: ${JSON.stringify(res.body)}`);
    }

    const docs = res.body.documents || [];
    for (const doc of docs) {
      const fields = doc.fields || {};
      const fcmToken = fields.fcmToken?.stringValue;
      if (fcmToken) {
        result.push({ docName: doc.name, fcmToken });
      }
    }
    pageToken = res.body.nextPageToken || null;
  } while (pageToken);

  return result;
}

// ── FCM v1: send to single token ──────────────────────────────────────────

async function sendToToken(authToken, fcmToken, title, body) {
  const payload = JSON.stringify({
    message: {
      token: fcmToken,
      notification: { title, body },
      webpush: {
        notification: {
          icon: ICON_URL,
          badge: BADGE_URL,
          tag: "fitforge-version-update",
        },
        fcmOptions: { link: APP_URL },
      },
    },
  });

  return httpsRequest(
    {
      hostname: "fcm.googleapis.com",
      path: `/v1/projects/${PROJECT_ID}/messages:send`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    payload
  );
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const [, , title, body] = process.argv;
  if (!title || !body) {
    console.error('Usage: node scripts/push-notify.js "<title>" "<body>"');
    process.exit(1);
  }

  console.log(`\n📣 Broadcasting FCM notification`);
  console.log(`   Title: ${title}`);
  console.log(`   Body:  ${body}\n`);

  const authToken = getStoredToken();
  const tokenDocs = await getAllTokenDocs(authToken);
  console.log(`Found ${tokenDocs.length} registered token(s)\n`);

  let sent = 0, failed = 0, stale = 0;

  for (const { docName, fcmToken } of tokenDocs) {
    const res = await sendToToken(authToken, fcmToken, title, body);
    if (res.status === 200) {
      sent++;
    } else {
      const errCode = res.body?.error?.details?.[0]?.errorCode || res.body?.error?.status;
      const staleErrors = ["UNREGISTERED", "INVALID_ARGUMENT"];
      if (staleErrors.includes(errCode)) {
        stale++;
        // Optionally delete stale token via Firestore REST
      } else {
        failed++;
        console.warn(`  ⚠ Failed (${errCode}) for token: ${fcmToken.substring(0, 20)}...`);
      }
    }
  }

  console.log(`\n✅ Done — sent: ${sent}, stale/skipped: ${stale}, failed: ${failed}`);
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
