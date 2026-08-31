// 事実ファイアウォール(2026-09-01 発注者指示で新設)。
//
// 考え方の転換: 「新しい表現・固有名詞を全部禁止する」のをやめ、**嘘になる個人事実だけ**を止める。
//   - 反応・感情・質問・未来の興味・軽い冗談・一時的な感想 … 入力に無くても自由(誤停止させない)
//   - 過去体験・習慣・確立した好み・所有・属性・専門性 … 有効な自分情報か自分の過去発言に根拠が要る
//   - 固有名詞は全面禁止しない: 入力の再利用=可 / 新規×質問・未来=soft / 新規×個人事実=hard
//
// 判定は3値。hard_reject の候補は**部分置換せず候補ごと破棄**する(呼び出し側の契約)。
//   ok        … そのまま使える
//   soft_risk … 使ってよいが人間確認で見せる(新しい固有名詞・一般的な過去の言い回し)
//   hard_reject … 破棄
//
// 日本語では主語が落ちるので「自分/僕/俺」が無くても検査する。逆に、相手に帰属する言い方
// (「〜さんは」「〜ですよね」)や質問文は自分の事実として数えない。
//
// 限界(文書にも明記):
//   - スクリーンショット入力は元テキストを独立照合できないため「完全検出」は主張しない
//   - 未知の固有名詞・暗黙の個人事実を全て検出できるとは主張しない(人間確認が最終判定)
//
// このファイルは本番UIと pricing_eval 評価器の両方から import される単一実装
// ([[ungrounded.mjs]] と同じ方針)。片方だけ直さないこと。

import { extractNameTokens, findFabricationHints } from './ungrounded.mjs';

// ---------------------------------------------------------------------------
// 未解決プレースホルダ(本番表示禁止・2026-09-01 決定)。従来 fidelity_checks.mjs にあった正本をここへ移し、
// 評価器は再輸出で同じものを使う(二重定義を作らない)。「相手さん」= 相手の名前が分からないままの代名詞。
export const PLACEHOLDER_RE = new RegExp('[○〇◯]{2,}|△△|▲▲|××|ＸＸ|□□|■■' + '|(?:^|[^A-Za-z])(?:XX+|xx+|TBD|NAME|PLACE)(?![A-Za-z])|_{2,}|＿{2,}' + '|［(?:店名|場所|地名|名前|お店|駅名|日付|日時|時間|相手の名前|名字|下の名前|自分の名前|地域)］|\\[(?:店名|場所|地名|名前|お店|駅名|日付|日時|時間|相手の名前|名字|下の名前|自分の名前|地域)\\]|〈(?:店名|場所|地名|名前|お店|駅名|日付|日時|時間|相手の名前|名字|下の名前|自分の名前|地域)〉|《(?:店名|場所|地名|名前|お店|駅名|日付|日時|時間|相手の名前|名字|下の名前|自分の名前|地域)》|【(?:店名|場所|地名|名前|お店|駅名|日付|日時|時間|相手の名前|名字|下の名前|自分の名前|地域)】|[(（](?:店名|場所|地名|名前|お店|駅名|日付|日時|時間|相手の名前|名字|下の名前|自分の名前|地域)[)）]' + '|(?:店名|場所|地名|名前)を?(?:入力|記入|入れ)' + '|相手さん|お相手さん');

// 自動送信・操作を促す表現(本番に無い機能を提案させない・相手を操作しない)
export const MANIPULATION_RE = /自動(?:で|的に)?(?:送信|返信|送っ)|代わりに送(?:り|っ)|勝手に送|既読(?:を)?つけ(?:ず|ない)|相手を(?:焦らせ|試す|煽)|わざと(?:既読|未読|返さ)|返信を予約/;

// ---------------------------------------------------------------------------
// 許可される表現(誤停止させない)。ここに当たる文は「個人事実」として扱わない。
// 未来の意向・願望
const FUTURE_RE = /(?:てみ|て)?たい(?:な|です|と|ね|!|！|。|$|、|笑)|たくなっ|してみよう|行ってみ|やってみ|試してみ|興味(?:ある|あり|出|わい)|気にな(?:る|って|り)|知りたい|聞きたい|教えて(?:ほしい|ください)|おすすめ(?:あ|教|聞)|予定です|しようかな|次(?:は|に)/;
// 反応・感想(その場の気持ち)
const REACTION_RE = /いい(?:ね|な|なあ|ですね|じゃん)|楽し(?:そう|い)|美味し?そう|おいしそう|すご(?:い|そう)|素敵|わかる|それな|羨まし|うらやまし|笑$|草$|ワクワク|テンション|嬉しい|ありがとう/;
// 相手への帰属(「〜さんは」「〜ですよね」「〜って書いてた」)= 自分の事実ではない
const ATTRIBUTION_TAIL_RE = /(?<!よ)ね[。!！?？…〜ー]?$|でしょ|そうです(?:ね|よ)|らしい(?:です)?|って(?:書|言|聞)/;
const SECOND_PERSON_RE = /(?:さん|ちゃん|くん|あなた|そちら|君)(?:は|が|も|って|の)|お相手/;
// 否定(自分の事実を「無い」と言うのは安全な断り。捏造の向きではないので許可)
const NEGATION_RE = /な(?:い|く|かった)|ませ(?:ん|んでした)|ないです|無い|未経験|ことがな|ことな|ず(?:に|、|。|$)|できてな|出てな|弱いです|無知/;

