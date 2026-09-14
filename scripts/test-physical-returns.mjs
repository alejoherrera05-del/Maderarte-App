import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {sandboxRuntime} from './fixtures/owner-sandbox-runtime.mjs';
const sample={};
function setup(description,price,quantity=1){
  const f=sandboxRuntime();f.start();f.c.osValidateDraft_=()=>{};
  f.command.items=[{...f.command.items[0],description,quantity,unitValue:price,photos:[],fulfillment:'DISPONIBLE',agreement:'ENTREGA_HOY'}];f.command.discount=0;
  f.command.payments=[{clientPaymentId:'1',method:'EFECTIVO',amount:price*quantity,internalNote:''}];f.command.noPayment=false;
  const number=f.run('ORDEN_CREAR',f.command,'RETURN-SOURCE-0001').order.number,itemId=number+'-I-1';
  const rm=f.run('REMISION_CUENTA',{number});
  const sent=f.run('REMISION_CREAR',{number,fingerprint:rm.position.fingerprint,items:[{itemId,quantity}],transporter:{name:'Transportador de muestra',mode:'PIALLERO',favorite:false},assistant:{name:'',favorite:false},physicalCheck:true,notes:'SIN ENTREGA REAL'},'RETURN-DISPATCH-0001');
  const old=JSON.stringify([f.rows('Remisiones'),f.rows('Remision_Items'),f.rows('Abonos')]);
  const account=()=>f.run('AJUSTE_CUENTA',{number});
  const command=(q=1)=>({number,fingerprint:account().position.fingerprint,type:'RETORNAR',items:[{itemId,quantity:q}],physicalCheck:true,destination:'EXHIBICION',reason:'El cliente no recibió el mueble; regresó al almacén.',reference:''});
  return {f,number,itemId,sent,old,account,command};
}
{
  const {f,number,itemId,old,account,command}=setup('Sofá de tres puestos',1500000);
  const p=command();sample.sofaBefore=account();
  assert.throws(()=>f.run('AJUSTE_PREVISUALIZAR',{...p,physicalCheck:false}),e=>e.appCode==='ORDER_INPUT_INVALID');
  assert.throws(()=>f.run('AJUSTE_PREVISUALIZAR',{...p,items:[{itemId,quantity:2}]}),e=>e.appCode==='RETURN_QUANTITY');
  const preview=f.run('AJUSTE_PREVISUALIZAR',p);assert.equal(preview.after.credit,1500000);assert.equal(preview.after.paid,1500000);
  f.state.loseBatch=true;assert.throws(()=>f.run('AJUSTE_CONFIRMAR',p,'RETURN-SOFA-0001'),e=>e.appCode==='ADJUSTMENT_UNCERTAIN');
  assert.equal(f.run('AJUSTE_ESTADO',{requestId:'RETURN-SOFA-0001'}).saved,true);
  const saved=f.run('AJUSTE_CONFIRMAR',p,'RETURN-SOFA-0001');assert.equal(f.rows('Anulaciones').length,1);
  assert.equal(JSON.stringify([f.rows('Remisiones'),f.rows('Remision_Items'),f.rows('Abonos')]),old);
  let a=account();assert.equal(a.items[0].returned,1);assert.equal(a.items[0].delivered,1);assert.equal(a.items[0].pending,0);assert.equal(a.position.credit,1500000);
  assert.equal(f.run('REMISION_CUENTA',{number}).position.items[0].available,0);
  assert.throws(()=>f.run('AJUSTE_CONFIRMAR',command(),'RETURN-DUPLICATE-0002'),e=>e.appCode==='RETURN_QUANTITY');
  assert.throws(()=>f.run('AJUSTE_CONFIRMAR',{...p,reason:'Otro motivo'},'RETURN-SOFA-0001'),e=>e.appCode==='REQUEST_CONTENT_CHANGED');
  const plan=f.run('INTERNO_AJUSTE_DOCUMENTO_PREPARAR',{number:saved.result.id});assert.equal(plan.document.returnReceipt.destination,'EXHIBICION');sample.returnDocument=plan.document;sample.sofaAfterReturn=a;
  sample.returnPreview=preview;sample.sofaOrder=f.run('ORDEN_OBTENER',{number});
  const refund={number,fingerprint:a.position.fingerprint,type:'DEVOLVER',amount:1500000,reason:'Reintegro realizado al cliente.',reference:'Soporte de muestra'};
  const refundResult=f.run('AJUSTE_CONFIRMAR',refund,'RETURN-REFUND-0001');a=account();assert.equal(a.position.credit,0);assert.equal(a.position.paid,0);
  sample.refundDocument=f.run('INTERNO_AJUSTE_DOCUMENTO_PREPARAR',{number:refundResult.result.id}).document;sample.sofaAfterRefund=a;
  assert.equal(f.rows('Abonos').length,1,'Return and refund do not create new incoming payments');
  const bad=JSON.parse(f.rows('Anulaciones')[0].Consecuencias_JSON);bad.items[0].quantity=2;f.rows('Anulaciones')[0].Consecuencias_JSON=JSON.stringify(bad);
  assert.throws(account,e=>e.appCode==='ADJUSTMENT_INTEGRITY');
}
{
  const {f,number,itemId,account,command}=setup('Chimenea',1200000);
  const ret=f.run('AJUSTE_CONFIRMAR',command(),'RETURN-FIREPLACE-0001');assert.equal(account().position.credit,1200000);
  const next=structuredClone(f.command);next.items[0].description='Sofá cama';next.items[0].unitValue=1800000;next.payments=[];next.noPayment=true;
  const destination=f.run('ORDEN_CREAR',next,'RETURN-NEW-PURCHASE-0001').order.number;
  const da=()=>f.run('AJUSTE_CUENTA',{number:destination});
  const p={number,fingerprint:account().position.fingerprint,type:'TRANSFERIR',amount:1200000,target:destination,targetFingerprint:da().position.fingerprint,reason:'Cambio de chimenea por sofá cama.',reference:''};
  const transfer=f.run('AJUSTE_CONFIRMAR',p,'RETURN-EXCHANGE-0001');assert.equal(account().position.credit,0);assert.equal(da().position.balance,600000);assert.equal(f.rows('Abonos').length,1);
  sample.exchangeDocument=f.run('INTERNO_AJUSTE_DOCUMENTO_PREPARAR',{number:transfer.result.id}).document;
  sample.exchangeSource=account();sample.exchangeDestination=da();
  const paid=f.run('RECIBO_CREAR',{number:destination,fingerprint:da().position.fingerprint,amount:600000,method:'EFECTIVO',concept:'Diferencia por cambio a sofá cama',reference:'',internalNote:''},'RETURN-DIFFERENCE-0001');
  assert.equal(da().position.balance,0);assert.equal(da().position.paid,1800000);
  const receipt=JSON.parse(f.rows('Archivos_Orden').find(r=>r.Archivo_ID===paid.receipt.number+'-PDF-V1').Plan_JSON);assert.equal(receipt.history.reduce((n,h)=>n+h.amount,0),1800000);sample.differenceDocument=receipt;
  const rm=f.run('REMISION_CUENTA',{number:destination});
  const dispatch=f.run('REMISION_CREAR',{number:destination,fingerprint:rm.position.fingerprint,items:[{itemId:destination+'-I-1',quantity:1}],transporter:{name:'Transportador de muestra',mode:'PIALLERO',favorite:false},assistant:{name:'',favorite:false},physicalCheck:true,notes:'Cambio de muestra'},'RETURN-NEW-DISPATCH-0001');
  sample.newRemission=f.run('INTERNO_REMISION_DOCUMENTO_PREPARAR',{number:dispatch.remission.number}).document;
  assert.equal(f.rows('Remisiones').length,2);assert.equal(account().items[0].returned,1);assert.equal(da().items[0].delivered,1);
  assert.equal(f.rows('Abonos').reduce((n,a)=>n+Number(a.Valor_Abono),0),1800000,'Only original payment plus actual difference are cash income');
  f.c.validateSessionToken_=()=>({permissions:['ordenes.read','abonos.read'],profile:{uid:'reader',branches:['MP']}});assert.throws(()=>f.c.ajConfirm_(command(),{requestId:'RETURN-DENIED-01'}));
}
{
  const {f,number,itemId,account,command}=setup('Sillas de muestra',100001,3);
  for(let i=1;i<=3;i++){f.run('AJUSTE_CONFIRMAR',command(),'RETURN-PARTIAL-000'+i);assert.equal(account().items[0].returned,i);assert.equal(account().position.credit,i*100001);}
  assert.equal(account().position.total,0);assert.equal(f.run('REMISION_CUENTA',{number}).position.items[0].pending,0);
}
if(process.env.RETURNS_EVIDENCE_DIR){mkdirSync(process.env.RETURNS_EVIDENCE_DIR,{recursive:true});writeFileSync(process.env.RETURNS_EVIDENCE_DIR+'/scenarios.json',JSON.stringify(sample,null,2));}
console.log('Physical returns: sofa/refund, fireplace/exchange plus difference and new dispatch, partials, immutable receipts, retry recovery, quantity limits and permissions passed.');