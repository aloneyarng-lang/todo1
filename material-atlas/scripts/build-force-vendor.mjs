import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({stdin:{contents:"export {forceSimulation,forceManyBody,forceLink,forceCollide,forceX,forceY} from 'd3-force';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/vendor/d3-force.mjs',banner:{js:'// D3 force 3.0.0 and dependencies. BSD-3-Clause; see D3-FORCE-LICENSE.txt.'}});
const packages=['d3-force','d3-quadtree','d3-dispatch','d3-timer'];
await writeFile('dist/vendor/D3-FORCE-LICENSE.txt',(await Promise.all(packages.map(async name=>name+'\n'+await readFile('node_modules/'+name+'/LICENSE','utf8')))).join('\n\n'));
console.log('Built offline D3 force bundle.');
