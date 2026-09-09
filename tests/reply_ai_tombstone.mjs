// Replier 公開停止ページの後始末処理を検査する。
//
// 検査対象は「書いたつもりのコード」ではなく、reply-ai/index.html に実際に入っている
// インラインスクリプトそのもの。ファイルから取り出して偽の localStorage の上で走らせる。
//
// 使い方: node tests/reply_ai_tombstone.mjs [--mutate]
//   --mutate を付けると、わざと壊した版で走らせて「ちゃんと落ちること」を確かめる。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = join(here, '..', 'reply-ai', 'index.html');
const MUTATE = process.argv.includes('--mutate');

function extractInlineScript(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('reply-ai/index.html にインラインスクリプトが無い');
  return m[1];
}

// 偽の localStorage(挿入順を保つ)
function makeStorage(seed) {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key(i) { return Array.from(map.keys())[i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    _keys() { return Array.from(map.keys()); },
  };
}

function run(code, seed) {
  const localStorage = makeStorage(seed);
  const el = { textContent: '', hidden: true };
  const document = { getElementById: (id) => (id === 'wiped' ? el : null) };
  const window = {}; // 'caches' in window === false
  const navigator = {}; // 'serviceWorker' in navigator === false
  const fn = new Function('localStorage', 'document', 'window', 'navigator', code);
  fn(localStorage, document, window, navigator);
  return { remaining: localStorage._keys(), message: el.textContent, shown: !el.hidden };
}

const SEED = {
  'reply_ai_key': 'sk-ant-XXXXXXXXXXXX',
  'reply_ai_onboarded': '1',
  'reply_ai_adopted': '[]',
  'reply_ai_timeout_ms': '60000',
  'reply_ai_install_hint_closed': '1',
  'replyResults': '{}',
  // Replier とは無関係の保存データ。巻き添えで消してはいけない
  'setlythm_songs': '[{"t":"曲A"}]',
  'rk_appId': 'user-rakuten-id',
};

let code = extractInlineScript(readFileSync(PAGE, 'utf8'));
if (MUTATE) {
  // 変異: 接頭辞の判定を壊す(先頭一致でなく「含む」にする)。
  // これだと無関係のキーまで巻き添えで消えるので、テストは落ちなければならない。
  const before = code;
  code = code.replace("k.indexOf('reply') === 0", "k.indexOf('reply') >= -1");
  if (code === before) throw new Error('変異を注入できなかった(検査対象のコードが変わっている)');
}

const r = run(code, SEED);

const failures = [];
const check = (ok, label, detail) => { if (!ok) failures.push(`${label}${detail ? ' — ' + detail : ''}`); };

// 1. APIキーを含む reply* のキーが全部消えている
const leftoverReply = r.remaining.filter((k) => k.startsWith('reply'));
check(leftoverReply.length === 0, 'reply* のキーが残っている', leftoverReply.join(', '));

// 2. 無関係の保存データは残っている(巻き添え削除をしていない)
check(r.remaining.includes('setlythm_songs'), 'セトリズムの保存データを巻き添えで消した');
check(r.remaining.includes('rk_appId'), 'JANツールの設定を巻き添えで消した');

// 3. 消したことを利用者に表示している
check(r.shown, '削除したのに画面に何も表示していない');
check(r.message.includes('6'), '削除件数の表示が実際と合っていない', `表示="${r.message}"`);

console.log(`モード: ${MUTATE ? '変異注入(落ちるのが正しい)' : '通常'}`);
console.log(`残ったキー: ${r.remaining.join(', ') || '(なし)'}`);
console.log(`表示: ${r.message || '(なし)'}`);

if (MUTATE) {
  if (failures.length === 0) {
    console.log('\nNG: 変異を入れたのにテストが通ってしまった。この検査器は信用できない。');
    process.exit(1);
  }
  console.log(`\nOK: 変異で ${failures.length} 件落ちた(検査器はNOと言える)`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(0);
}

if (failures.length) {
  console.log(`\n不合格 ${failures.length} 件:`);
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
console.log('\n合格: APIキーを含む reply* を6件削除し、無関係の2件は残した。');
