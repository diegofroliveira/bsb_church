import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Users, UserPlus, Home, TrendingUp, Loader2, X, Search, Layers, UserCheck, MapPin } from 'lucide-react';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalType, setModalType] = useState<any>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  
  const [filterGender, setFilterGender] = useState('Todos');
  const [filterGroup, setFilterGroup] = useState('Todos');
  const [filterDisc, setFilterDisc] = useState('Todos');
  const [filterMinAge, setFilterMinAge] = useState<number>(0);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(120);
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('Todos');

  const [rawMembros, setRawMembros] = useState<any[]>([]);
  const [rawCelulas, setRawCelulas] = useState<any[]>([]);
  const [rawDiscipulado, setRawDiscipulado] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        let membrosQuery = supabase.from('membros').select('nome, status, tipo_cadastro, nascimento, grupos_caseiros, sexo, cidade, estado, tipo_de_pessoa, data_de_cadastro, data_atualizacao, estado_civil');
        let celulasQuery = supabase.from('celulas').select('grupo_caseiro, lider, auxiliar, setor');

        if (user?.assigned_gc) {
          membrosQuery = membrosQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
          celulasQuery = celulasQuery.ilike('grupo_caseiro', `%${user.assigned_gc}%`);
        }

        const [membrosRes, celulasRes, discRes] = await Promise.all([
          membrosQuery,
          celulasQuery,
          supabase.from('discipulado').select('discipulador, discipulo, status')
        ]);

        setRawMembros(membrosRes.data || []);
        setRawCelulas(celulasRes.data || []);
        setRawDiscipulado(discRes.data || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      let membrosQuery = supabase.from('membros').select('nome, status, tipo_cadastro, nascimento, grupos_caseiros, sexo, cidade, estado, tipo_de_pessoa, data_de_cadastro, data_atualizacao, estado_civil');
      let celulasQuery = supabase.from('celulas').select('grupo_caseiro, lider, auxiliar, setor');

      if (user?.assigned_gc) {
        membrosQuery = membrosQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
        celulasQuery = celulasQuery.ilike('grupo_caseiro', `%${user.assigned_gc}%`);
      }

      const [membrosRes, celulasRes, discRes] = await Promise.all([
        membrosQuery,
        celulasQuery,
        supabase.from('discipulado').select('discipulador, discipulo, status')
      ]);

      setRawMembros(membrosRes.data || []);
      setRawCelulas(celulasRes.data || []);
      setRawDiscipulado(discRes.data || []);
      
      setSyncProgress(100);
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 500);
    } catch (error) {
      console.error('Sync error:', error);
      setIsSyncing(false);
    } finally {
      clearInterval(interval);
    }
  };

  const dashboardData = useMemo(() => {
    if (isLoading || rawMembros.length === 0) return null;

    const discSet = new Set(rawDiscipulado.map(d => d.discipulador));
    const discipuladoMap = new Map();
    rawDiscipulado.forEach(d => {
      const disc = d.discipulo?.trim().toUpperCase();
      if (!discipuladoMap.has(disc)) discipuladoMap.set(disc, []);
      discipuladoMap.get(disc).push(d.discipulador);
    });

    const now = new Date();
    const parseSafeDate = (dateVal: any) => {
        if (!dateVal) return null;
        try {
            if (dateVal instanceof Date) return dateVal;
            const s = String(dateVal);
            if (s.includes('/')) {
                const parts = s.split('/');
                if (parts.length === 3) {
                    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    return isNaN(d.getTime()) ? null : d;
                }
            }
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            return null;
        }
    };

    const getAge = (birth: any) => {
        const b = parseSafeDate(birth);
        if (!b) return 35;
        let age = now.getFullYear() - b.getFullYear();
        if (isNaN(age)) return 35;
        return age;
    };

    const getDetailedCategory = (m: any) => {
        const age = getAge(m.nascimento);
        if (age <= 3) return 'Bebês';
        if (age <= 12) return 'Crianças';
        if (age >= 60) return 'Idosos';
        const estCivil = (m.estado_civil || '').trim().toLowerCase();
        if (estCivil.includes('solteir')) return 'Solteiros';
        if (estCivil.includes('casad')) return 'Casados';
        if (estCivil.includes('viuv')) return 'Viúvos';
        return 'Outros';
    };

    const filteredMembros = rawMembros.filter(m => {
        const matchGender = filterGender === 'Todos' || m.sexo === filterGender;
        const matchGroup = filterGroup === 'Todos' || m.grupos_caseiros === filterGroup;
        const matchDisc = filterDisc === 'Todos' || (discipuladoMap.get(m.nome?.trim().toUpperCase()) || []).includes(filterDisc);
        const age = getAge(m.nascimento);
        const matchAge = (age >= filterMinAge && age <= filterMaxAge);
        const matchMarital = filterMaritalStatus === 'Todos' || m.estado_civil === filterMaritalStatus;
        return matchGender && matchGroup && matchDisc && matchAge && matchMarital;
    });

    const ativosOnly = filteredMembros.filter(m => m.status === 'Ativo');
    const totalMembros = filteredMembros.length;
    const ativos = filteredMembros.filter(m => m.status === 'Ativo').length;
    const visitantes = filteredMembros.filter(m => m.tipo_cadastro === 'Visitante').length;
    const totalCelulas = rawCelulas.length;
    const totalDiscipuladores = discSet.size;
    
    const tiposMembrosLocalidade = ['MEMBRO', 'DIÁCONO', 'PRESBÍTERO', 'AGREGADO', 'LÍDER'];
    const membrosLocalidade = filteredMembros.filter(m => 
        tiposMembrosLocalidade.includes((m.tipo_de_pessoa || '').toUpperCase()) && 
        m.status === 'Ativo'
    ).length;

    const growthData: any[] = [];
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mMonth = d.getMonth();
        const mYear = d.getFullYear();
        const label = `${monthsNames[mMonth]}/${mYear.toString().slice(-2)}`;
        const entries = rawMembros.filter(m => {
            const md = parseSafeDate(m.data_de_cadastro);
            return md && md.getMonth() === mMonth && md.getFullYear() === mYear;
        }).length;
        const exits = rawMembros.filter(m => {
            const md = parseSafeDate(m.data_atualizacao);
            return m.status === 'Inativo' && md && md.getMonth() === mMonth && md.getFullYear() === mYear;
        }).length;
        growthData.push({ name: label, entradas: entries, saidas: exits });
    }

    const demoCounts: Record<string, number> = {};
    ativosOnly.forEach(m => {
      const cat = getDetailedCategory(m);
      demoCounts[cat] = (demoCounts[cat] || 0) + 1;
    });

    const demoColors: Record<string, string> = {
        'Bebês': '#60a5fa', 'Crianças': '#3b82f6', 'Solteiros': '#10b981', 
        'Casados': '#f59e0b', 'Divorciados': '#ef4444', 'Viúvos': '#6366f1', 
        'Separados': '#8b5cf6', 'Idosos': '#a855f7', 'Outros': '#9ca3af'
    };

    const pyramidRanges = ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71+'];
    const pyramidMap: Record<string, { name: string, masc: number, fem: number }> = {};
    pyramidRanges.forEach(r => pyramidMap[r] = { name: r, masc: 0, fem: 0 });
    ativosOnly.forEach(m => {
        const age = getAge(m.nascimento);
        let range = '71+';
        if (age <= 10) range = '0-10';
        else if (age <= 20) range = '11-20';
        else if (age <= 30) range = '21-30';
        else if (age <= 40) range = '31-40';
        else if (age <= 50) range = '41-50';
        else if (age <= 60) range = '51-60';
        else if (age <= 70) range = '61-70';
        const isMasc = m.sexo === 'Masculino' || m.sexo === 'M';
        if (isMasc) pyramidMap[range].masc++; else pyramidMap[range].fem++;
    });

    const grupoCounts: any = {};
    filteredMembros.forEach(m => { if (m.grupos_caseiros) grupoCounts[m.grupos_caseiros] = (grupoCounts[m.grupos_caseiros] || 0) + 1; });
    const groupsList = rawCelulas.map(c => ({
      nome: c.grupo_caseiro, lider: c.lider || 'Sem Lider', setor: c.setor || 'Sem Setor', membros: grupoCounts[c.grupo_caseiro] || 0
    })).sort((a, b) => b.membros - a.membros);

    const sectorCounts: any = {};
    groupsList.forEach(g => {
      if (!sectorCounts[g.setor]) sectorCounts[g.setor] = { nome: g.setor, grupos: 0, membros: 0 };
      sectorCounts[g.setor].grupos += 1;
      sectorCounts[g.setor].membros += g.membros;
    });

    const mestreCounts: any = {};
    rawDiscipulado.forEach(d => { if (d.discipulador) mestreCounts[d.discipulador] = (mestreCounts[d.discipulador] || 0) + 1; });
    const discList = Object.keys(mestreCounts).map(k => ({ nome: k, discipulos: mestreCounts[k] })).sort((a, b) => b.discipulos - a.discipulos);

    return {
        stats: { totalMembros, ativos, visitantes, totalCelulas, totalDiscipuladores, membrosLocalidade },
        charts: {
            growth: growthData,
            demographics: Object.entries(demoCounts).map(([name, value]) => ({ 
                name, value, percent: ((value / (ativos || 1)) * 100).toFixed(1), fill: demoColors[name] || '#9ca3af' 
            })).sort((a, b) => b.value - a.value),
            pyramid: Object.values(pyramidMap),
            groups: groupsList,
            sectors: Object.values(sectorCounts).sort((a: any, b: any) => b.membros - a.membros),
            discipuladores: discList
        }
    };
  }, [isLoading, rawMembros, rawCelulas, rawDiscipulado, filterGender, filterGroup, filterDisc]);

  const handleOpenModal = async (type: 'grupo' | 'setor' | 'discipulador', title: string) => {
    setModalType(type); setModalTitle(title); setIsModalLoading(true);
    try {
      let dataResp: any[] = [];
      const discSet = new Set(rawDiscipulado.map(d => d.discipulador?.trim().toUpperCase()));
      if (type === 'grupo') {
        const { data } = await supabase.from('membros').select('nome, sexo, nascimento, tipo_cadastro').eq('grupos_caseiros', title);
        const cell = rawCelulas.find(c => c.grupo_caseiro === title);
        dataResp = (data || []).map(d => {
          const age = d.nascimento ? new Date().getFullYear() - new Date(d.nascimento).getFullYear() : '-';
          let role = 'Participante';
          if (cell?.lider === d.nome) role = 'Líder'; else if (cell?.auxiliar === d.nome) role = 'Auxiliar';
          return { col1: d.nome, col2: d.sexo || '-', col3: age, col4: role, col5: discSet.has(d.nome?.trim().toUpperCase()) ? 'Sim' : 'Não' };
        });
      } else if (type === 'setor') {
        const { data } = await supabase.from('celulas').select('grupo_caseiro, lider, auxiliar').eq('setor', title);
        dataResp = (data || []).map(d => ({ col1: d.grupo_caseiro, col2: d.lider || 'Sem Líder', col3: 'Grupo Caseiro', col4: 'Detalhar', isAction: true }));
      } else if (type === 'discipulador') {
        const { data } = await supabase.from('discipulado').select('discipulo, status, tipo').eq('discipulador', title);
        dataResp = (data || []).map(d => ({ col1: d.discipulo, col2: d.status || 'Ativo', col3: d.tipo || '-', col4: '-', col5: '-' }));
      }
      setModalItems(dataResp);
    } catch (e) { console.error(e); } finally { setIsModalLoading(false); }
  };

  const isPastorOrAdmin = ['pastor', 'admin', 'secretaria'].includes(user?.role || '');

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Visão Geral</h1>
          <p className="mt-2 flex items-baseline text-sm text-gray-500">
            Bem-vindo de volta, <span className="font-semibold text-primary-600 ml-1">{user?.name}</span>. Dados reais extraídos do Supabase.
          </p>
        </div>

        {isPastorOrAdmin && (
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div className="hidden md:block w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 transition-all duration-300" style={{ width: `${syncProgress}%` }} />
              </div>
            )}
            <button
              onClick={handleSync} disabled={isSyncing}
              className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all", isSyncing ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200")}
            >
              <TrendingUp className={clsx("w-4 h-4", isSyncing && "animate-bounce")} />
              {isSyncing ? `Atualizando ${Math.round(syncProgress)}%` : "Forçar Atualização"}
            </button>
          </div>
        )}
      </header>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center mb-6">
        <div className="flex items-center gap-2 text-gray-400 mr-2"><Search className="w-4 h-4" /><span className="text-xs font-bold uppercase tracking-wider">Filtros Rápidos:</span></div>
        <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50"><option value="Todos">Todos os Sexos</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 max-w-[200px]"><option value="Todos">Todos os Grupos</option>{rawCelulas.map(c => <option key={c.grupo_caseiro} value={c.grupo_caseiro}>{c.grupo_caseiro}</option>)}</select>
        <select value={filterDisc} onChange={e => setFilterDisc(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 max-w-[200px]"><option value="Todos">Todos os Discipuladores</option>{Array.from(new Set(rawDiscipulado.map(d => d.discipulador))).sort().map(d => <option key={d} value={d}>{d}</option>)}</select>
        <select value={filterMaritalStatus} onChange={e => setFilterMaritalStatus(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 max-w-[150px]"><option value="Todos">Estado Civil</option>{Array.from(new Set(rawMembros.map(m => m.estado_civil).filter(Boolean))).sort().map(s => <option key={s} value={s}>{s}</option>)}</select>
        
        <div className="flex items-center gap-2 bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-1">
           <span className="text-[10px] font-bold text-gray-400 uppercase">Idade:</span>
           <input type="number" value={filterMinAge} onChange={e => setFilterMinAge(parseInt(e.target.value) || 0)} className="w-12 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary-500" placeholder="Min" />
           <span className="text-gray-300">/</span>
           <input type="number" value={filterMaxAge} onChange={e => setFilterMaxAge(parseInt(e.target.value) || 120)} className="w-12 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary-500" placeholder="Max" />
        </div>

        {(filterGender !== 'Todos' || filterGroup !== 'Todos' || filterDisc !== 'Todos' || filterMinAge !== 0 || filterMaxAge !== 120 || filterMaritalStatus !== 'Todos') && (<button onClick={() => { setFilterGender('Todos'); setFilterGroup('Todos'); setFilterDisc('Todos'); setFilterMinAge(0); setFilterMaxAge(120); setFilterMaritalStatus('Todos'); }} className="text-xs text-red-600 font-medium hover:underline">Limpar Filtros</button>)}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total de Cadastros', value: dashboardData?.stats.totalMembros, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Membros Ativos', value: dashboardData?.stats.ativos, sub: 'Status: Ativo', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Membros Localidade', value: dashboardData?.stats.membrosLocalidade, icon: MapPin, color: 'text-pink-600', bg: 'bg-pink-50' },
          { label: 'Visitantes', value: dashboardData?.stats.visitantes, icon: UserPlus, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Grupos Caseiros', value: dashboardData?.stats.totalCelulas, icon: Home, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Discipuladores', value: dashboardData?.stats.totalDiscipuladores, icon: UserCheck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon || Users;
          return (
            <div key={idx} className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
              <div className="flex flex-col gap-3">
                <div className={clsx("flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110", kpi.bg)}><Icon className={clsx("h-5 w-5", kpi.color)} /></div>
                <div><p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</p><div className="flex items-baseline gap-2 mt-1"><p className="text-2xl font-bold text-gray-900">{kpi.value}</p></div>{kpi.sub && <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 mb-4 border-b border-gray-100 flex justify-between items-center"><h3 className="text-lg font-semibold leading-6 text-gray-900">Evolução da Base</h3></div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboardData?.charts.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient><linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} /><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /><Legend verticalAlign="top" height={36} iconType="circle" /><Area type="monotone" dataKey="entradas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEntradas)" name="Entradas" /><Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSaidas)" name="Saídas" /></AreaChart></ResponsiveContainer></div></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 mb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900">Demografia (Perfil)</h3></div><div className="flex-1 flex flex-col justify-center items-center relative"><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboardData?.charts.demographics} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{dashboardData?.charts.demographics.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12"><span className="text-2xl font-bold text-gray-900">{dashboardData?.stats.ativos}</span></div><div className="grid grid-cols-2 gap-2 w-full mt-4">{dashboardData?.charts.demographics.map((item: any, i: number) => (<div key={i} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }}></div><span className="text-[10px] font-medium text-gray-600 truncate">{item.name} ({item.percent}%)</span></div>))}</div></div></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 mb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900">Pirâmide Etária por Sexo</h3></div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData?.charts.pyramid} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'12px', border:'none'}} /><Legend /><Bar dataKey="masc" fill="#3b82f6" name="Masc" radius={[0, 4, 4, 0]} /><Bar dataKey="fem" fill="#ec4899" name="Fem" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>

      {isPastorOrAdmin && (
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="pb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><Home className="h-5 w-5 text-primary-500" /> Grupos Caseiros Ativos</h3><p className="mt-1 text-sm text-gray-500">Membros agrupados pela coluna [grupos_caseiros]</p></div>
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 mt-4"><thead className="bg-gray-50/50"><tr><th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo Caseiro</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Líder</th><th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Membros</th><th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{dashboardData?.charts.groups.slice(0, 10).map((group: any, idx: number) => (<tr key={idx} className="hover:bg-gray-50/50 transition-colors"><td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{group.nome}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">{group.lider}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-center font-bold text-gray-700"><span className="bg-primary-50 text-primary-700 py-1 px-3 rounded-full">{group.membros}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('grupo', group.nome)} className="text-primary-600 font-medium hover:underline text-xs outline-none">Ver Detalhes</button></td></tr>))}</tbody></table></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><Layers className="h-5 w-5 text-indigo-500" /> Setores</h3><p className="mt-1 text-sm text-gray-500">Agrupamento de células</p></div><div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 mt-4"><thead className="bg-gray-50/50"><tr><th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th><th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GCs</th><th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Membros</th><th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{dashboardData?.charts.sectors.map((setor: any, idx: number) => (<tr key={idx} className="hover:bg-gray-50/50"><td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{setor.nome}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-center"><span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-md font-bold">{setor.grupos}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-center"><span className="bg-indigo-50 text-indigo-600 py-1 px-2 rounded-md font-bold">{setor.membros}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('setor', setor.nome)} className="text-indigo-600 font-medium hover:underline text-xs">Acessar</button></td></tr>))}</tbody></table></div></div>
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><UserCheck className="h-5 w-5 text-emerald-500" /> Discipuladores Cadastrados</h3><p className="mt-1 text-sm text-gray-500">Rede de Discipulado Ativa</p></div><div className="overflow-x-auto max-h-[300px]"><table className="min-w-full divide-y divide-gray-200 mt-4"><thead className="bg-gray-50/50 sticky top-0"><tr><th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discipulador</th><th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Discípulos</th><th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{dashboardData?.charts.discipuladores.slice(0, 15).map((disc: any, idx: number) => (<tr key={idx} className="hover:bg-gray-50/50"><td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{disc.nome}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-center"><span className="bg-emerald-50 text-emerald-600 py-1 px-2 rounded-md font-bold">{disc.discipulos}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('discipulador', disc.nome)} className="text-emerald-600 font-medium hover:underline text-xs">Exibir Vidas</button></td></tr>))}</tbody></table></div></div>
          </div>
        </div>
      )}

      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setModalType(null)} />
          <div className="relative flex w-full max-w-2xl flex-col bg-white rounded-2xl shadow-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50"><div><h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3><p className="text-xs text-gray-500 mt-1">{modalItems.length} registros listados</p></div><button onClick={() => setModalType(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
            <div className="p-0 overflow-y-auto max-h-[60vh]">
              {isModalLoading ? (<div className="flex flex-col items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>) : modalItems.length === 0 ? (<div className="flex flex-col items-center justify-center p-12 text-center"><Search className="h-10 w-10 text-gray-300 mb-3" /><p className="text-gray-500 text-sm">Nenhum registro encontrado para {modalTitle}.</p></div>) : (
                <table className="min-w-full divide-y divide-gray-100"><thead className="bg-white sticky top-0"><tr><th className="py-3 pl-6 pr-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{modalType === 'setor' ? 'Grupo Caseiro' : 'Nome'}</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{modalType === 'grupo' ? 'Sexo' : modalType === 'setor' ? 'Líder' : 'Status'}</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{modalType === 'grupo' ? 'Idade' : 'Info'}</th>{modalType === 'grupo' && (<><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Função</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Disc.</th></>)}{modalType === 'setor' && <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Ação</th>}</tr></thead><tbody className="divide-y divide-gray-50">{modalItems.map((m, idx) => (<tr key={idx} className="hover:bg-gray-50/50"><td className="whitespace-nowrap py-3 pl-6 pr-3 text-sm font-medium text-gray-900">{m.col1}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">{m.col2}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 font-mono text-xs">{m.col3}</td>{modalType === 'grupo' && (<><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600"><span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase", m.col4 === 'Líder' ? 'bg-primary-50 text-primary-700' : m.col4 === 'Auxiliar' ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500')}>{m.col4}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600"><span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase", m.col5 === 'Sim' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500')}>{m.col5}</span></td></>)}{modalType === 'setor' && (<td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('grupo', m.col1)} className="text-primary-600 hover:underline text-xs font-bold uppercase tracking-tighter">Detalhar</button></td>)}</tr>))}</tbody></table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
