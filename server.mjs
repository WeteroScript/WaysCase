import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const port=Number.parseInt(process.env.PORT||'3000',10);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method||'GET')){res.writeHead(405,{allow:'GET, HEAD'});return res.end('Method Not Allowed');}
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  if(url.pathname==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true,service:'wayscase',mode:'demo'}));}
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400);return res.end('Bad Request')}
  if(pathname==='/')pathname='/index.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden')}
  try{const info=await stat(file);if(!info.isFile())throw Error();const data=await readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','x-content-type-options':'nosniff','cache-control':'no-cache'});res.end(req.method==='HEAD'?undefined:data)}
  catch{res.writeHead(404);res.end('Not Found')}
}).listen(port,'0.0.0.0',()=>console.log(`WaysCase demo listening on ${port}`));