// ---------------------------------------------------------------------------
// 個人事実のパターン(根拠が無ければ hard)。key は理由コードになる。
const HARD_PATTERNS = [
  // 過去体験(「行ってみたい」「食べたく」を巻き込まないよう、た/ました形に限定し直後の く/い を除外)
  ['past_experience', /(?:行っ|来|寄っ|訪れ|泊まっ|食べ|飲ん|読ん|観|見|買っ|作っ|通っ|回っ|開拓し|開拓でき|参加し|体験し|経験し|履い|着|使っ|住ん|やっ|覚え|習っ|飼っ)(?:た(?!く[なて]|い)|だ(?!ろ|け)|て(?:き|い)?(?:た(?!く[なて]|い)|ます|る)|て(?:い)?(?:な(?:い|く|かっ)|ませ)|ちゃった|で(?:た(?!く[なて]|い)|る|ます|います))|(?:行き|来|寄り|訪れ|泊まり|食べ|飲み|読み|観|見|買い|作り|通い|回り|開拓し|参加し|体験し|経験し|履き|着|使い|住み|やり)ました(?!ら)|(?:経験|行ったこと|来たこと|食べたこと|飲んだこと|読んだこと|見たこと|観たこと|買ったこと|作ったこと|住んだこと|使ったこと|飼ったこと|やったこと)(?:が|は|も)?(?:ない|な(?:い|く|かっ)|ありませ|なくて)/],
  // 習慣・頻度
  ['habit_frequency', /週[0-9０-９一二三四五]|毎(?:日|週|月|朝|晩|回)|いつも|よく(?:行|来|食べ|飲|読|観|見|買|使|する)|しょっちゅう|(?:月|週|年)に[0-9０-９一二三四五六七八九十]+回|ばっか(?:り|りです)|ばかりで|(?:普段|平日|休日|週末)は[^。！？!?\n]{0,12}(?:ます|ました|てる|でる|です|でした)/],
  // 確立した好み(「〜派」「〜が好き」。質問・帰属は上位で除外)
  ['established_preference', /派(?:です|だ|な(?:ん|の)|かな|で[、。]|$)|(?:が|は|も)好き(?:です|だ|な(?:ん|の)|で)|好きです|好きなん|苦手(?:です|だ|な(?:ん|の)|で)|嫌い(?:です|だ|な(?:ん|の))|(?:こだわ|拘)(?:り|って)|寄りが多い|の酸味あるやつが好き/],
  // 所有・生活状態
  ['possession_state', /飼っ(?:て|た)|持って(?:る|ます|い(?:る|ます|ない|ません)|ない|ませ)|履いて(?:る|ます|います|ない|ません)|着て(?:る|ます|います|ない|ません)|一人暮らし|実家暮らし|住んで(?:る|ます|います|ない|ません)|愛用/],
  // 属性(職業・住所・家族・交際)
  ['profile_fact', /仕事は|勤め(?:て|先)|職業は|会社は|独身|既婚|元カ(?:ノ|レ)|元彼|(?:兄|姉|弟|妹|嫁|妻|夫)(?:が|は|と)|実家は|出身は|大学は|[0-9０-９]{1,2}(?:歳|才)です/],
  // 専門性・経験(「詳しくない」は否定なので当たらない書き方にする)
  ['expertise', /詳し(?:いです(?![かね])|い(?=[。、!?！？\s]|$)|くて)|得意(?:です|な(?:ん|の)|で)|やってました|やってた|習ってた|経験があ|資格(?:を)?(?:持|取)/],
  // 行きつけ・常連
  ['regular_place', /行きつけ|常連|馴染みの(?:店|お店)|通ってる(?:店|お店)/],
  // 主語つきの範囲限定(「自分はバリとハワイだけなんで」「自分は近場ばっかり」= 経歴の断定)
  ['self_scope_claim', /(?:自分|僕|俺|私)(?:は|も)[^。！？!?\n]{0,24}(?:だけ(?:です|な(?:ん|の)|で)|ばっか(?:り|りです)|ばかりです|中心です)/],
];

