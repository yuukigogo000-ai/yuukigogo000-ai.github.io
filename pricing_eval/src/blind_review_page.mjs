// blind review 採点ページ生成。
//
// 3つの full run の blind_review.csv を突合し、モデル名を伏せたまま
// 1ページで採点できる HTML を runs/_summary/blind_review_scoring.html に出力する。
//
// - モデル→匿名ラベル(A/B/C)の対応は crypto シャッフルで決め、
//   runs/_summary/blind_mapping.json にだけ保存する(採点完了まで人に見せない)。
// - 採点結果はページ内の「書き出し」ボタンで CSV テキスト化して回収する。
//
// 使い方: node pricing_eval/src/blind_review_page.mjs --runs=<runId,runId,runId>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomInt } from 'node:crypto';
import { parseArgs, isCliEntry } from './lib/config.mjs';
import { logInfo, logError } from './lib/log.mjs';

const RUNS_DIR = 'pricing_eval/runs';

export function parseCsv(t) {
  const rows = []; let i = 0, f = '', row = [], q = false;
  while (i < t.length) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (f !== '' || row.length) { row.push(f); rows.push(row); row = []; f = ''; } }
    else f += c;
    i++;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function main() {
  const args = parseArgs();
  const runIds = String(args.runs || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (runIds.length < 2) throw new Error('--runs=<runId,runId,...> を2つ以上指定してください');

  // 匿名ラベル割り当て(crypto シャッフル)。対応表はファイルにのみ書く。
  const labels = ['A', 'B', 'C', 'D'].slice(0, runIds.length);
  const shuffled = [...runIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const mapping = {};
  shuffled.forEach((r, i) => { mapping[labels[i]] = r; });
  const outDir = join(RUNS_DIR, '_summary');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'blind_mapping.json'), JSON.stringify({ note: '採点完了まで開かない', mapping }, null, 2));

  // CSV 読み込み → case_id で突合
  const byLabel = {};
  for (const [label, runId] of Object.entries(mapping)) {
    const rows = parseCsv(readFileSync(join(RUNS_DIR, runId, 'blind_review.csv'), 'utf8'));
    const header = rows[0];
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    byLabel[label] = new Map(rows.slice(1).map((r) => [r[idx.case_id], {
      caseId: r[idx.case_id], category: r[idx.category],
      replies: [r[idx.reply_1], r[idx.reply_2], r[idx.reply_3]],
    }]));
  }
  // 選定はrunごとに微差が出る(モデル固有の要注意ケースを含むため)。和集合を採点対象とし、
  // CSVに無いぶんは同runの results.jsonl から補完する(全ケース実行済みなので必ず存在する)。
  const union = new Set();
  for (const l of labels) for (const id of byLabel[l].keys()) union.add(id);
  for (const [label, runId] of Object.entries(mapping)) {
    const missing = [...union].filter((id) => !byLabel[label].has(id));
    if (!missing.length) continue;
    const results = new Map(
      readFileSync(join(RUNS_DIR, runId, 'results.jsonl'), 'utf8').split('\n')
        .filter((s) => s.trim()).map((s) => JSON.parse(s)).map((r) => [r.caseId, r]),
    );
    for (const id of missing) {
      const r = results.get(id);
      if (!r) throw new Error(`${runId} の results.jsonl に ${id} がありません(突合不能)`);
      byLabel[label].set(id, {
        caseId: id, category: r.category,
        replies: r.success ? r.replies : null,
        failureNote: r.success ? null : `3案の生成に失敗(${r.failureKind})`,
      });
    }
  }

  const cases = JSON.parse(readFileSync('pricing_eval/cases.json', 'utf8')).cases;
  // ケース順は cases.json の並び(カテゴリごとにまとまる)
  const caseIds = cases.filter((c) => union.has(c.id)).map((c) => c.id);
  const catName = {
    text_short: 'テキスト短', text_long: 'テキスト長', screenshot_1_3: 'スクショ1〜3枚',
    screenshot_4_6: 'スクショ4〜6枚', style: '文体指定', edge: '境界ケース',
  };

  const scoreDefs = [
    ['natural', '自然さ', 25], ['context', '文脈適合', 25], ['style', '文体', 20],
    ['diversity', '多様性', 10], ['no_fab', '捏造なし', 10], ['no_refusal', '誤拒否なし', 10],
  ];

  let caseHtml = '';
  caseIds.forEach((id, n) => {
    const c = cases.find((x) => x.id === id);
    let inputHtml = `<p class="goal"><b>今回の狙い:</b> ${esc(c.goal)}</p>`;
    if (c.partner_profile) inputHtml += `<p class="meta"><b>相手(架空):</b> ${esc(c.partner_profile.nickname)} — ${esc(c.partner_profile.note)}</p>`;
    if (c.style_sample) inputHtml += `<p class="meta"><b>自分の文体サンプル:</b> ${esc(c.style_sample)}</p>`;
    if (c.images && c.images.length) {
      const imgs = c.images.map((f) => {
        const b64 = readFileSync(join('pricing_eval/screenshots', f)).toString('base64');
        return `<img src="data:image/png;base64,${b64}" alt="トーク画面">`;
      }).join('');
      inputHtml += `<div class="shots">${imgs}</div><p class="meta">画面の右側が自分・左側が相手(古い順)</p>`;
    } else {
      inputHtml += '<div class="conv">' + c.conversation.map((t) =>
        `<div class="bubble ${t.from === 'self' ? 'self' : 'other'}"><span class="who">${t.from === 'self' ? '自分' : '相手'}</span>${esc(t.text)}</div>`,
      ).join('') + '</div>';
    }

    const cols = labels.map((l) => {
      const row = byLabel[l].get(id);
      const replies = row.replies
        ? row.replies.map((r, i) => `<div class="reply"><span class="rn">案${i + 1}</span>${esc(r)}</div>`).join('')
        : `<div class="reply fail">⚠ ${esc(row.failureNote || '出力なし')}</div>`;
      const inputs = scoreDefs.map(([key, name, max]) =>
        `<label class="sc"><span>${name}<em>/${max}</em></span><input type="number" min="0" max="${max}" data-case="${esc(id)}" data-label="${l}" data-key="${key}"></label>`,
      ).join('');
      return `<div class="model"><h4>モデル ${l}</h4>${replies}
        <div class="scores">${inputs}</div>
        <input type="text" class="cmt" placeholder="コメント(任意)" data-case="${esc(id)}" data-label="${l}" data-key="comment"></div>`;
    }).join('');

    caseHtml += `<section class="case" id="case-${esc(id)}">
      <h3><span class="no">${n + 1}/${caseIds.length}</span> ${esc(id)} <span class="cat">${catName[c.category] || esc(c.category)}</span></h3>
      <div class="input">${inputHtml}</div>
      <div class="models">${cols}</div>
    </section>`;
  });

  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Replier ブラインド採点表</title>
<style>
:root{--ink:#1a1a24;--sub:#5a5a6e;--line:#d9d9e3;--bg:#f4f4f8;--card:#fff;--accent:#3b5bcc;}
*{box-sizing:border-box}body{margin:0;font-family:"Hiragino Sans","Yu Gothic UI",system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.65}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:10px 16px}
header h1{font-size:16px;margin:0 0 4px}
#tally{font-size:13px;color:var(--sub)}
#tally b{color:var(--accent);font-size:15px}
main{max-width:1180px;margin:0 auto;padding:16px}
.rubric{font-size:12.5px;color:var(--sub);margin:2px 0 0}
.case{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:0 0 22px;padding:14px 16px}
.case h3{margin:0 0 10px;font-size:15px;display:flex;gap:8px;align-items:center}
.no{color:var(--sub);font-weight:normal;font-size:12.5px}
.cat{background:#eef1fb;color:var(--accent);border-radius:999px;font-size:12px;padding:1px 10px;font-weight:normal}
.input{background:#fafafd;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-bottom:12px}
.goal{margin:0 0 6px}.meta{margin:4px 0;font-size:13px;color:var(--sub)}
.conv{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.bubble{max-width:72%;padding:7px 11px;border-radius:12px;font-size:13.5px;position:relative}
.bubble .who{display:block;font-size:10.5px;color:var(--sub);margin-bottom:1px}
.other{background:#ececf2;align-self:flex-start;border-bottom-left-radius:3px}
.self{background:#dbe6ff;align-self:flex-end;border-bottom-right-radius:3px}
.shots{display:flex;gap:8px;overflow-x:auto;padding:6px 0}
.shots img{height:340px;border:1px solid var(--line);border-radius:6px;flex:0 0 auto}
.models{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:900px){.models{grid-template-columns:1fr}}
.model{border:1px solid var(--line);border-radius:8px;padding:10px}
.model h4{margin:0 0 8px;font-size:13.5px;color:var(--accent)}
.reply{background:#f7f8fc;border-left:3px solid #c5cdea;border-radius:0 6px 6px 0;padding:6px 9px;margin:0 0 6px;font-size:13.5px}
.reply.fail{background:#fdf1f1;border-left-color:#d98c8c;color:#8a3232}
.rn{display:block;font-size:10.5px;color:var(--sub)}
.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 8px;margin:8px 0 6px}
.sc{font-size:11px;color:var(--sub);display:flex;flex-direction:column}
.sc em{font-style:normal;opacity:.7}
.sc input{width:100%;padding:3px 6px;border:1px solid var(--line);border-radius:5px;font-size:13px}
.sc input.done{background:#eaf7ea;border-color:#9ccc9c}
.cmt{width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:5px;font-size:12.5px}
.export{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
button{background:var(--accent);color:#fff;border:0;border-radius:7px;padding:8px 18px;font-size:14px;cursor:pointer}
textarea{width:100%;height:180px;margin-top:10px;font:12px/1.5 Consolas,monospace;border:1px solid var(--line);border-radius:6px;padding:8px}
</style></head><body>
<header><h1>Replier ブラインド採点表(${caseIds.length}ケース × モデル${labels.join('・')})</h1>
<div id="tally">未採点</div>
<p class="rubric">配点: 自然さ25・文脈適合25・文体20・多様性10・捏造なし10・誤拒否なし10 = 100点。3案まとめて1モデル1ケースを採点。入力は自動保存(この画面内)。最後に一番下の「採点を書き出す」を押してテキストをClaudeへ貼り付けてください。</p></header>
<main>
${caseHtml}
<div class="export"><h3>採点の書き出し</h3>
<p style="font-size:13px;color:var(--sub)">全部でなくても、入力済みの分だけ書き出せます。</p>
<button id="exp">採点を書き出す</button>
<textarea id="out" readonly placeholder="ここに CSV テキストが出ます。全選択してコピーし、Claude に貼り付けてください。"></textarea></div>
</main>
<script>
(function(){
  var KEY='replier_blind_review_v1';
  var store={};
  try{store=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){store={}}
  var fields=document.querySelectorAll('input[data-case]');
  function fid(el){return el.dataset.case+'|'+el.dataset.label+'|'+el.dataset.key}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}}
  function tally(){
    var per={},cnt={};
    fields.forEach(function(el){
      if(el.dataset.key==='comment'||el.value==='')return;
      var k=el.dataset.label;per[k]=(per[k]||0)+Number(el.value);
      cnt[k+'|'+el.dataset.case]=1;
    });
    var lines=Object.keys(per).sort().map(function(k){
      var cases=Object.keys(cnt).filter(function(x){return x.indexOf(k+'|')===0}).length;
      return 'モデル'+k+': <b>'+per[k]+'</b>点('+cases+'ケース入力済)';
    });
    document.getElementById('tally').innerHTML=lines.length?lines.join(' / '):'未採点';
  }
  fields.forEach(function(el){
    var v=store[fid(el)];if(v!==undefined){el.value=v;if(el.type==='number'&&v!=='')el.classList.add('done')}
    el.addEventListener('input',function(){
      if(el.type==='number'&&el.max&&Number(el.value)>Number(el.max))el.value=el.max;
      store[fid(el)]=el.value;save();
      if(el.type==='number')el.classList.toggle('done',el.value!=='');
      tally();
    });
  });
  tally();
  document.getElementById('exp').addEventListener('click',function(){
    var head='case_id,model_label,score_natural_25,score_context_25,score_style_20,score_diversity_10,score_no_fabrication_10,score_no_false_refusal_10,comment';
    var keys=['natural','context','style','diversity','no_fab','no_refusal','comment'];
    var rows={},order=[];
    fields.forEach(function(el){
      var rk=el.dataset.case+','+el.dataset.label;
      if(!rows[rk]){rows[rk]={};order.push(rk)}
      rows[rk][el.dataset.key]=el.value;
    });
    var out=[head];
    order.forEach(function(rk){
      var r=rows[rk];
      var any=keys.some(function(k){return r[k]});
      if(!any)return;
      var cells=keys.map(function(k){var v=r[k]||'';return /[",\\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v});
      out.push(rk+','+cells.join(','));
    });
    document.getElementById('out').value=out.length>1?out.join('\\n'):'(まだ入力がありません)';
    document.getElementById('out').select();
  });
})();
</script></body></html>`;

  const outPath = join(outDir, 'blind_review_scoring.html');
  writeFileSync(outPath, html);
  logInfo('採点ページを生成しました(対応表は blind_mapping.json のみ・表示しない)', {
    outPath, cases: caseIds.length, labels: labels.join(','),
  });
}

if (isCliEntry(import.meta.url)) {
  try { main(); } catch (e) { logError(e.message); process.exit(1); }
}
