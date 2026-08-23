import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Mail, Phone, MoreVertical, Loader2, Eye, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabaseReader } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import { filterOperationalMembers } from '../lib/operationalScope';
import { matchesPopulationMode, type PopulationMode } from '../lib/populationScope';
import { PopulationFlags } from '../components/PopulationFlags';
import { BatchPhotoUploadModal } from '../components/BatchPhotoUploadModal';
import { Image as ImageIcon } from 'lucide-react';

const getNormalizedSectorName = (dbSector: string | null | undefined): string => {
  if (!dbSector) return 'Sem Setor';
  const norm = dbSector.trim().toUpperCase();
  if (norm.includes('NORTE')) return 'Setor Norte';
  if (norm.includes('CENTRAL')) return 'Setor Central';
  if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
  if (norm.includes('SUL')) return 'Setor Sul';
  return 'Sem Setor';
};

export const Members: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Filters
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [filterGC, setFilterGC] = useState('Todos');
  const [filterGender, setFilterGender] = useState('Todos');
  const [filterAgeCategory, setFilterAgeCategory] = useState('Todas');
  const [filterState, setFilterState] = useState('Todos');
  const [filterSetor, setFilterSetor] = useState('Todos');
  const [filterSetorEcl, setFilterSetorEcl] = useState('Todos');
  const [filterMestre, setFilterMestre] = useState('Todos');
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('Todos');
  const [filterMinAge, setFilterMinAge] = useState<number>(0);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(120);
  const [showInactive, setShowInactive] = useState(false);
  const [populationMode, setPopulationMode] = useState<PopulationMode>('todos');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        let membrosQuery = supabaseReader.from('membros').select('*').order('nome').limit(10000);
        let celulasQuery = supabaseReader.from('celulas').select('grupo_caseiro, setor');

        if (user?.assigned_gc) {
          membrosQuery = membrosQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
          celulasQuery = celulasQuery.ilike('grupo_caseiro', `%${user.assigned_gc}%`);
        }

        const [membrosRes, celulasRes, discRes] = await Promise.all([
           membrosQuery,
           celulasQuery,
           supabaseReader.from('discipulado').select('discipulador, discipulo, status')
        ]);
        
        const allMembros = membrosRes.data || [];
        const allCelulas = celulasRes.data || [];
        const allDisc = discRes.data || [];

        const setorMap: Record<string, string> = {};
        allCelulas.forEach(c => {
           if (c.grupo_caseiro && c.setor) setorMap[c.grupo_caseiro.toLowerCase()] = c.setor;
        });

        const discipuladorMap: Record<string, string> = {};
        allDisc.forEach(d => {
           if (d.discipulo && d.discipulador) discipuladorMap[d.discipulo.toLowerCase()] = d.discipulador;
        });

        const enriched = allMembros.map(m => {
           const nomeLower = (m.nome || m.name || '').trim().toLowerCase();
           const gcLower = (m.grupos_caseiros || '').trim().toLowerCase();
           
           const rawEcl = m.setor_eclesiastico || setorMap[gcLower] || 'Sem Setor';
           const setorEcl = getNormalizedSectorName(rawEcl);
           
           const rawRes = m.setor_residencial || m.setor_residencial_calculado || '';
           const setorRes = rawRes ? getNormalizedSectorName(rawRes) : (setorMap[gcLower] ? getNormalizedSectorName(setorMap[gcLower]) : 'Sem Setor');

           return {
               ...m,
               setor: setorRes,
               setor_eclesiastico_display: setorEcl,
               setor_residencial_display: setorRes,
               discipulador: discipuladorMap[nomeLower] || 'Sem Discipulador'
           };
        });

        setMembers(filterOperationalMembers(enriched));
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [user]);

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


  // Unique Options
  const uniqueTypes = useMemo(() => Array.from(new Set(members.map(m => m.tipo_cadastro).filter(Boolean))).sort(), [members]);
  const uniqueGCs = useMemo(() => Array.from(new Set(members.map(m => m.grupos_caseiros).filter(Boolean))).sort(), [members]);
  const uniqueGenders = useMemo(() => Array.from(new Set(members.map(m => m.sexo || m.sex).filter(Boolean))).sort(), [members]);
  const uniqueStates = useMemo(() => Array.from(new Set(members.map(m => m.uf || m.estado).filter(Boolean))).sort(), [members]);
  const uniqueSetores = useMemo(() => Array.from(new Set(members.map(m => m.setor_residencial_display).filter(s => s !== 'Sem Setor'))).sort(), [members]);
  const uniqueSetoresEcl = useMemo(() => Array.from(new Set(members.map(m => m.setor_eclesiastico_display).filter(s => s !== 'Sem Setor'))).sort(), [members]);
  const uniqueMestres = useMemo(() => Array.from(new Set(members.map(m => m.discipulador).filter(d => d !== 'Sem Discipulador'))).sort(), [members]);
  const uniqueMaritalStatuses = useMemo(() => Array.from(new Set(members.map(m => m.estado_civil).filter(Boolean))).sort(), [members]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (!showInactive && m.status !== 'Ativo') return false;
      if (!matchesPopulationMode(m, populationMode)) return false;
      if (filterQuery) {
        const queryLower = filterQuery.toLowerCase();
        if (!(m.nome || '').toLowerCase().includes(queryLower)) return false;
      }
      if (filterType !== 'Todos' && m.tipo_cadastro !== filterType) return false;
      if (filterGC !== 'Todos' && m.grupos_caseiros !== filterGC) return false;
      if (filterSetor !== 'Todos' && m.setor !== filterSetor) return false;
      if (filterSetorEcl !== 'Todos' && m.setor_eclesiastico_display !== filterSetorEcl) return false;
      if (filterMestre !== 'Todos' && m.discipulador !== filterMestre) return false;
      if (filterGender !== 'Todos' && (m.sexo || m.sex) !== filterGender) return false;
      if (filterState !== 'Todos' && (m.uf || m.estado) !== filterState) return false;
      
      const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
      if (filterAgeCategory !== 'Todas' && getAgeCategory(age) !== filterAgeCategory) return false;
      if (age < filterMinAge || age > filterMaxAge) return false;
      if (filterMaritalStatus !== 'Todos' && m.estado_civil !== filterMaritalStatus) return false;
      
      return true;
    });
  }, [members, showInactive, populationMode, filterQuery, filterType, filterGC, filterGender, filterAgeCategory, filterMinAge, filterMaxAge, filterMaritalStatus, filterState, filterSetor, filterSetorEcl, filterMestre]);

  const totalCount = filteredMembers.length;
  const paginatedMembers = filteredMembers.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Membros & Visitantes</h1>
           <p className="mt-2 text-sm text-gray-500">
             Gestão completa do cadastro de pessoas da igreja.
           </p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={() => setIsBatchUploadOpen(true)}
             className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm text-center flex items-center gap-2"
           >
             <ImageIcon className="w-4 h-4" /> Upload em Lote
           </button>
           <a 
             href="https://sis.sistemaprover.com.br/pt-BR/cadastro/0/dados" 
             target="_blank" 
             rel="noopener noreferrer"
             className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm text-center flex items-center gap-2"
           >
               + Novo Cadastro no Prover
           </a>
        </div>
      </header>

      {/* Advanced Filters Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6 mb-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary-500" /> Painel de Filtros Avançados
          </div>
          <button 
            onClick={() => {
              setFilterQuery(''); setFilterType('Todos'); setFilterGC('Todos'); setFilterGender('Todos');
              setFilterAgeCategory('Todas'); setFilterState('Todos'); setFilterSetor('Todos'); setFilterSetorEcl('Todos'); setFilterMestre('Todos');
              setFilterMinAge(0); setFilterMaxAge(120); setFilterMaritalStatus('Todos');
              setShowInactive(false); setPopulationMode('todos');
            }}
            className="text-xs text-red-600 font-medium hover:underline"
          >
            Limpar Filtros
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <PopulationFlags value={populationMode} onChange={setPopulationMode} className="border-b border-gray-100 pb-3" />
          
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
               <label className="block text-xs font-medium text-gray-500 mb-1">Buscar por Nome</label>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                     type="text" value={filterQuery} onChange={e => { setFilterQuery(e.target.value); setPage(1); }}
                     className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                     placeholder="Ex: João da Silva..."
                  />
               </div>
            </div>
            
            <button
              type="button"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={clsx(
                "sm:w-auto px-4 py-2 border rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all outline-none md:hidden",
                isFiltersOpen ? "bg-primary-50 border-primary-200 text-primary-750" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {isFiltersOpen ? "Ocultar Filtros" : "Filtros Avançados"}
            </button>
          </div>

          <div className={clsx(
            "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 transition-all duration-300",
            isFiltersOpen ? "block" : "hidden md:grid"
          )}>
            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Tipo / Vínculo</label>
               <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueTypes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Faixa Etária</label>
               <select value={filterAgeCategory} onChange={e => { setFilterAgeCategory(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   {['Todas', 'Criança', 'Adolescente', 'Jovem', 'Adulto', 'Idoso', 'Indefinida'].map(t => <option key={t} value={t}>{t}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Sexo / Gênero</label>
               <select value={filterGender} onChange={e => { setFilterGender(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueGenders.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Setor de Residência</label>
               <select value={filterSetor} onChange={e => { setFilterSetor(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueSetores.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Setor do GC (Ecl.)</label>
               <select value={filterSetorEcl} onChange={e => { setFilterSetorEcl(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueSetoresEcl.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Grupo Caseiro</label>
               <select value={filterGC} onChange={e => { setFilterGC(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueGCs.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">UF / Estado</label>
               <select value={filterState} onChange={e => { setFilterState(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueStates.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Discipulador</label>
               <select value={filterMestre} onChange={e => { setFilterMestre(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueMestres.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Estado Civil</label>
               <select value={filterMaritalStatus} onChange={e => { setFilterMaritalStatus(e.target.value); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                   <option value="Todos">Todos</option>
                   {uniqueMaritalStatuses.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
               </select>
            </div>

            <div>
               <label className="block text-xs font-medium text-gray-500 mb-1">Idade (Min / Max)</label>
               <div className="flex items-center gap-2">
                  <input type="number" value={filterMinAge} onChange={e => { setFilterMinAge(parseInt(e.target.value) || 0); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white" placeholder="Min" />
                  <span className="text-gray-400">/</span>
                  <input type="number" value={filterMaxAge} onChange={e => { setFilterMaxAge(parseInt(e.target.value) || 120); setPage(1); }} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white" placeholder="Max" />
               </div>
            </div>

            <div className="flex items-end pb-1.5">
               <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showInactive} 
                    onChange={e => { setShowInactive(e.target.checked); setPage(1); }} 
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4.5 w-4.5 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Mostrar Inativos
                  </span>
               </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="overflow-x-auto min-h-[400px] relative">
             {isLoading && (
               <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                 <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
               </div>
             )}
             
             {/* Mobile View: Cards */}
             <div className="block sm:hidden divide-y divide-gray-100">
                {paginatedMembers.map((person) => (
                  <div key={person.id} className="p-4 flex flex-col gap-3 hover:bg-gray-50/50 transition-all">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200 overflow-hidden text-sm uppercase">
                            {person.foto ? (
                              <img src={person.foto} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <img 
                                  src={`https://vadufkgbluisdamgkbln.supabase.co/storage/v1/object/public/avatars/avatars/${person.id}.jpg`} 
                                  alt="" 
                                  className="w-full h-full object-cover" 
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).classList.add('hidden');
                                    (e.target as HTMLImageElement).parentElement?.querySelector('.list-fallback-char')?.classList.remove('hidden');
                                  }}
                                />
                                <span className="list-fallback-char hidden">
                                  {(person.nome || '?').charAt(0)}
                                </span>
                              </>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                           <Link to={`/membro/${person.id}`} className="font-bold text-sm text-primary-650 hover:underline block truncate">
                             {person.nome}
                           </Link>
                           <span className="text-[10px] text-gray-500 font-medium block truncate mt-0.5">
                             {person.tipo_cadastro || 'Membro'} • {getAgeCategory(calculateAge(person.nascimento || person.data_nascimento || person.birth_date))}
                           </span>
                        </div>
                        <div>
                           <span className={clsx("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", 
                              person.status === 'Ativo' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                              person.status === 'Inativo' ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                              'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                           )}>
                              {person.status}
                           </span>
                        </div>
                     </div>
                     
                     <div className="text-xs text-gray-600 flex flex-col gap-1 pl-13">
                        <div className="flex flex-wrap items-center gap-x-2">
                           <span className="font-semibold text-gray-800">{person.grupos_caseiros || 'Sem GC'}</span>
                           {person.setor !== 'Sem Setor' && (
                             <span className="text-indigo-600 font-bold">({person.setor})</span>
                           )}
                        </div>
                        {person.discipulador !== 'Sem Discipulador' && (
                          <div className="text-gray-500 text-[10px] font-medium">Disc.: {person.discipulador}</div>
                        )}
                        <div className="mt-1 flex flex-col gap-1 text-[11px] text-gray-400">
                           {person.email && <div className="flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5" /> {person.email}</div>}
                           {person.celular_principal_sms && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {person.celular_principal_sms}</div>}
                        </div>
                     </div>
                     
                     <div className="flex justify-end pt-2 border-t border-gray-50/50 pl-13">
                        <Link to={`/membro/${person.id}`} className="text-primary-600 hover:text-primary-800 text-xs font-extrabold flex items-center gap-1">
                           <Eye className="w-3.5 h-3.5"/> Ver Ficha
                        </Link>
                     </div>
                  </div>
                ))}
             </div>

             {/* Desktop View: Table */}
             <table className="hidden sm:table min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                   <tr>
                      <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900">Nome</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo / Perfil</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Grupo Caseiro</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contato</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-6"><span className="sr-only">Ações</span></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                   {paginatedMembers.map((person) => (
                      <tr key={person.id} className="hover:bg-gray-50 transition-colors group">
                         <td className="whitespace-nowrap py-4 pl-6 pr-3">
                            <div className="flex items-center gap-3">
                               <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200 overflow-hidden text-sm uppercase">
                                   {person.foto ? (
                                     <img src={person.foto} alt="" className="w-full h-full object-cover" />
                                   ) : (
                                     <>
                                       <img 
                                         src={`https://vadufkgbluisdamgkbln.supabase.co/storage/v1/object/public/avatars/avatars/${person.id}.jpg`} 
                                         alt="" 
                                         className="w-full h-full object-cover" 
                                         onError={(e) => {
                                           (e.target as HTMLImageElement).classList.add('hidden');
                                           (e.target as HTMLImageElement).parentElement?.querySelector('.list-fallback-char')?.classList.remove('hidden');
                                         }}
                                       />
                                       <span className="list-fallback-char hidden">
                                         {(person.nome || '?').charAt(0)}
                                       </span>
                                     </>
                                   )}
                               </div>
                               <div className="flex flex-col min-w-0">
                                  <Link to={`/membro/${person.id}`} className="font-bold text-primary-650 hover:text-primary-850 hover:underline truncate max-w-[200px]">
                                    {person.nome}
                                  </Link>
                                  <span className="text-[10px] text-gray-500 font-medium truncate max-w-[150px]">
                                    {person.discipulador !== 'Sem Discipulador' ? `Disc: ${person.discipulador}` : ''}
                                  </span>
                               </div>
                            </div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex flex-col">
                               <span>{person.tipo_cadastro || 'Membro'}</span>
                               <span className="text-[10px] text-gray-400">
                                 {getAgeCategory(calculateAge(person.nascimento || person.data_nascimento || person.birth_date))}
                               </span>
                            </div>
                         </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                             <div className="flex flex-col">
                                <span className="truncate max-w-[150px] font-medium text-gray-800">{person.grupos_caseiros || '-'}</span>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                  {person.setor !== 'Sem Setor' && (
                                    <span className="text-[10px] text-indigo-600 font-semibold truncate">
                                      Res.: {person.setor}
                                    </span>
                                  )}
                                  {person.setor_eclesiastico_display !== 'Sem Setor' && (
                                    <span className="text-[10px] text-teal-600 font-semibold truncate">
                                      GC: {person.setor_eclesiastico_display}
                                    </span>
                                  )}
                                </div>
                             </div>
                          </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex flex-col gap-1">
                               {person.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {person.email}</div>}
                               {person.celular_principal_sms && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {person.celular_principal_sms}</div>}
                            </div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={clsx("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", 
                               person.status === 'Ativo' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                               person.status === 'Inativo' ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                               'bg-yellow-50 text-yellow-800 ring-yellow-600/20'
                            )}>
                               {person.status}
                            </span>
                         </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-xs font-bold">
                             <Link to={`/membro/${person.id}`} className="text-primary-650 hover:text-primary-850 flex items-center justify-end gap-1 transition-colors">
                                <Eye className="w-4 h-4"/> Ver Ficha
                             </Link>
                          </td>
                      </tr>
                   ))}
                   {paginatedMembers.length === 0 && !isLoading && (
                     <tr>
                       <td colSpan={6} className="text-center py-12 text-gray-500">Nenhum membro encontrado com os filtros aplicados.</td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
          
          {/* Pagination */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/30 rounded-b-2xl">
             <p className="text-sm text-gray-500">
               Mostrando <span className="font-medium">{(page - 1) * pageSize + 1}</span> a <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> de <span className="font-medium">{totalCount}</span> resultados
             </p>
             <div className="flex gap-2">
                <button 
                  onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo(0, 0); }}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0); }}
                  disabled={page * pageSize >= totalCount}
                  className="px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Próxima
                </button>
             </div>
          </div>
      </div>

      {isBatchUploadOpen && (
        <BatchPhotoUploadModal 
          members={members} 
          onClose={() => setIsBatchUploadOpen(false)} 
          onSuccess={() => {
            setIsBatchUploadOpen(false);
            window.location.reload();
          }} 
        />
      )}
    </div>
  );
};
