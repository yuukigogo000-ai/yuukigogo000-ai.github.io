import { flowModel, flowHints, moveDraft, flowSignature, GOALS } from './flow-model.js';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const time=s=>`${Math.floor(Math.abs(s)/60)}:${String(Math.round(Math.abs(s))%60).padStart(2,'0')}`;
const button=(label,action)=>{const b=el('button','btn ghost',label);b.type='button';b.addEventListener('click',action);return b;};
function graph(model,baseline,selected=-1) {
  const box=el('div','flow-map');
  if(model.missing.length || baseline?.missing.length) { box.append(el('p','note','時間未入力の曲があります。正確な時間軸は長さを入力すると表示されます。'));return box; }
  if(!model.songs.length) {box.append(el('p','note','曲を追加して、ライブの流れを組み立てましょう。'));return box;}
  const width=window.matchMedia('(max-width:700px)').matches?320:640;
  const total=Math.max(model.total,baseline?.total||0,1), x=s=>30+s/total*(width-60),y=e=>110-(e-1)*20;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox',`0 0 ${width} 165`);svg.setAttribute('role','img');svg.setAttribute('aria-label','経過時間と入力エネルギー。琥珀色は現在の案、青い破線は比較元。');
  const shape=(tag,attrs)=>{const n=document.createElementNS(svg.namespaceURI,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));svg.append(n);return n;};
  [1,3,5].forEach(e=>{shape('line',{x1:30,x2:width-30,y1:y(e),y2:y(e),class:'flow-grid'});shape('text',{x:12,y:y(e)+4,class:'flow-axis'}).textContent=String(e);});
  model.segments.forEach(s=>shape('rect',{x:x(s.start),y:125,width:Math.max(0,x(s.end)-x(s.start)),height:12,class:`flow-band flow-${s.kind}`}));
  const line=(m,cls)=>{
    let d='',connected=false;
    m.songs.forEach(s=>{if(s.energy===null){connected=false;return;}d+=`${connected?' L':' M'} ${x(s.start+s.duration/2)} ${y(s.energy)}`;connected=true;});
    shape('path',{d,class:cls});
  };
  if(baseline)line(baseline,'flow-baseline');line(model,'flow-line');
  model.songs.forEach((s,i)=>{if(s.energy!==null)shape('circle',{cx:x(s.start+s.duration/2),cy:y(s.energy),r:i===selected?6:4,class:'flow-point','data-dot':''});});
  [0,.5,1].forEach(t=>{shape('text',{x:x(total*t),y:157,'text-anchor':t===0?'start':t===1?'end':'middle',class:'flow-axis'}).textContent=time(total*t);});
  box.append(svg,el('p','flow-key',baseline?'琥珀：現在の案　青破線：比較元':'琥珀：演奏　青：MC　灰：転換'));
  return box;
}
let dialog;
export function renderFlow({host,sl,entries,comparison,onApply,getCurrent}) {
  if(!host)return;
  host.replaceChildren(graph(flowModel(sl,entries),comparison?flowModel(comparison.sl,comparison.entries):null));
  host.append(el('p','note','曲の長さに沿った流れ。エネルギーは手入力の1〜5で、観客の反応予測ではありません。'));
  const launch=button('流れを設計・曲順を比較',()=>openEditor({sl,entries,onApply,getCurrent,launch}));launch.classList.add('primary');launch.disabled=!entries.length;host.append(launch);
}
function openEditor({sl,entries,onApply,getCurrent,launch}) {
  if(dialog){dialog.remove();}
  dialog=el('dialog','flow-dialog');dialog.id='flowDialog';dialog.setAttribute('aria-labelledby','flowTitle');
  const baseSl=structuredClone(sl),base=structuredClone(entries),signature=flowSignature(sl,entries);
  let draft=structuredClone(base),goal=sl.template||'',selected=draft[0]?.item.id;
  const heading=el('h2','', 'ライブの流れを設計');heading.id='flowTitle';
  const close=button('閉じる',()=>dialog.close());
  const head=el('div','flow-heading');head.append(heading,close);
  const intro=el('p','note','試している曲順はまだ保存されません。採用するまでは元のセトリのままです。');
  const goalLabel=el('label','flow-goal','今回の狙い');const select=el('select');select.id='flowGoal';GOALS.forEach(([id,name])=>select.append(new Option(name,id)));select.value=goal;goalLabel.append(select);
  const body=el('div','flow-body'),status=el('p','note');status.setAttribute('role','status');
  const reset=button('元の案に戻す',()=>{draft=structuredClone(base);goal=baseSl.template||'';select.value=goal;selected=draft[0]?.item.id;draw();status.textContent='元の曲順とMCに戻しました。';});
  const apply=button('この案を採用',()=>{
    const now=getCurrent();
    if(flowSignature(now.sl,now.entries)!==signature){status.textContent='元のセトリが変更されています。閉じて開き直し、最新の内容で比較してください。';apply.disabled=true;return;}
    onApply(draft.map(e=>structuredClone(e.item)),goal);dialog.close();
  });apply.classList.add('primary');apply.id='flowApply';
  const footer=el('div','flow-actions');footer.append(reset,apply);
  dialog.append(head,intro,goalLabel,body,status,footer);document.body.append(dialog);
  dialog.addEventListener('close',()=>launch.focus());select.addEventListener('change',()=>{goal=select.value;draw();});
  function draw(focusId) {
    const draftSl={...baseSl,template:goal}, model=flowModel(draftSl,draft),original=flowModel(baseSl,base);
    const selectedIndex=draft.findIndex(e=>e.item.id===selected);
    body.replaceChildren(graph(model,original,selectedIndex));
    const delta=model.switches-original.switches;
    const summary=el('p','flow-summary',`合計 ${time(model.total)}${model.missing.length?'＋未入力分':''} ／ 調弦変更 ${model.switches}回（元の案から${delta>0?'+':''}${delta}）${model.unknownTuning?'・未入力の調弦あり':''}`);
    summary.id='flowSummary';body.append(summary);
    const change=model.total-original.total;
    body.append(el('p','note',`時間差 ${change>0?'+':change<0?'−':''}${time(change)}${model.missing.length?'（入力済み分）':''}。曲順だけでは総時間は変わりません。持ち替えの実所要時間は自動加算しません。`));
    const grid=el('div','flow-editor-grid'),list=el('ol','flow-rows');
    draft.forEach((e,i)=>{
      const row=el('li','flow-row');row.classList.toggle('is-selected',e.item.id===selected);
      const info=button(`M${i+1} ${e.song.title}`,()=>{selected=e.item.id;draw(`song-${e.item.id}`);});info.className='flow-song';info.dataset.flowFocus=`song-${e.item.id}`;info.setAttribute('aria-pressed',String(e.item.id===selected));
      const timing=model.songs[i];
      const meta=el('span','note',`${model.missing.length?'開始未確定':time(timing.start)} · ${timing.duration?time(timing.duration):'長さ未入力'} · E ${timing.energy??'未入力'} · ${e.song.tuning||'調弦未入力'}`);
      const details=el('div','flow-track');details.append(info,meta);
      const controls=el('div','flow-row-actions');
      [-1,1].forEach((dir,j)=>{const b=button(j?'↓':'↑',()=>{draft=moveDraft(draft,i,dir);selected=e.item.id;draw(`${dir}-${e.item.id}`);status.textContent=`${e.song.title}をM${i+dir+1}へ移動しました。`;});b.setAttribute('aria-label',`${e.song.title}を${j?'後ろ':'前'}へ`);b.dataset.flowFocus=`${dir}-${e.item.id}`;b.disabled=i+dir<0||i+dir>=draft.length;controls.append(b);});
      const mc=button(e.item.mc?'MCあり':'MCなし',()=>{e.item.mc=!e.item.mc;draw(`mc-${e.item.id}`);});mc.dataset.flowFocus=`mc-${e.item.id}`;mc.setAttribute('aria-label',`${e.song.title}の後にMC`);mc.setAttribute('aria-pressed',String(!!e.item.mc));controls.append(mc);
      row.append(details,controls);list.append(row);
    });
    const hints=el('section','flow-hints');hints.setAttribute('aria-label','狙いと曲間の演出案');hints.append(el('h3','', '狙いと曲間の演出案'));
    flowHints(draftSl,draft,goal).forEach(h=>{const card=el('article','flow-hint');card.classList.toggle('is-selected',h.index===selectedIndex);const b=button(`M${h.index+1} · ${h.title}`,()=>{selected=draft[h.index].item.id;draw(`song-${selected}`);});card.append(b,el('p','note',h.text));hints.append(card);});
    grid.append(list,hints);body.append(grid);
    apply.disabled=flowSignature({...baseSl,template:goal,items:draft.map(e=>e.item)},draft)===flowSignature(baseSl,base);
    if(focusId) {const target=[...body.querySelectorAll('[data-flow-focus]')].find(e=>e.dataset.flowFocus===focusId);if(target&&!target.disabled)target.focus();}
  }
  draw();dialog.showModal();
}
