/* ==========================================================
   Service Worker — 離線支援

   網路優先、離線才回退快取。理由寫在 js/app.js 的註解裡。
   改動任何 SHELL 裡的檔案時記得把 VERSION 往上加，否則舊快取不會被清掉。
   ========================================================== */

const VERSION = 'v2';
const CACHE = 'timeline-' + VERSION;

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './ui-tokens.css',
  './style.css',
  './js/state.js',
  './js/storage.js',
  './js/ui.js',
  './js/timeline.js',
  './js/events.js',
  './js/theme.js',
  './js/io.js',
  './js/app.js',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* 個別加入而不是 addAll：任何一個檔案失敗都會讓 addAll 整批拒絕，
         導致 service worker 裝不起來，離線功能整個沒有。 */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () { /* 單一檔案失敗不影響其他 */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name !== CACHE) return caches.delete(name);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;
  // 只處理自家的 GET。跨網域（字型等）一律放行讓瀏覽器自己處理。
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      // 只快取正常的同源回應，不要把錯誤頁或不透明回應存進去
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
