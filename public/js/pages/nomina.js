import {guardStandalonePage} from '../core/page-guard.js';
import {mountPayroll} from '../core/payroll-ui.js';
void guardStandalonePage({permission:'nomina.read',render:({session})=>mountPayroll(document.getElementById('payroll-app'),session)});