// §2 謙遜(2026-09-01 FIX_REQUIRED)。「詳しくない」「よく知らない」は事実の申告なので ok にはしない。
// ただし嘘を作る向きではないので hard にもしない = soft_risk(人間確認へ回す)。
// 「詳しく知りたい」「もう少し知りたい」「教えてほしい」「気になる」は非事実表現なので当たらないこと。
const MODESTY_RE = /(?:あんまり|あまり|そこまで|そんなに|全然)?詳しく(?:な(?:い|く|かっ)|ありませ|なさ)|よく(?:知らな|分からな|わからな)|(?:あまり|あんまり|全然|そこまで)(?:知らな|分からな|わからな)|知識(?:が|は)?(?:あまり|全然)?(?:な(?:い|く)|浅)|得意(?:じゃ|では)な|苦手というか|素人(?:です|なん|で)/;

// §3 日常行動の捏造(2026-09-01 FIX_REQUIRED)。根拠のない「自分がやった日常の行動」は hard。
// 主語(自分/俺/僕)が無くても検出する。相手への質問(「仕事終わりました?」)は節が疑問文なので上位で除外される。
const DAILY_ACTION_RE = /洗濯|掃除|皿洗い|洗い物|片付け|料理|自炊|買い物|買い出し|仕事|残業|バイト|出勤|通勤|勉強|散歩|ジム|筋トレ|ランニング|外出|出かけ|家(?:から|を)出|帰っ|帰り|寝坊|昼寝|二度寝|飲み会|旅行|出張|映画|ドラマ|アニメ|ゲーム/;
const DAILY_TENSE_RE = /ました(?!ら)|てました|てた(?![くいら])|でした|終わ(?:り|っ)|きました|てきた|ています|てます|てる(?![か])|でる(?![か])|中でした|て(?:い)?な(?:い|く|かっ)|ていませ/;

// その場の気持ちの変化(「お腹すいてきた」「食べたくなってきた」)は一時的な感想であって過去の断定ではない
const MOMENTARY_RE = /てき(?:た|ました)|たくなっ|なってき/;

// 一般的な過去の言い回し(soft)。丁寧表現の定型は除く
const GENERIC_PAST_RE = /(?:ました(?!ら)|でした|だった(?![らり])|てました|てた(?![くいら]))/;
const POLITE_PAST_ALLOW_RE = /ありがとうございました|すみませんでした|お疲れ(?:様|さま)でした|失礼しました|わかりました|了解しました|承知しました|よかったです|楽しかったです/;

const CLAUSE_SPLIT_RE = /[。．！!？?、，\n\s]/;

/** 全角/半角の記号ゆれを吸収(判定用) */
export function normalizeForCheck(text) {
  return String(text ?? '').replace(/？/g, '?').replace(/！/g, '!').replace(/　/g, ' ');
}

