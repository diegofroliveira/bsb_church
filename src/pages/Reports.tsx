import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Filter, Download, Loader2, Search, FileText, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';

const normalizeStr = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
};

const MultiSelect: React.FC<{
  label: string;
  options: any[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ label, options, selected, onChange, placeholder = "Todos" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer flex items-center justify-between min-h-[38px] group hover:border-primary-300 transition-colors"
      >
        <span className="truncate max-w-[180px] text-gray-700">
          {selected.length === 0 ? placeholder : (
            selected.length === 1 ? selected[0] : `${selected.length} selecionados`
          )}
        </span>
        <Filter className={clsx("h-3 w-3 transition-colors", isOpen ? "text-primary-500" : "text-gray-400 group-hover:text-primary-400")} />
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto p-2 space-y-1 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opções</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="text-[10px] font-bold text-primary-600 uppercase hover:underline"
                >
                  Limpar
                </button>
             </div>
             <div className="border-t border-gray-100 my-1" />
             {options.map(opt => {
               const val = String(opt);
               return (
                 <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-primary-50 rounded-lg cursor-pointer group transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selected.includes(val)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (selected.includes(val)) onChange(selected.filter(s => s !== val));
                        else onChange([...selected, val]);
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                    />
                    <span className={clsx("text-xs transition-colors", selected.includes(val) ? "text-primary-700 font-semibold" : "text-gray-600 group-hover:text-primary-600")}>
                      {val}
                    </span>
                 </label>
               );
             })}
          </div>
        </>
      )}
    </div>
  );
};

