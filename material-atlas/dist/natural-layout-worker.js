import {solveNaturalLayout} from './natural-layout.js';
self.onmessage=async event=>{
  try{const result=await solveNaturalLayout(event.data.input,event.data.options);self.postMessage({result});}
  catch(error){self.postMessage({error:error.message});}
};
