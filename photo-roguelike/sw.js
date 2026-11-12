// オフラインで遊べるようにするサービスワーカー。
// 画面(ページ)は新しいものを先に取りに行き、取れなければ保存したものを出す。
// ビルドの部品(assets/ の中、名前に中身のハッシュが入る)は保存したものを先に使う。
// 外のサイト(端末内AIのモデルなど)には手を出さない。
// 名前の house-gp-v1 はビルドの時に中身のハッシュへ置き換わる(web/vite.config.ts の swVersion)。古い名前の保存領域は activate で消す。
// 同じサイト(同じオリジン)に別のアプリもあるので、消すのは自分の名前(house-gp-)の古いものだけ。
// 端末内AIのモデル(Transformers.js が自分で作る保存領域)や、ほかのアプリの保存領域には手を出さない
const CACHE = 'house-gp-78ae6c0963e5';
// 起動に要るファイルの一覧。ビルドの時に dist の全ファイル(端末内AIの wasm 約21MB を除く)で置き換わる(web/vite.config.ts の swVersion)。
// インストールの時に全部を保存し終えてから新しいサービスワーカーに切り替わるので、初めて開いた直後・更新の直後でも電波なしで起動できる
const CORE = ["./","./assets/index-CTPfP_VA.js","./assets/index-wuCPNbXN.css","./assets/label_embeddings-CKAw2owH.js","./assets/ort-wasm-simd-threaded.jsep-B0TxsgQ-.mjs","./assets/transformers.web-Bui0ymck.js","./icon-192.png","./icon-512.png","./icon.svg","./index.html","./licenses.html","./manifest.webmanifest","./privacy.html"];

// 取り出す時は Vary を見ない。配信側が Vary: Origin を付けると、保存した時(Origin なし)と画面の部品の要求(Origin あり)が
// 一致しないことになり、初めて開いた直後の電波なし起動で部品が出せなかった(Codex 工程7 r1 の指摘2)
const MATCH = { ignoreVary: true };

/** この版の HTML の指紋(index.html の SHA-256 の先頭12桁)。保存領域の名前の後ろと同じ */
const HTML_HASH = CACHE.slice('house-gp-'.length);

async function sha12(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

/**
 * 起動に要るファイルを全部取ってきて、HTML がこの版のものかを指紋で確かめてから、まとめて保存する。
 * 版が混ざる(新しい版の HTML と古い部品)と、電波なしで起動できなくなる(Codex 工程7 r8)。合わなければ何も保存しない
 */
async function precache() {
  const got = await Promise.all(CORE.map(async (u) => {
    const r = await fetch(u, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`取れない: ${u}`);
    return [u, r];
  }));
  for (const [u, r] of got) {
    if ((u === './' || u === './index.html') && (await sha12(await r.clone().arrayBuffer())) !== HTML_HASH) throw new Error('版が合わない');
  }
  const c = await caches.open(CACHE);
  await Promise.all(got.map(([u, r]) => c.put(u, r)));
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('house-gp-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // ページは新しいものを先に取りに行くが、取った物は保存しない。保存はインストールの時の一式(同じ版でそろったもの)だけ。
    // (新しい版の HTML だけを今の一式に上書きすると、新しい部品を取れないまま電波が切れた時に起動できなくなる。Codex 工程7 r2 の指摘2)
    // 電波が無い時は、そのページ → 無ければアプリ本体を、今の版の一式から出す。
    const isApp = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    e.respondWith(
      fetch(req)
        .then((res) => {
          // 保存領域が外から消されていた時(同じサイトの別の仕組みが全部消した等)は、今の版の一式を保存し直す。
          // 新しい版が出ていれば古い部品が取れずに失敗するだけ(版は混ざらない)。新しい版の一式は新しいサービスワーカーが入れる
          if (res.ok && isApp) {
            caches.open(CACHE).then(async (c) => {
              if (!(await c.match('./index.html', MATCH))) await precache().catch(() => undefined);
            });
          }
          return res;
        })
        .catch(async () => (isApp ? undefined : await caches.match(url.pathname, MATCH)) ?? (await caches.match('./index.html', MATCH)) ?? Response.error()),
    );
    return;
  }
  e.respondWith(
    caches.match(req, MATCH).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && url.pathname.includes('/assets/')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
