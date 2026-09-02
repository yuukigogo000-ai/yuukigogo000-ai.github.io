/* HONMONO 共通シェル: ヘッダーのメニュー開閉だけを受け持つ。
 *
 * ここに画面固有のロジックを足さないこと。
 * メニューの中身は各ページのHTMLに静的に書いてある(JSが動かなくてもリンクは辿れる)。
 */
/* 横に切れている表にだけ、スクロールできる目印を出す。
   中身は変えない。出せるかどうかを実測して切り替えるだけ。 */
(function () {
  'use strict';
  function markScrollables() {
    var wraps = document.querySelectorAll('.scroll-wrap');
    for (var i = 0; i < wraps.length; i++) {
      var box = wraps[i].querySelector('.scroll');
      if (!box) continue;
      wraps[i].classList.toggle('is-scrollable', box.scrollWidth > box.clientWidth + 1);
    }
  }
  markScrollables();
  window.addEventListener('resize', markScrollables);
  window.addEventListener('load', markScrollables);
})();

(function () {
  'use strict';

  var btn = document.getElementById('menuBtn');
  var menu = document.getElementById('siteMenu');
  if (!btn || !menu) return;

  var lastFocus = null;

  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }

  function open() {
    lastFocus = document.activeElement;
    menu.hidden = false;
    // hidden を外した直後に開始状態を確定させてから遷移させる
    requestAnimationFrame(function () { menu.classList.add('is-open'); });
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', 'メニューを閉じる');
    document.body.style.overflow = 'hidden';
    var first = menu.querySelector('a');
    if (first) first.focus();
  }

  function close(returnFocus) {
    menu.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'メニューを開く');
    document.body.style.overflow = '';
    var done = function () { menu.hidden = true; };
    // 動きを止めている環境では待たずに閉じる
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 160);
    if (returnFocus && lastFocus && lastFocus.focus) lastFocus.focus();
  }

  btn.addEventListener('click', function () { isOpen() ? close(true) : open(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) close(true);
  });

  // メニュー内のリンクを押したら閉じる(同一ページ内アンカーの場合に開いたままにしない)
  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) close(false);
  });

  // 幅が変わっても状態が食い違わないようにする
  window.addEventListener('pageshow', function () { if (isOpen()) close(false); });
})();
