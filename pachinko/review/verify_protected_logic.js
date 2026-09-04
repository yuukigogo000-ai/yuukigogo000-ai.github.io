#!/usr/bin/env node
/* 保護ロジックの同一性検証
   git show 40c2eaa:pachinko/index.html > /tmp/before.html
   node verify_protected_logic.js /tmp/before.html ../index.html
   期待: 39 PASS / 1 FAIL(grantAch は通知方法のみの意図的差分) */
const fs=require("fs");
const OLD=fs.readFileSync(process.argv[2],"utf8");
const NEW=fs.readFileSync(process.argv[3]||__dirname+"/../index.html","utf8");
function fn(src,name){
  const i=src.indexOf("function "+name+"(");
  if(i<0) return null;
  let j=src.indexOf("{",i),d=0,k=j;
  for(;k<src.length;k++){const c=src[k];if(c==="{")d++;else if(c==="}"){d--;if(!d){k++;break;}}}
  return src.slice(i,k);
}
const norm=s=>s.replace(/\s+/g," ").trim();
const names=["simulateDay","weeklyReport","expandCost","isDead","slotDenom","clearRank","save","sanitizeState","load","newGame","makeMachine","catalogOf","machineValue","machineAssets","totalAssets","creditLimit","isTokubi","isWeekend","staffNeeded","islandBonus","trendMult","effectivePop","rollFlag","finalSymbols","spinCost","hasAch","grantAch"];
let pass=0,fail=0;
for(const n of names){
  const a=fn(OLD,n),b=fn(NEW,n);
  if(!a){console.log("  SKIP (not in original)",n);continue;}
  if(!b){console.log("  FAIL missing",n);fail++;continue;}
  if(norm(a)===norm(b)){pass++;console.log("  PASS identical:",n);}
  else{fail++;console.log("  FAIL differs:",n);
    const A=norm(a),B=norm(b);let i=0;while(A[i]===B[i])i++;
    console.log("    old:",A.slice(Math.max(0,i-60),i+90));
    console.log("    new:",B.slice(Math.max(0,i-60),i+90));}
}
// constants: compare each top-level const declaration text
const consts=["SAVE_KEY","GOAL_ASSETS","MAX_CAP","DIFFS","CATALOG","MARGIN","ADS","TRENDS","LUCK_EVENTS","LUCK_DAILY_P","COND_EVENTS","ACHIEVEMENTS","SLOT_SYMBOLS"];
function cdecl(src,name){
  const i=src.indexOf("const "+name+" =");
  if(i<0) return null;
  // read to the matching end: find first ; at depth 0
  let d=0;
  for(let k=i;k<src.length;k++){const c=src[k];
    if("[{(".includes(c))d++;else if("]})".includes(c))d--;
    else if(c===";"&&d===0) return src.slice(i,k+1);}
  return null;
}
for(const n of consts){
  const a=cdecl(OLD,n),b=cdecl(NEW,n);
  if(!a){console.log("  SKIP",n);continue;}
  if(!b){console.log("  FAIL missing const",n);fail++;continue;}
  if(norm(a)===norm(b)){pass++;console.log("  PASS identical const:",n,`(${a.length}ch)`);}
  else{fail++;console.log("  FAIL const differs:",n);}
}
console.log(`\nPROTECTED LOGIC: ${pass} PASS / ${fail} FAIL`);
process.exit(fail?1:0);
