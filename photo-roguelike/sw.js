// オフラインで遊べるようにするサービスワーカー。
// 画面(ページ)は新しいものを先に取りに行き、取れなければ保存したものを出す。
// ビルドの部品(assets/ の中、名前に中身のハッシュが入る)は保存したものを先に使う。
// 外のサイト(端末内AIのモデルなど)には手を出さない。
// 名前の house-gp-v1 はビルドの時に中身のハッシュへ置き換わる(web/vite.config.ts の swVersion)。古い名前の保存領域は activate で消す。
// 同じサイト(同じオリジン)に別のアプリもあるので、消すのは自分の名前(house-gp-)の古いものだけ。
// 端末内AIのモデル(Transformers.js が自分で作る保存領域)や、ほかのアプリの保存領域には手を出さない
const CACHE = 'house-gp-e93cd6242d3d';
// 起動に要るファイルの一覧。ビルドの時に dist の全ファイル(端末内AIの wasm 約21MB を除く)で置き換わる(web/vite.config.ts の swVersion)。
// インストールの時に全部を保存し終えてから新しいサービスワーカーに切り替わるので、初めて開いた直後・更新の直後でも電波なしで起動できる
const CORE = ["./","./art/backdrops/bg_kitchen.webp","./art/backdrops/bg_living.webp","./art/backdrops/bg_notice.webp","./art/cards/card_slot.webp","./art/cards/card_stat_atk.webp","./art/cards/card_stat_hp.webp","./art/cards/shop_upgrade.webp","./art/events/ev_bargain.webp","./art/events/ev_cheer.webp","./art/events/ev_gift.webp","./art/events/ev_lucky.webp","./art/events/ev_sacrifice.webp","./art/events/ev_stray.webp","./art/events/ev_training.webp","./art/forms/apple_0.webp","./art/forms/ball_0.webp","./art/forms/banana_0.webp","./art/forms/bed_0.webp","./art/forms/bird_0.webp","./art/forms/blocks_0.webp","./art/forms/bonsai_0.webp","./art/forms/book_0.webp","./art/forms/bread_0.webp","./art/forms/broom_0.webp","./art/forms/cactus_0.webp","./art/forms/cat_0.webp","./art/forms/chair_0.webp","./art/forms/clock_0.webp","./art/forms/console_0.webp","./art/forms/desk_0.webp","./art/forms/dog_0.webp","./art/forms/dryer_0.webp","./art/forms/earphones_0.webp","./art/forms/electricfan_0.webp","./art/forms/envelope_0.webp","./art/forms/eraser_0.webp","./art/forms/flower_0.webp","./art/forms/goldfish_0.webp","./art/forms/hat_0.webp","./art/forms/houseplant_0.webp","./art/forms/insect_0.webp","./art/forms/kettle_0.webp","./art/forms/ladle_0.webp","./art/forms/laptop_0.webp","./art/forms/magazine_0.webp","./art/forms/microwave_0.webp","./art/forms/mug_0.webp","./art/forms/newspaper_0.webp","./art/forms/notebook_0.webp","./art/forms/pan_0.webp","./art/forms/pen_0.webp","./art/forms/pencil_0.webp","./art/forms/plush_0.webp","./art/forms/pot_0.webp","./art/forms/remote_0.webp","./art/forms/riceball_0.webp","./art/forms/ruler_0.webp","./art/forms/scarf_0.webp","./art/forms/scissors_0.webp","./art/forms/shelf_0.webp","./art/forms/shoes_0.webp","./art/forms/smartphone_0.webp","./art/forms/snack_0.webp","./art/forms/soap_0.webp","./art/forms/socks_0.webp","./art/forms/sofa_0.webp","./art/forms/sponge_0.webp","./art/forms/succulent_0.webp","./art/forms/toothbrush_0.webp","./art/forms/towel_0.webp","./art/forms/toycar_0.webp","./art/forms/toyrobot_0.webp","./art/forms/tshirt_0.webp","./art/forms/vacuum_0.webp","./art/fx/fx_awaken.webp","./art/fx/fx_heal.webp","./art/fx/fx_hit.webp","./art/fx/fx_ko.webp","./art/fx/fx_poison.webp","./art/fx/fx_shield.webp","./art/icons/ic_atk.webp","./art/icons/ic_battle_flat.webp","./art/icons/ic_capsule.webp","./art/icons/ic_coin.webp","./art/icons/ic_elite.webp","./art/icons/ic_film.webp","./art/icons/ic_heart.webp","./art/icons/ic_heart_empty.webp","./art/icons/ic_lock.webp","./art/icons/ic_pause.webp","./art/icons/ic_play.webp","./art/icons/ic_rest.webp","./art/icons/ic_shard.webp","./art/icons/ic_shop_flat.webp","./art/icons/ic_trophy.webp","./art/icons/nav_book.webp","./art/icons/nav_camera.webp","./art/icons/nav_home.webp","./art/icons/nav_stack.webp","./art/items/item_battery.webp","./art/items/item_bento.webp","./art/items/item_binoculars.webp","./art/items/item_blade.webp","./art/items/item_blanket.webp","./art/items/item_charm.webp","./art/items/item_clock.webp","./art/items/item_cushion.webp","./art/items/item_dumbbell.webp","./art/items/item_earplugs.webp","./art/items/item_fan.webp","./art/items/item_first_aid.webp","./art/items/item_gum.webp","./art/items/item_magnifier.webp","./art/items/item_match.webp","./art/items/item_mirror.webp","./art/items/item_poison_vial.webp","./art/items/item_pot_lid.webp","./art/items/item_spare_battery.webp","./art/items/item_whistle.webp","./art/story/story_disc.webp","./assets/index-4owKdFGr.js","./assets/index-vDcvBhoS.css","./assets/label_embeddings-CKAw2owH.js","./assets/mplus1p-bold-CpKTK5Xn.woff2","./assets/mplus1p-medium-ZETlR9Os.woff2","./assets/mplus1p-regular-CPxxg05l.woff2","./assets/ort-wasm-simd-threaded.jsep-B0TxsgQ-.mjs","./assets/transformers.web-Bui0ymck.js","./fonts/OFL-mplus1p.txt","./icon-192.png","./icon-512.png","./icon.svg","./index.html","./licenses.html","./manifest.webmanifest","./privacy.html"];

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
  // 背景の動画(art/video/)には手を出さない。ブラウザは動画を一部ずつ(Range・206)取りに来るが、保存領域は 206 を入れられず、
  // 保存した全体(200)を返すと iPhone の Safari が再生しない。先に保存もしない(電波が無い時は静止画のまま。components/BgVideo.tsx)
  if (url.pathname.includes('/art/video/')) return;
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
      // ビルドの部品(assets/)と絵(art/。進化した姿は先に保存しないので、見た時にここで保存する)
      if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/art/'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
