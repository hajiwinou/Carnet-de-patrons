/* Service worker : permet d'ouvrir l'atelier sans connexion */
var CACHE = 'atelier-tricot-v1';
var CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return Promise.all(CDN.map(function(u) { return c.add(u).catch(function() {}); }));
  }));
});
self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  var isCdn = CDN.indexOf(r.url) >= 0;
  if (u.origin !== location.origin && !isCdn) return;
  if (isCdn) {
    e.respondWith(caches.match(r.url).then(function(m) { return m || fetch(r); }));
    return;
  }
  e.respondWith(fetch(r).then(function(res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(CACHE).then(function(c) { c.put(r, cp); }); }
    return res;
  }).catch(function() { return caches.match(r, { ignoreSearch: true }); }));
});
