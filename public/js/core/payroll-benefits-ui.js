import {payrollBenefitDefaults,payrollDays} from './payroll-rules.js';
import {payrollMoney as money} from './payroll-document.js';

const esc=value=>String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[ch]));
const amount=value=>Math.max(0,Math.round(Number(value||0)));
const gross=(base,from,to,divisor)=>Math.round(amount(base)*payrollDays(from,to)/divisor);
const nextDay=value=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};

function paidReceipt(receipts,employeeId,type,from,to){
  return (receipts||[]).some(r=>r.employeeId===employeeId&&r.type===type&&r.status==='PAGADO'&&r.from<=to&&r.to>=from);
}

export function payrollBenefitModel({type,employee,to,initial={},rates,receipts=[]}){
  const defaults=payrollBenefitDefaults(to,employee,rates);
  const primaFrom=initial.primaFrom||defaults.primaFrom;
  const severanceFrom=initial.severanceFrom||defaults.severanceFrom;
  const benefitBase=amount(initial.benefitBase||defaults.benefitBase);
  const severanceBase=amount(initial.severanceBase||benefitBase);
  const vacationBase=amount(initial.vacationBase||defaults.vacationBase);
  const primaGross=gross(benefitBase,primaFrom,to,360);
  const severanceGross=type==='LIQUIDACION'?gross(severanceBase,severanceFrom,to,360):0;
  const interestGross=type==='LIQUIDACION'?Math.round(severanceGross*payrollDays(severanceFrom,to)*.12/360):0;
  const tenureDays=payrollDays(employee.start,to);
  const explicitVacation=String(initial.vacationFrom||'');
  const vacationMode=explicitVacation?(explicitVacation===employee.start?'none':'covered'):(tenureDays<=360?'none':'');
  const vacationFrom=explicitVacation||(vacationMode==='none'?employee.start:'');
  const vacationGross=type==='LIQUIDACION'&&vacationFrom?gross(vacationBase,vacationFrom,to,720):0;
  const primaPaid=initial.primaPaid!==undefined?amount(initial.primaPaid):(paidReceipt(receipts,employee.id,'PRIMA',primaFrom,to)?primaGross:0);
  return {defaults,primaFrom,severanceFrom,benefitBase,severanceBase,vacationBase,primaGross,severanceGross,interestGross,tenureDays,vacationMode,vacationFrom,vacationGross,primaPaid,severancePaid:amount(initial.severancePaid),interestPaid:amount(initial.interestPaid),vacationPaid:amount(initial.vacationPaid),variableWarning:Boolean(employee.sellerUid)};
}

function paidToggle(id,label,checked){return '<label class="np-benefit-paid"><input type="checkbox" id="'+id+'" '+(checked?'checked':'')+'><span>'+esc(label)+'</span></label>';}

function benefitCard(id,title,period,grossValue,paidValue,toggle=''){
  const pending=Math.max(0,grossValue-paidValue);
  return '<article class="np-benefit-card" data-benefit-card="'+id+'"><div class="np-benefit-card-copy"><span>'+esc(title)+'</span><small>'+esc(period)+'</small></div><strong data-benefit-value="'+id+'">'+money(pending)+'</strong>'+toggle+'</article>';
}

