import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Filter, Download, Loader2, Search, FileText } from 'lucide-react';
import clsx from 'clsx';

export const Reports: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [filterGC, setFilterGC] = useState('Todos');
  const [filterGender, setFilterGender] = useState('Todos');
  const [filterAgeCategory, setFilterAgeCategory] = useState('Todas');
  const [filterState, setFilterState] = useState('Todos');

  useEffect(() => {
    const fetchAllMembers = async () => {
      setIsLoading(true);
      try {
        // Fetch up to 10k members to perform in-memory filtering (typical for reporting UI without heavy pagination)
        const { data, error } = await supabase.from('membros').select('*').limit(10000);
        if (error) throw error;
        setMembers(data || []);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllMembers();
  }, []);

  // Compute Unique List of Filter Options
  const uniqueTypes = useMemo(() => Array.from(new Set(members.map(m => m.tipo_cadastro).filter(Boolean))).sort(), [members]);
  const uniqueGCs = useMemo(() => Array.from(new Set(members.map(m => m.grupo_caseiro).filter(Boolean))).sort(), [members]);
  const uniqueGenders = useMemo(() => Array.from(new Set(members.map(m => m.sexo || m.sex).filter(Boolean))).sort(), [members]);
  const uniqueStates = useMemo(() => Array.from(new Set(members.map(m => m.uf || m.estado).filter(Boolean))).sort(), [members]);

  const calculateAge = (dob: string) => {
    if (!dob) return -1;
    let parts = dob.includes('/') ? dob.split('/') : dob.split('-');
    // Assuming DD/MM/YYYY if slash, else YYYY-MM-DD
    const birth = dob.includes('/') ? new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0])) : new Date(dob);
    if (isNaN(birth.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
      age--;
    }
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
      // Free Text Target
      if (filterQuery) {
        const queryLower = filterQuery.toLowerCase();
        const nome = (m.nome || m.name || '').toLowerCase();
        if (!nome.includes(queryLower)) return false;
      }
      
      // Type Target
      if (filterType !== 'Todos' && m.tipo_cadastro !== filterType) return false;
      
      // GC Target
      if (filterGC !== 'Todos' && m.grupo_caseiro !== filterGC) return false;
      
      // Gender Target
      const gender = m.sexo || m.sex || '';
      if (filterGender !== 'Todos' && gender !== filterGender) return false;
      
      // State Target
      const state = m.uf || m.estado || '';
      if (filterState !== 'Todos' && state !== filterState) return false;

      // Age Target
      if (filterAgeCategory !== 'Todas') {
        const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
        if (getAgeCategory(age) !== filterAgeCategory) return false;
      }

      return true;
    });
  }, [members, filterQuery, filterType, filterGC, filterGender, filterAgeCategory, filterState]);

  const handleExportCSV = () => {
    if (filteredMembers.length === 0) return;
    
    // We dynamically grab the headers from the first filtered member
    const headers = Object.keys(filteredMembers[0]);
    
    // Convert logic to safely escape quotes and commas
    const escapeCsv = (val: any) => {
        if (val == null) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const csvContent = [
      headers.join(','),
      ...filteredMembers.map(item => headers.map(header => escapeCsv(item[header])).join(','))
    ].join('\n');

    // Blob and Native download logic
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // uFEFF is BOM for Excel UTF-8 support
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_igrejapro_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          onClick={handleExportCSV}
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
            <Filter className="h-4 w-4 text-primary-500" /> Painel de Filtros Ativos
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* TextField Filter */}
          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Buscar por Nome</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                   type="text"
                   value={filterQuery}
                   onChange={e => setFilterQuery(e.target.value)}
                   className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                   placeholder="Ex: João da Silva..."
                />
             </div>
          </div>
          
          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Tipo / Vínculo</label>
             <select
                 value={filterType}
                 onChange={e => setFilterType(e.target.value)}
                 className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
             >
                 <option value="Todos">Todos</option>
                 {uniqueTypes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
             </select>
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Grupo Caseiro</label>
             <select
                 value={filterGC}
                 onChange={e => setFilterGC(e.target.value)}
                 className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
             >
                 <option value="Todos">Todos</option>
                 {uniqueGCs.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
             </select>
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Faixa Etária</label>
             <select
                 value={filterAgeCategory}
                 onChange={e => setFilterAgeCategory(e.target.value)}
                 className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
             >
                 {['Todas', 'Criança', 'Adolescente', 'Jovem', 'Adulto', 'Idoso', 'Indefinida'].map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">UF (Estado)</label>
             <select
                 value={filterState}
                 onChange={e => setFilterState(e.target.value)}
                 className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
             >
                 <option value="Todos">Todos</option>
                 {uniqueStates.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
             </select>
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Sexo</label>
             <select
                 value={filterGender}
                 onChange={e => setFilterGender(e.target.value)}
                 className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
             >
                 <option value="Todos">Todos</option>
                 {uniqueGenders.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
             </select>
          </div>

        </div>
      </div>

      {/* Results Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col relative">
        {isLoading ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-4" />
              <p className="text-gray-500">Puxando dados reais do Supabase...</p>
           </div>
        ) : filteredMembers.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                 <Search className="h-6 w-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Nenhum membro encontrado</h3>
              <p className="text-gray-500 mt-1 max-w-sm">Os filtros aplicados não retornaram nenhum registro. Tente remover filtros ou buscar um termo diferente.</p>
           </div>
        ) : (
           <div className="overflow-x-auto flex-1">
              <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10">
                   <tr>
                     <th className="py-4 pl-6 pr-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
                     <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Perfil / Idade</th>
                     <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contato / Estado</th>
                     <th className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Grupo Caseiro</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 bg-white">
                   {filteredMembers.slice(0, 100).map((m, idx) => {
                     const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
                     const ageCategory = getAgeCategory(age);
                     
                     return (
                       <tr key={m.id || idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="whitespace-nowrap py-4 pl-6 pr-3">
                             <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                                   {(m.nome || m.name || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{m.nome || m.name || 'Sem nome'}</span>
                                   <span className="text-xs text-gray-500">{m.status || 'Ativo'}</span>
                                </div>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", 
                                     m.tipo_cadastro === 'Visitante' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                                  )}>
                                     {m.tipo_cadastro || 'Membro'}
                                  </span>
                                  <span className="text-xs text-gray-500 capitalize">{m.sexo || m.sex || ''}</span>
                                </div>
                                <span className="text-xs text-gray-500 mt-1">{age > 0 ? `${age} anos` : 'Idade desconhecida'} ({ageCategory})</span>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <div className="flex flex-col min-w-0">
                                <span className="text-sm text-gray-600 font-mono text-xs">{m.telefone || m.celular || m.phone || 'Sem contato'}</span>
                                <span className="text-xs text-gray-500 mt-1">{m.cidade || m.city} {m.uf ? `- ${m.uf}` : ''}</span>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <span className="text-sm text-gray-600 truncate max-w-[150px] inline-block">{m.grupo_caseiro || 'Livre'}</span>
                          </td>
                       </tr>
                     );
                   })}
                 </tbody>
              </table>
           </div>
        )}
        
        {filteredMembers.length > 100 && (
          <div className="p-4 bg-yellow-50 border-t border-yellow-100 text-yellow-700 text-xs font-medium text-center">
            Mostrando apenas os primeiros 100 resultados na tela. Clicando em "Exportar Planilha", todos os {filteredMembers.length} resultados serão exportados!
          </div>
        )}
      </div>

    </div>
  );
};
