/* Boutons du haut « vivants » : l'appui se voit, même sur un tap rapide. */
(function() {
  var cur = null;
  function clear() { if (cur) { cur.classList.remove('is-pressed'); cur = null; } }
  document.addEventListener('pointerdown', function(e) {
    var b = e.target.closest && e.target.closest('.dream-quick-actions button');
    if (!b) return;
    clear(); cur = b; b.classList.add('is-pressed');
  }, true);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function(ev) {
    document.addEventListener(ev, function() { setTimeout(clear, 140); }, true);
  });
  document.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('.dream-quick-actions button');
    if (!b) return;
    if (b.dataset.go) { delete b.dataset.go; return; }
    e.stopImmediatePropagation(); e.preventDefault();
    b.classList.add('is-pressed');
    setTimeout(function() { if (b.isConnected) { b.dataset.go = '1'; b.click(); } }, 130);
  }, true);
})();
