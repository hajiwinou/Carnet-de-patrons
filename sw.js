/* Service worker : permet d'ouvrir l'atelier sans connexion */
var CACHE = 'atelier-tricot-v6';
var CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];
/* Fichiers du site, mis en cache dès l'installation pour le mode hors-ligne */
var LOCAL = [
  './',
  'index.html',
  'styles.css',
  'styles-late.css',
  'app.js',
  'app-late.js',
  'themes/themes.css?v=1.0.1',
  'assets/icons/bookmark.png',
  'assets/icons/calculator.png',
  'assets/icons/camera.png',
  'assets/icons/cat_bag.png',
  'assets/icons/cat_beanie.png',
  'assets/icons/cat_blanket.png',
  'assets/icons/cat_cardigan.png',
  'assets/icons/cat_dress.png',
  'assets/icons/cat_mittens.png',
  'assets/icons/cat_other.png',
  'assets/icons/cat_pants.png',
  'assets/icons/cat_pull.png',
  'assets/icons/cat_scarf.png',
  'assets/icons/cat_shawl.png',
  'assets/icons/cat_skirt.png',
  'assets/icons/cat_socks.png',
  'assets/icons/cat_top.png',
  'assets/icons/cat_vest.png',
  'assets/icons/chart.png',
  'assets/icons/cloud.png',
  'assets/icons/computer.png',
  'assets/icons/folder.png',
  'assets/icons/folder_pixel.png',
  'assets/icons/notebook.png',
  'assets/icons/palette.png',
  'assets/icons/pdf.png',
  'assets/icons/photo.png',
  'assets/icons/recycle.png',
  'assets/icons/search.png',
  'assets/icons/settings.png',
  'assets/icons/sweater.png',
  'assets/icons/yarn.png',
  'assets/island/chat.webp',
  'assets/island/chenille.webp',
  'assets/island/chien.webp',
  'assets/island/etoile.webp',
  'assets/island/mouton.webp',
  'assets/island/narval.webp',
  'assets/island/poulpe.webp',
  'assets/island/tortue.webp',
  'assets/island/tortue2.webp'
];
self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return Promise.all(CDN.concat(LOCAL).map(function(u) { return c.add(u).catch(function() {}); }));
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
