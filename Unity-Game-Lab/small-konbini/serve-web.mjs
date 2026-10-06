import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'Build/Web');
const types={'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.data':'application/octet-stream','.css':'text/css','.png':'image/png','.ico':'image/x-icon'};
http.createServer((req,res)=>{let file;try{const url=new URL(req.url,'http://127.0.0.1');file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));}catch{res.writeHead(400);res.end();return;}if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);});}).listen(4185,'127.0.0.1',()=>console.log('Chiisana Konbini: http://127.0.0.1:4185/'));

