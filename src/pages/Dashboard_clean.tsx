import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Users, UserPlus, Home, TrendingUp, Loader2, X, Search, Layers, UserCheck } from 'lucide-react';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalMembros: 0,embrosAtivos: 0,totalVisitantes: 0,totalCelulas: 0,arrecadacaoMes: 0
  });

  const [charts, setCharts] = useState<any>({
    growth: [], demographics: [], finance: [], groups: [], sectors: [], discipuladores: []
  });
  
  // Modal State generic
  const [modalType, setModalType] = useState<any>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState<any[]>([]);
  const [isModalLoading, setIsModalLoading] = useState(false);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const parseProverDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [membrosRes, celulasRes, financeiroRes, discRes] = await Promise.all([
          supabase.from('membros').select('status, tipo_cadastro, nascimento, grupos_caseiros', { count: 'exact' }),
          supabase.from('celulas').select('grupo_caseiro, lider, setor'),
          supabase.from('financeiro').select('tipo, valor, data').order('data', { ascending: false }).limit(5000),
          supabase.from('discipulado').select('discipulador, discipulo, status')
        ]);

        const allMembros = membrosRes.data || [];
        const totalMembros = membrosRes.count || 0;
        const ativos = allMembros.filter(m => m.status === 'Ativo').length;
        const visitantes = allMembros.filter(m => m.tipo_cadastro === 'Visitante').length;
        
        const allCelulas = celulasRes.data || [];
        const totalCelulas = allCelulas.length;

        let sumEntradas = 0; let sumSaidas = 0;
        const monthlyFinance: Record<string, any> = {};
        financeiroRes.data?.forEach(item => {
          const val = Math.abs(parseFloat(item.valor)) || 0;
          const isEntrada = item.tipo.toLowerCase().includes('entrada');
          if (isEntrada) sumEntradas += val; else sumSaidas += val;
          const date = parseProverDate(item.data);
          const monthLabel = `${date.getMonth() + 1}/${date.getFullYear()}`;
          const sortKey = date.getFullYear() * 100 + date.getMonth();
          if (!monthlyFinance[monthLabel]) monthlyFinance[monthLabel] = { name: monthLabel, entradas: 0, saidas: 0, sortKey };
          if (isEntrada) monthlyFinance[monthLabel].entradas += val;
          else monthlyFinance[monthLabel].saidas += val;
        });

        const sortedFinanceChart = Object.values(monthlyFinance).sort((a: any, b: any) => a.sortKey - b.sortKey).slice(-6);

        const demoCounts = { 'Crian├ºas': 0, 'Jovens': 0, 'Adultos': 0, 'Idosos': 0 };
        const now = new Date();
        const grupoCounts: any = {};
        
        allMembros.forEach(m => {
          if (m.grupos_caseiros) {
            grupoCounts[m.grupos_caseiros] = (grupoCounts[m.grupos_caseiros] || 0) + 1;
          }
          if (m.nascimento) {
            const birth = new Date(m.nascimento);
            let age = now.getFullYear() - birth.getFullYear();
            if (isNaN(age)) age = 30;
            if (age < 12) demoCounts['Crian├ºas']++;
            else if (age < 25) demoCounts['Jovens']++;
            else if (age < 60) demoCounts['Adultos']++;
            else demoCounts['Idosos']++;
          } else {
            demoCounts['Adultos']++;
          }
        });

        const groupsList = allCelulas.map(c => ({
          nome: c.grupo_caseiro, lider: c.lider || 'Sem L├¡der', setor: c.setor || 'Sem Setor', membros: grupoCounts[c.grupo_caseiro] || 0
        })).sort((a,b) => b.membros - a.membros);

        const sectorCounts: any = {};
        groupsList.forEach(g => {
           if (!sectorCounts[g.setor]) sectorCounts[g.setor] = { nome: g.setor, grupos: 0, membros: 0 };
           sectorCounts[g.setor].grupos += 1;
           sectorCounts[g.setor].membros += g.membros;
        });
        const sectorsList = Object.values(sectorCounts).sort((a: any, b: any) => b.grupos - a.grupos);

        const discipuladoList = discRes.data || [];
        const mestreCounts: any = {};
        discipuladoList.forEach(d => {
           if (d.discipulador) mestreCounts[d.discipulador] = (mestreCounts[d.discipulador] || 0) + 1;
        });
        const discMestres = Object.keys(mestreCounts).map(k => ({ nome: k, discipulos: mestreCounts[k] })).sort((a,b) => b.discipulos - a.discipulos);

        setStats({
          totalMembros, membrosAtivos: ativos, totalVisitantes: visitantes, totalCelulas, arrecadacaoMes: sumEntradas / (sortedFinanceChart.length || 1),
        });

        setCharts({
          growth: [{ name: 'Total', membros: totalMembros, visitantes: visitantes }, { name: 'Ativos', membros: ativos, visitantes: 0 }],
          demographics: Object.entries(demoCounts).map(([name, value], i) => ({ name, value, fill: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'][i] })),
          finance: sortedFinanceChart,
          groups: groupsList,
          sectors: sectorsList,
          discipuladores: discMestres
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleOpenModal = async (type: 'grupo' | 'setor' | 'discipulador', title: string) => {
    setModalType(type);
    setModalTitle(title);
    setIsModalLoading(true);
    try {
      let dataResp: any[] = [];
      if (type === 'grupo') {
        const { data } = await supabase.from('membros').select('nome, tipo_cadastro, celular_principal_sms').eq('grupos_caseiros', title);
        dataResp = (data||[]).map(d => ({ col1: d.nome, col2: d.tipo_cadastro||'Membro', col3: d.celular_principal_sms||'-' }));
      } else if (type === 'setor') {
        const { data } = await supabase.from('celulas').select('grupo_caseiro, lider').eq('setor', title);
        dataResp = (data||[]).map(d => ({ col1: d.grupo_caseiro, col2: d.lider||'Sem L├¡der', col3: 'C├®lula' }));
      } else if (type === 'discipulador') {
        const { data } = await supabase.from('discipulado').select('discipulo, status, tipo').eq('discipulador', title);
        dataResp = (data||[]).map(d => ({ col1: d.discipulo, col2: d.status||'Ativo', col3: d.tipo||'-' }));
      }
      setModalItems(dataResp);
    } catch (e) {
        console.error(e);
    } finally {
        setIsModalLoading(false);
    }
  }

  const isPastorOrAdmin = ['pastor', 'admin'].includes(user?.role || '');

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Vis├úo Geral</h1>
        <p className="mt-2 flex items-baseline text-sm text-gray-500">
          Bem-vindo de volta, <span className="font-semibold text-primary-600 ml-1">{user?.name}</span>. Dados reais extra├¡dos do Supabase.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total de Membros', value: stats.totalMembros, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Membros Ativos', value: stats.membrosAtivos, sub: 'Status: Ativo', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Visitantes', value: stats.totalVisitantes, icon: UserPlus, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Grupos Caseiros', value: stats.totalCelulas, icon: Home, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-4">
                <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110", kpi.bg)}>
                  <Icon className={clsx("h-6 w-6", kpi.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                    {kpi.sub && <span className="text-xs text-gray-400">{kpi.sub}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Evolu├º├úo da Base</h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs><linearGradient id="colorMembros" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="membros" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembros)" name="Membros" />
                <Area type="monotone" dataKey="visitantes" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} name="Visitantes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Demografia</h3>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center relative">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.demographics} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {charts.demographics.map((entry:any, index:number) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
               <span className="text-3xl font-bold text-gray-900">{stats.totalMembros}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              {charts.demographics.map((item:any, i:number) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }}></div>
                  <span className="text-[10px] font-medium text-gray-600 truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isPastorOrAdmin && (
        <div className="grid grid-cols-1 gap-6 mt-6">
           {/* Top Groups Table */}
           <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><Home className="h-5 w-5 text-primary-500" /> Grupos Caseiros Ativos</h3>
                  <p className="mt-1 text-sm text-gray-500">Membros agrupados pela coluna [grupos_caseiros]</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200 mt-4">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">L├¡der</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Membros</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">A├º├úo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {charts.groups.slice(0, 10).map((group:any, idx:number) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                           <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{group.nome}</td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">{group.lider}</td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-center font-bold text-gray-700">
                              <span className="bg-primary-50 text-primary-700 py-1 px-3 rounded-full">{group.membros}</span>
                           </td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                              <button onClick={() => handleOpenModal('grupo', group.nome)} className="text-primary-600 font-medium hover:underline text-xs outline-none">
                                Ver Detalhes
                              </button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Setores Table */}
               <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
                  <div className="pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><Layers className="h-5 w-5 text-indigo-500" /> Setores</h3>
                    <p className="mt-1 text-sm text-gray-500">Agrupamento de c├®lulas</p>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="min-w-full divide-y divide-gray-200 mt-4">
                        <thead className="bg-gray-50/50">
                          <tr>
                            <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GCs</th>
                            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">A├º├úo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {charts.sectors.map((setor:any, idx:number) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                               <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{setor.nome}</td>
                               <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                                  <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-md font-bold">{setor.grupos}</span>
                               </td>
                               <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                                  <button onClick={() => handleOpenModal('setor', setor.nome)} className="text-indigo-600 font-medium hover:underline text-xs">Acessar</button>
                               </td>
                            </tr>
                          ))}
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Discipuladores Table */}
               <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
                  <div className="pb-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><UserCheck className="h-5 w-5 text-emerald-500" /> Discipuladores</h3>
                    <p className="mt-1 text-sm text-gray-500">Mestres cadastrados (MDA)</p>
                  </div>
                  <div className="overflow-x-auto max-h-[300px]">
                     <table className="min-w-full divide-y divide-gray-200 mt-4">
                        <thead className="bg-gray-50/50 sticky top-0">
                          <tr>
                            <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mestre</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Disc├¡pulos</th>
                            <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">A├º├úo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {charts.discipuladores.slice(0, 15).map((disc:any, idx:number) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                               <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{disc.nome}</td>
                               <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                                  <span className="bg-emerald-50 text-emerald-600 py-1 px-2 rounded-md font-bold">{disc.discipulos}</span>
                               </td>
                               <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                                  <button onClick={() => handleOpenModal('discipulador', disc.nome)} className="text-emerald-600 font-medium hover:underline text-xs">Exibir Vidas</button>
                               </td>
                            </tr>
                          ))}
                        </tbody>
                     </table>
                  </div>
               </div>
           </div>
        </div>
      )}

      {isPastorOrAdmin && (
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-gray-100 mt-6">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Hist├│rico Financeiro Real</h3>
                <p className="text-sm text-gray-500">Consolidado mensal de Entradas e Sa├¡das</p>
            </div>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.finance} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(v) => `R$${v/1000}k`} />
                    <Tooltip cursor={{fill: '#f8fafc'}} formatter={(v) => formatCurrency(v as number)} contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                    <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} name="Entradas" barSize={30} />
                    <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Sa├¡das" barSize={30} />
                </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      )}

      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setModalType(null)} />
          <div className="relative flex w-full max-w-2xl flex-col bg-white rounded-2xl shadow-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3>
                <p className="text-xs text-gray-500 mt-1">{modalItems.length} registros listados</p>
              </div>
              <button onClick={() => setModalType(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto max-h-[60vh]">
              {isModalLoading ? (
                <div className="flex flex-col items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>
              ) : modalItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Search className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">Nenhum registro encontrado para {modalTitle}.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="py-3 pl-6 pr-3 text-left text-xs font-medium text-gray-400 uppercase">
                        {modalType === 'setor' ? 'C├®lula' : 'Nome'}
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Atributo</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Complemento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {modalItems.map((m, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap py-3 pl-6 pr-3 text-sm font-medium text-gray-900">{m.col1}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">{m.col2}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 font-mono text-xs">{m.col3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
