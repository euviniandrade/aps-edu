import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xl = require('C:/Users/vinicius.felix/Projetos/aps-edu/web-admin/node_modules/xlsx');
const wb = xl.readFile('C:/Users/vinicius.felix/OneDrive - Adventistas/UCB-APS-EDUC14/Downloads/Viagem Administrativa 2026.xlsx');
wb.SheetNames.forEach(n => {
  console.log('\n=== SHEET:', n, '===');
  const d = xl.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
  d.forEach(r => { if (r.some(c => c !== '' && c != null)) console.log(JSON.stringify(r)); });
});
