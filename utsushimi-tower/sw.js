// オフラインで遊べるようにするサービスワーカー。
// 画面(ページ)は新しいものを先に取りに行き、取れなければ保存したものを出す。
// ビルドの部品(assets/ の中、名前に中身のハッシュが入る)は保存したものを先に使う。
// 外のサイト(端末内AIのモデルなど)には手を出さない。
// 名前の mawari-tower-v1 はビルドの時に中身のハッシュへ置き換わる(web/vite.config.ts の swVersion)。古い名前の保存領域は activate で消す。
// 同じサイト(同じオリジン)に別のアプリもあるので、消すのは自分の名前(mawari-tower-)の古いものだけ。
// 端末内AIのモデル(Transformers.js が自分で作る保存領域)や、ほかのアプリの保存領域には手を出さない
const CACHE = 'mawari-tower-4cb4d3b6ae19';
// 起動に要るファイルの一覧。ビルドの時に dist のファイル(端末内AIの wasm 約21MB と、札の絵・遺品・イベントの絵を除く)で置き換わる(web/vite.config.ts の swVersion)。
// インストールの時に全部を保存し終えてから新しいサービスワーカーに切り替わるので、初めて開いた直後・更新の直後でも電波なしで起動できる
const CORE = ["./","./art/backdrops/bg_a1_battle.webp","./art/backdrops/bg_a1_story.webp","./art/backdrops/bg_a2_battle.webp","./art/backdrops/bg_a2_story.webp","./art/backdrops/bg_a3_battle.webp","./art/backdrops/bg_a3_story.webp","./art/backdrops/bg_a4_battle.webp","./art/backdrops/bg_a4_story.webp","./art/backdrops/bg_hall.webp","./art/backdrops/bg_reception.webp","./art/backdrops/bg_rest.webp","./art/backdrops/bg_run_end.webp","./art/backdrops/bg_shop.webp","./art/backdrops/bg_title.webp","./art/backdrops/bg_treasure.webp","./art/chars/ch_apple.webp","./art/chars/ch_ball.webp","./art/chars/ch_banana.webp","./art/chars/ch_bed.webp","./art/chars/ch_bird.webp","./art/chars/ch_blocks.webp","./art/chars/ch_bonsai.webp","./art/chars/ch_book.webp","./art/chars/ch_bread.webp","./art/chars/ch_broom.webp","./art/chars/ch_cactus.webp","./art/chars/ch_cat.webp","./art/chars/ch_chair.webp","./art/chars/ch_clock.webp","./art/chars/ch_console.webp","./art/chars/ch_desk.webp","./art/chars/ch_dog.webp","./art/chars/ch_dryer.webp","./art/chars/ch_earphones.webp","./art/chars/ch_electricfan.webp","./art/chars/ch_envelope.webp","./art/chars/ch_eraser.webp","./art/chars/ch_flower.webp","./art/chars/ch_goldfish.webp","./art/chars/ch_hat.webp","./art/chars/ch_houseplant.webp","./art/chars/ch_insect.webp","./art/chars/ch_kettle.webp","./art/chars/ch_ladle.webp","./art/chars/ch_laptop.webp","./art/chars/ch_magazine.webp","./art/chars/ch_microwave.webp","./art/chars/ch_mug.webp","./art/chars/ch_newspaper.webp","./art/chars/ch_notebook.webp","./art/chars/ch_pan.webp","./art/chars/ch_pen.webp","./art/chars/ch_pencil.webp","./art/chars/ch_plush.webp","./art/chars/ch_pot.webp","./art/chars/ch_remote.webp","./art/chars/ch_riceball.webp","./art/chars/ch_ruler.webp","./art/chars/ch_scarf.webp","./art/chars/ch_scissors.webp","./art/chars/ch_shelf.webp","./art/chars/ch_shoes.webp","./art/chars/ch_smartphone.webp","./art/chars/ch_snack.webp","./art/chars/ch_soap.webp","./art/chars/ch_socks.webp","./art/chars/ch_sofa.webp","./art/chars/ch_sponge.webp","./art/chars/ch_st_brush.webp","./art/chars/ch_st_coat.webp","./art/chars/ch_st_denchi.webp","./art/chars/ch_st_houchou.webp","./art/chars/ch_st_koma.webp","./art/chars/ch_st_kuma.webp","./art/chars/ch_st_tansu.webp","./art/chars/ch_succulent.webp","./art/chars/ch_toothbrush.webp","./art/chars/ch_towel.webp","./art/chars/ch_toycar.webp","./art/chars/ch_toyrobot.webp","./art/chars/ch_tshirt.webp","./art/chars/ch_vacuum.webp","./art/enemies/en_armour_sentry.webp","./art/enemies/en_believer.webp","./art/enemies/en_bell_ringer.webp","./art/enemies/en_bone_archer.webp","./art/enemies/en_bone_soldier.webp","./art/enemies/en_bone_washer.webp","./art/enemies/en_boss_crow_l.webp","./art/enemies/en_boss_crow_m.webp","./art/enemies/en_boss_crow_r.webp","./art/enemies/en_boss_frog.webp","./art/enemies/en_boss_gatekeeper.webp","./art/enemies/en_boss_gear_king.webp","./art/enemies/en_boss_heart.webp","./art/enemies/en_boss_jailer.webp","./art/enemies/en_boss_master.webp","./art/enemies/en_boss_saint.webp","./art/enemies/en_boss_shadow_king_e.webp","./art/enemies/en_boss_shadow_king_y.webp","./art/enemies/en_boss_time_eater.webp","./art/enemies/en_candle_priest.webp","./art/enemies/en_candle_snuffer.webp","./art/enemies/en_choir.webp","./art/enemies/en_clockwork_knight.webp","./art/enemies/en_coffin_bearer.webp","./art/enemies/en_corpse.webp","./art/enemies/en_crow.webp","./art/enemies/en_curse_doll.webp","./art/enemies/en_dusty.webp","./art/enemies/en_executioner.webp","./art/enemies/en_gear_soldier.webp","./art/enemies/en_glass_mage.webp","./art/enemies/en_grave_robber.webp","./art/enemies/en_gravekeeper.webp","./art/enemies/en_guardian_shield.webp","./art/enemies/en_guardian_spear.webp","./art/enemies/en_hound.webp","./art/enemies/en_marionette.webp","./art/enemies/en_mirror_knight.webp","./art/enemies/en_moss_dead.webp","./art/enemies/en_mourner.webp","./art/enemies/en_nun_doll.webp","./art/enemies/en_obsidian_colossus.webp","./art/enemies/en_poison_moth.webp","./art/enemies/en_praying_shadow.webp","./art/enemies/en_puppeteer.webp","./art/enemies/en_rat.webp","./art/enemies/en_rot_mushroom.webp","./art/enemies/en_rotten_bishop.webp","./art/enemies/en_shadow_copy.webp","./art/enemies/en_shadow_eater.webp","./art/enemies/en_shield_eater.webp","./art/enemies/en_tag_peeler.webp","./art/enemies/en_tall_shadow.webp","./art/enemies/en_twin_hound.webp","./art/enemies/en_weeping_elder.webp","./art/enemies/en_weeping_younger.webp","./art/enemies/en_windup_dog.webp","./art/enemies/en_witch_elder.webp","./art/enemies/en_witch_middle.webp","./art/enemies/en_witch_young.webp","./art/enemies/en_wolf.webp","./art/enemies/en_wolf_howler.webp","./art/fx/fx_arrow.webp","./art/fx/fx_awaken.webp","./art/fx/fx_bolt.webp","./art/fx/fx_chain.webp","./art/fx/fx_counter.webp","./art/fx/fx_heal.webp","./art/fx/fx_hit.webp","./art/fx/fx_ko.webp","./art/fx/fx_poison.webp","./art/fx/fx_shield.webp","./art/fx/fx_slash.webp","./art/fx/fx_stun.webp","./art/icons/ic_aim.webp","./art/icons/ic_atk.webp","./art/icons/ic_ax_chain.webp","./art/icons/ic_ax_counter.webp","./art/icons/ic_ax_curse.webp","./art/icons/ic_ax_formation.webp","./art/icons/ic_ax_heal.webp","./art/icons/ic_ax_opening.webp","./art/icons/ic_ax_sacrifice.webp","./art/icons/ic_cd.webp","./art/icons/ic_film.webp","./art/icons/ic_gold.webp","./art/icons/ic_heart.webp","./art/icons/ic_job_archer.webp","./art/icons/ic_job_beast.webp","./art/icons/ic_job_blade.webp","./art/icons/ic_job_golem.webp","./art/icons/ic_job_healer.webp","./art/icons/ic_job_jester.webp","./art/icons/ic_job_knight.webp","./art/icons/ic_job_mage.webp","./art/icons/ic_job_priest.webp","./art/icons/ic_job_shaman.webp","./art/icons/ic_job_thunder.webp","./art/icons/ic_job_wall.webp","./art/icons/ic_lock.webp","./art/icons/ic_poison.webp","./art/icons/ic_room_boss.webp","./art/icons/ic_room_elite.webp","./art/icons/ic_room_event.webp","./art/icons/ic_room_fight.webp","./art/icons/ic_room_rest.webp","./art/icons/ic_room_shop.webp","./art/icons/ic_room_treasure.webp","./art/icons/ic_school_hai.webp","./art/icons/ic_school_ikazuchi.webp","./art/icons/ic_school_kurogane.webp","./art/icons/ic_school_mori.webp","./art/icons/ic_shield.webp","./art/icons/ic_stun.webp","./art/items/key_blue.webp","./art/items/key_green.webp","./art/items/key_red.webp","./art/logo/logo_title.webp","./art/potions/pt_chikara.webp","./art/potions/pt_doku.webp","./art/potions/pt_hagane.webp","./art/potions/pt_hi.webp","./art/potions/pt_inochi.webp","./art/potions/pt_iyashi.webp","./art/potions/pt_kaesu.webp","./art/potions/pt_kaminari.webp","./art/potions/pt_kaze.webp","./art/potions/pt_kemuri.webp","./art/potions/pt_kesshou.webp","./art/potions/pt_kyouka.webp","./art/potions/pt_rensa.webp","./art/potions/pt_tetsu.webp","./art/potions/pt_toge.webp","./assets/index-DDxLz_xL.css","./assets/index-d21Z1d7y.js","./assets/label_embeddings-DVFODGH-.js","./assets/mincho-b-EGZ4T8OT.woff2","./assets/ort-wasm-simd-threaded.jsep-B0TxsgQ-.mjs","./assets/transformers.web-aA9FNwaS.js","./icon-192.png","./icon-512.png","./index.html","./licenses.html","./manifest.webmanifest","./privacy.html"];

// 取り出す時は Vary を見ない。配信側が Vary: Origin を付けると、保存した時(Origin なし)と画面の部品の要求(Origin あり)が
// 一致しないことになり、初めて開いた直後の電波なし起動で部品が出せなかった(Codex 工程7 r1 の指摘2)
const MATCH = { ignoreVary: true };

/** この版の HTML の指紋(index.html の SHA-256 の先頭12桁)。保存領域の名前の後ろと同じ */
const HTML_HASH = CACHE.slice('mawari-tower-'.length);

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
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('mawari-tower-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
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
      // ビルドの部品(assets/)と絵(art/。札の絵・遺品・イベントの絵は先に保存しないので、見た時にここで保存する)
      if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/art/'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    })),
  );
});