export const Reports: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterGC, setFilterGC] = useState<string[]>([]);
  const [filterGender, setFilterGender] = useState<string[]>([]);
  const [filterAgeCategory, setFilterAgeCategory] = useState('Todas');
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterSetor, setFilterSetor] = useState<string[]>([]);
  const [filterMestre, setFilterMestre] = useState<string[]>([]);
  const [filterMaritalStatus, setFilterMaritalStatus] = useState<string[]>([]);
  const [filterMinAge, setFilterMinAge] = useState<number>(0);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(120);
  const [filterPersonType, setFilterPersonType] = useState<string[]>([]);
  const [filterStatusPessoa, setFilterStatusPessoa] = useState<string[]>([]);
  const [filterNoChildren, setFilterNoChildren] = useState(false);
  
  const [sortField, setSortField] = useState<string>('nome');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'nome', 'tipo_cadastro', 'grupos_caseiros', 'setor', 'discipulador', 'celular_principal_sms', 'email', 'nascimento', 'idade', 'sexo', 'estado_civil'
  ]);

  const columnOptions = [
    { key: 'nome', label: 'Nome' },
    { key: 'tipo_cadastro', label: 'Vínculo' },
    { key: 'grupos_caseiros', label: 'GC' },
    { key: 'setor', label: 'Setor' },
    { key: 'discipulador', label: 'Discipulador' },
    { key: 'celular_principal_sms', label: 'Telefone' },
    { key: 'email', label: 'E-mail' },
    { key: 'nascimento', label: 'Nascimento' },
    { key: 'idade', label: 'Idade' },
    { key: 'sexo', label: 'Sexo' },
    { key: 'estado_civil', label: 'Estado Civil' },
    { key: 'cpf', label: 'CPF' },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'uf', label: 'UF' },
    { key: 'status', label: 'Status' },
    { key: 'tipo_de_pessoa', label: 'Tipo de Pessoa' },
    { key: 'status_pessoa', label: 'Status Pessoa' }
  ];

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [membrosRes, celulasRes, discRes] = await Promise.all([
           supabase.from('membros').select('*').limit(10000),
           supabase.from('celulas').select('grupo_caseiro, setor'),
           supabase.from('discipulado').select('discipulo, discipulador, status')
        ]);
        
        const allMembros = membrosRes.data || [];
        const allCelulas = celulasRes.data || [];
        const allDisc = discRes.data || [];

        // Build mapping dictionaries for O(1) lookups
        const setorMap: Record<string, string> = {};
        allCelulas.forEach((c: any) => {
           if (c.grupo_caseiro && c.setor) {
               setorMap[c.grupo_caseiro.toLowerCase()] = c.setor;
           }
        });

        const discipuladorMap: Record<string, string> = {};
        allDisc.forEach((d: any) => {
           if (d.discipulo && d.discipulador) {
               discipuladorMap[d.discipulo.trim().toLowerCase()] = d.discipulador;
           }
        });

        // Enrich members with relational data
        const enrichedMembers = allMembros.map((m: any) => {
           const nomeLower = (m.nome || m.name || '').trim().toLowerCase();
           const gcLower = (m.grupos_caseiros || '').trim().toLowerCase();
           return {
               ...m,
               setor: setorMap[gcLower] || 'Sem Setor',
               discipulador: discipuladorMap[nomeLower] || 'Sem Discipulador'
           };
        });

        setMembers(enrichedMembers);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // Compute Unique List of Filter Options
  const uniqueTypes = useMemo(() => Array.from(new Set(members.map(m => m.tipo_cadastro).filter(Boolean))).sort(), [members]);
  const uniqueGCs = useMemo(() => Array.from(new Set(members.map(m => m.grupos_caseiros).filter(Boolean))).sort(), [members]);
  const uniqueGenders = useMemo(() => Array.from(new Set(members.map(m => m.sexo || m.sex).filter(Boolean))).sort(), [members]);
  const uniqueStates = useMemo(() => Array.from(new Set(members.map(m => m.uf || m.estado).filter(Boolean))).sort(), [members]);
  const uniqueSetores = useMemo(() => Array.from(new Set(members.map(m => m.setor).filter(s => s !== 'Sem Setor'))).sort(), [members]);
  const uniqueMestres = useMemo(() => Array.from(new Set(members.map(m => m.discipulador).filter(d => d !== 'Sem Discipulador'))).sort(), [members]);
  const uniqueMaritalStatuses = useMemo(() => Array.from(new Set(members.map(m => m.estado_civil).filter(Boolean))).sort(), [members]);
  const uniquePersonTypes = useMemo(() => Array.from(new Set(members.map(m => m.tipo_de_pessoa).filter(Boolean))).sort(), [members]);
  const uniqueStatusPessoas = useMemo(() => Array.from(new Set(members.map(m => m.status_pessoa || m.status).filter(Boolean))).sort(), [members]);
  
  const allParentsNames = useMemo(() => {
    const names = new Set<string>();
    members.forEach(m => {
      if (m.pai) names.add(normalizeStr(m.pai));
      if (m.mae) names.add(normalizeStr(m.mae));
    });
    return names;
  }, [members]);

  const calculateAge = (dob: string) => {
    if (!dob) return -1;
    let parts = dob.includes('/') ? dob.split('/') : dob.split('-');
    const birth = dob.includes('/') ? new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0])) : new Date(dob);
    if (isNaN(birth.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const getAgeCategory = (age: number) => {
    if (age < 0) return 'Indefinida';
    if (age < 12) return 'Criança';
    if (age < 18) return 'Adolescente';
    if (age < 30) return 'Jovem';
    if (age < 60) return 'Adulto';
    return 'Idoso';
  };


  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (filterQuery) {
        const queryLower = filterQuery.toLowerCase();
        const nome = (m.nome || m.name || '').toLowerCase();
        if (!nome.includes(queryLower)) return false;
      }
      if (filterType.length > 0 && !filterType.includes(m.tipo_cadastro)) return false;
      if (filterGC.length > 0 && !filterGC.includes(m.grupos_caseiros)) return false;
      if (filterSetor.length > 0 && !filterSetor.includes(m.setor)) return false;
      if (filterMestre.length > 0 && !filterMestre.includes(m.discipulador)) return false;
      
      const gender = m.sexo || m.sex || '';
      if (filterGender.length > 0 && !filterGender.includes(gender)) return false;
      
      const state = m.uf || m.estado || '';
      if (filterState.length > 0 && !filterState.includes(state)) return false;
      
      const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
      if (filterAgeCategory !== 'Todas' && getAgeCategory(age) !== filterAgeCategory) return false;
      if (age < filterMinAge || age > filterMaxAge) return false;
      
      if (filterMaritalStatus.length > 0 && !filterMaritalStatus.includes(m.estado_civil)) return false;
      if (filterPersonType.length > 0 && !filterPersonType.includes(m.tipo_de_pessoa)) return false;
      
      const status = m.status_pessoa || m.status || '';
      if (filterStatusPessoa.length > 0 && !filterStatusPessoa.includes(status)) return false;
      
      if (filterNoChildren) {
        const nomeNorm = normalizeStr(m.nome);
        if (allParentsNames.has(nomeNorm)) return false;
      }
      
      return true;
    }).sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'nome') {
        valA = a.nome || a.name || '';
        valB = b.nome || b.name || '';
      } else if (sortField === 'idade') {
        valA = calculateAge(a.nascimento || a.data_nascimento || a.birth_date);
        valB = calculateAge(b.nascimento || b.data_nascimento || b.birth_date);
      } else if (sortField === 'grupos_caseiros') {
        valA = a.grupos_caseiros || '';
        valB = b.grupos_caseiros || '';
      } else if (sortField === 'discipulador') {
        valA = a.discipulador || '';
        valB = b.discipulador || '';
      } else {
        valA = a[sortField] || '';
        valB = b[sortField] || '';
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, filterQuery, filterType, filterGC, filterGender, filterAgeCategory, filterMinAge, filterMaxAge, filterMaritalStatus, filterState, filterSetor, filterMestre, filterPersonType, filterStatusPessoa, filterNoChildren, allParentsNames, sortField, sortDirection]);

  const handleExportExcel = () => {
    if (filteredMembers.length === 0) return;
    
    const data = filteredMembers.map(item => {
      const row: any = {};
      selectedColumns.forEach(key => {
        const label = columnOptions.find(o => o.key === key)?.label || key;
        let val = item[key];
        if (key === 'idade') val = calculateAge(item.nascimento || item.data_nascimento || item.birth_date);
        row[label] = val || '-';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    XLSX.writeFile(workbook, `relatorio_igrejapro_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary-600" />
            Relatórios e Central
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Filtre cruzamentos de dados e exporte planilhas analíticas rapidamente.
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={isLoading || filteredMembers.length === 0}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Exportar Planilha ({filteredMembers.length})
        </button>
      </header>

      {/* Filter Surface */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
        <div className="flex md:items-center justify-between border-b border-gray-100 pb-4">
          <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary-500" /> Painel de Filtros Avançados
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Buscar por Nome</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                   type="text" value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
                   className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                   placeholder="Ex: João da Silva..."
                />
             </div>
          </div>
          
          <div className="xl:col-span-1">
             <MultiSelect label="Tipo / Vínculo" options={uniqueTypes} selected={filterType} onChange={setFilterType} />
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Faixa Etária</label>
             <select value={filterAgeCategory} onChange={e => setFilterAgeCategory(e.target.value)} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                 {['Todas', 'Criança', 'Adolescente', 'Jovem', 'Adulto', 'Idoso', 'Indefinida'].map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Sexo / Gênero" options={uniqueGenders} selected={filterGender} onChange={setFilterGender} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Setor" options={uniqueSetores} selected={filterSetor} onChange={setFilterSetor} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Grupo Caseiro" options={uniqueGCs} selected={filterGC} onChange={setFilterGC} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="UF / Estado" options={uniqueStates} selected={filterState} onChange={setFilterState} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Discipulador" options={uniqueMestres} selected={filterMestre} onChange={setFilterMestre} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Estado Civil" options={uniqueMaritalStatuses} selected={filterMaritalStatus} onChange={setFilterMaritalStatus} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Status Pessoa" options={uniqueStatusPessoas} selected={filterStatusPessoa} onChange={setFilterStatusPessoa} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Tipo de Pessoa" options={uniquePersonTypes} selected={filterPersonType} onChange={setFilterPersonType} />
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Idade (Min / Max)</label>
             <div className="flex items-center gap-2">
                <input type="number" value={filterMinAge} onChange={e => setFilterMinAge(parseInt(e.target.value) || 0)} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Min" />
                <span className="text-gray-400">/</span>
                <input type="number" value={filterMaxAge} onChange={e => setFilterMaxAge(parseInt(e.target.value) || 120)} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Max" />
             </div>
          </div>

          <div className="xl:col-span-1 flex items-end pb-1">
             <label className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50 transition-colors border border-dashed border-gray-200 w-full">
                <input 
                  type="checkbox" 
                  checked={filterNoChildren}
                  onChange={e => setFilterNoChildren(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-xs font-bold text-gray-700">Apenas sem filhos (Est.)</span>
             </label>
          </div>

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
           <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
             <Filter className="h-4 w-4 text-primary-500" /> Configurar Exportação
           </h3>
           <div className="flex gap-4">
              <button onClick={() => setSelectedColumns(columnOptions.map(o => o.key))} className="text-[10px] font-bold text-primary-600 uppercase hover:underline">Selecionar Tudo</button>
              <button onClick={() => setSelectedColumns(['nome'])} className="text-[10px] font-bold text-gray-400 uppercase hover:underline">Limpar</button>
           </div>
        </div>
        <div className="p-6">
           <p className="text-xs text-gray-500 mb-4 italic">Selecione abaixo as colunas que deseja incluir no arquivo final (XLSX/CSV). Deixe marcado apenas o que for essencial para a secretaria.</p>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {columnOptions.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                   <input 
                     type="checkbox" 
                     checked={selectedColumns.includes(opt.key)}
                     onChange={(e) => {
                       if (e.target.checked) setSelectedColumns([...selectedColumns, opt.key]);
                       else setSelectedColumns(selectedColumns.filter(c => c !== opt.key));
                     }}
                     className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                   />
                   <span className={clsx("text-xs font-medium transition-colors", selectedColumns.includes(opt.key) ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600")}>
                     {opt.label}
                   </span>
                </label>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col relative">
        {isLoading ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-4" />
           </div>
        ) : filteredMembers.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-4"><Search className="h-6 w-6 text-gray-400" /></div>
              <h3 className="text-lg font-medium text-gray-900">Nenhum membro encontrado</h3>
              <p className="text-gray-500 mt-1 max-w-sm">Os filtros aplicados não retornaram nenhum registro.</p>
           </div>
        ) : (
           <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10">
                   <tr>
                     <th className="py-4 pl-6 pr-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('nome')}><div className="flex items-center gap-1">Nome {sortField === 'nome' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                     <th className="px-3 py-4 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('idade')}><div className="flex items-center gap-1">Perfil / Idade {sortField === 'idade' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                     <th className="px-3 py-4 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('grupos_caseiros')}><div className="flex items-center gap-1">GC / Setor {sortField === 'grupos_caseiros' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                     <th className="px-3 py-4 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('discipulador')}><div className="flex items-center gap-1">Discipulador {sortField === 'discipulador' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 bg-white">
                   {filteredMembers.slice(0, 100).map((m, idx) => {
                     const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
                     
                     return (
                       <tr key={m.id || idx} className="hover:bg-gray-50/50">
                          <td className="whitespace-nowrap py-4 pl-6 pr-3">
                             <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                                   {(m.nome || m.name || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{m.nome}</span>
                                   <span className="text-xs text-gray-500">{m.status || 'Ativo'}</span>
                                </div>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", 
                                     m.tipo_cadastro === 'Visitante' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                                  )}>{m.tipo_cadastro || 'Membro'}</span>
                                </div>
                                <span className="text-xs text-gray-500 mt-1">{age > 0 ? `${age} anos` : '-'} - {m.sexo||''}</span>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <div className="flex flex-col min-w-0 max-w-[150px]">
                                <span className="text-sm text-gray-900 truncate">{m.grupos_caseiros || 'Sem Grupo'}</span>
                                <span className="text-xs text-indigo-500 font-medium truncate mt-1">{m.setor}</span>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <span className="text-sm font-medium text-emerald-600 truncate max-w-[150px] inline-block">{m.discipulador}</span>
                          </td>
                       </tr>
                     );
                   })}
                 </tbody>
              </table>
           </div>
        )}
      </div>
    </div>
  );
};
