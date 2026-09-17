import {guardStandalonePage} from '../core/page-guard.js';
import {installPayrollFriendlyUx} from '../core/payroll-friendly.js';
import {installPayrollPremiumUx} from '../core/payroll-premium.js';
import {mountPayroll} from '../core/payroll-ui.js';

void guardStandalonePage({
  permission:'nomina.read',
  render:async({session})=>{
    const root=document.getElementById('payroll-app');
    installPayrollFriendlyUx(root);
    installPayrollPremiumUx(root);
    await mountPayroll(root,session);
  }
});
