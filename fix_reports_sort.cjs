const fs = require('fs');
const path = 'g:/Meu Drive/2. Igreja & Ministério/Arquivo_Igreja/BI_Igreja/bsb_church/src/pages/Reports.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
  { 
    from: /font-semibold text-gray-600 uppercase">Nome<\/th>/,
    to: 'font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort(\'nome\')}><div className="flex items-center gap-1">Nome {sortField === \'nome\' ? (sortDirection === \'asc\' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>'
  },
  {
    from: /font-semibold text-gray-600 uppercase">Perfil \/ Idade<\/th>/,
    to: 'font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort(\'idade\')}><div className="flex items-center gap-1">Perfil / Idade {sortField === \'idade\' ? (sortDirection === \'asc\' ? <ChevronUp className="h-3 w-3 text-primary-500\" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>'
  },
  {
    from: /font-semibold text-gray-600 uppercase">GC \/ Setor<\/th>/,
    to: 'font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort(\'grupos_caseiros\')}><div className="flex items-center gap-1">GC / Setor {sortField === \'grupos_caseiros\' ? (sortDirection === \'asc\' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>'
  },
  {
    from: /font-semibold text-gray-600 uppercase">Discipulador<\/th>/,
    to: 'font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort(\'discipulador\')}><div className="flex items-center gap-1">Discipulador {sortField === \'discipulador\' ? (sortDirection === \'asc\' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>'
  }
];

replacements.forEach(r => {
  content = content.replace(r.from, r.to);
});

fs.writeFileSync(path, content);
console.log('Done');
