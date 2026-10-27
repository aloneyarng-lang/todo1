import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
let count=0;
for(const folder of ['dist','desktop','scripts'])for(const file of await readdir(folder))if(/\.(mjs|cjs|js)$/.test(file)){
  const result=spawnSync(process.execPath,['--check',path.join(folder,file)],{encoding:'utf8',windowsHide:true});
  if(result.status!==0){process.stderr.write(result.stderr);process.exit(result.status||1);}count++;
}
console.log(`Syntax checked ${count} source files.`);
