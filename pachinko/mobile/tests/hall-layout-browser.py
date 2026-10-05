"""Hall overview and report footer acceptance. Uses only isolated browser saves.
Usage: python hall-layout-browser.py REPO OUTPUT
"""
from pathlib import Path
import functools,hashlib,http.server,json,sys,threading,traceback
from playwright.sync_api import sync_playwright
root,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Quiet,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start();origin=f"http://127.0.0.1:{server.server_port}"
results=[]
def save():
 (out/"results.json").write_text(json.dumps({"source_sha256":hashlib.sha256((root/"pachinko/index.html").read_bytes()).hexdigest(),"physical_device":False,"results":results},ensure_ascii=False,indent=2),encoding="utf-8")
def frame(p):p.evaluate("() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
def begin(b,w,h,safe):
 c=b.new_context(viewport={"width":w,"height":h},reduced_motion="reduce",service_workers="block")
 c.route("**/*",lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort())
 p=c.new_page();p.set_default_timeout(12000);p.qa_errors=[];p.on("pageerror",lambda e:p.qa_errors.append(str(e)))
 p.goto(origin+"/pachinko/")
 if safe:p.add_style_tag(content=":root{--sat:59px;--sab:34px}")
 p.evaluate("() => {startGame('normal');closeModal();hideLaunch();document.getElementById('toasts').textContent='';setArea('hall');}")
 frame(p);return c,p
def run(engine,name,fn):
 try:data=fn();results.append({"engine":engine,"case":name,"status":"PASS","data":data})
 except Exception as e:results.append({"engine":engine,"case":name,"status":"FAIL","error":str(e),"traceback":traceback.format_exc()})
 save();print(json.dumps({k:v for k,v in results[-1].items() if k!="traceback"},ensure_ascii=True),flush=True)
def hall(b,engine,w,h,safe):
 c,p=begin(b,w,h,safe)
 try:
  measurements=[]
  for condition in ["initial","large-store","empty"]:
   if condition=="large-store":
    p.evaluate("() => {state.day=99;state.money=123456789;state.debt=10000000;state.cap=MAX_CAP;state.machines=Array.from({length:MAX_CAP},(_,i)=>makeMachine(CATALOG[i%CATALOG.length].id));state.staff=1;state.rep=99;state.regulars=9999;state.heat=11;state.grandOpen=true;state.trend=TRENDS.find(t=>t.ids.length);renderAll();}")
   elif condition=="empty":p.evaluate("() => {state.machines=[];state.grandOpen=false;renderAll();}")
   frame(p)
   m=p.evaluate("() => {const r=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,left:b.left,right:b.right}};return {scrollHeight:document.documentElement.scrollHeight,viewport:innerHeight,width:document.documentElement.scrollWidth,hall:r('#panel-hall'),dock:r('#dock'),crest:r('#crest'),kpi:r('#kpi'),flags:r('#stageFlags'),status:r('#statusBand'),elements:['#stMoney','#stDay','#dayLeft','#crestVal','#stRegs','#stMachines','#stDebt','#heatPct','#stAssets','#goalPct','#stratMode','#stratAvg','#stratCust','#stNet2','#btnOpen','#nav'].map(r)}}")
   assert m["scrollHeight"]<=h+1,m
   assert m["width"]<=w+1,m
   assert m["hall"]["bottom"]<=m["dock"]["top"]+1,m
   assert m["crest"]["bottom"]<=m["kpi"]["top"]+1,m
   assert m["flags"]["bottom"]<=m["kpi"]["top"]+1,m
   for r in m["elements"]:assert r["top"]>=0 and r["bottom"]<=h-(34 if safe else 0)+1 and r["left"]>=0 and r["right"]<=w+1,r
   assert p.locator("#panel-hall #focusWrap").count()==0
   assert p.locator("#panel-mgmt #focusCard").count()==1
   measurements.append({"condition":condition,"scrollHeight":m["scrollHeight"],"viewport":h})
   if condition=="initial":p.screenshot(path=str(out/f"{engine}-{w}-hall.png"))
  assert not p.qa_errors,p.qa_errors
  return measurements
 finally:c.close()
def operations(b,engine):
 c,p=begin(b,390,844,True)
 try:
  p.locator('#nav [data-area="mgmt"]').click()
  assert p.locator("#machineManagement").is_visible()
  assert p.locator("#machineManagement #hallNote").count()==1
  assert p.locator("#hallList [data-focus]").count()>=2
  p.locator('#hallList [data-focus="1"]').click()
  financial=p.evaluate("({money:state.money,debt:state.debt})")
  p.locator('#focusCard [data-set="1:5"]').click()
  assert p.evaluate("state.machines[1].setting")==5
  assert p.evaluate("({money:state.money,debt:state.debt})")==financial
  p.locator("#btnSetList").click()
  assert not p.locator("#modalBg").evaluate("e=>e.classList.contains('day-report')")
  p.locator('#slList [data-set="0:4"]').click()
  assert p.evaluate("state.machines[0].setting")==4
  p.locator("#modalBox .mh .x").click()
  before=p.evaluate("JSON.stringify(state)")
  p.locator('#focusCard [data-sell="1"]').click();p.locator("#askNo").click()
  assert p.evaluate("JSON.stringify(state)")==before
  sale=p.evaluate("machineSale(state.machines[1])");cash=p.evaluate("state.money");count=p.evaluate("state.machines.length")
  p.locator('#focusCard [data-sell="1"]').click();p.locator("#askYes").click()
  p.wait_for_function("(n)=>state.machines.length===n",arg=count-1)
  assert p.evaluate("state.money")==cash+sale
  saved=p.evaluate("localStorage.getItem(SAVE_KEY)")
  p.reload();p.evaluate("() => {hideLaunch();closeModal();setArea('mgmt');}")
  assert p.evaluate("localStorage.getItem(SAVE_KEY)")==saved
  assert p.evaluate("state.machines.length")==count-1
  assert p.evaluate("state.machines[0].setting")==4
  p.screenshot(path=str(out/f"{engine}-management.png"))
  assert not p.qa_errors,p.qa_errors
  return {"machine_selection":True,"individual_and_list_settings":True,"cancel_sale_unchanged":True,"confirmed_sale_exact_amount":True,"reload_preserved":True}
 finally:c.close()
def report(b,engine,w,h):
 c,p=begin(b,w,h,True)
 try:
  p.evaluate("() => {window.qaOriginal=showDayResult;showDayResult=r=>{window.qaResult=r;qaOriginal(r)};}")
  old_day=p.evaluate("state.day")
  p.locator("#btnOpen").click();p.wait_for_function("() => !busy && document.querySelector('#modalBg.show.day-report')")
  frame(p)
  assert p.evaluate("state.day")==old_day+1
  body=p.locator(".day-report-body");button=p.locator("#btnDayResultNext")
  records=[]
  def positions(label):
   for fraction in [0,.5,1]:
    body.evaluate("(e,f)=>{e.scrollTop=f*(e.scrollHeight-e.clientHeight)}",fraction);frame(p)
    br=button.bounding_box();ar=body.bounding_box()
    assert br["y"]>=59 and br["y"]+br["height"]<=h-34+1,br
    assert ar["y"]+ar["height"]<=br["y"]+1,(ar,br)
    assert button.evaluate("(e)=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e===hit||e.contains(hit)}")
    records.append({"fixture":label,"fraction":fraction,"button_top":br["y"]})
   assert max(r["button_top"] for r in records[-3:])-min(r["button_top"] for r in records[-3:])<=1
   assert body.evaluate("e=>Math.abs(e.scrollHeight-e.clientHeight-e.scrollTop)<=1")
  positions("actual-day")
  p.screenshot(path=str(out/f"{engine}-{w}-report.png"))
  for _ in range(6):
   p.keyboard.press("Shift+Tab")
   assert p.evaluate("document.getElementById('modalBg').contains(document.activeElement)")
  snapshot=p.evaluate("JSON.stringify(state)")
  p.evaluate("() => {for(let i=0;i<5;i++){document.getElementById('btnBorrow').click();document.getElementById('btnOpen').click();}}")
  assert p.evaluate("JSON.stringify(state)")==snapshot
  button.click()
  assert p.locator("#modalBg").evaluate("e=>!e.classList.contains('show')")
  assert p.evaluate("JSON.stringify(state)")==snapshot
  assert p.evaluate("state.day")==old_day+1 and not p.evaluate("document.getElementById('app').inert")
  p.evaluate("() => {state.day=8;state.cap=40;state.machines=Array.from({length:40},(_,i)=>makeMachine(CATALOG[i%CATALOG.length].id));state.history=Array.from({length:7},(_,i)=>({...qaResult.rec,day:7-i}));qaOriginal({...qaResult,rec:{...qaResult.rec,day:7},notes:Array.from({length:20},(_,i)=>'長い営業報告の確認 '+i)});}")
  frame(p);positions("long-weekly")
  assert p.locator(".week").is_visible()
  body.evaluate("e=>{e.scrollTop=0}");body.focus();p.keyboard.press("PageDown")
  p.wait_for_function("() => document.querySelector(\".day-report-body\").scrollTop > 0")
  p.evaluate("() => {const b=document.getElementById('btnDayResultNext');for(let i=0;i<5;i++)b.click();}")
  assert p.evaluate("state.day")==8
  p.evaluate("() => {openSetList();}");assert not p.locator("#modalBg").evaluate("e=>e.classList.contains('day-report')")
  p.locator("#modalBox .mh .x").click()
  p.evaluate("() => {state.money=-1;qaOriginal(qaResult);}")
  assert p.locator("#btnDayResultNext").count()==0
  assert p.get_by_role("button",name="最初からやり直す",exact=True).count()==1
  assert not p.qa_errors,p.qa_errors
  return {"positions":records,"background_locked":True,"confirmation_does_not_run_extra_day":True,"other_modals_restored":True,"bankrupt_has_no_next_button":True}
 finally:c.close()
with sync_playwright() as pw:
 for engine in ["chromium","webkit"]:
  b=getattr(pw,engine).launch()
  for w,h,safe in [(390,844,True),(375,667,True),(430,932,True),(360,740,False)]:
   run(engine,f"hall-{w}",lambda w=w,h=h,safe=safe:hall(b,engine,w,h,safe))
  run(engine,"machine-operations",lambda:operations(b,engine))
  for w,h in [(375,667),(390,844)]:
   run(engine,f"report-{w}",lambda w=w,h=h:report(b,engine,w,h))
  b.close()
server.shutdown()
assert all(r["status"]=="PASS" for r in results)
