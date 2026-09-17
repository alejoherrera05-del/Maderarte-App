import {guardStandalonePage} from '../core/page-guard.js';
import {installPayrollFriendlyUx} from '../core/payroll-friendly.js';
import {mountPayroll} from '../core/payroll-ui.js';

void guardStandalonePage({
  permission:'nomina.read',
  render:async({session})=>{
    const root=document.getElementById('payroll-app');
    await mountPayroll(root,session);
    installPayrollFriendlyUx(root);
  }
});
