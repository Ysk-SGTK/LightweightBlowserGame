import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'Build/Web');
const types={'.html':'text/html','.js':'application/javascript','.wasm':'application/wasm','.data':'application/octet-stream','.png':'image/png','.css':'text/css','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let pathname;
  try {pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);} catch {res.writeHead(400).end();return;}
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
  });
}).listen(4181,'127.0.0.1',()=>console.log('Drum Smash: http://127.0.0.1:4181'));
