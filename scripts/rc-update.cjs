#!/usr/bin/env node
// Usage: node scripts/rc-update.cjs "<title>" "<body>" "<button>"
// Updates Firebase Remote Config popup fields.
// Uses the stored firebase-tools OAuth token — no service account key needed.

const https = require("https");
const os = require("os");
const path = require("path");
const fs = require("fs");

const PROJECT_ID = "fitnesswith47";

function httpsRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, headers: res.headers, body: data }); }
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

async function getCurrentRC(authToken) {
  const res = await httpsRequest({
    hostname: "firebaseremoteconfig.googleapis.com",
    path: `/v1/projects/${PROJECT_ID}/remoteConfig`,
    method: "GET",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (res.status !== 200) throw new Error(`GET RC failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { etag: res.headers.etag, config: res.body };
}

async function updateRC(authToken, etag, title, body, button) {
  const payload = JSON.stringify({
    parameters: {
      popup_enabled: { defaultValue: { value: "true" } },
      popup_title: { defaultValue: { value: title } },
      popup_body: { defaultValue: { value: body } },
      popup_button_text: { defaultValue: { value: button } },
      popup_trigger_type: { defaultValue: { value: "1" } },
      popup_trigger_count: { defaultValue: { value: "1" } },
    },
  });

  const res = await httpsRequest(
    {
      hostname: "firebaseremoteconfig.googleapis.com",
      path: `/v1/projects/${PROJECT_ID}/remoteConfig`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "Content-Length": Buffer.byteLength(payload),
        "If-Match": etag || "*",
      },
    },
    payload
  );
  return res;
}

async function main() {
  const [, , title, body, button] = process.argv;
  if (!title || !body || !button) {
    console.error('Usage: node scripts/rc-update.cjs "<title>" "<body>" "<button>"');
    process.exit(1);
  }

  console.log(`\n🔧 Updating Remote Config`);
  console.log(`   popup_title: ${title}`);
  console.log(`   popup_body:  ${body}`);
  console.log(`   popup_button_text: ${button}\n`);

  const authToken = getStoredToken();
  const { etag, config } = await getCurrentRC(authToken);
  console.log(`   Current etag: ${etag}`);

  // Merge with existing parameters to avoid wiping other keys
  const merged = {
    ...(config.parameters || {}),
    popup_enabled: { defaultValue: { value: "true" } },
    popup_title: { defaultValue: { value: title } },
    popup_body: { defaultValue: { value: body } },
    popup_button_text: { defaultValue: { value: button } },
    popup_trigger_type: { defaultValue: { value: "1" } },
    popup_trigger_count: { defaultValue: { value: "1" } },
  };

  const payload = JSON.stringify({ ...(config.conditions ? { conditions: config.conditions } : {}), parameters: merged });
  const res = await httpsRequest(
    {
      hostname: "firebaseremoteconfig.googleapis.com",
      path: `/v1/projects/${PROJECT_ID}/remoteConfig`,
      method: "PUT",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "Content-Length": Buffer.byteLength(payload),
        "If-Match": etag || "*",
      },
    },
    payload
  );

  if (res.status === 200) {
    console.log(`✅ Remote Config updated successfully`);
  } else {
    console.error(`⚠️  Remote Config update failed: ${res.status} ${JSON.stringify(res.body)}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });
