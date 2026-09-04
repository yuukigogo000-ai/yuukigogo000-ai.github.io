// パチスロ帝国 Service Worker: ネットワーク優先+オフラインフォールバック
const CACHE = "pachi-teikoku-v4";
const PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./art/atm_blue.jpg", "./art/atm_gold.jpg", "./art/atm_neon.jpg", "./art/atm_purple.jpg", "./art/atm_red.jpg", "./art/atm_smoke.jpg", "./art/bg_data.jpg", "./art/bg_home.jpg", "./art/bg_news.jpg", "./art/bg_shop.jpg", "./art/bg_staff.jpg", "./art/bg_strategy.jpg", "./art/c_group.jpg", "./art/c_player_f.jpg", "./art/c_player_m.jpg", "./art/c_regular.jpg", "./art/c_staff_f.jpg", "./art/c_staff_m.jpg", "./art/fx_at.jpg", "./art/fx_bonus.jpg", "./art/fx_coin.jpg", "./art/fx_freeze.jpg", "./art/fx_light.jpg", "./art/fx_win.jpg", "./art/hall_aisle.jpg", "./art/hall_calm.jpg", "./art/hall_crowd.jpg", "./art/hall_left.jpg", "./art/hall_right.jpg", "./art/hall_wide.jpg", "./art/m_at.jpg", "./art/m_go.jpg", "./art/m_juggler.jpg", "./art/m_neon.jpg", "./art/m_normal.jpg", "./art/m_okislot.jpg", "./art/m_p_a.jpg", "./art/m_p_b.jpg", "./art/m_p_c.jpg", "./art/m_p_d.jpg", "./art/rank_a.jpg", "./art/rank_b.jpg", "./art/rank_c.jpg", "./art/rank_s.jpg", "./art/tex_carbon.jpg", "./art/tex_glass.jpg", "./art/tex_gold.jpg", "./art/tex_leather.jpg", "./art/tex_metal.jpg", "./art/tex_plastic.jpg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true })
          .then(m => m || caches.match("./index.html"))
      )
  );
});
