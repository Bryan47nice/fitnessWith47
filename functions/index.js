const { onSchedule } = require('firebase-functions/v2/scheduler');
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
                            badge: 'https://fitnesswith47.web.app/icons/icon-192.png',
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
