// Pure planning model: user-entered energy, never inferred from BPM.
const sec = v => Number.isFinite(v) && v > 0 ? v : 0;
export const GOALS = [
  ['', '自由に組む'], ['opener', '最初から飛ばす'], ['buildup', '徐々に引き込む'],
  ['twinPeaks', '緩急をつける'], ['afterglow', '余韻を残す'], ['ushape', '中盤で深く落とす'],
];
export function flowModel(sl, entries) {
  let time = 0, switches = 0, unknownTuning = 0;
  const segments = [], songs = [], missing = [];
  entries.forEach((e, i) => {
    const duration = sec(e.song.sec), start = time;
    if (!duration) missing.push(i);
    const energy = Number.isFinite(e.song.energy) && e.song.energy >= 1 && e.song.energy <= 5 ? e.song.energy : null;
    const song = { kind:'song', index:i, id:e.item.id, start, duration, end:start+duration, energy, title:e.song.title };
    segments.push(song); songs.push(song); time += duration;
    if (e.item.mc && sec(sl.mcSec)) { segments.push({kind:'mc',index:i,start:time,duration:sec(sl.mcSec),end:time+sec(sl.mcSec)}); time += sec(sl.mcSec); }
    if (i < entries.length-1 && sec(sl.gapSec)) { segments.push({kind:'gap',index:i,start:time,duration:sec(sl.gapSec),end:time+sec(sl.gapSec)}); time += sec(sl.gapSec); }
    const tuning = String(e.song.tuning || '').trim();
    if (!tuning) unknownTuning++;
    const prev = i ? String(entries[i-1].song.tuning || '').trim() : '';
    if (prev && tuning && prev !== tuning) switches++;
  });
  const target = sec(sl.targetMin)*60;
  return {segments,songs,total:time,missing,switches,unknownTuning,margin:target && !missing.length ? target-time : null};
}
export function moveDraft(entries, index, direction) {
  const next = entries.slice(), to = index+direction;
  if (index<0 || index>=next.length || to<0 || to>=next.length) return next;
  [next[index],next[to]]=[next[to],next[index]]; return next;
}
export function flowHints(sl, entries, goal='') {
  const hints=[], add=(index,title,text)=>hints.push({index,title,text});
  if (!entries.length) return hints;
  const energy=e=>Number.isFinite(e?.song.energy)?e.song.energy:null;
  const first=energy(entries[0]), last=energy(entries.at(-1));
  if (goal==='opener') add(0,'序盤の狙い',first>=4?'最初の曲は入力エネルギーが高めです。短い導入から入る演出を試せます。':'最初から飛ばす狙いなら、高い入力エネルギーの曲を先頭に置いて聴き比べてください。');
  if (goal==='buildup') add(entries.length-1,'終盤への積み上げ',last!==null && first!==null && last>first?'最後の曲は最初より入力エネルギーが高い構成です。終盤へ向けた連続演奏を検討できます。':'終盤に力を集めたい場合は、強い曲を後ろへ動かして比較してみてください。');
  if (goal==='afterglow') add(entries.length-1,'最後の余韻',last!==null && last<=2?'最後は入力エネルギーが低めです。曲後の静けさや挨拶の入り方を決めましょう。':'余韻は静かな曲に限りません。最後の音をどこまで残すか、MCを入れるかを決めましょう。');
  if (goal==='twinPeaks' || goal==='ushape') {
    const mid=Math.floor(entries.length/2);
    add(mid,'緩急の作り方','入力エネルギーの高低が変わる場所を見比べましょう。落差は欠点ではありません。照明や間の取り方まで含めて演出できます。');
  }
  for(let i=1;i<entries.length;i++) {
    const a=entries[i-1],b=entries[i], from=String(a.song.tuning||'').trim(),to=String(b.song.tuning||'').trim();
    const budget=sec(sl.gapSec)+(a.item.mc?sec(sl.mcSec):0);
    if(from && to && from!==to) add(i,'持ち替えをつなぐ',`M${i} → M${i+1} は調弦が変わります。曲間に ${budget}秒を設定中。MC担当と交換担当を分けられるか、実測で確認してください。`);
    else if(from && to && energy(a)>=4 && energy(b)>=4) add(i,'畳みかける区間',`M${i} → M${i+1} は入力エネルギーがともに高めです。間を短くする案もありますが、呼吸・同期・機材の準備時間を確認してください。`);
    if(energy(a)!==null && energy(b)!==null && energy(a)-energy(b)>=2) add(i,'聴かせる切り替え',`M${i} → M${i+1} は入力エネルギーが下がります。前曲の余韻を残すか、短いMCで場面を切り替えるかを試せます。`);
  }
  if (!hints.length) add(0,'曲間から設計する','各曲の長さ・入力エネルギー・MCを確認してください。同じ数値でも曲調は違うため、最後は通し練習で確かめましょう。');
  return hints;
}
export function flowSignature(sl, entries) { return JSON.stringify({sl,entries}); }
