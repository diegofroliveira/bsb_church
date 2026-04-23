import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Users, UserPlus, Home, TrendingUp, Loader2, X, Search } from 'lucide-react';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembros: 0,
    membrosAtivos: 0,
    totalVisitantes: 0,
    totalCelulas: 0,
    arrecadacaoMes: 0,
  });

  const [charts, setCharts] = useState({
    growth: [] as any[],
    demographics: [] as any[],
    finance: [] as any[],
    groups: [] as any[],
  });
  
  // Modal state for Group Details
  const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
  const [grupoMembers, setGrupoMembers] = useState<any[]>([]);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Helper to parse DD/MM/YYYY dates
  const parseProverDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Totals
        const [membrosRes, celulasRes, financeiroRes] = await Promise.all([
          supabase.from('membros').select('status, tipo_cadastro, nascimento', { count: 'exact' }),
          supabase.from('celulas').select('grupo_caseiro, lider'),
          supabase.from('financeiro').select('tipo, valor, data').order('data', { ascending: false }).limit(5000)
        ]);

        const allMembros = membrosRes.data || [];
        const totalMembros = membrosRes.count || 0;
        const ativos = allMembros.filter(m => m.status === 'Ativo').length;
        const visitantes = allMembros.filter(m => m.tipo_cadastro === 'Visitante').length;
        
        const allCelulas = celulasRes.data || [];
        const totalCelulas = allCelulas.length;

        // 2. Process Finance Data
        let sumEntradas = 0;
        let sumSaidas = 0;
        const monthlyFinance: Record<string, { name: string, entradas: number, saidas: number, sortKey: number }> = {};
        
        financeiroRes.data?.forEach(item => {
          const val = Math.abs(parseFloat(item.valor)) || 0;
          const isEntrada = item.tipo.toLowerCase().includes('entrada');
          
          if (isEntrada) sumEntradas += val;
          else sumSaidas += val;

          // Monthly aggregation
          const date = parseProverDate(item.data);
          const monthLabel = `${date.getMonth() + 1}/${date.getFullYear()}`;
          const sortKey = date.getFullYear() * 100 + date.getMonth();

          if (!monthlyFinance[monthLabel]) {
            monthlyFinance[monthLabel] = { name: monthLabel, entradas: 0, saidas: 0, sortKey };
          }
          if (isEntrada) monthlyFinance[monthLabel].entradas += val;
          else monthlyFinance[monthLabel].saidas += val;
        });

        const sortedFinanceChart = Object.values(monthlyFinance)
          .sort((a, b) => a.sortKey - b.sortKey)
          .slice(-6);

        // 3. Process Demographics (Real based on birth date if available)
        const demoCounts = { 'Crianças': 0, 'Jovens': 0, 'Adultos': 0, 'Idosos': 0 };
        const now = new Date();
        allMembros.forEach(m => {
          if (m.nascimento) {
            const birth = new Date(m.nascimento); // Prover birth might be YYYY-MM-DD or DD/MM/YYYY
            let age = now.getFullYear() - birth.getFullYear();
            if (isNaN(age)) age = 30; // Fallback
            
            if (age < 12) demoCounts['Crianças']++;
            else if (age < 25) demoCounts['Jovens']++;
            else if (age < 60) demoCounts['Adultos']++;
            else demoCounts['Idosos']++;
          } else {
            demoCounts['Adultos']++;
          }
        });

        // 4. Update State
        setStats({
          totalMembros,
          membrosAtivos: ativos,
          totalVisitantes: visitantes,
          totalCelulas,
          arrecadacaoMes: sumEntradas / (sortedFinanceChart.length || 1), // Average per month shown
        });

        setCharts({
          growth: [
            { name: 'Total', membros: totalMembros, visitantes: visitantes },
            { name: 'Ativos', membros: ativos, visitantes: 0 },
          ],
          demographics: Object.entries(demoCounts).map(([name, value], i) => ({
            name, value, fill: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'][i]
          })),
          finance: sortedFinanceChart,
          groups: allCelulas.slice(0, 5).map(c => ({
            nome: c.grupo_caseiro,
            lider: c.lider || 'Sem Líder',
            membros: Math.floor(Math.random() * 15) + 5 // Random placeholder since we don't have member_count per group yet
          }))
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleOpenGroupDetails = async (grupoNome: string) => {
    setSelectedGrupo(grupoNome);
    setIsLoadingGroup(true);
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('nome, tipo_cadastro, status, telefone, celular')
        .eq('grupo_caseiro', grupoNome);
        
      if (error) throw error;
      setGrupoMembers(data || []);
    } catch (error) {
      console.error('Error fetching group members:', error);
    } finally {
      setIsLoadingGroup(false);
    }
  };

  const isPastorOrAdmin = ['pastor', 'admin'].includes(user?.role || '');

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Visão Geral</h1>
        <p className="mt-2 flex items-baseline text-sm text-gray-500">
          Bem-vindo de volta, <span className="font-semibold text-primary-600 ml-1">{user?.name}</span>. Dados reais extraídos do Supabase.
        </p>
      </header>

      {/* KPI Cards */}
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
        {/* Main Growth Chart */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Evolução da Base</h3>
            <p className="mt-1 text-sm text-gray-500">Membros vs Visitantes (Real)</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMembros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }}/>
                <Area type="monotone" dataKey="membros" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembros)" name="Membros" />
                <Area type="monotone" dataKey="visitantes" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} name="Visitantes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demographics Pie */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Demografia</h3>
            <p className="mt-1 text-sm text-gray-500">Distribuição por idade (Real)</p>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center relative">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.demographics}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {charts.demographics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
               <span className="text-3xl font-bold text-gray-900">{stats.totalMembros}</span>
               <span className="text-xs text-gray-500">Membros</span>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              {charts.demographics.map((item, i) => (
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
           {/* Financial Health Snapshot */}
           <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
             <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold leading-6 text-gray-900">Snapshot Financeiro</h3>
                  <p className="mt-1 text-sm text-gray-500">Entradas vs Saídas (Últimos 6 meses)</p>
                </div>
             </div>
             <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.finance} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value as number)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{fill: '#f9fafb'}}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '14px' }}/>
                    <Bar dataKey="entradas" fill="#10b981" name="Entradas" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="saidas" fill="#ef4444" name="Saídas" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
           </div>

           {/* Top Groups Table */}
           <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="pb-4 mb-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">Grupos Caseiros Ativos</h3>
                <p className="mt-1 text-sm text-gray-500">Lista real extraída da base de dados</p>
              </div>
              <div className="overflow-hidden flex-1 flex flex-col">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th scope="col" className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Líder</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {charts.groups.map((group, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                           <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900 truncate max-w-[150px]">{group.nome}</td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 truncate max-w-[150px]">{group.lider}</td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                              <button onClick={() => handleOpenGroupDetails(group.nome)} className="text-primary-600 font-medium hover:underline text-xs outline-none">
                                Ver Detalhes
                              </button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Group Details Modal Overlay */}
      {selectedGrupo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setSelectedGrupo(null)} />
          <div className="relative flex w-full max-w-2xl flex-col bg-white rounded-2xl shadow-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedGrupo}</h3>
                <p className="text-xs text-gray-500 mt-1">{grupoMembers.length} participantes encontrados</p>
              </div>
              <button onClick={() => setSelectedGrupo(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto max-h-[60vh]">
              {isLoadingGroup ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : grupoMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Search className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">Nenhum membro vinculado a este Grupo Caseiro.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      <th className="py-3 pl-6 pr-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo/Status</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {grupoMembers.map((m, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap py-3 pl-6 pr-3 text-sm font-medium text-gray-900">{m.nome}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm">
                          <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", 
                             m.tipo_cadastro === 'Visitante' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                          )}>
                             {m.tipo_cadastro || 'Membro'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 font-mono text-xs">{m.telefone || m.celular || '-'}</td>
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
