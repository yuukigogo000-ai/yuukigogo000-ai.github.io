// Check that core diagnostic tests reject plausible wrong results; never mutate working sources.
import {mkdtemp,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const mutations=[
 ['overtime disabled','d.target > 0 && d.total > d.target','false && d.total > d.target'],
 ['missing duration accepted','positive(e.song.sec) ? null : i','true ? null : i'],
 ['MC assumed sufficient','budget < 30 ? "warn" : "info"','"info"'],
];
for(const [name,from,to] of mutations){
 const dir=await mkdtemp(join(tmpdir(),'setlism-mutation-'));
 try{
  await cp(new URL('../band',import.meta.url),join(dir,'band'),{recursive:true});
  await mkdir(join(dir,'tests'));await cp(new URL('./diagnosis-unit.mjs',import.meta.url),join(dir,'tests/diagnosis-unit.mjs'));
  const file=join(dir,'band/diagnose.js');const src=await readFile(file,'utf8');if(!src.includes(from))throw Error('Mutation target absent: '+name);
  await writeFile(file,src.replace(from,to));
  const result=spawnSync(process.execPath,['--test',join(dir,'tests/diagnosis-unit.mjs')],{encoding:'utf8'});
  if(result.status!==1 || !/AssertionError/.test(result.stdout+result.stderr))throw Error('Mutation not rejected by assertion: '+name);
  console.log('DETECTED '+name);
 }finally{await rm(dir,{recursive:true,force:true});}
}
