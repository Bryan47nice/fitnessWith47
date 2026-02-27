importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA_0fP855R73MPxD3mKfMOkErfMCmSbBJY",
  authDomain: "fitnesswith47.firebaseapp.com",
  projectId: "fitnesswith47",
  messagingSenderId: "543136136479",
  appId: "1:543136136479:web:1af5079f08284deeef842a",
});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title || 'FitForge', {
    body: body || '記得今天訓練了嗎？',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'fitforge-reminder',
    data: { url: 'https://fitnesswith47.web.app' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://fitnesswith47.web.app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
