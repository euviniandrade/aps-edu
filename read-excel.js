const xl = require('./web-admin/node_modules/xlsx');
const path = 'C:\\Users\\vinicius.felix\\OneDrive - Adventistas\\UCB-APS-EDUC14\\Downloads\\Viagem Administrativa 2026.xlsx';
const wb = xl.readFile(path);
wb.SheetNames.forEach(n => {
  console.log('\n=== SHEET:', n, '===');
  const data = xl.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
  data.forEach(r => {
    if (r.some(c => c !== '' && c != null)) console.log(JSON.stringify(r));
  });
});