export function payrollBenefitEditorHtml(args){
  const m=payrollBenefitModel(args),type=args.type,employee=args.employee,to=args.to;
  let vacationQuestion='';
  if(type==='LIQUIDACION'&&m.tenureDays>360){
    let coveredValue='';
    if(m.vacationMode==='covered'&&m.vacationFrom){const d=new Date(m.vacationFrom+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);coveredValue=d.toISOString().slice(0,10);}
    vacationQuestion='<section class="np-benefit-history"><span class="np-friendly-step">Historial de vacaciones</span><h4>¿Ya tomó o le pagaron vacaciones durante este contrato?</h4><p>Maddy solo necesita este dato porque el historial anterior no se puede adivinar.</p><div class="np-friendly-choices"><button type="button" class="np-friendly-choice '+(m.vacationMode==='none'?'is-selected':'')+'" data-vacation-history="none" aria-pressed="'+(m.vacationMode==='none')+'">No, nunca</button><button type="button" class="np-friendly-choice '+(m.vacationMode==='covered'?'is-selected':'')+'" data-vacation-history="covered" aria-pressed="'+(m.vacationMode==='covered')+'">Sí, ya tiene períodos cubiertos</button></div><label id="np-vacation-covered-label" '+(m.vacationMode==='covered'?'':'hidden')+'>Vacaciones cubiertas hasta<input type="date" id="np-vacation-covered-to" min="'+esc(employee.start)+'" max="'+esc(to)+'" value="'+esc(coveredValue)+'"></label></section>';
  }
  const vacationPeriod=m.vacationFrom?m.vacationFrom+' — '+to:'Confirma el historial para calcular';
  const variableNote=m.variableWarning?'<p class="np-benefit-warning">Este trabajador tiene vínculo comercial. Si recibió salario variable o comisiones que deban integrar la base, abre “Ajustar cálculo”.</p>':'';
  const advancedOpen=m.variableWarning?' open':'';
  let cards=benefitCard('prima','Prima de servicios',m.primaFrom+' — '+to,m.primaGross,m.primaPaid,paidToggle('np-prima-paid','Esta prima ya fue pagada',m.primaPaid>=m.primaGross&&m.primaGross>0));
  if(type==='LIQUIDACION'){
    cards+=benefitCard('cesantias','Cesantías',m.severanceFrom+' — '+to,m.severanceGross,m.severancePaid,paidToggle('np-severance-paid','Estas cesantías ya fueron reconocidas',m.severancePaid>=m.severanceGross&&m.severanceGross>0));
    cards+=benefitCard('intereses','Intereses a las cesantías',m.severanceFrom+' — '+to,m.interestGross,m.interestPaid,paidToggle('np-interest-paid','Estos intereses ya fueron pagados',m.interestPaid>=m.interestGross&&m.interestGross>0));
    cards+=benefitCard('vacaciones','Vacaciones pendientes',vacationPeriod,m.vacationGross,m.vacationPaid,'');
  }
  let advanced='<div class="np-grid"><label>Base mensual prima<input name="benefitBase" type="number" min="1" value="'+m.benefitBase+'"></label><label>Prima ya pagada<input name="primaPaid" type="number" min="0" value="'+m.primaPaid+'"></label>';
  if(type==='LIQUIDACION'){
    advanced+='<label>Cesantías desde<input name="severanceFrom" type="date" value="'+esc(m.severanceFrom)+'"></label><label>Base mensual cesantías<input name="severanceBase" type="number" min="1" value="'+m.severanceBase+'"></label><label>Cesantías ya reconocidas<input name="severancePaid" type="number" min="0" value="'+m.severancePaid+'"></label><label>Intereses ya pagados<input name="interestPaid" type="number" min="0" value="'+m.interestPaid+'"></label><label>Base vacaciones · sin auxilio<input name="vacationBase" type="number" min="1" value="'+m.vacationBase+'"></label><label>Vacaciones ya reconocidas<input name="vacationPaid" type="number" min="0" value="'+m.vacationPaid+'"></label>';
  }
  advanced+='</div>';
  if(type==='LIQUIDACION')advanced+='<div class="np-grid"><label>Salario pendiente de pago<input name="salaryPending" type="number" min="0" value="'+amount(args.initial&&args.initial.salaryPending)+'"></label><label>Salario pendiente · desde<input name="salaryPendingFrom" type="date" value="'+esc(args.initial&&args.initial.salaryPendingFrom||'')+'"></label><label>Salario pendiente · hasta<input name="salaryPendingTo" type="date" value="'+esc(args.initial&&args.initial.salaryPendingTo||'')+'"></label><label>Indemnización · valor revisado<input name="indemnity" type="number" min="0" value="'+amount(args.initial&&args.initial.indemnity)+'"></label></div>';
  return '<section class="np-benefit-auto" data-benefit-type="'+esc(type)+'"><div class="np-benefit-source"><div><span>Calculado por Maddy</span><strong>'+money(m.defaults.salary)+' salario'+(m.defaults.transport?' + '+money(m.defaults.transport)+' auxilio':'')+'</strong></div><p>No tienes que escribir fórmulas ni bases si estas condiciones son correctas.</p></div>'+variableNote+'<div class="np-benefit-cards">'+cards+'</div>'+vacationQuestion+'<input type="hidden" name="primaFrom" value="'+esc(m.primaFrom)+'"><input type="hidden" name="vacationFrom" value="'+esc(m.vacationFrom)+'"><input type="checkbox" name="reviewed" checked hidden><details class="np-benefit-advanced"'+advancedOpen+'><summary>Ajustar cálculo o registrar pagos parciales</summary><p>Ábrelo solo si hubo otro salario, pagos parciales, salario variable o un caso especial.</p>'+advanced+'</details></section>';
}

