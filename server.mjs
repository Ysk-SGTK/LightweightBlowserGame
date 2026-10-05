import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.ico': 'image/x-icon' };
const port = Number(process.env.PORT || 4173);
// Local-only by default. Set HOST=0.0.0.0 explicitly for LAN phone testing.
const host = process.env.HOST || '127.0.0.1';
http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep) || !types[extname(path)] || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(404); res.end('Not found'); return; }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, host, () => console.log(`Browser Game Lab static preview: http://${host}:${port}`));
