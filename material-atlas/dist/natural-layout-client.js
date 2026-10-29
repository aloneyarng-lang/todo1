import {solveNaturalLayout} from './natural-layout.js';

export function computeNaturalLayout(input,options={},signal){
  const fallback=()=>solveNaturalLayout(input,options,{signal,yieldTask:()=>new Promise(resolve=>setTimeout(resolve,0))});
  if(typeof Worker==='undefined')return fallback();
  return new Promise((resolve,reject)=>{
    let worker,timer,settled=false;
    const cleanup=()=>{clearTimeout(timer);worker?.terminate();signal?.removeEventListener('abort',cancel);};
    const cancel=()=>{if(settled)return;settled=true;cleanup();reject(new DOMException('整理已取消。','AbortError'));};
    const retry=()=>{if(settled)return;settled=true;cleanup();fallback().then(resolve,reject);};
    if(signal?.aborted){cancel();return;}
    try{
      worker=new Worker(new URL('./natural-layout-worker.js',import.meta.url),{type:'module'});
      worker.onmessage=event=>{if(settled)return;if(event.data.error){retry();return;}settled=true;cleanup();resolve(event.data.result);};
      worker.onerror=event=>{event.preventDefault();retry();};signal?.addEventListener('abort',cancel,{once:true});
      timer=setTimeout(retry,12000);worker.postMessage({input,options});
    }catch{retry();}
  });
}
