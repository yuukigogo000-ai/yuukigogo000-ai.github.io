// はじきバトル 演出の数値の置き場(正本)。演出の秒・ピクセル・倍率・音の高さ・粒の数は、ここ以外に書かない。
// 人が読む説明は ../FX_SPEC.md。各値の右の [ ] は出典と根拠の強さ:
//   M3 = Material Design 3 の公式トークン(@material/web 2.5.0 の tokens/_md-sys-motion.scss、Apache-2.0)
//   R1 = reports/はじきバトルの演出と動き.md、R2 = reports/はじきバトル演出の見本帳.md
//   今 = 仮の画面(play/ui.js)で使っている値(手触りを確かめ済み)、耳 / 目 = 発注者が聴き比べ・見比べて決める
//   強・中・弱 = 報告書の根拠の強さ。「弱」の値は出発点で、演出ラボで見て直す
// 時間はミリ秒、長さは卓の座標(幅 360)のピクセル。

/** Material Design 3 の動きのトークン(枠の UI: 上の帯・ボタン・重ねた画面の出入りに使う) [M3] */
const M3 = {
  duration: {
    short1: 50, short2: 100, short3: 150, short4: 200,
    medium1: 250, medium2: 300, medium3: 350, medium4: 400,
    long1: 450, long2: 500, long3: 550, long4: 600,
    extraLong1: 700, extraLong2: 800, extraLong3: 900, extraLong4: 1000,
  },
  // cubic-bezier の 4 つの数
  easing: {
    standard: [0.2, 0, 0, 1], standardAccelerate: [0.3, 0, 1, 1], standardDecelerate: [0, 0, 0, 1],
    emphasizedAccelerate: [0.3, 0, 0.8, 0.15], emphasizedDecelerate: [0.05, 0.7, 0.1, 1], linear: [0, 0, 1, 1],
  },
  // ばね(減衰比・硬さ)。spatial = 位置や大きさ、effects = 色や透明度
  spring: {
    fastSpatial: { damping: 0.9, stiffness: 1400 }, defaultSpatial: { damping: 0.9, stiffness: 700 }, slowSpatial: { damping: 0.9, stiffness: 300 },
    fastEffects: { damping: 1, stiffness: 3800 }, defaultEffects: { damping: 1, stiffness: 1600 }, slowEffects: { damping: 1, stiffness: 800 },
  },
};

