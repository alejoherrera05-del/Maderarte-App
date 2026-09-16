import fs from 'node:fs';
const source=fs.readFileSync('public/js/core/payroll-rules.js','utf8').replace(/^\uFEFF/,'').replace(/^export /gm,'');
const output='// Generated from public/js/core/payroll-rules.js. Do not edit independently.\n'+source;
if(process.argv.includes('--check')){if(fs.readFileSync('apps-script/PayrollRules.gs','utf8')!==output)throw Error('Payroll rules mirror is stale');}else fs.writeFileSync('apps-script/PayrollRules.gs',output);
