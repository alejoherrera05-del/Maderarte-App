// Test-only HTTP adapter. Executes the real Apps Script modules, replacing ONLY
// Google I/O with in-memory implementations. Not served or deployed in public/.
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { documentFixture } from './fixtures/order-document-runtime.mjs';
import { secureDocumentResponse } from '../worker/document-security.js';
let fixture = documentFixture();
let posts = [];
const root = resolve('public');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.json':'application/json', '.webmanifest':'application/manifest+json' };
const globalHeaders = Object.fromEntries(readFileSync('public/_headers','utf8').split('\n\n')[0].split('\n').slice(1).map(line => { const index = line.indexOf(':'); return [line.slice(0,index).trim(),line.slice(index+1).trim()]; }).filter(([key])=>key));
const profile = {uid:'qa-owner',email:'qa@example.invalid',name:'Operador QA',role:'PROPIETARIO',status:'ACTIVO',mainBranch:'MP',branches:['MP','TP']};
const session = {profile, permissions:['*'],expiresAt:'2099-01-01T00:00:00Z', persistence:'session',validatedAt:Date.now()};
const json = (res, value, status=200) => { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value)); };
const server = http.createServer(async (req,res) => {
 try {
  const url = new URL(req.url,'http://127.0.0.1:4174');
  if(url.pathname==='/__test/reset') {fixture=documentFixture();posts=[];return json(res,{session});}
  if(url.pathname==='/__test/state') return json(res,{tables:fixture.state.tables,posts,files:[...fixture.state.drive.values()]});
  if(url.pathname==='/__test/export') {
   const out=resolve('artifacts/order-documents');mkdirSync(out,{recursive:true});
   for(const file of fixture.state.drive.values()) if(file.mimeType==='application/pdf'&&fixture.state.binary.has(file.id)) writeFileSync(resolve(out,file.name),fixture.state.binary.get(file.id));
   writeFileSync(resolve(out,'test-state.json'),JSON.stringify({tables:fixture.state.tables,posts},null,2));return json(res,{ok:true});
  }
  if(url.pathname==='/api/maderarte') {
   let raw='';for await(const chunk of req) raw+=chunk;
   const body=JSON.parse(raw),action=body.action;posts.push(body);
   if(action==='AUTH_SESSION_VALIDATE')return json(res,{status:'success',data:session});
   if(action==='CLIENTES_LISTAR')return json(res,{status:'success',data:{items:[],total:0}});
   if(action==='CLIENTE_OBTENER')return json(res,{status:'success',data:null});
   // Native trial authorization has separate backend tests. This fixture uses
   // production-mode synthetic tables to test the same financial/doc functions.
   try {const data=fixture.context.routeAction_(action,body.payload||{},{session:fixture.session,sessionToken:'qa-session',requestId:body.requestId});return json(res,{status:'success',data});}
   catch(error){return json(res,{status:'error',code:error.appCode||'TEST_SERVER',msg:error.message,details:error.details},error.httpStatus||500);}
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root+'/')||!existsSync(path)||!statSync(path).isFile())return json(res,{error:'Not found'},404);
  let headers={...globalHeaders,'Content-Type':types[extname(path)]||'application/octet-stream'};
  if(url.pathname==='/documento.html') headers=Object.fromEntries(secureDocumentResponse(new Response('',{headers})).headers);
  res.writeHead(200,headers);res.end(readFileSync(path));
 }catch(error){console.error(error);json(res,{error:String(error)},500);}
});
server.listen(4174,'127.0.0.1',()=>console.log('Synthetic Google document server: 4174'));
