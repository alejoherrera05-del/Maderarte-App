import {payrollBenefitDefaults,payrollBenefitPeriods,payrollDays} from './payroll-rules.js';
import {payrollMoney as money} from './payroll-document.js';

const esc=value=>String(value??'').replace(/[&<>\"']/g,ch=>ch==='&'?'&amp;':ch==='<'?'&lt;':ch==='>'?'&gt;':ch==='\"'?'&quot;':'&#39;');
const amount=value=>Math.max(0,Math.round(Number(value||0)));
const gross=(base,from,to,divisor)=>Math.round(amount(base)*payrollDays(from,to)/divisor);
const sameSemester=(a,b)=>a.slice(0,4)===b.slice(0,4)&&Math.floor((Number(a.slice(5,7))-1)/6)===Math.floor((Number(b.slice(5,7))-1)/6);
const prior=(list,segment)=>Array.isArray(list)?list.find(x=>x.from===segment.from&&x.to===segment.to):null;
const nextDay=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};

function receiptCoversPrime(receipts,employeeId,segment){
  return (receipts||[]).some(r=>r.employeeId===employeeId&&r.type==='PRIMA'&&r.status==='PAGADO'&&sameSemester(r.from,r.to)&&r.from<=segment.from&&r.to>=segment.to);
}

export function payrollBenefitModel({type,employee,from,to,initial={},rates,receipts=[]}){
  const periods=payrollBenefitPeriods(from,to);
  const prime=periods.prime.map(segment=>{
    const old=prior(initial.primaPeriods,segment),base=amount(old?.base||payrollBenefitDefaults(segment.to,employee,rates).benefitBase),value=gross(base,segment.from,segment.to,360);
    const paid=old?.paid!==undefined?amount(old.paid):(receiptCoversPrime(receipts,employee.id,segment)?value:0);
    return {...segment,base,gross:value,paid};
  });
  const severance=type==='LIQUIDACION'?periods.severance.map(segment=>{
    const old=prior(initial.severancePeriods,segment),base=amount(old?.base||payrollBenefitDefaults(segment.to,employee,rates).benefitBase),value=gross(base,segment.from,segment.to,360),days=payrollDays(segment.from,segment.to);
    const interestGross=Math.round(value*days*.12/360);return {...segment,base,gross:value,paid:amount(old?.paid),interestGross,interestPaid:amount(old?.interestPaid)};
  }):[];
  const vacationBase=amount(initial.vacationBase||payrollBenefitDefaults(to,employee,rates).vacationBase),serviceDays=payrollDays(from,to),explicitVacation=String(initial.vacationFrom||'');
  const vacationMode=explicitVacation?(explicitVacation===from?'none':'covered'):(serviceDays<=360?'none':'');
  const vacationFrom=explicitVacation||(vacationMode==='none'?from:''),vacationGross=type==='LIQUIDACION'&&vacationFrom?gross(vacationBase,vacationFrom,to,720):0;
  return {prime,severance,vacationBase,vacationFrom,vacationGross,vacationPaid:amount(initial.vacationPaid),vacationMode,serviceDays,variableWarning:Boolean(employee.sellerUid)};
}

const paidToggle=(id,label,checked)=>'<label class="np-benefit-paid"><input type="checkbox" id="'+id+'" '+(checked?'checked':'')+'><span>'+esc(label)+'</span></label>';
const periodText=(from,to)=>from+' — '+to;
function benefitCard(id,title,period,grossValue,paidValue,toggle=''){const pending=Math.max(0,grossValue-paidValue);return '<article class="np-benefit-card" data-card="'+id+'"><div class="np-benefit-card-copy"><span>'+esc(title)+'</span><small>'+esc(period)+'</small></div><strong data-benefit-value="'+id+'">'+money(pending)+'</strong>'+toggle+'</article>';}

export function payrollBenefitEditorHtml(args){
  const m=payrollBenefitModel(args),type=args.type,employee=args.employee,from=args.from,to=args.to;
  let cards='';
  m.prime.forEach((p,i)=>{const title='Prima · '+(p.half==='1'?'1er semestre ':'2º semestre ')+p.year;cards+=benefitCard('prima-'+i,title,periodText(p.from,p.to),p.gross,p.paid,paidToggle('np-prime-paid-'+i,'Esta prima ya fue pagada',p.paid>=p.gross&&p.gross>0));});
  if(type==='LIQUIDACION')m.severance.forEach((p,i)=>{cards+=benefitCard('ces-'+i,'Cesantías · '+p.year,periodText(p.from,p.to),p.gross,p.paid,paidToggle('np-sev-paid-'+i,'Estas cesantías ya fueron reconocidas',p.paid>=p.gross&&p.gross>0));cards+=benefitCard('int-'+i,'Intereses de cesantías · '+p.year,periodText(p.from,p.to),p.interestGross,p.interestPaid,paidToggle('np-int-paid-'+i,'Estos intereses ya fueron pagados',p.interestPaid>=p.interestGross&&p.interestGross>0));});
  if(type==='LIQUIDACION')cards+=benefitCard('vac','Vacaciones pendientes',m.vacationFrom?periodText(m.vacationFrom,to):'Confirma el historial para calcular',m.vacationGross,m.vacationPaid,paidToggle('np-vac-paid','Estas vacaciones ya fueron disfrutadas o pagadas',m.vacationPaid>=m.vacationGross&&m.vacationGross>0));
  let history='';
  if(type==='LIQUIDACION'&&m.serviceDays>360){let covered='';if(m.vacationMode==='covered'&&m.vacationFrom){const d=new Date(m.vacationFrom+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);covered=d.toISOString().slice(0,10);}history='<section class="np-benefit-history"><span class="np-friendly-step">Historial de vacaciones</span><h4>¿Ya tomó o le pagaron vacaciones dentro de este período?</h4><p>Si ya hubo vacaciones, Maddy solo necesita saber hasta qué fecha quedaron cubiertas.</p><div class="np-friendly-choices"><button type="button" class="np-friendly-choice '+(m.vacationMode==='none'?'is-selected':'')+'" data-vacation-history="none" aria-pressed="'+(m.vacationMode==='none')+'">No, ninguna</button><button type="button" class="np-friendly-choice '+(m.vacationMode==='covered'?'is-selected':'')+'" data-vacation-history="covered" aria-pressed="'+(m.vacationMode==='covered')+'">Sí, ya hubo vacaciones</button></div><label id="np-vacation-covered-label" '+(m.vacationMode==='covered'?'':'hidden')+'>Cubiertas hasta<input type="date" id="np-vacation-covered-to" min="'+esc(from)+'" max="'+esc(to)+'" value="'+esc(covered)+'"></label></section>';}
  let advanced='<div class="np-benefit-advanced-grid">';
  m.prime.forEach((p,i)=>{advanced+='<fieldset><legend>Prima '+(p.half==='1'?'1er semestre ':'2º semestre ')+p.year+'</legend><label>Base del período<input name="primeBase'+i+'" type="number" min="1" value="'+p.base+'"></label><label>Ya pagado<input name="primePaid'+i+'" type="number" min="0" value="'+p.paid+'"></label></fieldset>';});
  if(type==='LIQUIDACION')m.severance.forEach((p,i)=>{advanced+='<fieldset><legend>Cesantías '+p.year+'</legend><label>Base del período<input name="sevBase'+i+'" type="number" min="1" value="'+p.base+'"></label><label>Cesantías ya reconocidas<input name="sevPaid'+i+'" type="number" min="0" value="'+p.paid+'"></label><label>Intereses ya pagados<input name="intPaid'+i+'" type="number" min="0" value="'+p.interestPaid+'"></label></fieldset>';});
  if(type==='LIQUIDACION')advanced+='<fieldset><legend>Vacaciones y otros</legend><label>Base vacaciones · sin auxilio<input name="vacationBase" type="number" min="1" value="'+m.vacationBase+'"></label><label>Vacaciones ya reconocidas<input name="vacationPaid" type="number" min="0" value="'+m.vacationPaid+'"></label><label>Salario pendiente de pago<input name="salaryPending" type="number" min="0" value="'+amount(args.initial?.salaryPending)+'"></label><label>Salario pendiente · desde<input name="salaryPendingFrom" type="date" value="'+esc(args.initial?.salaryPendingFrom||'')+'"></label><label>Salario pendiente · hasta<input name="salaryPendingTo" type="date" value="'+esc(args.initial?.salaryPendingTo||'')+'"></label><label>Indemnización · valor revisado<input name="indemnity" type="number" min="0" value="'+amount(args.initial?.indemnity)+'"></label></fieldset>';
  advanced+='</div>';
  const warning=m.variableWarning?'<p class="np-benefit-warning">Este trabajador puede tener pagos variables o comisiones. Revisa “Ajustar cálculo” si esas sumas deben integrar alguna base.</p>':'';
  return '<section class="np-benefit-auto"><div class="np-benefit-source"><div><span>Calculado por Maddy</span><strong>'+esc(from)+' — '+esc(to)+'</strong></div><p>Maddy separa automáticamente semestres, vigencias y prestaciones.</p></div>'+warning+'<div class="np-benefit-cards">'+cards+'</div>'+history+'<input type="hidden" name="vacationFrom" value="'+esc(m.vacationFrom)+'"><input type="checkbox" name="reviewed" checked hidden><details class="np-benefit-advanced"'+(m.variableWarning?' open':'')+'><summary>Ajustar cálculo o registrar pagos parciales</summary><p>Solo úsalo si hubo salario variable, pagos parciales o un caso especial.</p>'+advanced+'</details></section>';
}

function readAmount(form,name){return amount(form.elements[name]?.value);}
export function readPayrollBenefitEditor(form,payload){
  const section=form.querySelector('.np-benefit-auto');if(!section)return payload;
  const prime=[...section.querySelectorAll('[data-prime-segment]')];
  payload.primaPeriods=prime.map((node,i)=>({from:node.dataset.from,to:node.dataset.to,base:readAmount(form,'primeBase'+i),paid:readAmount(form,'primePaid'+i)}));
  const sev=[...section.querySelectorAll('[data-sev-segment]')];
  if(sev.length)payload.severancePeriods=sev.map((node,i)=>({from:node.dataset.from,to:node.dataset.to,base:readAmount(form,'sevBase'+i),paid:readAmount(form,'sevPaid'+i),interestPaid:readAmount(form,'intPaid'+i)}));
  payload.vacationFrom=form.elements.vacationFrom?.value||'';payload.vacationBase=readAmount(form,'vacationBase');payload.vacationPaid=readAmount(form,'vacationPaid');payload.reviewed=true;return payload;
}

export function bindPayrollBenefitEditor(form,args){
  const section=form.querySelector('.np-benefit-auto');if(!section)return;
  const type=args.type,from=args.from,to=args.to,employee=args.employee,model=payrollBenefitModel(args),submit=form.querySelector('button[type="submit"]');
  model.prime.forEach((p,i)=>{const card=section.querySelector('[data-card="prima-'+i+'"]');card.dataset.primeSegment='';card.dataset.from=p.from;card.dataset.to=p.to;});
  model.severance.forEach((p,i)=>{const card=section.querySelector('[data-card="ces-'+i+'"]');card.dataset.sevSegment='';card.dataset.from=p.from;card.dataset.to=p.to;});
  const refresh=()=>{
    model.prime.forEach((p,i)=>{const base=readAmount(form,'primeBase'+i),g=gross(base,p.from,p.to,360),check=section.querySelector('#np-prime-paid-'+i),paidInput=form.elements['primePaid'+i];if(check?.checked)paidInput.value=String(g);section.querySelector('[data-benefit-value="prima-'+i+'"]').textContent=money(Math.max(0,g-readAmount(form,'primePaid'+i)));});
    model.severance.forEach((p,i)=>{const base=readAmount(form,'sevBase'+i),g=gross(base,p.from,p.to,360),days=payrollDays(p.from,p.to),interest=Math.round(g*days*.12/360),sevCheck=section.querySelector('#np-sev-paid-'+i),intCheck=section.querySelector('#np-int-paid-'+i);if(sevCheck?.checked)form.elements['sevPaid'+i].value=String(g);if(intCheck?.checked)form.elements['intPaid'+i].value=String(interest);section.querySelector('[data-benefit-value="ces-'+i+'"]').textContent=money(Math.max(0,g-readAmount(form,'sevPaid'+i)));section.querySelector('[data-benefit-value="int-'+i+'"]').textContent=money(Math.max(0,interest-readAmount(form,'intPaid'+i)));});
    if(type==='LIQUIDACION'){const vFrom=form.elements.vacationFrom?.value||'',base=readAmount(form,'vacationBase'),g=vFrom?gross(base,vFrom,to,720):0,check=section.querySelector('#np-vac-paid');if(check?.checked)form.elements.vacationPaid.value=String(g);section.querySelector('[data-benefit-value="vac"]').textContent=money(Math.max(0,g-readAmount(form,'vacationPaid')));const needsHistory=payrollDays(from,to)>360;if(submit)submit.disabled=needsHistory&&!vFrom;}
  };
  section.querySelectorAll('[id^="np-prime-paid-"]').forEach(x=>x.addEventListener('change',refresh));section.querySelectorAll('[id^="np-sev-paid-"]').forEach(x=>x.addEventListener('change',refresh));section.querySelectorAll('[id^="np-int-paid-"]').forEach(x=>x.addEventListener('change',refresh));section.querySelector('#np-vac-paid')?.addEventListener('change',refresh);
  section.querySelectorAll('.np-benefit-advanced input').forEach(input=>input.addEventListener('input',refresh));
  const historyButtons=[...section.querySelectorAll('[data-vacation-history]')],coveredLabel=section.querySelector('#np-vacation-covered-label'),covered=section.querySelector('#np-vacation-covered-to'),vacationFrom=form.elements.vacationFrom;
  historyButtons.forEach(button=>button.addEventListener('click',()=>{const mode=button.dataset.vacationHistory;historyButtons.forEach(b=>{const selected=b===button;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});if(mode==='none'){vacationFrom.value=from;if(coveredLabel)coveredLabel.hidden=true;}else{vacationFrom.value='';if(coveredLabel)coveredLabel.hidden=false;covered?.focus();}refresh();}));
  covered?.addEventListener('change',()=>{if(!covered.value||covered.value>=to){vacationFrom.value='';refresh();return;}vacationFrom.value=nextDay(covered.value);refresh();});refresh();
}