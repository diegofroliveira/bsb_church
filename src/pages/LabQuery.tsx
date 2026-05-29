import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, Users, Calendar, Sparkles, Filter, 
  Download, Copy, RefreshCw, GraduationCap, AlertCircle,
  Database, UserCheck, HelpCircle, ArrowRight, ShieldCheck, MapPin,
  Clock, Heart, Eye, HelpCircle as QuestionIcon
} from 'lucide-react';
import clsx from 'clsx';

interface Member {
  id: any;
  nome: string;
  apelido?: string;
  status?: string;
  sexo?: string;
  data_de_cadastro?: string | null;
  data_de_vinculo?: string | null;
  nascimento?: string | null;
  grupos_caseiros?: string | null;
  estado_civil?: string | null;
  tipo_de_pessoa?: string | null;
  tipo_cadastro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  celular_principal_sms?: string | null;
  telefone_fixo?: string | null;
  email?: string | null;
}

const calculateAge = (dob?: string | null) => {
  if (!dob) return -1;
  let parts = dob.includes('/') ? dob.split('/') : dob.split('-');
  const birth = dob.includes('/') 
    ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) 
    : new Date(dob);
  if (isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

// Calculates how many months of connection a person has
const calculateDurationInMonths = (cadastro?: string | null, vinculo?: string | null) => {
  const targetDateStr = vinculo || cadastro;
  if (!targetDateStr) return -1;
  
  const targetDate = new Date(targetDateStr);
  if (isNaN(targetDate.getTime())) return -1;
  
  const now = new Date();
  const diffYears = now.getFullYear() - targetDate.getFullYear();
  const diffMonths = now.getMonth() - targetDate.getMonth();
  
  return diffYears * 12 + diffMonths;
};

const formatDuration = (months: number) => {
  if (months < 0) return 'Não Informado';
  if (months === 0) return 'Menos de 1 mês';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  
  if (remMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}`;
};

export const LabQuery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Ativo' | 'Inativo' | 'Todos'>('Ativo');
  const [filterGender, setFilterGender] = useState<string>('Todos');
  const [filterGC, setFilterGC] = useState<string>('Todos');
  const [filterTipoPessoa, setFilterTipoPessoa] = useState<string>('Todos');
  const [filterMaritalStatus, setFilterMaritalStatus] = useState<string>('Todos');
  const [maxDurationMonths, setMaxDurationMonths] = useState<number>(-1); // -1 means No Limit
  const [minAge, setMinAge] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<number>(120);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('membros')
          .select('id, nome, apelido, status, sexo, data_de_cadastro, data_de_vinculo, nascimento, grupos_caseiros, estado_civil, tipo_de_pessoa, tipo_cadastro, bairro, cidade, celular_principal_sms, telefone_fixo, email')
          .limit(10000);

        if (error) throw error;
        setMembers(data || []);
      } catch (err: any) {
        console.error('Error fetching members for lab queries:', err);
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Unique lists for dropdowns
  const uniqueGCs = useMemo(() => {
    const list = new Set<string>();
    members.forEach(m => {
      if (m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM') {
        list.add(m.grupos_caseiros);
      }
    });
    return Array.from(list).sort();
  }, [members]);

  const uniqueTipos = useMemo(() => {
    const list = new Set<string>();
    members.forEach(m => {
      const t = (m.tipo_de_pessoa || m.tipo_cadastro || '').trim().toUpperCase();
      if (t) list.add(t);
    });
    return Array.from(list).sort();
  }, [members]);

  const uniqueMaritals = useMemo(() => {
    const list = new Set<string>();
    members.forEach(m => {
      if (m.estado_civil) list.add(m.estado_civil);
    });
    return Array.from(list).sort();
  }, [members]);

  // Apply Filters Client-Side
  const filteredList = useMemo(() => {
    return members.filter(m => {
      // 1. Status Filter
      if (filterStatus !== 'Todos') {
        const mStatus = (m.status || '').trim().toUpperCase();
        const fStatus = filterStatus.toUpperCase();
        if (fStatus === 'ATIVO' && mStatus !== 'ATIVO') return false;
        if (fStatus === 'INATIVO' && mStatus === 'ATIVO') return false;
      }

      // 2. Gender Filter
      if (filterGender !== 'Todos' && m.sexo !== filterGender) return false;

      // 3. GC Filter
      if (filterGC !== 'Todos') {
        if (filterGC === 'Sem GC') {
          const hasGC = m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM';
          if (hasGC) return false;
        } else {
          if (m.grupos_caseiros !== filterGC) return false;
        }
      }

      // 4. Tipo de Pessoa Filter
      if (filterTipoPessoa !== 'Todos') {
        const mTipo = (m.tipo_de_pessoa || m.tipo_cadastro || '').trim().toUpperCase();
        if (mTipo !== filterTipoPessoa.toUpperCase()) return false;
      }

      // 5. Marital Status
      if (filterMaritalStatus !== 'Todos' && m.estado_civil !== filterMaritalStatus) return false;

      // 6. Age range
      const age = calculateAge(m.nascimento);
      if (age !== -1) {
        if (age < minAge || age > maxAge) return false;
      } else if (minAge > 0 || maxAge < 120) {
        // If age is unrecorded, only include if user hasn't narrowed the age ranges
        return false;
      }

      // 7. Max duration of connection (months)
      if (maxDurationMonths !== -1) {
        const months = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo);
        if (months === -1 || months > maxDurationMonths) return false;
      }

      // 8. Text Search (Nome, apelido, bairro, cidade, celular)
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = m.nome.toLowerCase().includes(term);
        const matchNick = (m.apelido || '').toLowerCase().includes(term);
        const matchBairro = (m.bairro || '').toLowerCase().includes(term);
        const matchCidade = (m.cidade || '').toLowerCase().includes(term);
        const matchPhone = (m.celular_principal_sms || m.telefone_fixo || '').includes(term);
        
        if (!matchName && !matchNick && !matchBairro && !matchCidade && !matchPhone) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [members, searchTerm, filterStatus, filterGender, filterGC, filterTipoPessoa, filterMaritalStatus, maxDurationMonths, minAge, maxAge]);

  // Statistics for Current Filtered List
  const stats = useMemo(() => {
    const total = filteredList.length;
    if (total === 0) {
      return { total: 0, avgAge: 0, avgDuration: 0, malePct: 0, femalePct: 0, gcAllocatedPct: 0 };
    }

    let ageSum = 0;
    let ageCount = 0;
    let durationSum = 0;
    let durationCount = 0;
    let maleCount = 0;
    let gcCount = 0;

    filteredList.forEach(m => {
      // Age
      const age = calculateAge(m.nascimento);
      if (age !== -1) {
        ageSum += age;
        ageCount++;
      }
      
      // Bond Duration
      const duration = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo);
      if (duration !== -1) {
        durationSum += duration;
        durationCount++;
      }

      // Gender
      if (m.sexo === 'Masculino') maleCount++;

      // GC
      const hasGC = m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM';
      if (hasGC) gcCount++;
    });

    return {
      total,
      avgAge: ageCount > 0 ? Math.round(ageSum / ageCount) : 0,
      avgDuration: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
      malePct: Math.round((maleCount / total) * 100),
      femalePct: Math.round(((total - maleCount) / total) * 100),
      gcAllocatedPct: Math.round((gcCount / total) * 100)
    };
  }, [filteredList]);

  // Presets Handlers
  const applyPresetRecentMembers = () => {
    setFilterStatus('Ativo');
    setMaxDurationMonths(6); // Less than 6 months of link
    setFilterGC('Todos');
    setFilterTipoPessoa('Todos');
    setFilterGender('Todos');
    setMinAge(0);
    setMaxAge(120);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPresetNoGC = () => {
    setFilterStatus('Ativo');
    setFilterGC('Sem GC'); // Without GC
    setMaxDurationMonths(-1);
    setFilterTipoPessoa('Todos');
    setFilterGender('Todos');
    setMinAge(0);
    setMaxAge(120);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPresetExternals = () => {
    setFilterStatus('Todos');
    setFilterTipoPessoa('EXTERNO');
    setFilterGC('Todos');
    setMaxDurationMonths(-1);
    setFilterGender('Todos');
    setMinAge(0);
    setMaxAge(120);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPresetYoungYouth = () => {
    setFilterStatus('Ativo');
    setMinAge(12);
    setMaxAge(25);
    setMaxDurationMonths(-1);
    setFilterGC('Todos');
    setFilterTipoPessoa('Todos');
    setFilterGender('Todos');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setFilterStatus('Ativo');
    setFilterGender('Todos');
    setFilterGC('Todos');
    setFilterTipoPessoa('Todos');
    setFilterMaritalStatus('Todos');
    setMaxDurationMonths(-1);
    setMinAge(0);
    setMaxAge(120);
    setCurrentPage(1);
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    
    // Header
    const headers = [
      'ID', 'Nome', 'Apelido', 'Status', 'Sexo', 'Tipo Pessoa', 'GC', 
      'Estado Civil', 'Bairro', 'Cidade', 'Idade', 'Tempo de Vínculo (Meses)', 
      'Data Vínculo', 'Data Cadastro', 'Celular', 'Email'
    ];
    
    const rows = filteredList.map(m => {
      const age = calculateAge(m.nascimento);
      const months = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo);
      return [
        m.id,
        `"${m.nome}"`,
        m.apelido ? `"${m.apelido}"` : '""',
        m.status || 'Ativo',
        m.sexo || '',
        m.tipo_de_pessoa || m.tipo_cadastro || 'Membro',
        `"${m.grupos_caseiros || 'Nenhum'}"`,
        m.estado_civil || '',
        `"${m.bairro || ''}"`,
        `"${m.cidade || ''}"`,
        age !== -1 ? age : '',
        months !== -1 ? months : '',
        m.data_de_vinculo || '',
        m.data_de_cadastro || '',
        m.celular_principal_sms || '',
        m.email || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `estudo_personalizado_membros_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy JSON Data
  const handleCopyJSON = () => {
    if (filteredList.length === 0) return;
    
    const jsonStr = JSON.stringify(filteredList.map(m => {
      const age = calculateAge(m.nascimento);
      const months = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo);
      return {
        id: m.id,
        nome: m.nome,
        apelido: m.apelido,
        status: m.status,
        sexo: m.sexo,
        tipo: m.tipo_de_pessoa || m.tipo_cadastro || 'Membro',
        grupo_caseiro: m.grupos_caseiros,
        bairro: m.bairro,
        cidade: m.cidade,
        idade: age !== -1 ? age : null,
        tempo_vinculo_meses: months !== -1 ? months : null,
        data_cadastro: m.data_de_cadastro,
        data_vinculo: m.data_de_vinculo,
        celular: m.celular_principal_sms
      };
    }), null, 2);

    navigator.clipboard.writeText(jsonStr);
    alert('Os dados do estudo foram copiados em formato JSON de alta fidelidade para sua área de transferência!');
  };

  // Paginated list
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredList, currentPage]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Database className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Acessando Supabase Lab...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* Dynamic Tabs Navigation inside Lab Pages */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-1">
        {[
          { path: '/lab/vision', label: '🏛️ Visão de Efésios 4' },
          { path: '/lab/visits', label: '🏠 Gestão de Visitas' },
          { path: '/lab/queries', label: '📊 Consultas & Estudos' }
        ].map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={clsx(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 cursor-pointer",
                isActive 
                  ? "bg-slate-900 text-white border-indigo-500" 
                  : "bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100/80 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Header card */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-indigo-500/20 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-indigo-400" /> LAB · EXPLORADOR DE ESTUDOS
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            Relatórios &<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-cyan-300 to-rose-300">
              Estudos Customizados
            </span>
          </h1>
          <p className="text-slate-300 max-w-2xl text-xs md:text-sm leading-relaxed">
            Monte estudos comportamentais e demográficos customizados. Filtre por tempo de vínculo à igreja (ex: novos convertidos de pouco tempo), idade, GCs e tipos de pessoa para subsidiar as decisões estratégicas da liderança.
          </p>
        </div>
      </header>

      {/* Study Presets (One-Click Actions) */}
      <section className="bg-slate-55 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-indigo-500" /> Presets de Estudo Sugeridos (Um Clique)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              title: "🌱 Pouco Vínculo (< 6 Meses)",
              desc: "Novos membros com até 6 meses de cadastro ou vínculo pastoral ativo.",
              action: applyPresetRecentMembers,
              color: "hover:border-emerald-300 hover:bg-emerald-50/10 hover:text-emerald-700"
            },
            {
              title: "⚠️ Ativos Sem Grupo Caseiro",
              desc: "Membros ativos que não estão participando de nenhum GC (alto risco de desligamento).",
              action: applyPresetNoGC,
              color: "hover:border-amber-300 hover:bg-amber-50/10 hover:text-amber-700"
            },
            {
              title: "💼 Membros Externos",
              desc: "Visualização e estudos focados nos cadastros classificados como Externos.",
              action: applyPresetExternals,
              color: "hover:border-indigo-300 hover:bg-indigo-50/10 hover:text-indigo-700"
            },
            {
              title: "🎓 Jovens & Adolescentes (12-25)",
              desc: "Estudo demográfico focado na faixa etária juvenil ativa na comunidade.",
              action: applyPresetYoungYouth,
              color: "hover:border-pink-300 hover:bg-pink-50/10 hover:text-pink-700"
            }
          ].map((preset, idx) => (
            <button
              key={idx}
              onClick={preset.action}
              className={clsx(
                "p-4 text-left bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-150 transition-all cursor-pointer group flex flex-col justify-between h-28 shadow-sm hover:shadow",
                preset.color
              )}
            >
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 leading-snug group-hover:text-inherit flex items-center justify-between w-full">
                  {preset.title}
                  <ArrowRight className="w-3 h-3 text-slate-450 group-hover:translate-x-1 transition-transform" />
                </h4>
                <p className="text-[10px] text-slate-450 leading-relaxed mt-1.5 font-medium">
                  {preset.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Advanced Custom Query Filters Panel */}
      <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
          <h3 className="text-xs font-black text-slate-405 uppercase tracking-widest flex items-center gap-1.5 text-slate-800">
            <Filter className="w-4 h-4 text-indigo-500" /> Filtros e Sintonia do Estudo Customizado
          </h3>
          {(searchTerm || filterStatus !== 'Ativo' || filterGender !== 'Todos' || filterGC !== 'Todos' || filterTipoPessoa !== 'Todos' || filterMaritalStatus !== 'Todos' || maxDurationMonths !== -1 || minAge > 0 || maxAge < 120) && (
            <button
              onClick={resetAllFilters}
              className="text-[10px] text-red-650 font-extrabold uppercase hover:underline cursor-pointer flex items-center gap-1 active:scale-95"
            >
              <RefreshCw className="w-3 h-3" /> Limpar Todos os Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Text Search */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Busca Rápida</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Nome, apelido, bairro..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-medium text-slate-700 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide font-bold">Status no Cadastro</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
            >
              <option value="Ativo">Ativos (Padrão)</option>
              <option value="Inativo">Inativos / Afastados</option>
              <option value="Todos">Todos os Status</option>
            </select>
          </div>

          {/* Tipo de Pessoa */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Tipo de Cadastro</label>
            <select
              value={filterTipoPessoa}
              onChange={e => { setFilterTipoPessoa(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
            >
              <option value="Todos">Todos os Tipos</option>
              {uniqueTipos.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Grupo Caseiro */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Grupo Caseiro (GC)</label>
            <select
              value={filterGC}
              onChange={e => { setFilterGC(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
            >
              <option value="Todos">Todos os GCs</option>
              <option value="Sem GC">🚫 Sem Grupo Caseiro</option>
              {uniqueGCs.map(gc => (
                <option key={gc} value={gc}>{gc}</option>
              ))}
            </select>
          </div>

          {/* Tempo de Vínculo */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3 text-indigo-500" /> Tempo de Vínculo
            </label>
            <select
              value={maxDurationMonths}
              onChange={e => { setMaxDurationMonths(Number(e.target.value)); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
            >
              <option value={-1}>Sem limite (Qualquer duração)</option>
              <option value={3}>Extremamente Recente (Até 3 Meses)</option>
              <option value={6}>Pouco Tempo de Vínculo (Até 6 Meses)</option>
              <option value={12}>Recente (Até 1 Ano)</option>
              <option value={24}>Médio Prazo (Até 2 Anos)</option>
            </select>
          </div>

          {/* Sexo */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Sexo</label>
            <select
              value={filterGender}
              onChange={e => { setFilterGender(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>

          {/* Estado Civil */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Estado Civil</label>
            <select
              value={filterMaritalStatus}
              onChange={e => { setFilterMaritalStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              {uniqueMaritals.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Age range */}
          <div className="space-y-1.5">
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Faixa Etária (Idade)</label>
            <div className="flex items-center gap-1.5 bg-slate-50/50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <input 
                type="number" 
                value={minAge} 
                min={0}
                max={120}
                onChange={e => { setMinAge(Math.max(0, parseInt(e.target.value) || 0)); setCurrentPage(1); }} 
                className="w-10 bg-transparent text-xs font-bold text-slate-700 outline-none text-center" 
                placeholder="Mín" 
              />
              <span className="text-slate-350 text-[10px]">até</span>
              <input 
                type="number" 
                value={maxAge} 
                min={0}
                max={120}
                onChange={e => { setMaxAge(Math.min(120, parseInt(e.target.value) || 120)); setCurrentPage(1); }} 
                className="w-10 bg-transparent text-xs font-bold text-slate-700 outline-none text-center" 
                placeholder="Máx" 
              />
              <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">anos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Query Stats Panel */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Pessoas Selecionadas", value: stats.total, color: "text-indigo-650" },
          { label: "Idade Média", value: stats.avgAge > 0 ? `${stats.avgAge} anos` : 'N/C', color: "text-slate-800" },
          { label: "Tempo de Vínculo Médio", value: stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : 'N/C', color: "text-indigo-600" },
          { label: "Alocados em GC", value: `${stats.gcAllocatedPct}%`, color: "text-emerald-600" },
          { label: "Masculino", value: `${stats.malePct}%`, color: "text-blue-500" },
          { label: "Feminino", value: `${stats.femalePct}%`, color: "text-pink-500" }
        ].map((item, index) => (
          <div key={index} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[90px]">
            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
              {item.label}
            </span>
            <span className={clsx("text-lg font-black mt-2 leading-none", item.color)}>
              {item.value}
            </span>
          </div>
        ))}
      </section>

      {/* Data Table and Export Panel */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 leading-snug">
              Resultados do Estudo ({filteredList.length} registros encontrados)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              Lista ordenada alfabeticamente baseada nas restrições especificadas acima.
            </p>
          </div>

          {filteredList.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleCopyJSON}
                className="inline-flex items-center gap-1.5 text-xs font-black text-slate-650 hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm uppercase tracking-wide text-[10px]"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar JSON
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-indigo-650 hover:bg-indigo-750 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 shadow-md shadow-indigo-200 uppercase tracking-wide text-[10px]"
              >
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </button>
            </div>
          )}
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-6">Nome</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Gênero</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Grupo Caseiro</th>
                <th className="py-3 px-4">Bairro / RA</th>
                <th className="py-3 px-3">Idade</th>
                <th className="py-3 px-4">Tempo de Vínculo</th>
                <th className="py-3 px-4">Contato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
              {paginatedList.map((m) => {
                const age = calculateAge(m.nascimento);
                const durationMonths = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo);
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-3.5 px-6">
                      <span className="font-extrabold text-slate-900 block truncate max-w-[200px]" title={m.nome}>
                        {m.nome}
                      </span>
                      {m.apelido && (
                        <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1 py-0.5 rounded uppercase mt-0.5 inline-block">
                          {m.apelido}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={clsx(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wide",
                        m.status === 'Ativo' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-red-50 text-red-700 border-red-100'
                      )}>
                        {m.status || 'Ativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-550">
                      {m.sexo === 'Masculino' ? '🚹 M' : '🚺 F'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-600">
                      {m.tipo_de_pessoa || m.tipo_cadastro || 'Membro'}
                    </td>
                    <td className="py-3.5 px-4">
                      {m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM' ? (
                        <span className="font-extrabold text-indigo-650 bg-indigo-50 px-2 py-1 rounded-md text-[10px]">
                          {m.grupos_caseiros}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium italic">Sem GC</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block truncate max-w-[120px]" title={m.bairro || ''}>
                        {m.bairro || 'N/C'}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-medium mt-0.5">
                        {m.cidade || ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {age !== -1 ? `${age} anos` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-indigo-650 block">
                        {formatDuration(durationMonths)}
                      </span>
                      {(m.data_de_vinculo || m.data_de_cadastro) && (
                        <span className="text-[9px] text-slate-400 block font-medium mt-0.5">
                          Desde: {new Date(m.data_de_vinculo || m.data_de_cadastro || '').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700 block select-all">
                        {m.celular_principal_sms || m.telefone_fixo || '—'}
                      </span>
                      {m.email && (
                        <span className="text-[9px] text-slate-400 block truncate max-w-[150px] mt-0.5" title={m.email}>
                          {m.email}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 bg-slate-50/10">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-sm">Nenhum registro atende aos filtros do estudo</p>
                    <p className="text-xs text-slate-400 mt-1">Ajuste os filtros acima ou limpe-os para recomeçar.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Página {currentPage} de {totalPages} ({filteredList.length} itens no total)
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Helpful methodology footer */}
      <div className="bg-indigo-50 border border-indigo-150 rounded-3xl p-6 flex items-start gap-4 shadow-sm">
        <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Metodologia e Coleta de Dados</h4>
          <p className="text-[11px] text-indigo-700 leading-relaxed mt-1 font-medium">
            Este painel foi projetado especificamente para apoiar a liderança em análises ad-hoc e estudos de retenção/demografia. O cálculo de <strong>Tempo de Vínculo</strong> prioriza a data de batismo/vínculo (`data_de_vinculo`) e retrocede para a data de cadastro (`data_de_cadastro`) se ausente, calculando com precisão matemática a duração real da conexão do membro na comunidade local. Os dados são totalmente criptografados de ponta a ponta.
          </p>
          <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-2">Efésios 4:16 — BSB CHURCH LAB ENVIRONMENT</p>
        </div>
      </div>

    </div>
  );
};
