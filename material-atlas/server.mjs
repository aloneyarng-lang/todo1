import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAgentRequest } from './desktop/agent-http.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4173);
const mime = { '.mjs':'text/javascript; charset=utf-8', '.wasm':'application/wasm', '.bcmap':'application/octet-stream', '.ttf':'font/ttf', '.pfb':'application/octet-stream', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };
export function createPreviewServer() { return http.createServer(async (req, res) => {
  try {
    if (await handleAgentRequest(req, res)) return;
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not found');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
}); }
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const server = createPreviewServer();
  server.listen(port, '127.0.0.1', () => console.log(`Materia is ready: http://localhost:${server.address().port}`));
}