/** 文を節に割り、各節が疑問文かどうかを付ける(疑問符は直前の節に属する) */
export function splitClauses(text) {
  const t = normalizeForCheck(text);
  const out = [];
  let buf = '';
  for (const ch of t) {
    if (CLAUSE_SPLIT_RE.test(ch)) {
      const isQ = ch === '?';
      if (buf.trim()) out.push({ text: buf, isQuestion: isQ });
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) out.push({ text: buf, isQuestion: false });
  // 「〜ですか」「〜ますか」で終わる節も疑問扱い(?を打たない書き方)
  for (const c of out) {
    if (/(?:です|ます|でしょう)か$|^(?:どんな|どこ|なに|何|いつ|どう|どっち|どちら)/.test(c.text.trim())) c.isQuestion = true;
  }
  return out;
}

/**
 * 有効な自分情報と食い違う断定の検出(現状は「〜派」の食い違いだけ)。
 * **全ての矛盾を検出できるとは主張しない**(人間確認が最終判定)。
 */
export function findFactContradictions(text, factTexts = []) {
  // 「〜派」の直前の内容語だけを取る(助詞・主語は含めない)
  const pref = (s) => [...String(s).matchAll(/([^\s、。!?！？はがもをにでとの]{1,4})派/g)].map((m) => m[1]).filter(Boolean);
  // 質問文(「どっち派ですか?」)は自分の断定ではないので対象外
  const mine = splitClauses(text).filter((c) => !c.isQuestion).flatMap((c) => pref(c.text));
  if (!mine.length) return [];
  const out = [];
  for (const f of factTexts) {
    for (const fp of pref(f)) {
      for (const mp of mine) {
        if (mp === fp || out.some((o) => o.detail.includes(`「${mp}派」`))) continue;
        out.push({ code: 'fact_contradiction', level: 'hard_reject', detail: `有効な自分情報(${fp}派)と食い違う断定: 「${mp}派」` });
      }
    }
  }
  return out;
}

/** 節が「相手のこと」を言っているか(自分の事実として数えない) */
function isAttributedToPartner(clause) {
  return SECOND_PERSON_RE.test(clause) || ATTRIBUTION_TAIL_RE.test(clause.trim());
}

/** マッチ位置の直後に否定が来ているか(「行ったことない」「詳しくない」「開拓できてない」) */
function isNegated(clause, matchEnd) {
  return NEGATION_RE.test(clause.slice(matchEnd, matchEnd + 6));
}

/** 有効な自分情報・自分の過去発言に根拠があるか */
function isGrounded(clause, groundingTexts) {
  const c = clause.replace(/[\s、。!?]/g, '');
  for (const g of groundingTexts) {
    const s = String(g ?? '').replace(/[\s、。!?]/g, '');
    if (!s) continue;
    if (c.includes(s) || s.includes(c)) return true;
    // 事実文の中身が節に含まれていれば根拠ありとみなす。ただし「ですけど」「好きです」のような
    // ひらがなだけの定型で根拠ありにしないため、(a)5文字以上かつ漢字/カタカナを含む重なり、または
    // (b)自分情報の内容語(漢字/カタカナ2文字以上)が節にある、のどちらかを要求する(実測の誤判定対策)
    for (let i = 0; i + 5 <= s.length; i++) {
      const piece = s.slice(i, i + 5);
      if (!/[一-龠ァ-ヴー0-9０-９]/.test(piece)) continue;
      if (c.includes(piece)) return true;
    }
    for (const tok of s.match(/[一-龠ァ-ヴー0-9０-９]{2,}/g) || []) {
      if (c.includes(tok)) return true;
    }
  }
  return false;
}

/**
 * 個人事実の検査。
 * @param {string} text 候補本文
 * @param {{conversationText?:string, selfMessages?:string[], enabledFactTexts?:string[]}} ctx
 * @returns {{code:string, level:'hard_reject'|'soft_risk', clause:string, detail:string}[]}
 */
export function findPersonalFacts(text, ctx = {}) {
  const grounding = [...(ctx.selfMessages || []), ...(ctx.enabledFactTexts || [])];
  const found = [];
  for (const clause of splitClauses(text)) {
    let c = clause.text;
    // 相手への言及(「〜さんは」)がある場合、その手前までは自分の発言として検査する
    const sp = SECOND_PERSON_RE.exec(c);
    if (sp) {
      if (sp.index === 0) continue;           // 節の頭から相手の話 = 自分の事実ではない
      c = c.slice(0, sp.index);
    } else {
      if (clause.isQuestion) continue;        // 質問は自分の事実ではない
      if (isAttributedToPartner(c)) continue; // 相手のことは自分の事実ではない
    }
    for (const [code, re] of HARD_PATTERNS) {
      const m = re.exec(c);
      if (!m) continue;
      if (isGrounded(c, grounding)) continue;              // 有効な自分情報・自分の過去発言に根拠あり
      // §1(2026-09-01 FIX_REQUIRED): 肯定・否定にかかわらず個人事実として扱う。
      // 「行ったことがない」「持っていない」も、根拠が無ければ嘘になるので hard。
      const negated = isNegated(c, m.index + m[0].length);
      found.push({
        code, level: 'hard_reject', clause: c.trim(),
        detail: `根拠のない個人事実(${code}${negated ? '・否定形' : ''}): 「${m[0]}」`,
      });
    }
    // §3 日常行動の捏造(根拠のない自分の行動)。丁寧表現の定型(お疲れ様でした 等)は除く
    if (DAILY_ACTION_RE.test(c) && DAILY_TENSE_RE.test(c) && !POLITE_PAST_ALLOW_RE.test(c) && !isGrounded(c, grounding)) {
      const dm = DAILY_ACTION_RE.exec(c);
      found.push({ code: 'daily_action_claim', level: 'hard_reject', clause: c.trim(), detail: `根拠のない自分の行動(${dm[0]}): 「${c.trim()}」` });
    }
    // §2 謙遜(「詳しくない」「よく知らない」)。hard にはしないが ok でもない
    if (MODESTY_RE.test(c) && !isGrounded(c, grounding)) {
      const mm = MODESTY_RE.exec(c);
      found.push({ code: 'modesty_claim', level: 'soft_risk', clause: c.trim(), detail: `根拠のない自己申告(謙遜): 「${mm[0]}」` });
    }
    // 一般的な過去の断定(「〜でした」「〜ました」)は soft。定型の丁寧表現は除く
    if (!found.some((f) => f.clause === c.trim())) {
      const gm = GENERIC_PAST_RE.exec(c);
      if (gm && !POLITE_PAST_ALLOW_RE.test(c) && !isNegated(c, gm.index + gm[0].length) && !isGrounded(c, grounding) && !FUTURE_RE.test(c) && !MOMENTARY_RE.test(c)) {
        found.push({ code: 'generic_past_claim', level: 'soft_risk', clause: c.trim(), detail: `過去の断定(自動では真偽を判定できない): 「${gm[0]}」` });
      }
    }
  }
  return found;
}

/**
 * 固有名詞の検査。入力にあるものは可。新規は文脈で hard / soft を分ける。
 * @returns {{code:string, level:'hard_reject'|'soft_risk', token:string, detail:string}[]}
 */
export function findProperNounRisks(text, ctx = {}) {
  const groundingText = String(ctx.conversationText ?? '');
  // place_store(「〈地名〉の〈語〉」)は一般語を拾う誤検出が実測で出たため、firewall では使わない
  // (人間確認ページの候補提示としては引き続き有効)。ここは実在名の固定リストと固有名詞抽出だけ。
  const hints = findFabricationHints([text], groundingText).filter((h) => h.kind === 'known_brand' || h.kind === 'known_place');
  const tokens = new Set([...extractNameTokens(text)].filter((t) => !groundingText.includes(t)));
  for (const h of hints) if (!groundingText.includes(h.text)) tokens.add(h.text);
  if (!tokens.size) return [];

  const clauses = splitClauses(text);
  const out = [];
  for (const tok of tokens) {
    const clause = clauses.find((c) => c.text.includes(tok)) || { text, isQuestion: false };
    const factHere = findPersonalFacts(clause.text, ctx).some((f) => f.level === 'hard_reject');
    if (clause.isQuestion || FUTURE_RE.test(clause.text) || REACTION_RE.test(clause.text)) {
      out.push({ code: 'new_proper_noun', level: 'soft_risk', token: tok, detail: `入力に無い固有名詞(質問・未来の文脈): 「${tok}」` });
    } else if (factHere || !isAttributedToPartner(clause.text)) {
      out.push({ code: 'proper_noun_personal_history', level: 'hard_reject', token: tok, detail: `入力に無い固有名詞を自分の事実として断定: 「${tok}」` });
    } else {
      out.push({ code: 'new_proper_noun', level: 'soft_risk', token: tok, detail: `入力に無い固有名詞: 「${tok}」` });
    }
  }
  return out;
}

/**
 * 候補1件の事実面の判定。
 * @param {string} text
 * @param {{conversationText?:string, selfMessages?:string[], enabledFactTexts?:string[]}} ctx
 * @returns {{verdict:'ok'|'soft_risk'|'hard_reject', reasons:{code:string, level:string, detail:string}[]}}
 */
export function checkFactFirewall(text, ctx = {}) {
  const reasons = [];
  const t = String(text ?? '');
  if (PLACEHOLDER_RE.test(t)) reasons.push({ code: 'placeholder', level: 'hard_reject', detail: '未解決のプレースホルダ・呼びかけ(そのまま送れない)' });
  if (MANIPULATION_RE.test(t)) reasons.push({ code: 'manipulation_or_autosend', level: 'hard_reject', detail: '自動送信・操作を促す表現' });
  reasons.push(...findPersonalFacts(t, ctx));
  reasons.push(...findFactContradictions(t, ctx.enabledFactTexts || []));
  reasons.push(...findProperNounRisks(t, ctx));
  const verdict = reasons.some((r) => r.level === 'hard_reject') ? 'hard_reject'
    : reasons.some((r) => r.level === 'soft_risk') ? 'soft_risk' : 'ok';
  return { verdict, reasons };
}

/** 表現が「許可された反応・質問・未来の興味」に当たるか(誤停止の検査用・判定の補助) */
export function isAllowedConversationalMove(text) {
  const t = normalizeForCheck(text);
  return FUTURE_RE.test(t) || REACTION_RE.test(t) || /\?$/.test(t.trim()) || splitClauses(t).some((c) => c.isQuestion);
}
