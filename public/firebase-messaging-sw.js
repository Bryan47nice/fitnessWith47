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
    badge: '/icons/badge-72.png',
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

// ── Widget support ────────────────────────────────────────────────────────

// IndexedDB helpers for widget data
function openWidgetDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fitforge-widget', 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore('data');
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function saveWidgetData(data) {
  return openWidgetDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite');
    tx.objectStore('data').put(data, 'widget');
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  }));
}

function getWidgetData() {
  return openWidgetDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction('data', 'readonly').objectStore('data').get('widget');
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror = (e) => reject(e.target.error);
  }));
}

// Intercept /widget-data.json and serve from IndexedDB
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).pathname === '/widget-data.json') {
    event.respondWith(
      getWidgetData().then(data => new Response(
        JSON.stringify(data || { nextClassTitle: '尚無課程', nextClassTime: '', daysUntil: '—', streak: 0, todayStatus: '' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
  }
});

// Push widget data to Chrome widget engine
async function updateWidget() {
  if (!self.widgets) return;
  const data = await getWidgetData();
  if (!data) return;
  await self.widgets.updateByTag('fitforge-overview', { data: JSON.stringify(data) });
}

// Widget lifecycle events
self.addEventListener('widgetinstall', (event) => { event.waitUntil(updateWidget()); });
self.addEventListener('widgetresume',  (event) => { event.waitUntil(updateWidget()); });
self.addEventListener('widgetupdate',  (event) => { event.waitUntil(updateWidget()); });

// Receive widget data from React app via postMessage
self.addEventListener('message', (event) => {
  if (event.data?.type === 'WIDGET_DATA') {
    const payload = event.data.payload;
    event.waitUntil(
      saveWidgetData(payload).then(() => updateWidget())
    );
  }
});
