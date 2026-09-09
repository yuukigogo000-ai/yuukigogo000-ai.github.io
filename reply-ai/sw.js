// Replier は公開を停止した。
//
// これは旧アプリの Service Worker を置き換えるための「墓標」。
// PWA として端末に入っている利用者は、次にアプリを開いたときにこのファイルを取得する。
// ここでキャッシュ(古いアプリ本体)を全部消し、自分自身の登録も解除する。
// これをやらないと、公開停止後も古いアプリがオフラインで動き続け、
// APIキーを預かる画面がいつまでも端末に残る。

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (n) { return caches.delete(n); }));
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function (clients) {
        clients.forEach(function (c) {
          // 告知ページを取りに行かせる(キャッシュ済みの旧アプリを表示させない)
          if ('navigate' in c) { c.navigate(c.url); }
        });
      })
      .catch(function () {
        // 解除に失敗しても、少なくとも fetch は素通しにする(下の fetch ハンドラ無し)
      })
  );
});