export const FXT = {
  m3: M3,
  frameMs: 1000 / 60, // 1 コマ

  // ---- 演出の格表(5 段)。格は「本当に起きた結果の大きさ」だけで決める [R1 格表・R2 改訂] ----------------
  // hitstopMs: 止める時間(駒の動きだけ止め、輪や文字は動き続ける) / shake: 揺れ(当たった向きに) / text: 文字の段
  tiers: [
    { ja: 'ふつう', hitstopMs: 0, firstHitStopMs: 30, shakePx: 0, shakeMs: 0, text: 4, waitCapMs: 0 },          // [今・強] 1 発目だけ 0.03 秒
    { ja: '強い', hitstopMs: 90, shakePx: 3, shakeMs: 150, text: 3, waitCapMs: 100 },                          // [今・中] 0.06〜0.09 秒
    { ja: '大きい', hitstopMs: 120, shakePx: 4, shakeMs: 200, text: 2, waitCapMs: 200 },                       // [今・中]
    { ja: '山場', hitstopMs: 400, repeatMul: 0.5, shakePx: 5, shakeMs: 220, text: 2, waitCapMs: 600, skippable: true }, // [R1・中] 0.3〜0.6 秒、同じ戦闘の 2 回目から半分
    { ja: '決着', slowRate: 0.4, slowLeadMs: 300, zoom: 1.25, zoomMs: 300, shakePx: 7, shakeMs: 250, hitstopMs: 140,
      text: 1, totalMaxMs: 1500, skippable: true },                                                             // [R1・中、数値は弱] 0.35〜0.5 倍速・寄り 1.2〜1.3
  ],
  // 同じ瞬間とみなす幅(この間に起きたものは、一番上の格の止め・揺れ・和音を 1 回だけ) [R1 重なりの決まり]
  sameMomentMs: 50,

  // ---- 1 手の予算(演出の検査器が測る) [R2 WO §9 AC6] -------------------------------------------------
  budget: {
    addedWaitPerShotMs: 500, // 1 手で演出が足した待ち(止め・間)の合計。決着を除く
    finaleMaxMs: 1500,       // 決着の余韻の上限(タップで飛ばせる)
    enemyTurnMaxMs: 3000,    // 敵の番ぜんぶ
    releaseToMoveMs: 100,    // 離してから動き出すまで
    flashesPerSecMax: 3,     // 明暗が大きく変わる回数(1 秒あたり)。赤の点滅は 0
    particlesMax: 200,       // 同時に出す粒の総数(実機で測って直す) [R2・弱]
    textTiersMax: 5,         // 文字の段
    damageMergeAt: 4,        // 同時に 4 つ以上のダメージの数字は合計 1 つにまとめる [R1]
    frameMsAvgWarn: 20,      // 直近のコマの平均がこれを超えたら「弱」を勧める(勝手に切り替えない) [R2・推論]
  },

  // ---- 早送りと演出の強さ -------------------------------------------------------------------------
  fastForward: { rate: 2, stopsMul: 0.5 },   // 卓をタップで 2 倍速。止め・スロー・カットインは半分 [R1・中]
  level: {                                   // 演出の強さ「標準・弱・なし」 [R2]
    full: { particles: 1, life: 1, shake: 1, glow: true, speedLines: true, afterimage: true, breathe: true },
    low: { particles: 0.5, life: 0.8, shake: 0.5, glow: true, speedLines: false, afterimage: false, breathe: false },
    off: { particles: 0, life: 1, shake: 0, glow: false, speedLines: false, afterimage: false, breathe: false }, // 文字・色・小さなつぶれは残す
  },

  // ---- 文字の 5 段(卓の中の文字も数える)。大きさは仮置きで、PC で本体のトークンに合わせる [R2 文字の段] ----
  text: {
    sizes: [null, 28, 20, 15, 12, 10], // 1 特大 / 2 大 / 3 中 / 4 小 / 5 最小
    weight: 700,
    lifeMs: { 1: 1200, 2: 950, 3: 900, 4: 800, 5: 800 }, // [今] 0.95 秒、数字は短く [R1] 0.6〜0.95
    rise: 22,                                              // 消えるまでに上へ動く量 [今]
    laneGap: 28,                                           // 中央の文字の段ずらし [今]
  },

  // ---- 色の役割(新しい色は足さない。CSS の今のトークンに対応づける) [R1 #12・R2 #12] ------------------
  // 危険色(danger)は「自分(味方)に悪いこと」だけ: 味方が受けたダメージ・味方の落下・敵の予告・落ちる軌道
  color: {
    good: 'accent',  // 味方の手柄(強打・巻き込んだ・玉突き・敵の場外と撃破の文字)
    great: 'ult',    // 節目・必殺・決着(必殺色はもともと金色。10 れんさの「金」はこれで出す)
    harm: 'danger',
    heal: 'heal', poison: 'poison', boss: 'boss',
    plain: 'fg',     // 敵に与えたダメージの数字・合計
    muted: 'muted',
  },

  // ---- れんさ 10 段 [R2 れんさの表] ----------------------------------------------------------------
  // text: 文字の段(0 = 出さない) / color: 上の役割 / chord: 節目の和音の音の数 / stopMs / dim: 背景を暗くする
  chain: {
    1: { text: 0 },
    2: { text: 4, color: 'plain', label: 'num' },                           // 小さな数字だけ
    3: { text: 3, color: 'good', chord: 2, stopMs: 75, ringGrow: true, dots: 6, label: 'charge' }, // 「3 れんさ 必殺+1」
    4: { text: 3, color: 'good', label: 'mult' },                           // 「4 れんさ ×1.8」
    5: { text: 2, color: 'great', chord: 3, low: true, stopMs: 120, dim: { pct: 20, ms: 300 }, dots: 12, callout: 1, label: 'mult' },
    6: { text: 2, color: 'great', label: 'mult' },                          // 6〜9 は見た目は 5 のまま、音だけ上がる
    10: { text: 1, color: 'great', plate: true, chord: 4, low: true, preSilenceMs: 60, stopMs: 400, repeatMul: 0.5,
          dim: { pct: 25, ms: 400 }, dots: 24, callout: 3, label: 'plate' }, // 必殺色の地に白い文字の札。呼びかけを重ねる
    over: { addChordNote: true, chordMax: 4, calloutMax: 3, noRedim: true }, // 11 以上: 言葉は増やさない
    multFrom: 4, // 倍率を添え始める数(掛け算が効き始める次)
  },

  // ---- 駒の動き(写真シールは形を変える動きだけで生かす) [R1 駒の表] ----------------------------------
  body: {
    breathe: { amp: 0.03, periodMs: 2000 },              // 番の駒と狙う敵だけ。面積一定で ±3% [弱]
    turnRing: { amp: 2, periodMs: 1130, gap: 4, width: 3 }, // 番の駒の輪 [今] sin(now/180) ≒ 1.13 秒周期
    stepPulse: { px: 5, ms: 160 },                       // 強さの段が変わった瞬間 [今]
    dragSquash: [1, 0.95, 0.9, 0.85],                    // 引く向きにつぶれる(段 0〜3) [中・数値は弱]
    stepBounce: 0.03,                                    // 段の変わり目で一瞬はずむ [弱]
    release: { stretch: 1.2, frames: 2, spring: { damping: 0.5, stiffness: 700 } }, // 1〜2 コマで伸び、1 回だけ行き過ぎて戻る [R2 桜井氏・中]
    speedStretch: { max: 1.2, atSpeed: 1400 },           // 速さに比例して進む向きに伸びる [弱]
    afterimage: { fromSpeed: 900, count: 3, alpha: [0.3, 0.2, 0.1] }, // [弱]
    hitSquash: { normal: 0.85, strong: 0.75, recoverMs: 300 }, // ぶつかった向きにつぶれ、速く入ってゆっくり戻る [中・数値は弱]
    strongJitter: { px: 1.5, ms: 300 },                  // 強打を受けた駒だけ見た目を揺らす [中]
    peel: { wobblePx: 1.2, alpha: 0.6, flapDeg: 4, flapPeriodMs: 1000 }, // はがれかけ [今]。めくれは見本の後 [弱]
    ringOut: { wobbleMs: 100, shrinkTo: 0.6, ms: 500, turns: 1.5 },     // 敵の場外: 縁で一拍ぐらつき、縮みながら回る [弱]
    allyFall: { dropMs: 300, stickMs: 300 },             // 味方の落下: 小さく落ちて元の位置にぺたっと [弱]
    windup: { squash: 0.88, ms: 120, strongMs: 150 },    // 敵の溜め [中・数値は弱]
    bossFlinch: { squash: 0.75, ms: 400 },               // [弱]
    winHop: { staggerMs: 100, hopMs: 500, bowMs: 400, hops: 2 }, // [弱]
  },

  // ---- エフェクトの部品(3 層: メイン・サブ・賑やかし / 色は 1 つの効果に 4 つまで) [R2 エフェクトの表] ----
  // life は [最短, 最長]。数は「標準」のとき。粒は使い回しの配列から出す
  parts: {
    glowSprite: { px: 64 },                              // 起動時に 1 回だけ描く丸い光の絵 [R2]
    hit: { flashMs: 80, sparks: 4, sparkLife: [200, 300], sparkSpeed: [120, 260], laterMul: 0.5 }, // 2 発目からは半分
    strong: { ringMs: 225, ringR: [12, 46], sparks: 10, sparkLife: [300, 400], dots: 6, dotLife: 400, flashMs: 80, ringsMax: 3 },
    milestone: { ringMs: 250, dotLife: 500 },
    ringOut: { edgeRingMs: 300, dots: 5, dotLife: 400 },
    shatter: { pieces: [4, 6], ms: 550, dots: 8, dotLife: 400, avgColorPx: 12 }, // 写真の平均色は 8〜16px に縮めて 1 回だけ取る
    blast: { ringMs: 250, flashMs: 100, sparks: 8, smoke: 2, smokeLife: [500, 800], staggerMs: 60, laterRingOnly: true },
    ult: { gather: 12, gatherMs: 500, ringMs: 300, flashMs: 100, sparks: 16, speedLines: 12, speedLineMs: 150 },
    cutin: { firstMs: 600, repeatMs: 300 },              // 構えた瞬間に出す。離した後には挟まない [R1・中]
    gauge: { pieces: 5, sparks: 10, ms: 500 },
    finale: { rings: 2, ringMs: 500, sparks: 14, confetti: 10, life: [800, 1000] },
    win: { dotsPerUnit: 6, ms: 500 },
    damageNumber: { lifeMs: 800 },
  },
  // 加算の光はライトの卓(明るい木の色)では白く飛んで見えない。ライトは通常の重ね方+暗い縁に切り替える [R2]
  glowMode: { light: 'normal', dark: 'lighter' },

  // ---- 音(端末の中で作る。音源ファイルは使わない) [R1 音・R2 声] -----------------------------------
  sound: {
    attackMs: 8,          // 立ち上がり 5〜20 ミリ秒(いきなり最大にすると「プチッ」と鳴る) [R1・弱]
    voicesMax: 6,         // 同時に鳴る音の上限 [R1]
    jitterSemi: 0.5,      // 毎回の高さのゆらし(±1 半音以内から) [R1・弱]
    master: 0.9,
    // れんさの音階。既定は 5 音階、半音と聴き比べて決める [R2 食い違い 1・耳]
    scales: { pentatonic: [0, 2, 4, 7, 9], semitone: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    scale: 'pentatonic',
    chainBaseHz: 330,     // れんさ 1 の高さ(今の当たりの音と同じ)
    chainCap: 10,         // 10 で頭打ち
    // 引っぱりの段の音: 今は長 3 度ずつで、3 段で増三和音になる → ドミソ [R2 #8]
    step: { baseHz: 392, semis: [0, 0, 4, 7], legacySemis: [0, 0, 4, 8] },
    chord: [0, 4, 7, 12], // 節目の和音(3 は 2 音、5 は 3 音、10 は 4 音)
    duck: { db: -6, ms: 250 }, // 呼びかけが鳴る間は衝突音を下げる [R2]
    // 呼びかけ(声っぽい合成音): のこぎり波を母音の帯域の山 2 つに通す [R2・弱]
    // a と i は R2 の出典の値。u・e・o は Peterson & Barney(1952)の男声の平均の目安 [弱・耳]
    formants: { a: [800, 1200], i: [300, 2200], u: [300, 870], e: [530, 1840], o: [570, 840] },
    callout: { baseHz: 220, noteMs: 140, gapMs: 30, riseSemi: 5, layerSemi: 4, layersMax: 3, maxMs: 800 },
    // 勝ち: 上がって最後の音を伸ばす(4〜6 音・1.0〜1.5 秒) / 負け: 下がる 3 音(今のまま)
    win: { semis: [0, 4, 7, 12], noteMs: 90, lastMs: 420 },
    lose: { hz: [392, 311, 233], noteMs: 120 },
  },
};
