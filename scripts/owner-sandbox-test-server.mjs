// Loopback-only QA: actual Worker + Apps Script; Google transport is synthetic.
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sandboxRuntime } from './fixtures/owner-sandbox-runtime.mjs';
import { handleRequest } from '../functions/api/maderarte.js';
const exec=promisify(execFile),port=4177,origin=`http://127.0.0.1:${port}`,root=resolve('public'),out=resolve('artifacts/owner-sandbox');mkdirSync(out,{recursive:true});
let fixture=sandboxRuntime(),initial=JSON.stringify(fixture.production()),actions=[],pdfs=0,faults={};
const env={MADERARTE_APPS_SCRIPT_URL:'https://qa-script.invalid/exec',MADERARTE_PROXY_TOKEN:'qa-proxy',BROWSER:{async quickAction(type,options){
 if(type!=='pdf'||options.url!=='https://app.maderartepopayan.com/documento-render.html')throw Error('Unexpected render URL');
 const plan=JSON.parse(options.addScriptTag[0].content),n=++pdfs,source=resolve(out,`render-plan-${n}.json`),destination=resolve(out,`pedido-${n}.pdf`);
 writeFileSync(source,JSON.stringify(plan));await exec('python',['scripts/render_owner_sandbox_pdf.py',source,destination,origin],{timeout:60000});
 return new Response(readFileSync(destination),{headers:{'content-type':'application/pdf'}});
}}};
globalThis.fetch=async(url,opts)=>{
 if(url!==env.MADERARTE_APPS_SCRIPT_URL)throw Error('External traffic forbidden by QA');
 const body=JSON.parse(opts.body);actions.push({action:body.action,sandbox:body.sandboxId||'',requestId:body.requestId});
 const result=fixture.c.doPost({postData:{contents:opts.body}}),reply=JSON.parse(result);
 if(reply.status==='success'&&faults[body.action]){faults[body.action]=false;throw Error('Lost reply after successful operation');}
 return new Response(result,{headers:{'content-type':'application/json'}});
};
function json(res,data){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));}
function evidence(){const s=fixture.c.osState_(),tables=s?.sheetId?fixture.state.books[s.sheetId].tables:{};const a=JSON.parse(initial),b=structuredClone(fixture.production());delete a.tables.Sesiones;delete b.tables.Sesiones;return {state:s,counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.rows.length])),orders:tables.Ordenes_Pedido?.rows,items:tables.Orden_Items?.rows,payments:tables.Abonos?.rows,files:[...fixture.state.files.values()].map(({bytes,...file})=>file),actions,pdfs,productionUnchanged:JSON.stringify(a)===JSON.stringify(b),commercialWrites:fixture.c.MADERARTE_APP.COMMERCIAL_WRITES};}
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,origin);let chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks).toString();
 if(u.pathname==='/__qa/reset'){fixture=sandboxRuntime();initial=JSON.stringify(fixture.production());actions=[];pdfs=0;faults={};return json(res,{ok:true});}
 if(u.pathname==='/__qa/faults'){faults=JSON.parse(body||'{}');return json(res,{ok:true});}
 if(u.pathname==='/__qa/evidence')return json(res,evidence());
 if(u.pathname==='/api/maderarte'){
   const request=new Request(origin+req.url,{method:'POST',headers:req.headers,body});
   const response=await handleRequest(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));
 }
 const path=resolve(root,'.'+decodeURIComponent(u.pathname));
 if(!path.startsWith(root+'/')||!existsSync(path)){res.writeHead(404);return res.end('Not found');}
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
 const headers={'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'};
 if(extname(path)==='.html')headers['Content-Security-Policy']="default-src 'self'; connect-src 'self' https://identitytoolkit.googleapis.com; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src 'self' https://drive.google.com; object-src 'none'; base-uri 'self'; form-action 'self'";
 res.writeHead(200,headers);res.end(readFileSync(path));
 }catch(error){console.error(error.stack);res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({status:'error',msg:error.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log('QA loopback server '+origin));