export function bindPayrollBenefitEditor(form,args){
  const section=form.querySelector('.np-benefit-auto');if(!section)return;
  const type=args.type,employee=args.employee,to=args.to;
  const submit=form.querySelector('button[type="submit"]');
  const field=name=>form.elements[name];
  const card=(id,value)=>{const node=section.querySelector('[data-benefit-value="'+id+'"]');if(node)node.textContent=money(Math.max(0,value));};
  const model=()=>{
    const benefitBase=amount(field('benefitBase')&&field('benefitBase').value),primaFrom=field('primaFrom').value,primaGross=gross(benefitBase,primaFrom,to,360);
    const severanceFrom=field('severanceFrom')&&field('severanceFrom').value||'',severanceBase=amount(field('severanceBase')&&field('severanceBase').value),severanceGross=type==='LIQUIDACION'?gross(severanceBase,severanceFrom,to,360):0;
    const interestGross=type==='LIQUIDACION'?Math.round(severanceGross*payrollDays(severanceFrom,to)*.12/360):0;
    const vacationFrom=field('vacationFrom')&&field('vacationFrom').value||'',vacationBase=amount(field('vacationBase')&&field('vacationBase').value),vacationGross=type==='LIQUIDACION'&&vacationFrom?gross(vacationBase,vacationFrom,to,720):0;
    return {primaGross,severanceGross,interestGross,vacationGross};
  };
  const refresh=()=>{
    try{
      const m=model();card('prima',m.primaGross-amount(field('primaPaid')&&field('primaPaid').value));
      if(type==='LIQUIDACION'){card('cesantias',m.severanceGross-amount(field('severancePaid')&&field('severancePaid').value));card('intereses',m.interestGross-amount(field('interestPaid')&&field('interestPaid').value));card('vacaciones',m.vacationGross-amount(field('vacationPaid')&&field('vacationPaid').value));}
      const needsHistory=type==='LIQUIDACION'&&payrollDays(employee.start,to)>360;if(submit)submit.disabled=needsHistory&&!(field('vacationFrom')&&field('vacationFrom').value);
    }catch{if(submit)submit.disabled=true;}
  };
  const setFullPaid=(checkbox,name,getGross)=>{checkbox&&checkbox.addEventListener('change',()=>{const input=field(name);if(!input)return;input.value=checkbox.checked?String(getGross()):'0';input.dispatchEvent(new Event('input',{bubbles:true}));refresh();});};
  setFullPaid(section.querySelector('#np-prima-paid'),'primaPaid',()=>model().primaGross);
  setFullPaid(section.querySelector('#np-severance-paid'),'severancePaid',()=>model().severanceGross);
  setFullPaid(section.querySelector('#np-interest-paid'),'interestPaid',()=>model().interestGross);
  section.querySelectorAll('.np-benefit-advanced input').forEach(input=>input.addEventListener('input',refresh));
  const historyButtons=[...section.querySelectorAll('[data-vacation-history]')],coveredLabel=section.querySelector('#np-vacation-covered-label'),covered=section.querySelector('#np-vacation-covered-to'),vacationFrom=field('vacationFrom');
  historyButtons.forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.vacationHistory;historyButtons.forEach(b=>{const selected=b===button;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));});
    if(mode==='none'){vacationFrom.value=employee.start;if(coveredLabel)coveredLabel.hidden=true;}else{vacationFrom.value='';if(coveredLabel)coveredLabel.hidden=false;covered&&covered.focus();}refresh();
  }));
  covered&&covered.addEventListener('change',()=>{if(!covered.value||covered.value>=to){vacationFrom.value='';refresh();return;}vacationFrom.value=nextDay(covered.value);refresh();});
  refresh();
}