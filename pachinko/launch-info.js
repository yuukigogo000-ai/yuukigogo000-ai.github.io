/* Launch guide and presentation preferences. Gameplay and save data are separate. */
(() => {
  "use strict";
  const KEY = "pachi-teikoku-preferences-v1";
  const defaults = () => ({ motion: "auto", business: "normal" });
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return { motion: value?.motion === "reduce" ? "reduce" : "auto", business: value?.business === "quick" ? "quick" : "normal" };
    } catch (_) { return defaults(); }
  };
  let prefs = read(), opener = null, current = "help";
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.pachiMotionReduced = () => prefs.motion === "reduce" || media.matches;
  window.pachiShortBusiness = () => prefs.business === "quick";
  const apply = () => document.documentElement.classList.toggle("pachi-reduce-motion", prefs.motion === "reduce");
  apply();
  const panel = document.createElement("section");
  panel.id = "launchInfo";
  panel.className = "pachi-info";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "pachiInfoTitle");
  document.querySelector(".launch-shell").appendChild(panel);
  const tabs = [["basics", "遊び方"], ["strategy", "攻略のコツ"], ["difficulty", "難易度"]];
  const note = text => '<p class="pi-note">' + text + "</p>";
  const article = (title, body) => '<article class="pi-card"><h3>' + title + "</h3>" + body + "</article>";
  const step = (n, title, body) => '<li><span class="pi-step-no">' + n + '</span><div><h3>' + title + "</h3><p>" + body + "</p></div></li>";
  const tip = (title, body, open = false) => '<details class="pi-tip"' + (open ? " open" : "") + "><summary>" + title + "</summary><p>" + body + "</p></details>";
  function guideBody(tab) {
    if (tab === "strategy") return '<div class="pi-lead"><span class="pi-eyebrow">OWNER’S STRATEGY</span><h3>利益と評判を、両立させる。</h3><p>今日の黒字だけでなく、明日もお客さんが来る店をつくりましょう。</p></div>' +
      tip("01　平均設定にメリハリをつける", "低設定は店の取り分が増える一方、続けると評判や行政の警戒に響きます。高設定は常連づくりにつながりますが、プロにも狙われます。全シマを一律にせず、出すシマと回収するシマを分けて、店全体の平均設定も確認しましょう。", true) +
      tip("02　特日とブームを使い分ける", "日数に「7」がつく日は特日です。開店前に日付と設定を見直しましょう。週替わりのブームは機種カテゴリ単位で集客を後押しします。同一機種を複数シマに置く効果もありますが、ブームだけを理由に現金を使い切らないことが大切です。") +
      tip("03　評判とスタッフを放置しない", "評判は毎日少しずつ下がり、高い評判ほど維持が難しくなります。出玉とスタッフの質で支えましょう。スタッフ不足は客入りと評判に悪影響があるので、新台購入や店舗拡張の際に必要人数も確認します。") +
      tip("04　拡張の前に、現金を残す", "シマ増設費の6割は店舗の資産として残りますが、支払いで現金は減ります。家賃・人件費・維持費・利息を払える余力を残しましょう。借入は投資の手段になりますが、借金が増えた分だけ純資産が増えるわけではありません。") +
      tip("05　荒い機種に偏らせない", "甘デジやAタイプは比較的安定し、ミドル・爆裂系・スマスロは収支が大きく振れます。資金に余裕がない時期は機種構成を分散し、一日の勝ち負けだけで判断せず、帳簿で収支の流れを見ましょう。") +
      tip("06　行政の警戒を見逃さない", "平均設定が渋い営業を続けると、警戒度が上がります。警戒される基準は難易度で異なります。「経営」の行政・組合の目を確認し、警戒が高いときは設定を見直して沈静化を図りましょう。") +
      note("このゲームには収支の振れやランダムイベントがあります。同じ方針でも毎回同じ結果になるとは限りません。");
    if (tab === "difficulty") {
      const descriptions = {
        easy: "初めてならここから。初期資金が多く、プロや行政の影響も比較的穏やかです。",
        normal: "資金・集客・維持費のバランスを見ながら、経営の基本を試す難易度です。",
        hard: "集客と維持費の条件が厳しく、プロや行政への対応も重要になります。",
        hardx: "修羅より客入りと維持費が厳しいモード。30枚の商機が助けになりますが、訪れる順番はランダムです。"
      };
      return '<div class="pi-lead"><span class="pi-eyebrow">CHOOSE YOUR CHALLENGE</span><h3>自分のペースで、1億円へ。</h3><p>すべての難易度で目標は同じ。使える資金と営業条件、期限が変わります。</p></div>' +
        ["easy", "normal", "hard", "hardx"].map(d => '<article class="pi-diff ' + d + '"><h3>' + DIFFS[d].label + '</h3><dl><div><dt>初期資金</dt><dd>' + yen(DIFFS[d].money) + '</dd></div><div><dt>営業期限</dt><dd>' + LIMIT_DAYS[d] + '日</dd></div></dl><p>' + descriptions[d] + "</p></article>").join("") +
        note("「修羅・熟練」は難易度選択で「修羅」を選んだ後に選べます。ここで説明を読むだけでは、セーブデータは変わりません。");
    }
    return '<div class="pi-goal"><span class="pi-eyebrow">YOUR GOAL</span><h3>目指せ、純資産 <strong>1億円</strong></h3><p>小さなホールを育てて、期限内の達成を目指そう。</p></div>' +
      article("1日の流れ", '<ol class="pi-steps">' +
        step("01", "開店前に準備する", "ホールで各シマの平均設定を決め、新台・スタッフ・広告などを必要に応じて見直します。") +
        step("02", "「営業開始」を押す", "1日分の営業が進みます。客入り、出玉、費用やイベントがその日の収支に反映されます。") +
        step("03", "結果を見て、翌日へ", "収支・評判・常連・行政の警戒を確認。うまくいかなかった点を次の営業で調整します。") + "</ol>") +
      article("4つのタブを使い分ける", '<dl class="pi-map"><div><dt>ホール</dt><dd>各シマの平均設定、台の状況を確認。</dd></div><div><dt>新台購入</dt><dd>機種の特徴と価格を見て導入。</dd></div><div><dt>経営</dt><dd>スタッフ・広告・融資・拡張を管理。セーブは一番上。</dd></div><div><dt>帳簿</dt><dd>収支や資産を振り返り、経営を見直す。</dd></div></dl>') +
      article("覚えておきたいルール", '<ul class="pi-list"><li>設定を変える単位は<strong>1シマ＝同一機種10台</strong>です。</li><li>純資産は、現金や台・店舗などの資産から借金を差し引いた額です。</li><li>資金が尽きたり、期限内に目標を達成できなかったりするとゲーム終了です。</li><li>営業終了時に自動保存されます。手動保存は「経営」の一番上から行えます。</li></ul>');
  }
  function renderGuide(tab = "basics") {
    const body = panel.querySelector("#piGuideBody");
    if (body) {
      body.innerHTML = guideBody(tab);
      body.setAttribute("aria-labelledby", "piTab-" + tab);
      panel.querySelectorAll("[data-guide-tab]").forEach(button => { const selected = button.dataset.guideTab === tab; button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
      panel.querySelector(".pi-scroll").scrollTop = 0;
      return;
    }
    panel.innerHTML = header("遊び方・攻略", "OWNER’S HANDBOOK") +
      '<div class="pi-tabs" role="tablist" aria-label="ガイドの内容">' + tabs.map(([id, label]) => '<button type="button" role="tab" id="piTab-' + id + '" aria-controls="piGuideBody" aria-selected="' + (id === tab) + '" tabindex="' + (id === tab ? "0" : "-1") + '" data-guide-tab="' + id + '">' + label + "</button>").join("") + '</div><div class="pi-scroll" id="piInfoScroll"><div id="piGuideBody" role="tabpanel" tabindex="0" aria-labelledby="piTab-' + tab + '">' + guideBody(tab) + '</div><div class="pi-bottom"><button type="button" class="launch-mini gold" data-info="difficulty">難易度を選ぶ <span aria-hidden="true">›</span></button>' + note("説明を読んだら、自分に合う難易度で開店しましょう。") + "</div></div>";
  }
  function header(title, subtitle) {
    return '<header class="pi-head"><button type="button" class="pi-back" data-info="close"><span aria-hidden="true">‹</span> 戻る</button><div><p class="pi-eyebrow">' + subtitle + '</p><h2 id="pachiInfoTitle">' + title + '</h2></div><img src="./art/launch-exact/crown.webp" width="135" height="99" alt="" aria-hidden="true"></header>';
  }
  function choice(name, value, label, detail) {
    return '<label class="pi-choice"><input type="radio" name="pi-' + name + '" value="' + value + '" data-pref="' + name + '"' + (prefs[name] === value ? " checked" : "") + '><span><strong>' + label + "</strong><small>" + detail + "</small></span></label>";
  }
  function renderSettings() {
    panel.innerHTML = header("設定", "PLAY AT YOUR OWN PACE") + '<div class="pi-scroll" id="piInfoScroll"><div class="pi-lead"><h3>遊びやすさを、自分のペースに。</h3><p>変更はすぐに反映され、次回起動時にも引き継がれます。</p></div>' +
      '<fieldset class="pi-card pi-field"><legend>画面の動き</legend><p class="pi-description">点滅やアニメーションを抑えたいときに。</p>' +
      choice("motion", "auto", "端末に合わせる", "端末の「動きを減らす」設定に従います。") +
      choice("motion", "reduce", "動きを減らす", "点滅や移動を抑え、営業演出も短縮します。") + '<p class="pi-note" id="piMotionState"></p></fieldset>' +
      '<fieldset class="pi-card pi-field"><legend>営業演出</legend><p class="pi-description">営業開始から収支結果までの見せ方を選べます。</p>' +
      choice("business", "normal", "通常", "ホールの営業風景をアニメーションで表示。") +
      choice("business", "quick", "短縮", "静止画を表示して、収支結果へすぐ進みます。") + note("画面の動きを減らしているときは、こちらが「通常」でも短縮されます。") + "</fieldset>" +
      '<p class="pi-status" id="piPrefsStatus" role="status" aria-live="polite">設定はこのブラウザに保存されます。</p>' +
      article("セーブデータ", '<div class="pi-save-state"><span class="pi-dot' + (launchHasSave ? " available" : "") + '"></span><strong>' + (launchHasSave ? "続きから遊べるデータがあります" : "セーブデータはまだありません") + '</strong></div><p>営業終了時に自動保存されます。手動で保存するときは「経営」タブの一番上にある「セーブ」を押してください。</p><p>進行データはこの端末の、このブラウザ内に保存されます。別の端末やブラウザには自動で引き継がれません。ブラウザのサイトデータを消すと、セーブも消えます。</p>' + (launchHasSave ? '<button type="button" class="launch-mini gold pi-wide" data-info="continue">続きから遊ぶ</button>' : "")) +
      '<button type="button" class="pi-reset" data-info="reset-prefs">演出設定を初期値に戻す</button>' + note("ゲームの進行・難易度・セーブデータは変更されません。") + "</div>";
    updateMotionState();
  }
  function updateMotionState() {
    const state = document.getElementById("piMotionState");
    if (state) state.textContent = "現在の表示：" + (window.pachiMotionReduced() ? "動きを減らす" : "通常");
  }
  function writePrefs() {
    let message = "設定を保存しました。";
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); }
    catch (_) { message = "設定を保存できませんでした。今回の起動中のみ適用されます。"; }
    apply(); updateMotionState();
    const status = document.getElementById("piPrefsStatus");
    if (status) status.textContent = message;
  }
  document.querySelector(".launch-shell").addEventListener("click", event => {
    const button = event.target.closest('[data-launch="help"], [data-launch="settings"]');
    if (button) opener = button;
  }, true);
  window.openLaunchInfo = kind => {
    current = kind === "settings" ? "settings" : "help";
    if (opener?.dataset.launch !== current) opener = document.querySelector('[data-launch="' + current + '"]') || document.activeElement;
    if (typeof closeLaunchDrawer === "function") closeLaunchDrawer();
    if (current === "help") renderGuide(); else renderSettings();
    panel.hidden = false;
    document.querySelectorAll("#launchTitle, #launchDifficulty").forEach(node => { node.inert = true; });
    panel.querySelector(".pi-back").focus({ preventScroll: true });
  };
  window.closeLaunchInfo = (restoreFocus = true) => {
    if (panel.hidden) return;
    panel.hidden = true;
    document.querySelectorAll("#launchTitle, #launchDifficulty").forEach(node => { node.inert = false; });
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  };
  panel.addEventListener("click", event => {
    const tab = event.target.closest("[data-guide-tab]");
    if (tab) { const name = tab.dataset.guideTab; renderGuide(name); panel.querySelector('[data-guide-tab="' + name + '"]').focus({ preventScroll: true }); return; }
    const action = event.target.closest("[data-info]")?.dataset.info;
    if (action === "close") window.closeLaunchInfo();
    if (action === "difficulty") { window.closeLaunchInfo(false); showLaunchDifficulty(); document.querySelector("[data-launch-diff].on")?.focus({ preventScroll: true }); }
    if (action === "continue") { window.closeLaunchInfo(false); hideLaunch(); document.getElementById("btnOpen")?.focus({ preventScroll: true }); }
    if (action === "reset-prefs") { prefs = defaults(); panel.querySelectorAll("[data-pref]").forEach(input => { input.checked = prefs[input.dataset.pref] === input.value; }); writePrefs(); panel.querySelector('[data-info="reset-prefs"]').focus({ preventScroll: true }); }
  });
  panel.addEventListener("change", event => {
    const input = event.target.closest("[data-pref]");
    if (!input) return;
    const name = input.dataset.pref, value = input.value;
    if (name === "motion" && ["auto", "reduce"].includes(value) || name === "business" && ["normal", "quick"].includes(value)) { prefs[name] = value; writePrefs(); }
  });
  document.addEventListener("keydown", event => {
    if (panel.hidden) return;
    if (event.key === "Escape") { event.preventDefault(); window.closeLaunchInfo(); return; }
    const tab = event.target.closest?.("[data-guide-tab]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = tabs.findIndex(([id]) => id === tab.dataset.guideTab);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      renderGuide(tabs[next][0]); panel.querySelector('[data-guide-tab="' + tabs[next][0] + '"]').focus(); return;
    }
    if (event.key === "Tab") {
      const items = [...panel.querySelectorAll('button:not(:disabled), input, [tabindex="0"], a[href]')].filter(node => node.tabIndex >= 0 && node.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  const systemChanged = () => { apply(); updateMotionState(); };
  window.addEventListener("focus", systemChanged);
  window.addEventListener("pageshow", systemChanged);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) systemChanged(); });
  if (media.addEventListener) media.addEventListener("change", systemChanged); else media.addListener(systemChanged);
})();
