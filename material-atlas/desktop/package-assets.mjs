import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
export async function walkFiles(root,relative=''){
  const result=[];
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
    const name=path.join(relative,entry.name);if((await lstat(path.join(root,name))).isSymbolicLink())throw Error('程序资源不能包含符号链接：'+name);
    if(entry.isDirectory())result.push(...await walkFiles(root,name));else if(entry.isFile())result.push(name);
  }return result;
}
// Check the exact staged application, so a working source tree cannot hide missing release assets.
export async function validatePackagedAssets(root){
  const files=await walkFiles(root),known=new Set(files.map(p=>p.replaceAll('\\','/'))),missing=[];
  for(const name of files){
    if(!/\.(?:js|mjs|cjs|css|html)$/.test(name))continue;
    const text=await readFile(path.join(root,name),'utf8'),refs=[];
    if(/\.(?:js|mjs)$/.test(name)){
      for(const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|new\s+URL\s*\(\s*)['"](\.\.?\/[^'"\s]+)['"]/g))refs.push(m[1]);
    }else if(/\.html$/.test(name)){
      for(const m of text.matchAll(/(?:src|href)\s*=\s*['"](\.\.?\/[^'"\s]+)['"]/g))refs.push(m[1]);
    }else for(const m of text.matchAll(/url\(\s*['"]?(\.\.?\/[^\s)'"?#]+)['"]?\s*\)/g))refs.push(m[1]);
    for(const ref of refs){const target=path.posix.normalize(path.posix.join(path.dirname(name).replaceAll('\\','/'),ref.split(/[?#]/)[0]));
      if(ref.endsWith('/')){try{if((await lstat(path.join(root,target))).isDirectory())continue;}catch{}}
      // Optional private Apple resources have documented bundled open-font fallbacks.
      if(!known.has(target)&&!target.startsWith('dist/fonts/apple/'))missing.push({file:name,reference:ref});
    }
  }if(missing.length)throw Error('打包遗漏程序依赖：'+JSON.stringify(missing));return{files:files.length};
}
