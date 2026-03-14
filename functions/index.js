const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const Anthropic = require('@anthropic-ai/sdk');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS    = 1 * 24 * 60 * 60 * 1000;
const MESSAGES = [
  { title: '💪 FitForge — 該訓練了！', body: '已經3天沒動了，身體在等你回來。今天就去做一組！' },
  { title: '🔥 別讓訓練中斷！',        body: '你的健身目標還在等你，現在打開記錄繼續保持！' },
  { title: '⚡ FitForge 提醒你',       body: '3天了，該回到訓練了。每一組都是投資未來的自己。' },
  { title: '🏋️ 訓練計畫在等你',       body: '持續才是力量的來源，今天記錄你的訓練吧！' },
];

exports.generateFitnessComment = onCall(
  { region: 'asia-east1', memory: '256MiB' },
  async (request) => {
    const { streak, lastDate, recentCount, todayStr, exercise, exerciseHistory } = request.data;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let content;
    if (exercise) {
      const histStr = (exerciseHistory || [])
        .map(r => `${r.date}: ${JSON.stringify(r.sets)}`)
        .join('\n');
      content = `你是健身 AI 教練，用繁體中文回覆，2到3句話，針對用戶的「${exercise}」訓練紀錄給出具體評價或建議。\n歷史紀錄（最近）：\n${histStr || '尚無紀錄'}\n只輸出評語本身，不要多餘說明。`;
    } else {
      content = `你是一個健身 App 的評語生成器，用繁體中文回覆。
根據以下數據生成一句評語（30-60字），口吻隨機在「熱情稱讚」或「嚴格教練告誡」之間切換：
- 連續訓練天數：${streak} 天
- 最近訓練日期：${lastDate || '無'}
- 近 30 天訓練天數：${recentCount} 天
- 今天：${todayStr}
只輸出評語本身，不要多餘說明。`;
    }
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content }],
    });
    return { comment: message.content[0].text };
  }
);

exports.sendWorkoutReminders = onSchedule(
  { schedule: '0 12 * * *', timeZone: 'UTC', region: 'asia-east1', memory: '256MiB' },
  async () => {
    const now = Date.now();
    const threeDaysAgo   = new Date(now - THREE_DAYS_MS).toISOString().slice(0, 10);
    const threeDaysAgoTs = Timestamp.fromMillis(now - THREE_DAYS_MS);
    const oneDayAgoTs    = Timestamp.fromMillis(now - ONE_DAY_MS);

    const snapshot = await db.collection('userPushTokens').get();
    const sends = [];

    for (const docSnap of snapshot.docs) {
      const { fcmToken, lastActiveAt, lastWorkoutDate, lastNotifiedAt } = docSnap.data();
      if (!fcmToken) continue;
      if (lastNotifiedAt?.toMillis() > oneDayAgoTs.toMillis()) continue;  // 24h 去重

      const inactiveApp     = !lastActiveAt    || lastActiveAt.toMillis() < threeDaysAgoTs.toMillis();
      const inactiveWorkout = !lastWorkoutDate || lastWorkoutDate          < threeDaysAgo;
      if (!inactiveApp && !inactiveWorkout) continue;

      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      sends.push(
        getMessaging().send({
          token: fcmToken,
          notification: { title: msg.title, body: msg.body },
          webpush: {
            notification: { icon: 'https://fitnesswith47.web.app/icons/icon-192.png',
                            badge: 'https://fitnesswith47.web.app/icons/badge-72.png',
                            tag: 'fitforge-reminder' },
            fcmOptions: { link: 'https://fitnesswith47.web.app' },
          },
        })
        .then(() => docSnap.ref.update({ lastNotifiedAt: Timestamp.now() }))
        .catch(async (err) => {
          const stale = ['messaging/registration-token-not-registered','messaging/invalid-registration-token'];
          if (stale.includes(err.code)) await docSnap.ref.delete();
          else console.error(`FCM error uid=${docSnap.id}:`, err.code);
        })
      );
    }
    await Promise.all(sends);
    console.log(`Processed ${sends.length} tokens`);
  }
);
